// ============================================================================
// Weckrain Backend — Code.gs
// Version: 4.0.4
// Last updated: 2026-04-13
// Source of truth: /VERSIONS.json
// ============================================================================
// Fritz!Box Aktivitätsüberwachung via Google Apps Script
//
// Authentifizierung: MD5 Challenge-Response (AVM-Spezifikation)
// Sensorik: Energiezähler-Delta (kumulativ), Gmail-Push (Tür), CSV (Telefon)
// Alerting: Nur bei Inaktivität (>18h) oder Ausfall (>3h), mit Kontext-Historie
// Sicherheit: Dedizierter Nur-Lese-Benutzer, Passwort in Script Properties
// ============================================================================

// ─── VERSION ────────────────────────────────────────────────────────────────
// Diese Konstante wird bei jedem Code.gs-Release mit /VERSIONS.json synchron
// gehalten. Sie erscheint im JSON-API-Response als `version`-Feld, im
// Systemlog beim Setup und im täglichen Heartbeat-Eintrag.
var CODE_GS_VERSION = "4.0.4";

// ─── SENSOR-KONFIGURATION ────────────────────────────────────────────────────
// Setze einen Sensor auf false, wenn er nicht installiert oder dauerhaft
// defekt ist. Das Script ignoriert ihn dann komplett — kein Fehlalarm.
//
// Die Namen hier (wasserkocher, tv) entsprechen den tatsächlichen Geräten
// bei Mama. Die Suchbegriffe darunter matchen den Gerätenamen in der Fritz!Box.

var ENABLED_SENSORS = {
  wasserkocher: true, // FRITZ!DECT 200 — "Wasserkocher"
  tv: true, // FRITZ!DECT 200 — "Fernseher"
  tuer: true, // FRITZ!DECT 350 — "Haustür EG" (via Gmail Push)
  telefon: true, // Anrufliste der Fritz!Box
};

// Suchbegriffe für die Gerätenamen in der Fritz!Box (Kleinbuchstaben).
// Das Script sucht ob der Gerätename einen dieser Begriffe enthält.
var DEVICE_KEYWORDS = {
  wasserkocher: ["wasserkocher"],
  tv: ["fernseher", "fernseh"],
};

// ─── KONFIGURATION LESEN ────────────────────────────────────────────────────

/**
 * Liest einen Konfigurationswert aus dem Tab "Config" des Sheets.
 * Spalte A = Schlüssel, Spalte B = Wert. Keys werden getrimmt.
 */
function getConfig(key) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");
  var data = sheet.getRange("A:B").getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) {
      return String(data[i][1]).trim();
    }
  }
  throw new Error("Config-Schlüssel nicht gefunden: " + key);
}

/**
 * Liest einen numerischen Konfigurationswert mit Fallback-Default.
 */
function getConfigNumber(key, defaultValue) {
  try {
    var val = getConfig(key);
    var num = parseInt(val, 10);
    return isNaN(num) ? defaultValue : num;
  } catch (e) {
    return defaultValue;
  }
}

// ─── FRITZ!BOX AUTHENTIFIZIERUNG (MD5, gemäß AVM-Spezifikation) ─────────────

/**
 * Konvertiert einen String in ein UTF-16LE Byte-Array.
 * Gemäß AVM-Spezifikation: Zeichen mit Codepoint >255 werden durch '.' ersetzt.
 */
function stringToUtf16LE(str) {
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code > 255) {
      code = 0x2e; // '.' als Ersatz (AVM-Vorgabe)
    }
    bytes.push(code & 0xff); // Low Byte
    bytes.push((code >> 8) & 0xff); // High Byte
  }
  return bytes;
}

/**
 * Konvertiert ein Byte-Array (mit signierten Bytes von Utilities.computeDigest)
 * in einen Hex-String (lowercase).
 */
function bytesToHex(bytes) {
  return bytes
    .map(function (b) {
      // Utilities.computeDigest gibt signierte Bytes zurück (-128 bis 127)
      var unsigned = (b + 256) % 256;
      return ("0" + unsigned.toString(16)).slice(-2);
    })
    .join("");
}

/**
 * Berechnet die MD5 Challenge-Response gemäß AVM-Spezifikation.
 * 1. String "<challenge>-<password>" erstellen
 * 2. In UTF-16LE kodieren
 * 3. MD5-Hash berechnen
 * 4. Response: "<challenge>-<md5hex>"
 */
function calculateMD5Response(challenge, password) {
  var challengePassword = challenge + "-" + password;
  var utf16leBytes = stringToUtf16LE(challengePassword);
  var md5Bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    utf16leBytes,
  );
  var md5Hex = bytesToHex(md5Bytes);
  return challenge + "-" + md5Hex;
}

/**
 * Authentifiziert sich bei der Fritz!Box und gibt eine Session-ID (SID) zurück.
 *
 * WICHTIG: Wir rufen login_sid.lua OHNE ?version=2 auf, damit die Fritz!Box
 * den MD5-Modus verwendet (statt PBKDF2). MD5 ist in Google Apps Script
 * nativ unterstützt und performant.
 *
 * Der Benutzer "monitor_api" hat nur Leserechte auf Smart Home + Anrufliste.
 */
