# Weckrain Dashboard — 74653 Wetter

Standalone-Frontend für das **Weckrain Check** Aktivitäts-Monitoring.

Zeigt Sensor-Daten als anonymisierte "Wetterstation" an — nur Eingeweihte wissen, was es wirklich zeigt.

## Architektur

```
Fritz!Box 6660 Cable
  │  AHA-HTTP-Interface (alle 30 Min.)
  ▼
Google Apps Script (Code.gs)
  │  Pollt Sensoren, loggt in Google Sheets
  │  Stellt JSON-API bereit (?format=json&pw=...)
  ▼
Dieses Dashboard (index.html)
  │  fetch() → JSON-API → React-Rendering
  ▼
GitHub Pages → weckrain.derkarsten.de
```

**Dieses Repo enthält nur das Frontend.** Backend (Code.gs), Hardware-Setup und Komplettanleitung liegen separat:
→ `~/Documents/__claude/projects/privat/2026-03_mama-monitor/`

## Sensoren

| Sensor | Hardware | Dashboard-Label |
|--------|----------|------------------|
| Küche | FRITZ!DECT 200 (Wasserkocher) | Küche |
| Lesezimmer | FRITZ!DECT 200 (Fernseher) | Lesezimmer |
| Eingang | FRITZ!DECT 350 (Haustür) | Eingang |
| Gesang | Fritz!Fon X6 (Anrufliste) | Gesang |

## Setup

Die `index.html` enthält die API-URL bereits fest eingetragen. Deployment läuft automatisch via GitHub Pages.

**Deployen nach Änderungen:**
```bash
cd ~/dev/weckrain-dashboard
git add . && git commit -m "Beschreibung" && git push
```

**Domain:** `weckrain.derkarsten.de` (CNAME → karstenhoffmann.github.io)

## Passwortschutz

Das Dashboard fragt beim ersten Besuch nach einem Passwort. Dieses wird im localStorage gespeichert, sodass man es nur einmal eingeben muss. Das Passwort ist in der Google Apps Script Config-Tabelle unter `DASHBOARD_PW` hinterlegt.

## Zusammenspiel der Komponenten

| Komponente | Ort | Zweck |
|-----------|-----|-------|
| **index.html** | Dieses Repo | Dashboard-Frontend (React) |
| **Code.gs** | Google Apps Script | Backend: Polling, Logging, JSON-API, Alerts |
| **Dashboard.html** | Google Apps Script | GAS-gehostete Version (Desktop-Fallback) |
| **Google Sheet** | Google Drive | Datenspeicher (Log, SystemLog, Config) |
| **Fritz!Box** | Vor Ort | Hardware-Sensoren |
| **Healthchecks.io** | Cloud | Dead Man's Switch |
| **Komplettanleitung** | ~/Documents/__claude/…/mama-monitor/ | Gesamtdoku inkl. Code.gs |
