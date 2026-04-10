# Known Issues — Weckrain Check

Offene und bekannte Probleme, die beim nächsten Iterationsschritt angegangen werden sollten. Neu entdeckte Issues gehören hier hinein, bevor sie in Vergessenheit geraten. Erledigte Issues bleiben dokumentiert mit dem Status „gelöst", damit die Historie nachvollziehbar ist.

## Issue 1 — Gesang / Telefon-Aktivität nicht zuverlässig erkannt

**Status:** gelöst in Version 4.0.1
**Betroffen (pre-fix):** `checkPhoneActivity()` in `backend/Code.gs`, Sensor-Key `g`
**Symptom:** Im Dashboard wurde der Gesang-Slot häufig als inaktiv angezeigt, obwohl in der Fritz!Box-Anrufliste sehr wohl ein geführtes Telefonat im Zeitraum stand. Gleichzeitig wurden sehr kurze Klingel-Anrufe (ein paar Sekunden) fälschlich als Aktivität gewertet.

### Ursachen-Analyse (nach vollständiger Recherche)

Drei unabhängige Fehler lagen vor:

1. **Falsche Typ-Code-Annahme.** Der Code in 4.0.0 filterte auf `typ === "1" || typ === "3"` mit dem Kommentar „Nur angenommen + ausgehend". Das ist für den Endpoint, den der Code tatsächlich aufruft (`foncalls_list.lua?csv=`, die **Web-UI-URL**, nicht TR-064), falsch.
2. **Keine Dauer-Filterung.** Klingelversuche (Anruf ≤ 1 Sekunde angenommen, dann sofort wieder aufgelegt) wurden als „echtes Gespräch" gewertet.
3. **Falscher Spalten-Offset-Kommentar.** Der Code-Kommentar behauptete `Format: Typ;Datum;Name;Rufnummer;Nebenstelle;Eigene Rufnummer;Dauer` (7 Spalten). Tatsächlich sind es 8 Spalten — die Spalte `Landes-/Ortsnetzbereich` zwischen `Rufnummer` und `Nebenstelle` fehlte. Dauer liegt in `fields[7]`, nicht `fields[6]`. Da der alte Code die Dauer gar nicht gelesen hat, war das kein aktiver Bug — aber eine Zeitbombe für den Fix.

### Verifizierte Semantik (Quellen siehe unten)

**Typ-Codes bei `foncalls_list.lua?csv=` (Web-UI-URL, Fritz!OS 8.x):**

| Code | Bedeutung |
|---|---|
| `1` | **CALLIN** — eingehend angenommen (inkl. durch Anrufbeantworter) |
| `2` | **CALLFAIL** — nicht zustande gekommen (verpasst eingehend *oder* ausgehend ohne Antwort) |
| `4` | **CALLOUT** — ausgehend erfolgreich verbunden |

**Wichtig:** Das ist NICHT die TR-064-Semantik! TR-064 definiert `3 = outgoing`. Die Web-UI-URL hat aber in neueren Firmware-Versionen auf `4 = outgoing` gewechselt. Das ist der zentrale Fehler den der Original-Code gemacht hat (Mischung aus beiden Schemas).

**Dauer-Format:** `H:MM` (Stunden:Minuten) mit **Minuten-Aufrundung, keine Sekunden-Auflösung**.

| CSV-Wert | Bedeutung |
|---|---|
| `0:00` | Anruf kam nicht zustande (CALLFAIL) |
| `0:01` | Anruf < 1 Minute — AVM-Minimalwert, UI-Anzeige „< 1 Min" |
| `0:50` | 50 Minuten |
| `1:35` | 1 Stunde 35 Minuten = 95 Minuten |

AVM speichert **keine Sekunden** im Export. Kurze Anrufe (1-59 Sekunden) werden grundsätzlich als `0:01` abgelegt.

### Produktentscheidung: Filter-Schwelle

Die ursprüngliche Anforderung war „nur Anrufe länger als 1 Minute zählen" — begründet mit der Sorge, dass kurze Klingelversuche als Aktivität gewertet werden. Die Recherche hat jedoch gezeigt, dass **kurze Klingelversuche von der Fritz!Box bereits als Typ 2 (CALLFAIL) klassifiziert werden**, nicht als Typ 1 oder 4. Die einzige Restsorge wäre der Anrufbeantworter gewesen (der AB-Antworten als Typ 1 loggt).