function getFritzBoxSID() {
  var baseUrl = getConfig("FRITZBOX_URL");
  var username = getConfig("FRITZBOX_USER");

  // Passwort aus Script Properties lesen (NICHT aus dem Sheet!)
  var password =
    PropertiesService.getScriptProperties().getProperty("FRITZBOX_PASS");
  if (!password) {
    throw new Error(
      "FRITZBOX_PASS nicht in den Skripteigenschaften hinterlegt. " +
        "Bitte im Apps Script Editor unter Projekteinstellungen → Skripteigenschaften eintragen.",
    );
  }

  // Schritt 1: Challenge holen
  var response = UrlFetchApp.fetch(baseUrl + "/login_sid.lua", {
    muteHttpExceptions: true,
    validateHttpsCertificates: false, // Fritz!Box nutzt ggf. selbstsignierte Zertifikate
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(
      "Fritz!Box nicht erreichbar (HTTP " + response.getResponseCode() + ")",
    );
  }

  var xml = response.getContentText();
  var challenge = extractXmlValue(xml, "Challenge");
  var blockTime = parseInt(extractXmlValue(xml, "BlockTime") || "0", 10);

  // PBKDF2-Challenge erkennen und abfangen
  if (challenge && challenge.indexOf("2$") === 0) {
    throw new Error(
      "Fritz!Box sendet PBKDF2-Challenge. Bitte login_sid.lua ohne ?version=2 aufrufen. " +
        "Falls dieses Problem bestehen bleibt, prüfe die FRITZBOX_URL in der Config.",
    );
  }

  // BlockTime abwarten (Brute-Force-Schutz der Fritz!Box)
  if (blockTime > 0) {
    Utilities.sleep(Math.min(blockTime * 1000, 30000)); // Max 30 Sekunden
  }

  // Schritt 2: MD5 Response berechnen
  var challengeResponse = calculateMD5Response(challenge, password);

  // Schritt 3: Login durchführen
  var loginResponse = UrlFetchApp.fetch(baseUrl + "/login_sid.lua", {
    method: "post",
    payload: {
      username: username,
      response: challengeResponse,
    },
    muteHttpExceptions: true,
    validateHttpsCertificates: false,
  });

  var sid = extractXmlValue(loginResponse.getContentText(), "SID");

  if (!sid || sid === "0000000000000000") {
    throw new Error(
      "Login fehlgeschlagen — falscher Benutzername oder Passwort. " +
        "Prüfe FRITZBOX_USER im Config-Tab und FRITZBOX_PASS in den Skripteigenschaften.",
    );
  }

  return sid;
}

/**
 * Einfacher XML-Value-Extraktor.
 * Extrahiert den Textinhalt des ersten Tags mit dem gegebenen Namen.
 */
function extractXmlValue(xml, tagName) {
  var openTag = "<" + tagName + ">";
  var closeTag = "</" + tagName + ">";
  var startIndex = xml.indexOf(openTag);
  if (startIndex === -1) return null;
  startIndex += openTag.length;
  var endIndex = xml.indexOf(closeTag, startIndex);
  if (endIndex === -1) return null;
  return xml.substring(startIndex, endIndex).trim();
}

// ─── SMART HOME ABFRAGE (Energiezähler-Delta + DECT-Präsenz) ───────────────

/**
 * Fragt alle Smart-Home-Geräte über das AHA-HTTP-Interface ab.
 *
 * Statt momentaner Wattwerte nutzen wir den kumulativen Energiezähler (<energy>
 * in Wh). Indem wir den Wert mit dem des letzten Polls vergleichen, erkennen
 * wir JEDEN Verbrauch zwischen den Polls — auch wenn das Gerät längst wieder
 * aus ist. Das löst das "30-Minuten-Blindflug"-Problem.
 *
 * Zusätzlich prüfen wir den <present>-Tag: Ist das DECT-Gerät erreichbar?
 * Falls nicht (dicke Wände, Batterie leer, Steckdose gezogen), loggen wir
 * "OFFLINE" statt fälschlich "keine Aktivität".
 *
 * RETRY-LOGIK: Google Apps Script routet jeden UrlFetchApp.fetch() potenziell
 * über eine andere IP. Die Fritz!Box kann die SID an die Quell-IP binden —
 * wenn Login über IP-A lief, aber die AHA-Abfrage über IP-B kommt, gibt es
 * HTTP 403. Lösung: Bei 403 neuen Login durchführen und erneut versuchen.
 * Gibt ein Objekt zurück: { devices: ..., sid: <aktuelle SID> }
 */
function querySmartHomeDevices(sid) {
  var baseUrl = getConfig("FRITZBOX_URL");
  var maxRetries = 5; // 6 Versuche — nötig wegen Google-IP-Rotation vs. Fritz!Box-SID-Binding

  for (var attempt = 0; attempt <= maxRetries; attempt++) {
    var url =
      baseUrl +
      "/webservices/homeautoswitch.lua?switchcmd=getdevicelistinfos&sid=" +
      sid;

    var response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      validateHttpsCertificates: false,
    });

    if (response.getResponseCode() === 200) {
      var xml = response.getContentText();
      return { devices: parseDeviceList(xml), sid: sid };
    }

    // Bei 403: Neuen Login versuchen (IP-Rotation-Workaround)
    // Kein Log hier — RETRY ist erwartetes Verhalten bei Kabel-Internet (SID/IP-Binding)
    if (response.getResponseCode() === 403 && attempt < maxRetries) {
      Utilities.sleep(1000); // Kurz warten
      sid = getFritzBoxSID(); // Frischer Login
      continue;
    }

    throw new Error(
      "AHA-HTTP-Abfrage fehlgeschlagen (HTTP " +
        response.getResponseCode() +
        ") nach " +
        (attempt + 1) +
        " Versuch(en)",
    );
  }
}

/**
 * Parst die XML-Geräteliste und extrahiert relevante Daten.
 *
 * Für jedes Gerät:
 * - Prüft <present>0/1</present> → DECT-Verbindungsstatus
 * - Liest <energy> (kumulativer Verbrauch in Wh)
 * - Vergleicht mit gespeichertem Wert des letzten Polls (Delta)
 * - Status: "AKTIV" (Delta >= 2 Wh), "RUHE" (Delta < 2 Wh), "OFFLINE" (nicht erreichbar)
 * - Schwellenwert 2 Wh filtert Standby-Verbrauch zuverlässig raus
 */
function parseDeviceList(xml) {
  var devices = {
    wasserkocherStatus: "N/A",
    tvStatus: "N/A",
    wasserkocherAktiv: false,
    tvAktiv: false,
  };

  if (!ENABLED_SENSORS.wasserkocher && !ENABLED_SENSORS.tv) {
    return devices; // Keine Steckdosen-Sensoren aktiv
  }

  var props = PropertiesService.getScriptProperties();

  // Alle <device>-Blöcke extrahieren
  var deviceBlocks = [];
  var searchFrom = 0;
  while (true) {
    var start = xml.indexOf("<device ", searchFrom);
    if (start === -1) break;
    var end = xml.indexOf("</device>", start);
    if (end === -1) break;
    end += "</device>".length;
    deviceBlocks.push(xml.substring(start, end));
    searchFrom = end;
  }

  for (var i = 0; i < deviceBlocks.length; i++) {
    var block = deviceBlocks[i];
    var name = extractXmlValue(block, "name");
    if (!name) continue;
    var nameLower = name.toLowerCase();
    var present = extractXmlValue(block, "present");

    // ── Wasserkocher (FRITZ!DECT 200) ──
    if (
      ENABLED_SENSORS.wasserkocher &&
      matchesKeywords(nameLower, DEVICE_KEYWORDS.wasserkocher)
    ) {
      if (present === "0") {
        devices.wasserkocherStatus = "OFFLINE";
      } else {
        var energyStr = extractXmlValue(block, "energy");
        if (energyStr !== null) {
          var wkWh = parseInt(energyStr, 10);
          var lastWk = props.getProperty("lastWasserkocherEnergy");
          if (lastWk !== null) {
            var delta = wkWh - parseInt(lastWk, 10);
            if (delta >= 2) {
              // Schwellenwert: 2 Wh filtert Standby-Rauschen
              devices.wasserkocherAktiv = true;
              devices.wasserkocherStatus = "AKTIV";
            } else {
              devices.wasserkocherStatus = "RUHE";
            }
          } else {
            devices.wasserkocherStatus = "RUHE"; // Erster Poll — kein Vergleichswert
          }
          props.setProperty("lastWasserkocherEnergy", String(wkWh));
        }
      }
    }

    // ── Fernseher (FRITZ!DECT 200) ──
    if (ENABLED_SENSORS.tv && matchesKeywords(nameLower, DEVICE_KEYWORDS.tv)) {
      if (present === "0") {
        devices.tvStatus = "OFFLINE";
      } else {
        var tvEnergyStr = extractXmlValue(block, "energy");
        if (tvEnergyStr !== null) {
          var tvWh = parseInt(tvEnergyStr, 10);
          var lastTv = props.getProperty("lastTvEnergy");
          if (lastTv !== null) {
            var tvDelta = tvWh - parseInt(lastTv, 10);
            if (tvDelta >= 2) {
              // Schwellenwert: 2 Wh filtert Standby-Rauschen
              devices.tvAktiv = true;
              devices.tvStatus = "AKTIV";
            } else {
              devices.tvStatus = "RUHE";
            }
          } else {
            devices.tvStatus = "RUHE";
          }
          props.setProperty("lastTvEnergy", String(tvWh));
        }
      }
    }
  }

  return devices;
}

