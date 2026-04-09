# Known Issues — Weckrain Check

Offene und bekannte Probleme, die beim nächsten Iterationsschritt angegangen werden sollten. Neu entdeckte Issues gehören hier hinein, bevor sie in Vergessenheit geraten. Erledigte Issues bleiben dokumentiert mit dem Status „gelöst", damit die Historie nachvollziehbar ist.

## Issue 1 — Gesang / Telefon-Aktivität nicht zuverlässig erkannt

**Status:** offen (Version 4.0.0)
**Betroffen:** `checkPhoneActivity()` in `backend/Code.gs`, Sensor-Key `g`
**Symptom:** Im Dashboard wird der Gesang-Slot häufig als inaktiv angezeigt, obwohl in der Fritz!Box-Anrufliste sehr wohl ein geführtes Telefonat im Zeitraum steht.

### Analyse

Der Code holt die Anrufliste via `foncalls_list.lua?csv` als CSV und filtert auf „geführtes Telefonat". Das Filter-Kriterium in Version 4.0.0 ist zu naiv: Es prüft nur auf bestimmte Typ-Codes in der ersten CSV-Spalte, ignoriert aber die Dauer und behandelt verschiedene Fritz!OS-Versionen unterschiedlich.

Die Fritz!Box liefert in der CSV eine Spalte `Typ` mit diesen Werten (Fritz!OS 8.x, empirisch):

| Code | Bedeutung |
|---|---|
| `1` | Ankommender Anruf (angenommen) |
| `2` | Abgehender Anruf |
| `3` | Ankommender Anruf (entgangen / nicht angenommen) |
| `4` | Ankommender Anruf aktiv (während der Erfassung noch laufend) |
| `10` | Blockierter Anruf (Rufsperre) |
| `11` | Aktiver abgehender Anruf (während der Erfassung noch laufend) |

Aktueller Code zählt `1` und `2` als „geführt", ignoriert aber die Spalte `Dauer`. Dadurch werden sehr kurze Klingel-Anrufe (angenommen und nach 1 Sekunde aufgelegt) als Aktivität gewertet — und umgekehrt werden Typ `4`/`11` (Anruf läuft gerade) nicht erkannt, was besonders während lang laufender Gespräche zu Fehlalarmen „keine Aktivität" führt.

Außerdem: In einigen Fritz!OS-Versionen wird die Dauer als `HH:MM` formatiert, in anderen als `MM:SS` — das `parseDuration()`-Helfer-Stub existiert im Code, behandelt aber beide Formate nicht korrekt.

### Verifikations-Schritt (bevor gepatcht wird)

Vor einem Patch sollte empirisch geprüft werden, welche Typ-Codes die Live-Fritz!Box tatsächlich liefert. Vorgehen:

1. Im Monitoring-Account `testPoll()` ausführen und das Raw-CSV aus `checkPhoneActivity()` ins Execution Log dumpen (temporäres `Logger.log(csvContent)`).
2. Einen eindeutigen Test-Anruf von einem bekannten Gerät führen (angenommen + kurz gesprochen).
3. Erneut `testPoll()` und das CSV der neuen Zeile anschauen.
4. Vergleichen: Welcher Typ-Code, welches Dauerformat? Die obige Tabelle verifizieren oder korrigieren.

### Lösungsskizze

```javascript
// In checkPhoneActivity(), Filterlogik:
const TYPES_COUNTING = ['1', '2', '4', '11']; // angenommen, abgehend, laufend
const MIN_DURATION_SECONDS = 5; // Klingel-Anrufe filtern

const isLivePhoneActivity = row => {
  if (!TYPES_COUNTING.includes(row.typ)) return false;
  const seconds = parseDuration(row.dauer);
  return seconds >= MIN_DURATION_SECONDS;
};
```

Und `parseDuration()` so, dass beide Formate akzeptiert werden:

```javascript
function parseDuration(s) {
  if (!s) return 0;
  const parts = s.split(':').map(n => parseInt(n, 10));
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
  if (parts.length === 2) {
    // Mehrdeutig: HH:MM oder MM:SS. Heuristik: wenn erste Zahl < 24, ist HH:MM.
    // Besser: aus dem Fritz!OS-Version-Check ableiten.
    return parts[0] * 60 + parts[1]; // MM:SS als Default
  }
  return 0;
}
```

### Workaround in der Zwischenzeit

Kein Workaround — der Sensor ist weiter im Log, aber wird beim Aggregieren als zweitrangig behandelt. Im Frontend ist der Sensor zudem im Normalmodus dezent versteckt und nur im `?mode=karsten`-Modus voll sichtbar (siehe `docs/API.md`, Abschnitt „Gesang-Modus"), damit eine laienhafte Betrachterin nicht durch Fehlalarme verunsichert wird.

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

## Issue 4 — `cleanupOldLogs()` nicht automatisch getriggert

**Status:** offen, niedrige Priorität
**Betroffen:** `backend/Code.gs`, `cleanupOldLogs()`

Die Rotations-Funktion existiert und funktioniert, ist aber nicht in einem Apps-Script-Trigger eingetragen. Das heißt: Der `Log`-Tab wächst unbegrenzt weiter. Bei 48 Zeilen/Tag macht das ca. 17.500 Zeilen/Jahr — für Google Sheets unkritisch (Limit: 10M Zellen), aber das Sheet wird beim Öffnen merklich langsamer.

**Lösung:** Im Apps-Script-Editor unter `Triggers` einen monatlichen Trigger für `cleanupOldLogs` einrichten. Siehe `docs/DEPLOYMENT.md`, Abschnitt „Wartung".

## Issue 5 — Erste Frontend-Ladezeit hoch

**Status:** offen, niedrige Priorität (Design-Trade-off)
**Betroffen:** `index.html`

Das Frontend lädt React + ReactDOM + Babel Standalone über CDN, transformiert JSX im Browser, und fetcht dann die Daten. Der Kaltstart dauert damit je nach Verbindung 1–3 Sekunden länger als ein vorgebautes Bundle. Nach dem Warmstart (Cache) ist es schnell.

Das ist ein bewusster Trade-off gegen „Reparierbarkeit ohne Toolchain" — siehe `docs/DEPLOYMENT.md`, „Voraussetzungen". Wenn die Ladezeit irgendwann stört, wäre der kleinste Umbau: React + ReactDOM als minifizierte Version einbinden und Babel im Build-Step weglassen (Pre-compile der JSX zu JS). Das würde ~500 KB sparen und 1 Sekunde Parse-Zeit.

Aktuell nicht geplant.

## Referenzen

- Bug 1 Code: `checkPhoneActivity()` in `backend/Code.gs`
- Bug 2 Code: `getFritzBoxSID()`, `querySmartHomeDevices()` in `backend/Code.gs`
- Issue 4 Code: `cleanupOldLogs()` in `backend/Code.gs`
- Config-Keys für Retry-Verhalten: nicht konfigurierbar, hart im Code
- Verifikations-Tipps: `docs/MONITORING.md`, Abschnitt „Diagnose-Reihenfolge"