**Situation:** Die Mutter hat **keinen aktiven Anrufbeantworter** — weder in der Fritz!Box noch auf einem der DECT-Telefone. Sie will auch keinen haben („wer mich erreichen will, soll nochmal anrufen"). Damit ist jeder Typ-1-Eintrag zu 100% eine menschliche Hörer-Abnahme durch die Mutter selbst.

**Konsequenz:** Wir zählen **jede angenommene oder erfolgreich aufgebaute Verbindung**, unabhängig von der Gesprächsdauer. Ein 5-Sekunden-Gespräch ist trotzdem ein eindeutiges Lebenszeichen (Hörer wurde aktiv in die Hand genommen). Primärziel des Systems ist „lebt die Mutter, ist sie handlungsfähig?" — da ist eine liberale Filterung der konservativen vorzuziehen.

### Fix in 4.0.1

1. Separator auto-detection über `sep=<char>`-Präambel (Semikolon im Web-UI-URL-Export, Tab im manuellen Web-UI-Export).
2. Spalten-Offset korrigiert: Dauer ist `fields[7]`, Plausi-Check `fields.length >= 8`.
3. Neuer Helper `parseDurationMinutes()` für das `H:MM`-Format.
4. Filter: `typ ∈ {"1", "4"}` AND `dauerMinuten >= 1`. Der Dauer-Check dient als Safety-Net — Typ 1/4 mit Dauer 0 sollte laut AVM-Spec nie vorkommen, wir fangen es trotzdem defensiv ab.
5. Typ-Codes und Rationale ausführlich im Code kommentiert.

Verifiziert gegen einen realen CSV-Export mit 20 Zeilen: Keine false positives (alle `CALLFAIL`-Einträge werden korrekt verworfen), keine false negatives (alle Typ-1- und Typ-4-Einträge mit Dauer > 0 werden gezählt — inklusive des 50-Minuten-Schrozberg-Gesprächs, des 95-Minuten-Langenau-Gesprächs und der kurzen Gespräche).

**Falls die Mutter doch irgendwann einen Anrufbeantworter aktivieren will:** Die Filter-Schwelle muss dann auf `MIN_DURATION_MINUTES = 2` angehoben werden, um AB-Antworten auszuschließen. Alternativ kann die `Nebenstelle`-Spalte (`fields[5]`) auf AB-Bezeichner geprüft werden — siehe Hintergrund-Diskussion in dieser Doku-Historie.

### Quellen

- **AVM TR-064 Spec — X_AVM-DE_OnTel Calllist:** Dauerformat `hh:mm (minutes rounded up)`, Typ-Codes `1=incoming, 2=missed, 3=outgoing, 9=active incoming, 10=rejected incoming, 11=active outgoing`. Das ist die **TR-064-Semantik** — gilt NICHT für die Web-UI-URL!
- **Community-Recherche (ip-phone-forum.de u.a.) zur Web-UI-URL-Semantik:** Bestätigt den Drift von `3=outgoing` (alte Firmware) auf `4=CALLOUT` (neuere Firmware). Typ `2` heißt in beiden Varianten „nicht zustande gekommen".
- **Empirisch verifiziert mit realem CSV-Export** aus Fritz!OS 8.21 am 2026-04-09: Alle Typ-1 und Typ-4 Einträge haben Dauer > 0, alle Typ-2 Einträge haben Dauer 0:00. Kein Widerspruch.

## Issue 2 — Google-IP-Rotation bricht Fritz!Box-Session

**Status:** gelöst in Version 4.0.0
**Betroffen:** `getFritzBoxSID()`, `querySmartHomeDevices()` in `backend/Code.gs`

### Historischer Verlauf

Frühere Versionen haben einmal pro Session eine SID per `login_sid.lua` geholt und dann mehrere Requests gegen die AHA-HTTP-Schnittstelle damit geschickt. Funktionierte lokal einwandfrei, aber aus Google Apps Script heraus ist die Quell-IP nicht stabil: Google Apps Script fetch-Requests kommen aus einem großen IP-Pool, und Google rotiert die Quell-IP teilweise innerhalb **derselben** Script-Ausführung.

Die Fritz!Box bindet SIDs an die Client-IP (Sicherheitsfeature). Sobald die IP wechselt, antwortet die Fritz!Box mit HTTP 403 Forbidden auf die folgenden Requests. Symptom im Systemlog: Plötzliche Kaskade von `WARNUNG — HTTP 403` für mehrere Sensoren innerhalb eines Polls.

### Lösung in 4.0.0

`querySmartHomeDevices()` wiederholt bei einem 403 automatisch: Alte SID verwerfen, neu einloggen, Request wiederholen. Maximal 2 Retries pro Sensor. Bei anhaltendem 403 wird `FEHLER` in das Log geschrieben und mit dem nächsten Sensor weitergemacht.

Zusätzlich: Jeder Sensor holt sich seine eigene frische SID (kein Sharen mehr), solange die Gesamtlaufzeit darunter nicht leidet. Das kostet ein paar extra Login-Calls pro Poll, ist aber mit dem 30-Minuten-Intervall problemlos.

## Issue 3 — iOS Safari zeigt Dashboard angeblich nicht korrekt

**Status:** unbestätigt
**Betroffen:** `index.html` Frontend

### Meldung

Eine einzelne Rückmeldung, dass das Dashboard auf iOS Safari „nicht richtig" angezeigt wird. Keine Screenshots, keine iOS-Version, kein reproduzierbarer Schritt.

### Verdacht

Mögliche Ursachen, in Reihenfolge der Wahrscheinlichkeit:

1. **Caching:** iOS Safari cached JS-Assets sehr aggressiv. Nach einem Frontend-Bump wird eventuell noch die alte Version ausgeliefert, bis der Safari-Cache abläuft. Workaround: Dashboard in Privat-Tab neu öffnen, oder Einstellungen → Safari → Verlauf & Webseitendaten löschen.
2. **React via Babel Standalone:** Babel-Transformation im Browser ist auf älteren iOS-Versionen träge oder fehlerhaft. Auf iOS < 14 könnten bestimmte ES2020-Features nicht laufen.
3. **CORS-Fetch:** Safari ist restriktiver bei Cross-Origin-Fetches. Wenn das Fetch-Response keinen korrekten Content-Type hat, zeigt Safari einen leeren Body. Unwahrscheinlich, weil Chrome und Firefox funktionieren — aber testen.
4. **Dark-Mode-Erkennung:** Safari nutzt `prefers-color-scheme` etwas anders als Chromium. Könnte zu einer unlesbaren Farbkombination führen (dunkler Text auf dunklem Hintergrund).

### Reproduktion

Vor einem Fix: Ein konkreter Nutzer mit iOS Safari muss das Problem mit Screenshot + iOS-Version + Safari-Version + genauer Fehlerbeschreibung melden. Ohne das ist ein Fix Blindflug.

## Issue 4 — Log-Rotation: kein Archiv, kein Trigger

**Status:** gelöst in Version 4.0.2
**Betroffen:** `backend/Code.gs`, `cleanupOldLogs()`

Die alte `cleanupOldLogs()`-Funktion hat Einträge gelöscht statt archiviert, deckte nur den `Log`-Tab (nicht `Systemlog`), und war nicht per Trigger eingetragen.

**Fix in 4.0.2:**
- `cleanupOldLogs()` verschiebt alte Zeilen jetzt in Archiv-Tabs (`Log_Archiv`, `Systemlog_Archiv`) statt sie zu löschen. Kein Datenverlust.
- Archiv-Tabs werden beim ersten Lauf automatisch angelegt (Header vom Live-Tab übernommen).
- Live-Fenster: `Log` ≤ 30 Tage, `Systemlog` ≤ 90 Tage.
- Archivierung erfolgt in einem Block (effizient, kein Zeile-für-Zeile).
- **Trigger einrichten (manuell durch Karsten):** Im GAS-Editor unter `Triggers` → `cleanupOldLogs` → monatlich (z.B. 1. des Monats, 03:00). Alternativ: manuell im GAS-Editor ausführen.

## Issue 5 — Erste Frontend-Ladezeit hoch

**Status:** offen, niedrige Priorität (Design-Trade-off)
**Betroffen:** `index.html`

Das Frontend lädt React + ReactDOM + Babel Standalone über CDN, transformiert JSX im Browser, und fetcht dann die Daten. Der Kaltstart dauert damit je nach Verbindung 1–3 Sekunden länger als ein vorgebautes Bundle. Nach dem Warmstart (Cache) ist es schnell.

Das ist ein bewusster Trade-off gegen „Reparierbarkeit ohne Toolchain" — siehe `docs/DEPLOYMENT.md`, „Voraussetzungen". Wenn die Ladezeit irgendwann stört, wäre der kleinste Umbau: React + ReactDOM als minifizierte Version einbinden und Babel im Build-Step weglassen (Pre-compile der JSX zu JS). Das würde ~500 KB sparen und 1 Sekunde Parse-Zeit.

Aktuell nicht geplant.

## Issue 6 — HTTP 403 von Fritz!Box deutlich zu häufig

**Status:** offen, mittlere Priorität
**Betroffen:** `backend/Code.gs`, `querySmartHomeDevices()`, `checkPhoneActivity()`

### Symptom

Aus dem Systemlog (07.04–10.04.2026): Etwa jeder 3.–4. Poll schlägt mit `AHA-HTTP-Abfrage fehlgeschlagen (HTTP 403) nach 6 Versuch(en)` fehl. Sporadisch, nicht in Blöcken — d.h. meist erholt sich das System beim nächsten regulären Poll. Betrifft `Poll #1` (nicht `Poll #2, #3`) → der Fehlerzähler wird nach jedem Erfolg zurückgesetzt, die Fehler sind also jeweils isoliert.

Das IP-Rotations-Problem ist in Issue 2 bereits beschrieben und in 4.0.0 gemildert (Retry-Logik). Aber die beobachtete Fehlerrate (>20 Fehlschläge in ~3 Tagen bei ca. 144 erwarteten Polls) entspricht ca. 14% Fehlerrate — deutlich mehr als erwartet.

### Mögliche Ursachen

1. **Fritz!Box Session-Timeout aggressiver als gedacht.** Die SID läuft nach 10 min aus. Der GAS-Trigger feuert alle 30 min, Session ist also immer abgelaufen — aber `getFritzBoxSID()` holt jedesmal frisch eine SID. Das sollte OK sein, ist aber ein möglicher Fehlerquelle wenn Fritz!Box den Login-Request von wechselnden IPs ablehnt.
2. **Steigende IP-Poolbreite bei Google.** Googles GAS-IP-Pool könnte breiter geworden sein oder aggressiver rotieren als 2024/2025.
3. **Fritz!Box-seitiger Schutz.** Zu viele Login-Versuche aus verschiedenen IPs innerhalb kurzer Zeit → temporärer Soft-Block.

### Diagnoseschritte (Karsten)

1. Im Fritz!Box Ereignislog (Heimnetz → Netzwerk → Ereignisse) schauen, ob dort Login-Fehlschläge für `monitor_api` zu sehen sind.
2. Im GAS-Systemlog prüfen: Treten die 403-Fehler zu bestimmten Tageszeiten gehäuft auf?
3. Testen: `testPoll()` manuell im GAS-Editor ausführen und schauen ob es zum 403 kommt.

### Mögliche Fixes (noch nicht implementiert)

- **Delay zwischen Login-Retry und AHA-Request erhöhen** (aktuell: 1 Sekunde nach 403). Ggf. auf 3–5 Sekunden erhöhen.
- **Retry-Anzahl reduzieren** (aktuell: 3 Versuche pro Sensor). Weniger aggressive Retries könnten Fritz!Box-seitigen Soft-Block verhindern.
- **Konsolidierter Login:** Alle Sensor-Requests in einer Session (mit einer SID) statt jeder Sensor mit eigener SID — spart Login-Calls und reduziert IP-Exposition. (Gegenläufig zu Issue 2 Fix — Trade-off.)

## Referenzen

- Bug 1 Code: `checkPhoneActivity()` in `backend/Code.gs`
- Bug 2 Code: `getFritzBoxSID()`, `querySmartHomeDevices()` in `backend/Code.gs`
- Issue 4 Code: `cleanupOldLogs()`, `_archiveTab()` in `backend/Code.gs`
- Config-Keys für Retry-Verhalten: nicht konfigurierbar, hart im Code
- Verifikations-Tipps: `docs/MONITORING.md`, Abschnitt „Diagnose-Reihenfolge"