/**
 * Prüft ob ein Gerätename eines der Suchbegriffe enthält.
 */
function matchesKeywords(nameLower, keywords) {
  for (var k = 0; k < keywords.length; k++) {
    if (nameLower.indexOf(keywords[k]) !== -1) return true;
  }
  return false;
}

// ─── HAUSTÜR VIA GMAIL (Fritz!Box Push-Service) ─────────────────────────────

/**
 * Prüft via Gmail, ob die Fritz!Box eine Push-Mail für die Haustür gesendet hat.
 *
 * Die Fritz!Box sendet bei JEDEM Schaltvorgang der Tür eine E-Mail.
 * Das Script prüft, ob seit dem letzten Poll solche Mails eingegangen sind.
 * Verarbeitete Mails werden in den Papierkorb verschoben (verhindert volles Postfach).
 *
 * Voraussetzung: Fritz!Box Push-Service für den Türsensor eingerichtet
 * (siehe Phase 1, Schritt 1.3).
 */
function checkDoorViaGmail() {
  if (!ENABLED_SENSORS.tuer) return { status: "N/A", aktiv: false };

  try {
    var props = PropertiesService.getScriptProperties();
    var lastPollStr = props.getProperty("lastSuccessfulPoll");
    var lastPoll = lastPollStr
      ? new Date(lastPollStr)
      : new Date(Date.now() - 30 * 60 * 1000);

    // Gmail nach Fritz!Box Alarm-Mails für die Haustür durchsuchen
    // Fritz!Box sendet Emails mit Betreff wie "Haustür EG Alarm aktiv"
    // → Wir suchen nach Tür-Keywords im Subject (NICHT "FRITZ" — das steht nur im Absender)
    var afterEpoch = Math.floor(lastPoll.getTime() / 1000);
    var searchQuery =
      'subject:(Haustür OR Haustuer OR "Haustuer EG" OR Türkontakt OR Tuerkontakt ' +
      'OR "DECT 350") after:' +
      afterEpoch;

    var threads = GmailApp.search(searchQuery, 0, 10);

    if (threads.length === 0) {
      return { status: "RUHE", aktiv: false };
    }

    // Prüfe ob mindestens eine Mail tatsächlich NACH dem letzten Poll kam
    var found = false;
    for (var i = 0; i < threads.length; i++) {
      var messages = threads[i].getMessages();
      for (var j = 0; j < messages.length; j++) {
        if (messages[j].getDate() > lastPoll) {
          found = true;
          break;
        }
      }
      // Verarbeitete Threads aufräumen (verhindert volles Postfach über Monate)
      if (found) {
        threads[i].moveToTrash();
      }
    }

    if (found) {
      return { status: "AKTIV", aktiv: true };
    }
    return { status: "RUHE", aktiv: false };
  } catch (e) {
    logSystem("WARNUNG", "Gmail-Türprüfung fehlgeschlagen: " + e.message);
    return { status: "FEHLER", aktiv: false };
  }
}

// ─── ANRUFLISTE (CSV-Export) ────────────────────────────────────────────────

/**
 * Fragt die Anrufliste der Fritz!Box ab (CSV-Export).
 * Gibt zurück, ob seit dem letzten Poll ein Telefonat GEFÜHRT wurde.
 *
 * Anruftypen in der CSV:
 * 1 = Eingehend angenommen, 2 = Verpasst, 3 = Ausgehend, 4 = Aktiv
 * Wir zählen Typ 1 und 3 als "Telefonat geführt".
 */
function checkPhoneActivity(sid) {
  if (!ENABLED_SENSORS.telefon)
    return { status: "N/A", aktiv: false, sid: sid };

  try {
    var baseUrl = getConfig("FRITZBOX_URL");
    var maxRetries = 5; // 6 Versuche — analog zu Smart-Home-Abfrage
    var csv = null;

    // Retry-Logik wie bei Smart Home (IP-Rotation-Workaround)
    for (var attempt = 0; attempt <= maxRetries; attempt++) {
      var url =
        baseUrl +
        "/fon_num/foncalls_list.lua?sid=" +
        sid +
        "&csv=&type=all&max=20";

      var response = UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        validateHttpsCertificates: false,
      });

      if (response.getResponseCode() === 200) {
        csv = response.getContentText("UTF-8");
        break;
      }

      // Bei 403: Neuen Login versuchen (IP-Rotation-Workaround, kein Log nötig)
      if (response.getResponseCode() === 403 && attempt < maxRetries) {
        Utilities.sleep(1000);
        sid = getFritzBoxSID();
        continue;
      }

      logSystem(
        "WARNUNG",
        "Anrufliste HTTP " +
          response.getResponseCode() +
          " nach " +
          (attempt + 1) +
          " Versuch(en)",
      );
      return { status: "FEHLER", aktiv: false, sid: sid };
    }

    var lines = csv.split("\n");

    var props = PropertiesService.getScriptProperties();
    var lastPollStr = props.getProperty("lastSuccessfulPoll");
    var lastPoll = lastPollStr
      ? new Date(lastPollStr)
      : new Date(Date.now() - 30 * 60 * 1000);

    // ── Separator auto-detection via "sep=<char>" Präambel ──
    // Fritz!OS liefert den Web-UI-Export mit Semikolon (sep=;), manche
    // Versionen mit Tab. Defensiv: den Separator aus der ersten Zeile
    // lesen statt hartkodieren.
    var separator = ";";
    var dataStart = 1;
    if (lines.length > 0 && lines[0].indexOf("sep=") === 0) {
      var sepChar = lines[0].substring(4).trim();
      if (sepChar === "\\t") separator = "\t";
      else if (sepChar && sepChar.length === 1) separator = sepChar;
      dataStart = 2;
    }

    // ── CSV-Datenzeilen verarbeiten ──
    // Spalten-Layout (Fritz!OS 8.x):
    //   0: Typ
    //   1: Datum (DD.MM.YY HH:MM)
    //   2: Name
    //   3: Rufnummer
    //   4: Landes-/Ortsnetzbereich
    //   5: Nebenstelle
    //   6: Eigene Rufnummer
    //   7: Dauer (H:MM, minuten-aufgerundet)
    //
    // Typ-Codes bei foncalls_list.lua?csv= (Web-UI-URL, NICHT TR-064!):
    //   1 = CALLIN   — eingehend angenommen (Hörer wurde abgenommen)
    //   2 = CALLFAIL — nicht zustande gekommen (verpasst, abgelehnt,
    //                  ausgehend ohne Antwort) → niemals zählen
    //   4 = CALLOUT  — ausgehend erfolgreich verbunden
    //
    // Filter-Kriterium: Alle erfolgreich verbundenen Gespräche (Typ 1, 3, 4).
    //
    // Typ-Codes — defensive Abdeckung beider Fritz!OS-Generationen:
    //   1 = CALLIN   — eingehend angenommen
    //   3 = CALLOUT  — ausgehend (TR-064-Semantik, ältere Fritz!OS-Versionen)
    //   4 = CALLOUT  — ausgehend (Web-UI-Semantik, neuere Fritz!OS-Versionen)
    //   2 = CALLFAIL — nie zählen (verpasst / nicht zustande gekommen)
    //
    // Warum ["1","3","4"] statt nur ["1","4"]:
    //   Die empirische Verifikation in 4.0.1 bestätigte Typ 4 im Web-UI-Export.
    //   In der Praxis tauchen aber weiterhin fehlende Erkennungen auf — manche
    //   Fritz!OS-Versionen oder Anruf-Konstellationen liefern Typ 3 statt 4.
    //   Belt-and-suspenders: alle Nicht-CALLFAIL-Typen abdecken.
    //
    // Dauer-Filter: MIN_DURATION_MINUTES = 0 (jede Verbindung zählt).
    //   Kein Anrufbeantworter vorhanden → kein AB-Noise-Risiko.
    //   Primärziel ist Lebenszeichen-Erkennung, nicht Gesprächslänge.
    //   (Typ 2 / CALLFAIL werden über den Typ-Filter bereits ausgeschlossen.)
    //
    // Siehe docs/KNOWN_ISSUES.md Issue 1 für Hintergrund und Quellen.
    var TYPES_ANSWERED = ["1", "3", "4"];
    var MIN_DURATION_MINUTES = 0;

    // Ablehnungsprotokoll für Diagnose-Logging im RUHE-Fall
    var rejections = [];

    for (var i = dataStart; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var fields = line.split(separator);
      if (fields.length < 8) {
        rejections.push("Z" + (i - dataStart + 1) + ":felder=" + fields.length);
        continue;
      }

      var typ = fields[0].trim();
      if (TYPES_ANSWERED.indexOf(typ) === -1) {
        rejections.push("Z" + (i - dataStart + 1) + ":typ" + typ);
        continue;
      }

      var dauerStr = fields[7].trim();
      var dauerMinuten = parseDurationMinutes(dauerStr);
      if (dauerMinuten < MIN_DURATION_MINUTES) {
        rejections.push("Z" + (i - dataStart + 1) + ":dur" + dauerStr);
        continue;
      }

      var callDate = parseFritzDate(fields[1].trim());
      if (!callDate) {
        rejections.push("Z" + (i - dataStart + 1) + ":datum?");
        continue;
      }

      if (callDate > lastPoll) {
        logSystem(
          "TEL",
          "AKTIV: typ=" + typ +
            " " + fields[1].trim() +
            " dauer=" + dauerStr +
            " callDate=" + callDate.toISOString().substring(0, 16) +
            " lastPoll=" + lastPoll.toISOString().substring(0, 16),
        );
        return { status: "AKTIV", aktiv: true, sid: sid };
      }

      rejections.push("Z" + (i - dataStart + 1) + ":" + fields[1].trim() + "<=poll");
    }

    logSystem(
      "TEL",
      "RUHE: sep='" + separator + "'" +
        " daten=" + (lines.length - dataStart) +
        " lastPoll=" + lastPoll.toISOString().substring(0, 16) +
        (rejections.length > 0
          ? " rej=[" + rejections.slice(0, 10).join(", ") + "]" + (rejections.length > 10 ? "…" : "")
          : " (leere Liste)"),
    );

    return { status: "RUHE", aktiv: false, sid: sid };
  } catch (e) {
    logSystem(
      "WARNUNG",
      "Anrufliste konnte nicht abgerufen werden: " + e.message,
    );
    return { status: "FEHLER", aktiv: false, sid: sid };
  }
}

