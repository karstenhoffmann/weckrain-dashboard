# Architektur

**Version:** 1.0.0
**Tracks:** `backend/Code.gs` 4.0.0 · `index.html` 1.0.0
**Last updated:** 2026-04-09

## Zweck

Nicht-invasive Aktivitätsüberwachung für eine allein lebende Person mittels Fritz!Box-Sensorik, Google Apps Script Cloud-Monitoring und einem statischen Web-Dashboard. Kein Kamera, kein Wearable, kein Notfallknopf. Offizieller Systemname überall: „Weckrain Check". Im Dashboard anonymisiert als „74653 Wetter".

## Datenfluss

```
┌─────────────────────────────────────────┐
│  Fritz!Box 6660 Cable (vor Ort)         │
│  Fritz!OS 8.21                          │
│                                         │
│  Sensoren:                              │
│  • 2× FRITZ!DECT 200 (Energiezähler)    │
│  • 1× FRITZ!DECT 350 (Tür)              │
│  • 1× Fritz!Fon X6 (Anrufliste)         │
└──────────────┬──────────────────────────┘
               │
               │ HTTPS via MyFRITZ! (Port 48342)
               │ AHA-HTTP-Interface (alle 30 Min.)
               │ Gmail Push für Tür-Alarme
               │ CSV-Export für Anrufliste
               │
               ▼
┌─────────────────────────────────────────┐
│  Google Apps Script (Cloud)             │
│  backend/Code.gs                        │
│                                         │
│  • pollFritzBox() alle 30 Min           │
│  • MD5-Auth, SID-Management             │
│  • Energie-Delta-Erkennung              │
│  • Gmail-Scan für Tür-Push              │
│  • Anrufliste parsen                    │
│  • Inaktivitäts-/Ausfall-Analyse        │
│  • JSON-API via doGet()                 │
└──────┬──────────────────────┬───────────┘
       │                      │
       │ appendRow()          │ HTTP GET
       │ setProperty()        │ ?format=json&pw=...
       │                      │
       ▼                      ▼
┌──────────────────┐   ┌─────────────────────────┐
│  Google Sheet    │   │  index.html             │
│  "Weckrain Check"│   │  (Repo → GitHub Pages)  │
│                  │   │                         │
│  • Log           │   │  • fetch() JSON-API     │
│  • Systemlog     │   │  • React-Rendering      │
│  • Config        │   │  • localStorage für PW  │
└──────────────────┘   └──────────┬──────────────┘
                                  │
                                  │ DNS CNAME
                                  ▼
                       ┌─────────────────────┐
                       │  weckrain.          │
                       │  derkarsten.de      │
                       └─────────────────────┘

    Parallel:  Google Apps Script Trigger
               └─> sendHeartbeat()
                   └─> Healthchecks.io (Dead Man's Switch)
                       └─> alarmiert Karsten
                           bei ausbleibendem Ping
```

## Komponenten & Verantwortlichkeiten

### Fritz!Box (vor Ort)

- Lokale Sensorhardware und Datenquelle
- MyFRITZ!-Zugang für Remote-Polling via HTTPS
- Sendet Push-Mails bei Tür-Events an das Monitor-Gmail-Konto
- Hält die Anrufliste als CSV-exportierbare Ressource

Siehe `docs/HARDWARE.md` für Modelle, DECT-Zuordnung und Sensor-Labels.

### `backend/Code.gs` (Google Apps Script)

- **Polling:** alle 30 Minuten via Zeit-Trigger, orchestriert von `pollFritzBox()`
- **Authentifizierung:** MD5 Challenge-Response gegen Fritz!Box (nicht PBKDF2 — Google Apps Script hat kein natives PBKDF2)
- **Datenerfassung:** Energiezähler-Delta (Schwellenwert 2 Wh filtert Standby), Gmail-Push-Scan für Tür-Events, CSV-Anrufliste für Telefon
- **Logging:** Status pro Sensor in Google Sheet `Log`-Tab, Meta-Events im `Systemlog`-Tab
- **Alerting:** Inaktivitätsalarm (>18h), Ausfallalarm (>3h = 6 Polls), Entwarnung bei Recovery
- **API:** `doGet()`-Endpunkt liefert HTML-Dashboard oder (bei `?format=json`) JSON-Rohdaten
- **Heartbeat:** pingt Healthchecks.io bei jedem erfolgreichen Poll
- **Status-Abfrage per E-Mail:** antwortet autorisierten Absendern (Config `STATUS_EMAILS`) mit den letzten 10 Log-Einträgen

### Google Sheet „Weckrain Check"

