# Google Sheet — Weckrain Check

Das zentrale Datenarchiv des Weckrain Check ist ein Google Sheet mit dem Namen „Weckrain Check". Es liegt im Drive-Ordner `<DRIVE_FOLDER_URL>` des Monitoring-Accounts (`<MONITORING_GMAIL>`). Zugriff: nur der Monitoring-Account selbst — das Script läuft als dieser User.

Das Sheet hat drei Tabs mit fester Struktur. Änderungen am Schema sind Breaking Changes und müssen mit einem Major-Bump in `backend/Code.gs` einhergehen.

## Tab 1 — `Log`

Roher Poll-Output. Jede Zeile = ein 30-Minuten-Poll.

| Spalte | Header | Typ | Werte | Beschreibung |
|---|---|---|---|---|
| A | Zeitstempel | Date | ISO/Locale | Zeit des Polls (wird durch `new Date()` in `logData()` gesetzt) |
| B | Wasserkocher-Status | String | `AKTIV`, `RUHE`, `OFFLINE`, `N/A` | Ergebnis der Delta-Prüfung am Energiezähler |
| C | TV-Status | String | `AKTIV`, `RUHE`, `OFFLINE`, `N/A` | Ergebnis der Delta-Prüfung am Energiezähler |
| D | Tür-Status | String | `AKTIV`, `RUHE`, `FEHLER`, `N/A` | Ergebnis der Gmail-Suche nach Push-Mails |
| E | Telefon-Status | String | `AKTIV`, `RUHE`, `FEHLER`, `N/A` | Ergebnis der Anrufliste-Auswertung |
| F | Aktivitaet_erkannt | String | `JA`, `NEIN` | OR-Verknüpfung der Sensor-Aktivität (wird von `hatAktivitaetInLetztenStunden()` gelesen) |
| G | Notiz | String | frei | Optional — aktuell nicht gesetzt, Platzhalter für manuelle Annotationen |

Status-Werte im Detail:

| Wert | Bedeutung |
|---|---|
| `AKTIV` | Sensor hat in diesem Poll Aktivität erkannt (Energiezähler-Delta ≥ 2 Wh, Türmail empfangen, Anruf geführt) |
| `RUHE` | Sensor war erreichbar, aber keine Aktivität seit dem letzten Poll |
| `OFFLINE` | DECT-Gerät nicht erreichbar (`<present>0</present>` bei Steckdosen) |
| `FEHLER` | Abfrage selbst fehlgeschlagen (Gmail-Fehler, CSV-Parse-Fehler, HTTP-Fehler) |
| `N/A` | Sensor in `ENABLED_SENSORS` deaktiviert oder nicht vorhanden |

Die 4 Status-Spalten (B–E) sind Einzelstatus pro Sensor. Nur Spalte F (`Aktivitaet_erkannt`) wird von der Inaktivitäts-Prüfung gelesen. Das Dashboard liest alle 5 Spalten (B–F) und aggregiert sie im `doGet()`-JSON-Modus zu 7×6×4-Werten.

## Tab 2 — `Systemlog`

System-Ereignisse, getrennt vom Datenlog. Diagnose und Audit-Trail.

| Spalte | Header | Typ | Beschreibung |
|---|---|---|---|
| A | Zeitstempel | Date | Zeit des Ereignisses |
| B | Typ | String | siehe Typen-Liste unten |
| C | Nachricht | String | Freitext |

**Typen** (werden von `logSystem()` in `backend/Code.gs` vergeben):

| Typ | Wann | Beispiel |
|---|---|---|
| `SETUP` | Einmalig beim Ausführen von `setupTrigger()` | `Code.gs v4.0.0 — 30-Minuten-Trigger eingerichtet. Monitoring + Status-Abfrage aktiv.` |
| `HEARTBEAT` | Einmal pro Tag beim ersten Poll nach Mitternacht | `Code.gs v4.0.0 läuft` |
| `ALERT` | Jedes Mal wenn eine Alarm-Mail rausgeht | `Inaktivitätsalarm — Keine Aktivität seit 18+ Stunden` |
| `WARNUNG` | Nicht-kritische Fehler (einzelner Sensor defekt, Gmail-Suche fehlgeschlagen) | `Anrufliste konnte nicht abgerufen werden: ...` |
| `FEHLER` | Harte Fehler (Fritz!Box nicht erreichbar, Login fehlgeschlagen) | `Poll #3 fehlgeschlagen: Fritz!Box nicht erreichbar (HTTP 504)` |
| `WARTUNG` | `cleanupOldLogs()`-Läufe | `142 alte Log-Einträge (>90 Tage) gelöscht.` |

Diagnose-Tipp: Wenn im Monitoring etwas schiefläuft, ist dieser Tab die **erste** Anlaufstelle — noch vor dem Apps Script Execution Log.

## Tab 3 — `Config`

Key-Value-Store für Konfiguration, die sich zur Laufzeit ändern kann (ohne Re-Deploy).

| Spalte | Header | Typ |
|---|---|---|
| A | Key | String |
| B | Value | String |

Vollständige Key-Liste und Semantik: siehe `docs/CONFIG.md`. Wichtig: **Passwörter und Geheimnisse gehören NICHT in diesen Tab**, sondern in `PropertiesService.getScriptProperties()` (Key `FRITZBOX_PASS`).

Grund für die Aufteilung: Das Config-Sheet ist für jeden lesbar, der Zugriff auf das Sheet hat. Script-Properties sind an das Apps-Script-Projekt gebunden und nur für Editoren des Projekts sichtbar.

## Rotation und Größe

Das Sheet wächst kontinuierlich. Ein 30-Minuten-Poll macht 48 Zeilen pro Tag im `Log`-Tab — über ein Jahr sind das rund 17.500 Zeilen. Kein Problem für Google Sheets (Limit: 10M Zellen), aber die Datei wird langsam beim Öffnen.

Deshalb: Die Funktion `cleanupOldLogs()` in `backend/Code.gs` löscht beim manuellen oder geplanten Aufruf alle Zeilen im `Log`-Tab, die älter als 90 Tage sind. Aktuell ist sie **nicht** in einem Trigger — das muss manuell oder in einem monatlichen Trigger eingerichtet werden (siehe `docs/DEPLOYMENT.md`, Abschnitt „Wartung").

Der `Systemlog`-Tab wird **nicht** automatisch bereinigt, weil er klein bleibt (etwa ein Eintrag pro Tag plus gelegentliche Warnungen).

## Zugriff und Ownership

- **Owner:** `<MONITORING_GMAIL>` (der Account, unter dem Apps Script läuft)
- **Editoren:** keine weiteren
- **Viewer:** keine weiteren
- **Script-Binding:** Das Apps-Script-Projekt ist an dieses Sheet gebunden (container-bound). `SpreadsheetApp.getActiveSpreadsheet()` verweist immer auf dieses Sheet.

Sheet-URL: `<SHEET_URL>` — nicht im Repo, weil sie den Account indirekt identifiziert.

## Referenzen

- Logging-Funktionen: `logData()`, `logSystem()` in `backend/Code.gs`
- Rotation: `cleanupOldLogs()` in `backend/Code.gs`
- Config-Details: `docs/CONFIG.md`