/**
 * Parst ein Fritz!Box-Datum im Format "DD.MM.YY HH:MM" in ein Date-Objekt.
 */
function parseFritzDate(str) {
  try {
    var parts = str.split(" ");
    if (parts.length < 2) return null;
    var dateParts = parts[0].split(".");
    var timeParts = parts[1].split(":");
    var year = parseInt(dateParts[2], 10);
    if (year < 100) year += 2000;
    return new Date(
      year,
      parseInt(dateParts[1], 10) - 1,
      parseInt(dateParts[0], 10),
      parseInt(timeParts[0], 10),
      parseInt(timeParts[1], 10),
    );
  } catch (e) {
    return null;
  }
}

/**
 * Parst die Dauer-Spalte der Fritz!Box-Anrufliste ("H:MM"-Format mit
 * Minuten-Aufrundung) und gibt die Dauer in Minuten zurück.
 *
 * AVM-Semantik (TR-064 + foncalls_list.lua?csv=, Fritz!OS 8.x):
 *   "0:00" = Anruf kam nicht zustande (CALLFAIL)           →   0 Minuten
 *   "0:01" = Anruf < 1 Minute ("< 1 Min" in Web-UI)        →   1 Minute
 *   "0:50" = 50 Minuten                                    →  50 Minuten
 *   "1:35" = 1 Stunde 35 Minuten                           →  95 Minuten
 *
 * Das CSV-Feld enthält grundsätzlich NUR Stunden und Minuten — keine
 * Sekunden-Auflösung. Sehr kurze Anrufe werden als "0:01" abgespeichert.
 *
 * Quelle: AVM TR-064 Spec (X_AVM-DE_OnTel Calllist) und Community-
 * Verifikation — siehe docs/KNOWN_ISSUES.md Issue 1.
 */
function parseDurationMinutes(str) {
  if (!str) return 0;
  var parts = String(str).split(":");
  if (parts.length !== 2) return 0;
  var hours = parseInt(parts[0], 10);
  var minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

// ─── GOOGLE SHEET LOGGING ───────────────────────────────────────────────────

/**
 * Schreibt eine Datenzeile in den "Log"-Tab.
 * Status-Werte pro Sensor: AKTIV / RUHE / OFFLINE / N/A / FEHLER
 */
function logData(devices, tuerResult, telefonResult, notiz) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Log");

  var irgendwasAktiv =
    devices.wasserkocherAktiv ||
    devices.tvAktiv ||
    tuerResult.aktiv ||
    telefonResult.aktiv;

  sheet.appendRow([
    new Date(),
    devices.wasserkocherStatus,
    devices.tvStatus,
    tuerResult.status,
    telefonResult.status,
    irgendwasAktiv ? "JA" : "NEIN",
    notiz || "",
  ]);

  return irgendwasAktiv;
}

/**
 * Schreibt einen Eintrag in den "Systemlog"-Tab.
 */
function logSystem(typ, nachricht) {
  try {
    var sheet =
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Systemlog");
    sheet.appendRow([new Date(), typ, nachricht]);
  } catch (e) {
    Logger.log("Systemlog-Fehler: " + e.message);
  }
}

// ─── AKTIVITÄTSANALYSE ──────────────────────────────────────────────────────

/**
 * Prüft, ob in den letzten X Stunden irgendeine Aktivität im Log steht.
 * Liest die "Aktivitaet_erkannt"-Spalte (F) rückwärts durch.
 */
function hatAktivitaetInLetztenStunden(stunden) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Log");
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return true; // Keine Daten → kein Alarm (noch zu früh)

  var cutoff = new Date(Date.now() - stunden * 60 * 60 * 1000);

  // Nur die letzten ~50 Zeilen prüfen (18h ÷ 30min = 36 Polls + Puffer)
  var startRow = Math.max(2, lastRow - 50);
  var numRows = lastRow - startRow + 1;
  var range = sheet.getRange(startRow, 1, numRows, 6); // Spalten A-F
  var values = range.getValues();

  for (var i = values.length - 1; i >= 0; i--) {
    var timestamp = values[i][0];
    if (!(timestamp instanceof Date)) continue;
    if (timestamp < cutoff) break; // Älter als Cutoff → aufhören

    var aktiv = values[i][5]; // Spalte F = "Aktivitaet_erkannt"
    if (aktiv === "JA") {
      return true;
    }
  }

  return false;
}