- **Log-Tab:** Zeitstempel + Status aller vier Sensoren + Aktivitäts-Flag + Notiz-Spalte
- **Systemlog-Tab:** Meta-Events (`SETUP`, `ALERT`, `WARNUNG`, `FEHLER`, `WARTUNG`, `HEARTBEAT`)
- **Config-Tab:** Key-Value-Store für alle Laufzeit-Config (`FRITZBOX_URL`, `ALERT_EMAIL`, `DASHBOARD_PW`, etc.)
- **Rotation:** `cleanupOldLogs()` löscht Log-Einträge älter als 90 Tage

Siehe `docs/GOOGLE_SHEET.md` für die vollständige Tab-Struktur und `docs/CONFIG.md` für alle Config-Keys.

### `index.html` (Frontend, GitHub Pages)

- Statisches React-Dashboard via CDN (kein Build-Step)
- Holt Daten per `fetch()` von der GAS JSON-API
- Anzeige als Wetterstations-Metapher („74653 Wetter") — anonymisiert
- Passwort-Eingabe beim ersten Besuch, gespeichert in `localStorage`
- Footer zeigt Frontend- und Backend-Version
- Deploy: Git-Push auf `main` → GitHub Pages baut und veröffentlicht automatisch unter `weckrain.derkarsten.de` (CNAME via all-inkl.com)

### `backend/Dashboard.html` (GAS-Template, Legacy Desktop-Fallback)

- Wird serverseitig via `HtmlService.createTemplateFromFile('Dashboard')` gerendert
- Bekommt Daten per Template-Injection (`template.dashboardData = ...`)
- Fallback-Ansicht, falls das GitHub-Pages-Frontend mal nicht erreichbar sein sollte
- **Status:** wird nicht aktiv genutzt, aber mitgepflegt. Funktioniert in Safari auf iOS weniger gut als die GitHub-Pages-Variante — das war ursprünglich der Grund für die Auslagerung auf ein eigenes Repo.

### Healthchecks.io (Dead Man's Switch)

- Erwartet alle 30 Minuten einen Ping vom Script
- Grace Period: 90 Minuten (erlaubt 2 verpasste Pings, bevor Alarm)
- Alarmiert per E-Mail (optional Telegram), wenn Pings ausbleiben
- Deckt den Fall ab, dass das Script selbst stirbt (Google-Konto-Problem, Quota, Trigger weg, Code-Crash)

## Sicherheit & Secrets

- **Fritz!Box-Passwort:** NICHT im Code, NICHT im Sheet. Liegt verschlüsselt in den `PropertiesService.getScriptProperties()` als Key `FRITZBOX_PASS`.
- **Dedizierter Fritz!Box-Benutzer:** `monitor_api` mit minimalen Rechten (nur Smart Home + Anrufliste, kein Admin, kein VPN, kein NAS).
- **Dashboard-Passwort:** Liegt im Config-Tab des Sheets unter `DASHBOARD_PW`. Einfacher Schutz gegen zufällige Besucher.
- **Keine Secrets im Repo:** Weder im Code, noch in der Dokumentation, noch in `appsscript.json`. Alle Dokumente verwenden Platzhalter wie `<DASHBOARD_PW>`, `<FRITZBOX_PW>`, `<HEALTHCHECKS_URL>`, `<MYFRITZ_URL>`.

## Resilienz-Mechanismen

| Szenario | Erkennung | Reaktion |
|---|---|---|
| Fritz!Box 3h+ offline | `pollFritzBox()` zählt `consecutiveFailures` | Ausfallalarm nach 6 Polls (= 3h), einmalig pro Vorfall |
| 18h keine Aktivität | `hatAktivitaetInLetztenStunden(18)` | Inaktivitätsalarm, einmalig pro Vorfall |
| DECT-Sensor einzeln offline | `parseDeviceList()` prüft `<present>`-Tag | Loggt `OFFLINE`, andere Sensoren zählen weiter, kein Fehlalarm |
| Google-IP-Rotation → Fritz!Box HTTP 403 | Retry-Logik in `querySmartHomeDevices()` und `checkPhoneActivity()` | Bis zu 6 Login-Versuche mit frischer SID |
| Script crasht / Trigger tot / Quota | Healthchecks.io erkennt fehlenden Ping | Externe Alert-Mail an Karsten |
| Log-Sheet läuft voll | `cleanupOldLogs()` | Entfernt Einträge älter als 90 Tage |
| Recovery nach Ausfall | Nach wiederhergestelltem Poll | Entwarnungs-Mail mit aktuellem Sensor-Status |

## Trennung zwischen Repo und Cowork

Alles Technische (Code, Doku, API-Schema, Hardware-Mapping, Config-Keys, Deployment-Rezepte) lebt in diesem Repo. Alles Strategische, Persönliche und Historische (Warum dieser Ansatz, welche Alternativen wurden verworfen, persönlicher Kontext) bleibt bei Cowork. Siehe `CLAUDE.md` für die Scope-Regeln.