// ─── KONTEXT-HISTORIE FÜR ALARM-MAILS ───────────────────────────────────────

/**
 * Erstellt eine lesbare Tabelle der letzten 10 Log-Einträge.
 * Wird in Alarm-E-Mails eingebettet für sofortigen Kontext.
 */
function getRecentHistory() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Log");
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return "Noch keine Historie vorhanden.";

  var startRow = Math.max(2, lastRow - 9);
  var numRows = lastRow - startRow + 1;
  var data = sheet.getRange(startRow, 1, numRows, 6).getValues();

  var text = "LETZTE " + numRows + " ABFRAGEN:\n";
  text += "Zeitpunkt        | Wkocher | TV      | Tür     | Telefon | Aktiv?\n";
  text += "─────────────────+─────────+─────────+─────────+─────────+───────\n";

  for (var i = 0; i < data.length; i++) {
    var ts = data[i][0];
    var timeStr =
      ts instanceof Date
        ? Utilities.formatDate(ts, "Europe/Berlin", "dd.MM. HH:mm")
        : "??";
    text +=
      padRight(timeStr, 17) +
      "| " +
      padRight(String(data[i][1]), 8) +
      "| " +
      padRight(String(data[i][2]), 8) +
      "| " +
      padRight(String(data[i][3]), 8) +
      "| " +
      padRight(String(data[i][4]), 8) +
      "| " +
      String(data[i][5]) +
      "\n";
  }

  return text;
}

function padRight(str, len) {
  while (str.length < len) str += " ";
  return str;
}

// ─── ALERTING ───────────────────────────────────────────────────────────────

/**
 * Sendet eine Alert-E-Mail mit Kontext-Historie.
 */
function sendAlert(betreff, nachricht) {
  var email = getConfig("ALERT_EMAIL");
  var sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  MailApp.sendEmail({
    to: email,
    subject: "[Weckrain Check] " + betreff,
    body:
      nachricht +
      "\n\n───────────────────────────────────────\n" +
      getRecentHistory() +
      "\n───────────────────────────────────────\n" +
      "Google Sheet: " +
      sheetUrl +
      "\n\nDiese E-Mail wurde automatisch von deinem Weckrain Check gesendet.",
  });
  logSystem("ALERT", betreff);
}

// ─── DEAD MAN'S SWITCH (HEALTHCHECKS.IO) ────────────────────────────────────

/**
 * Sendet einen Heartbeat-Ping an Healthchecks.io.
 * - success=true → normaler Ping ("Ich lebe, alles OK")
 * - success=false → /fail-Endpunkt ("Ich lebe, aber Fritz!Box nicht erreichbar")
 * - kein Ping → Healthchecks.io erkennt Ausfall nach Grace Period
 */
function sendHeartbeat(success) {
  try {
    var healthcheckUrl;
    try {
      healthcheckUrl = getConfig("HEALTHCHECK_URL");
    } catch (e) {
      return; // Nicht konfiguriert — still ignorieren
    }

    if (!healthcheckUrl || healthcheckUrl.indexOf("http") !== 0) {
      return;
    }

    var url = success ? healthcheckUrl : healthcheckUrl + "/fail";
    UrlFetchApp.fetch(url, {
      method: "get",
      muteHttpExceptions: true,
      validateHttpsCertificates: true,
    });
  } catch (e) {
    // Heartbeat-Fehler darf NIEMALS den Hauptprozess stören
    Logger.log("Heartbeat-Fehler (nicht kritisch): " + e.message);
  }
}

// ─── HAUPTLOGIK ─────────────────────────────────────────────────────────────

/**
 * HAUPTFUNKTION — Wird alle 30 Minuten durch einen Trigger aufgerufen.
 */
function pollFritzBox() {
  var props = PropertiesService.getScriptProperties();

  try {
    // ── 1. Fritz!Box kontaktieren ──
    var sid = getFritzBoxSID();

    // ── 2. Energiezähler abfragen (mit Delta + Präsenz-Check) ──
    //    Bei HTTP 403 (IP-Rotation) wird intern automatisch ein neuer Login
    //    durchgeführt. Die aktuelle SID wird im Ergebnis zurückgegeben.
    var smartHomeResult = querySmartHomeDevices(sid);
    var devices = smartHomeResult.devices;
    sid = smartHomeResult.sid; // Ggf. aktualisierte SID nach Retry

    // ── 3. Anrufliste prüfen ──
    var telefonResult = checkPhoneActivity(sid);
    sid = telefonResult.sid; // Ggf. aktualisierte SID nach Retry

    // ── 4. Session beenden ──
    try {
      UrlFetchApp.fetch(
        getConfig("FRITZBOX_URL") + "/login_sid.lua?logout=1&sid=" + sid,
        {
          muteHttpExceptions: true,
          validateHttpsCertificates: false,
        },
      );
    } catch (e) {
      /* Logout-Fehler ignorieren */
    }

    // ── 5. Haustür via Gmail prüfen ──
    var tuerResult = checkDoorViaGmail();

    // ── 6. Daten loggen ──
    var irgendwasAktiv = logData(devices, tuerResult, telefonResult, "");

    // ── 7. Ausfall-Recovery prüfen ──
    var consecutiveFailures = parseInt(
      props.getProperty("consecutiveFailures") || "0",
      10,
    );
    var outageAlertSent = props.getProperty("outageAlertSent") === "true";

    if (consecutiveFailures > 0 && outageAlertSent) {
      sendAlert(
        "Entwarnung — Fritz!Box wieder erreichbar",
        "Die Fritz!Box ist nach " +
          consecutiveFailures +
          " fehlgeschlagenen Versuchen (" +
          Math.round(consecutiveFailures * 30) +
          " Minuten) wieder erreichbar.\n\n" +
          "Aktueller Status:\n" +
          "  Wasserkocher: " +
          devices.wasserkocherStatus +
          "\n" +
          "  Fernseher: " +
          devices.tvStatus +
          "\n" +
          "  Haustür: " +
          tuerResult.status +
          "\n" +
          "  Telefon: " +
          telefonResult.status,
      );
    }

    // Fehlerzähler zurücksetzen
    props.setProperty("consecutiveFailures", "0");
    props.setProperty("outageAlertSent", "false");
    props.setProperty("lastSuccessfulPoll", new Date().toISOString());

    // ── 8. Inaktivität prüfen ──
    var inaktivStunden = getConfigNumber("INAKTIVITAET_STUNDEN", 18);
    var aktivitaetVorhanden = hatAktivitaetInLetztenStunden(inaktivStunden);
    var inactivityAlertSent =
      props.getProperty("inactivityAlertSent") === "true";

    if (!aktivitaetVorhanden && !inactivityAlertSent) {
      sendAlert(
        "Inaktivitätsalarm — Keine Aktivität seit " +
          inaktivStunden +
          "+ Stunden",
        "In den letzten " +
          inaktivStunden +
          " Stunden wurde KEINE Aktivität erkannt:\n\n" +
          "  - Wasserkocher: Kein Energieverbrauch (Zähler-Delta = 0)\n" +
          "  - Fernseher: Kein Energieverbrauch (Zähler-Delta = 0)\n" +
          "  - Haustür: Keine Push-Mail eingegangen\n" +
          "  - Telefon: Kein Gespräch in der Anrufliste\n\n" +
          "Bitte schau nach deiner Mutter.",
      );
      props.setProperty("inactivityAlertSent", "true");
    }

    if (aktivitaetVorhanden && inactivityAlertSent) {
      sendAlert(
        "Entwarnung — Aktivität erkannt",
        "Nach einer Phase der Inaktivität wurde wieder Aktivität erkannt.\n\n" +
          "Aktueller Status:\n" +
          "  Wasserkocher: " +
          devices.wasserkocherStatus +
          "\n" +
          "  Fernseher: " +
          devices.tvStatus +
          "\n" +
          "  Haustür: " +
          tuerResult.status +
          "\n" +
          "  Telefon: " +
          telefonResult.status,
      );
      props.setProperty("inactivityAlertSent", "false");
    }

    // ── 9a. Tägliches Version-Heartbeat ins Systemlog ──
    //       Einmal pro Tag (erster Poll nach Mitternacht) wird die aktuelle
    //       Code.gs-Version ins Systemlog geschrieben. So ist nach jedem
    //       Deploy in den Logs sichtbar, welche Version gerade läuft.
    var today = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd",
    );
    var lastHeartbeatDay = props.getProperty("lastHeartbeatDay");
    if (lastHeartbeatDay !== today) {
      logSystem("HEARTBEAT", "Code.gs v" + CODE_GS_VERSION + " läuft");
      props.setProperty("lastHeartbeatDay", today);
    }

    // ── 9b. Heartbeat (Dead Man's Switch) ──
    sendHeartbeat(true);

    // ── 10. Status-Anfragen per E-Mail beantworten ──
    checkStatusRequests();
  } catch (error) {
    // ── FEHLERBEHANDLUNG ──
    var failures =
      parseInt(props.getProperty("consecutiveFailures") || "0", 10) + 1;
    props.setProperty("consecutiveFailures", String(failures));
    logSystem(
      "FEHLER",
      "Poll #" + failures + " fehlgeschlagen: " + error.message,
    );

    var ausfallPolls = getConfigNumber("AUSFALL_POLLS", 6);
    var alreadyAlerted = props.getProperty("outageAlertSent") === "true";

    if (failures >= ausfallPolls && !alreadyAlerted) {
      var ausfallMinuten = failures * 30;
      sendAlert(
        "Ausfallalarm — Fritz!Box seit " +
          ausfallMinuten +
          " Minuten nicht erreichbar",
        "Die Fritz!Box deiner Mutter ist seit " +
          failures +
          " aufeinanderfolgenden Versuchen " +
          "(" +
          ausfallMinuten +
          " Minuten / " +
          (ausfallMinuten / 60).toFixed(1) +
          " Stunden) " +
          "nicht erreichbar.\n\n" +
          "Letzter Fehler: " +
          error.message +
          "\n\n" +
          "Mögliche Ursachen:\n" +
          "  - Internetausfall bei deiner Mutter\n" +
          "  - Fritz!Box-Neustart (z.B. nach Update)\n" +
          "  - Stromausfall\n" +
          "  - MyFRITZ!-Dienst vorübergehend gestört\n\n" +
          "Du bekommst automatisch eine Entwarnung, sobald die Verbindung wiederhergestellt ist.",
      );
      props.setProperty("outageAlertSent", "true");
    }

    // Heartbeat auch im Fehlerfall — Script läuft, nur Fritz!Box nicht erreichbar.
    // true = "ich lebe noch". Der Fritz!Box-Ausfall wird separat über den
    // eigenen Ausfallalarm (consecutiveFailures) behandelt.
    sendHeartbeat(true);
  }
}

// ─── STATUS-ABFRAGE PER E-MAIL ─────────────────────────────────────────────

/**
 * Prüft das Gmail-Postfach auf Status-Anfragen von autorisierten Absendern.
 *
 * Wer eine E-Mail (egal welcher Inhalt/Betreff) an weckrain.check@gmail.com
 * schickt und in der Config unter STATUS_EMAILS steht, bekommt automatisch
 * eine Antwort mit den letzten 10 Log-Einträgen.
 *
 * Läuft als Teil von pollFritzBox() alle 30 Minuten mit.
 * Mehrere autorisierte Absender: Kommagetrennt in STATUS_EMAILS eintragen.
 */
function checkStatusRequests() {
  try {
    // Autorisierte E-Mail-Adressen aus Config lesen
    var statusEmails = getConfig("STATUS_EMAILS");
    if (!statusEmails) return;

    var allowedSenders = statusEmails.split(",").map(function (e) {
      return e.trim().toLowerCase();
    });

    // Für jeden autorisierten Absender nach ungelesenen Mails suchen
    for (var s = 0; s < allowedSenders.length; s++) {
      var query = "is:unread from:" + allowedSenders[s];
      var threads = GmailApp.search(query, 0, 5);

      for (var t = 0; t < threads.length; t++) {
        var messages = threads[t].getMessages();
        var lastMessage = messages[messages.length - 1];

        // Status-Bericht zusammenbauen
        var historie = getRecentHistory();
        var props = PropertiesService.getScriptProperties();
        var lastPoll = props.getProperty("lastSuccessfulPoll") || "unbekannt";
        var failures = props.getProperty("consecutiveFailures") || "0";

        var body =
          "WECKRAIN CHECK — STATUS\n" +
          "═══════════════════════\n\n" +
          "Letzter erfolgreicher Poll: " +
          lastPoll +
          "\n" +
          "Aufeinanderfolgende Fehler: " +
          failures +
          "\n\n" +
          historie +
          "\n\n" +
          "---\n" +
          "Automatische Antwort von Weckrain Check.\n" +
          "Du kannst jederzeit eine Mail schicken, um den aktuellen Status abzurufen.";

        // Antwort senden
        lastMessage.reply(body);

        // Thread als gelesen markieren
        threads[t].markRead();
      }
    }
  } catch (e) {
    logSystem("WARNUNG", "Status-Abfrage-Check fehlgeschlagen: " + e.message);
  }
}

// ─── DASHBOARD — WEB APP ────────────────────────────────────────────────────

/**
 * Liest die letzten numDays Tage aus dem Log-Sheet und aggregiert sie
 * in das Dashboard-Format (pro Tag → 6 Zeitfenster → 4 Sensoren).
 * Rückgabe: Array von { date, slots: [{ slot, k, s, e, g }] }
 *   k/s/e/g: true (AKTIV), false (RUHE), "fehler", "offline", null (keine Daten)
 */
function getDashboardData(numDays) {
  numDays = numDays || 7;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Log");
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  var tz = Session.getScriptTimeZone();

  var now = new Date();
  var cutoff = new Date(now.getTime() - numDays * 24 * 60 * 60 * 1000);
  cutoff.setHours(0, 0, 0, 0);

  var days = {};

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var ts = new Date(row[0]);
    if (isNaN(ts.getTime()) || ts < cutoff) continue;

    var dateStr = Utilities.formatDate(ts, tz, "yyyy-MM-dd");
    var hour = parseInt(Utilities.formatDate(ts, tz, "HH"), 10);
    var slotIdx =
      hour < 4
        ? 0
        : hour < 8
          ? 1
          : hour < 12
            ? 2
            : hour < 14
              ? 3
              : hour < 18
                ? 4
                : 5;

    if (!days[dateStr]) {
      days[dateStr] = {};
      for (var s = 0; s < 6; s++) {
        days[dateStr][s] = [];
      }
    }

    days[dateStr][slotIdx].push({
      k: String(row[1]).trim(),
      s: String(row[2]).trim(),
      e: String(row[3]).trim(),
      g: String(row[4]).trim(),
    });
  }

  var slotNames = [
    "Nachts",
    "Morgens",
    "Vormittags",
    "Mittags",
    "Nachmittags",
    "Abends",
  ];
  var result = [];
  var dates = Object.keys(days).sort().reverse();

  for (var d = 0; d < Math.min(dates.length, numDays); d++) {
    var date = dates[d];
    var dayData = { date: date, slots: [] };

    for (var si = 0; si < 6; si++) {
      dayData.slots.push({
        slot: slotNames[si],
        k: aggregateSensor(days[date][si], "k"),
        s: aggregateSensor(days[date][si], "s"),
        e: aggregateSensor(days[date][si], "e"),
        g: aggregateSensor(days[date][si], "g"),
      });
    }

    result.push(dayData);
  }

  return result;
}

/**
 * Aggregiert einen einzelnen Sensor über alle Einträge eines Zeitfensters.
 * Priorität: AKTIV > FEHLER > OFFLINE > RUHE > null
 */
function aggregateSensor(entries, key) {
  if (!entries || entries.length === 0) return null;

  var hasAktiv = false,
    hasFehler = false,
    hasOffline = false,
    allNa = true;

  for (var i = 0; i < entries.length; i++) {
    var val = entries[i][key];
    if (val !== "N/A" && val !== "") allNa = false;
    if (val === "AKTIV") hasAktiv = true;
    if (val === "FEHLER") hasFehler = true;
    if (val === "OFFLINE") hasOffline = true;
  }

  if (allNa) return null;
  if (hasAktiv) return true;
  if (hasFehler) return "fehler";
  if (hasOffline) return "offline";
  return false;
}

/**
 * Web App Endpoint — liefert das Dashboard als HTML-Seite aus.
 * URL-Parameter:
 *   pw=...       → Passwort (muss mit Config DASHBOARD_PW übereinstimmen)
 *   format=json  → gibt nur die Rohdaten als JSON zurück (für API-Nutzung)
 */
function doGet(e) {
  var pw = e && e.parameter && e.parameter.pw ? e.parameter.pw : "";
  var configPw = "";
  try {
    configPw = getConfig("DASHBOARD_PW");
  } catch (err) {
    configPw = "";
  }

  if (configPw && pw !== configPw) {
    var wrongPw = pw !== "";
    var appUrl = ScriptApp.getService().getUrl();
    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        "<style>" +
        'body{font-family:"Georgia",serif;text-align:center;padding:80px 20px;' +
        "background:#080e1a;color:#5a6a80;min-height:100vh;}" +
        "h2{font-weight:300;letter-spacing:2px;color:#9aabbe;font-size:24px;margin-bottom:8px;}" +
        "p{margin:12px 0;font-size:14px;}" +
        "input{background:#141e30;border:1px solid #2a3a50;color:#e8edf5;padding:12px 18px;" +
        "border-radius:8px;font-size:16px;text-align:center;width:180px;outline:none;}" +
        "input:focus{border-color:#5a7a9a;}" +
        "button{background:#1a2a40;border:1px solid #2a3a50;color:#9aabbe;padding:12px 24px;" +
        "border-radius:8px;font-size:14px;cursor:pointer;margin-top:8px;}" +
        "button:hover{background:#243450;border-color:#4a6a8a;}" +
        ".err{color:#c27a5a;font-style:italic;}" +
        "</style></head>" +
        "<body>" +
        "<h2>74653 Wetter</h2>" +
        (wrongPw
          ? '<p class="err">Falsches Passwort</p>'
          : "<p>Passwort eingeben</p>") +
        '<form method="GET" action="' +
        appUrl +
        '" style="margin-top:24px;">' +
        '<input name="pw" type="password" placeholder="Passwort" autofocus><br>' +
        '<button type="submit">Öffnen</button>' +
        "</form></body></html>",
    ).setTitle("74653 Wetter");
  }

  // JSON-API Modus
  if (e && e.parameter && e.parameter.format === "json") {
    var jsonData = getDashboardData(7);
    var props = PropertiesService.getScriptProperties();
    var payload = {
      version: CODE_GS_VERSION,
      history: jsonData,
      lastPoll: props.getProperty("lastSuccessfulPoll") || null,
      generated: new Date().toISOString(),
    };
    return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
      ContentService.MimeType.JSON,
    );
  }

  // Dashboard-HTML ausliefern
  var history = getDashboardData(7);
  var props = PropertiesService.getScriptProperties();
  var payload = {
    version: CODE_GS_VERSION,
    history: history,
    lastPoll: props.getProperty("lastSuccessfulPoll") || null,
    generated: new Date().toISOString(),
  };

  var template = HtmlService.createTemplateFromFile("Dashboard");
  template.dashboardData = JSON.stringify(payload);
  template.pw = pw;

  return template
    .evaluate()
    .setTitle("74653 Wetter")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ─── SETUP & HILFSFUNKTIONEN ────────────────────────────────────────────────

/**
 * EINMALIG AUSFÜHREN: Richtet den 30-Minuten-Trigger ein.
 * checkStatusRequests() läuft als Teil von pollFritzBox() mit — kein eigener Trigger nötig.
 */
function setupTrigger() {
  // Bestehende Trigger dieses Projekts löschen
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }

  // 30-Minuten-Trigger erstellen
  ScriptApp.newTrigger("pollFritzBox").timeBased().everyMinutes(30).create();

  // Script Properties initialisieren
  var props = PropertiesService.getScriptProperties();
  props.setProperty("consecutiveFailures", "0");
  props.setProperty("outageAlertSent", "false");
  props.setProperty("inactivityAlertSent", "false");
  props.setProperty("lastSuccessfulPoll", new Date().toISOString());

  logSystem(
    "SETUP",
    "Code.gs v" +
      CODE_GS_VERSION +
      " — 30-Minuten-Trigger eingerichtet. Monitoring + Status-Abfrage aktiv.",
  );
  Logger.log(
    "Trigger eingerichtet. pollFritzBox() wird alle 30 Minuten ausgeführt (inkl. Status-Abfrage).",
  );
}

/**
 * TESTFUNKTION: Führt einen einzelnen Poll durch und zeigt das Ergebnis.
 */
function testPoll() {
  Logger.log("=== TESTPOLL START ===");

  try {
    Logger.log("Verbinde mit Fritz!Box...");
    var sid = getFritzBoxSID();
    Logger.log("Login erfolgreich. SID: " + sid);

    Logger.log("Frage Smart-Home-Geräte ab (Energiezähler + Präsenz)...");
    var smartHomeResult = querySmartHomeDevices(sid);
    var devices = smartHomeResult.devices;
    sid = smartHomeResult.sid; // Ggf. aktualisierte SID nach Retry
    Logger.log(
      "Wasserkocher: " +
        devices.wasserkocherStatus +
        (devices.wasserkocherAktiv ? " (Verbrauch seit letztem Poll!)" : ""),
    );
    Logger.log(
      "Fernseher: " +
        devices.tvStatus +
        (devices.tvAktiv ? " (Verbrauch seit letztem Poll!)" : ""),
    );

    Logger.log("Prüfe Anrufliste...");
    var telefon = checkPhoneActivity(sid);
    sid = telefon.sid; // Ggf. aktualisierte SID nach Retry
    Logger.log("Telefon: " + telefon.status);

    // Session beenden
    try {
      UrlFetchApp.fetch(
        getConfig("FRITZBOX_URL") + "/login_sid.lua?logout=1&sid=" + sid,
        {
          muteHttpExceptions: true,
          validateHttpsCertificates: false,
        },
      );
    } catch (e) {}

    Logger.log("Prüfe Gmail auf Tür-Push-Mails...");
    var tuer = checkDoorViaGmail();
    Logger.log("Haustür: " + tuer.status);

    Logger.log("=== TESTPOLL ERFOLGREICH ===");
    Logger.log(
      "HINWEIS: Beim allerersten Lauf zeigt Wasserkocher/TV immer RUHE,",
    );
    Logger.log(
      "da noch kein Vergleichswert existiert. Ab dem zweiten Lauf funktioniert das Delta.",
    );
  } catch (error) {
    Logger.log("FEHLER: " + error.message);
    Logger.log("Stack: " + error.stack);
  }
}

/**
 * TESTFUNKTION: Prüft ob Anrufe in den letzten hoursBack Stunden erkannt werden.
 *
 * Setzt lastSuccessfulPoll temporär zurück, ruft checkPhoneActivity() auf,
 * und stellt den ursprünglichen Wert danach wieder her (auch bei Fehlern).
 *
 * Ergebnis: Logger-Ausgabe UND neue TEL:-Einträge im Systemlog-Tab.
 * Schreibt NICHT in den Log-Tab (keine Datenverfälschung).
 *
 * Aufruf:
 *   testPhoneActivitySince()       — Standard: 48 Stunden zurück
 *   testPhoneActivitySince(72)     — 72 Stunden zurück
 */
function testPhoneActivitySince(hoursBack) {
  hoursBack = hoursBack || 48;
  var props = PropertiesService.getScriptProperties();
  var savedPoll = props.getProperty("lastSuccessfulPoll");

  var fakePoll = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  props.setProperty("lastSuccessfulPoll", fakePoll);

  Logger.log("=== testPhoneActivitySince(" + hoursBack + "h) ===");
  Logger.log("Simulierter lastPoll: " + fakePoll);

  try {
    var sid = getFritzBoxSID();
    var result = checkPhoneActivity(sid);
    Logger.log("Ergebnis: " + result.status);
    Logger.log("Details: siehe TEL:-Einträge im Systemlog-Tab des Google Sheets.");
  } catch (e) {
    Logger.log("FEHLER: " + e.message);
  } finally {
    // Immer wiederherstellen — egal ob Erfolg oder Fehler
    if (savedPoll) {
      props.setProperty("lastSuccessfulPoll", savedPoll);
    } else {
      props.deleteProperty("lastSuccessfulPoll");
    }
    Logger.log("lastSuccessfulPoll wiederhergestellt auf: " + (savedPoll || "(leer)"));
    Logger.log("=== ENDE ===");
  }
}

/**
 * TESTFUNKTION: Sendet eine Test-E-Mail, um den E-Mail-Versand zu prüfen.
 */
function testEmail() {
  sendAlert(
    "Test",
    "Dies ist eine Testnachricht vom Weckrain Check.\nWenn du das liest, funktioniert der E-Mail-Versand.",
  );
  Logger.log("Test-E-Mail gesendet an: " + getConfig("ALERT_EMAIL"));
}

/**
 * Archiviert alte Einträge aus Log und Systemlog ins jeweilige Archiv-Tab.
 *
 * Strategie: Zeilen, die älter als LIVE_DAYS sind, werden in den
 * Archiv-Tab verschoben (NICHT gelöscht). Das Archiv wächst kontinuierlich
 * und ist überlappungsfrei — jeder Eintrag existiert genau einmal,
 * entweder im Live-Tab oder im Archiv-Tab.
 *
 * Live-Tabs:    "Log" (≤ 30 Tage), "Systemlog" (≤ 90 Tage)
 * Archiv-Tabs:  "Log_Archiv", "Systemlog_Archiv" (alles darüber hinaus)
 *
 * Wird monatlich per Trigger aufgerufen (siehe docs/DEPLOYMENT.md).
 * Kann auch manuell im GAS-Editor ausgeführt werden.
 */
function cleanupOldLogs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var total = 0;

  total += _archiveTab(ss, "Log",       "Log_Archiv",       30);
  total += _archiveTab(ss, "Systemlog", "Systemlog_Archiv", 90);

  logSystem(
    "WARTUNG",
    "Log-Rotation abgeschlossen: " + total + " Zeile(n) ins Archiv verschoben."
  );
}

/**
 * Verschiebt Zeilen, die älter als liveDays sind, vom Tab sourceName
 * in den Tab archiveName. Erstellt den Archiv-Tab falls nötig.
 * Gibt die Anzahl verschobener Zeilen zurück.
 *
 * Voraussetzung: Beide Tabs haben Spaltenköpfe in Zeile 1.
 * Zeilen werden chronologisch angehängt — kein Sortieren nötig, da
 * appendRow() immer am Ende anfügt und die Quelldaten selbst chronologisch sind.
 */
function _archiveTab(ss, sourceName, archiveName, liveDays) {
  var source = ss.getSheetByName(sourceName);
  if (!source) return 0;

  var lastRow = source.getLastRow();
  if (lastRow < 2) return 0; // Nur Header, nichts zu tun

  var cutoff = new Date(Date.now() - liveDays * 24 * 60 * 60 * 1000);

  // Alle Zeilen auf einmal lesen (effizienter als Zeile für Zeile)
  var allData = source.getRange(2, 1, lastRow - 1, source.getLastColumn()).getValues();

  // Trennpunkt finden: erste Zeile, die NICHT archiviert werden soll
  var archiveCount = 0;
  for (var i = 0; i < allData.length; i++) {
    var ts = allData[i][0];
    if (ts instanceof Date && ts < cutoff) {
      archiveCount++;
    } else {
      break; // Daten sind chronologisch → ab hier alles aktuell
    }
  }

  if (archiveCount === 0) return 0;

  // Archiv-Tab holen oder erstellen
  var archive = ss.getSheetByName(archiveName);
  if (!archive) {
    archive = ss.insertSheet(archiveName);
    // Header aus dem Quell-Tab übernehmen
    var header = source.getRange(1, 1, 1, source.getLastColumn()).getValues();
    archive.getRange(1, 1, 1, header[0].length).setValues(header);
  }

  // Zu archivierende Zeilen in einem Block ans Archiv anhängen
  var toArchive = allData.slice(0, archiveCount);
  var archiveLastRow = archive.getLastRow();
  archive.getRange(archiveLastRow + 1, 1, archiveCount, toArchive[0].length)
    .setValues(toArchive);

  // Aus dem Live-Tab entfernen (deleteRows ist effizienter als Schleife)
  source.deleteRows(2, archiveCount);

  return archiveCount;
}
