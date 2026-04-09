# API — Weckrain Backend

Der Weckrain-Backend-Endpunkt ist ein Google-Apps-Script-Webapp (`doGet`), der zwei Ausgabeformate liefert: ein vollständig server-gerendertes HTML-Dashboard (Legacy-Fallback) und eine JSON-Response für das GitHub-Pages-Frontend.

## Endpunkt

```
GET https://script.google.com/macros/s/<SCRIPT_ID>/exec
```

`<SCRIPT_ID>` ist die Deployment-ID der Webapp. Die URL bleibt über alle Deployments hinweg stabil (siehe `docs/DEPLOYMENT.md`).

## URL-Parameter

| Parameter | Pflicht | Werte | Zweck |
|---|---|---|---|
| `pw` | ja | String | Dashboard-Passwort, muss mit Config-Key `DASHBOARD_PW` übereinstimmen |
| `format` | nein | `json` | Wenn gesetzt: JSON-Response statt HTML |

## Responses

### HTML-Response (Default, ohne `format=json`)

Bei fehlerhafter oder fehlender `pw`: HTML-Login-Seite (einfaches dunkles Input-Feld, Titel „74653 Wetter"). Bei korrekter `pw`: Das vollständige `Dashboard.html`-Template wird gerendert und mit dem aktuellen Datenstand befüllt. Rolle: Fallback, falls GitHub Pages nicht erreichbar ist.

Content-Type: `text/html; charset=UTF-8`

### JSON-Response (`?pw=<DASHBOARD_PW>&format=json`)

Content-Type: `application/json`

Schema:

```json
{
  "version": "4.0.0",
  "history": [ ... ],
  "lastPoll": "2026-04-09T05:30:00.000Z",
  "generated": "2026-04-09T05:31:12.341Z"
}
```

Feld-Erklärungen:

| Feld | Typ | Beschreibung |
|---|---|---|
| `version` | String | Semver-Version des Backends. Kommt aus der Konstante `CODE_GS_VERSION` in `backend/Code.gs`. Das Frontend zeigt sie im Footer neben seiner eigenen Version an. |
| `history` | Array | Bis zu 7 Tage, neuester Tag zuerst. Format siehe unten. |
| `lastPoll` | String (ISO 8601) oder `null` | Zeitstempel des letzten erfolgreichen Polls. `null` wenn noch nie erfolgreich gepollt wurde. |
| `generated` | String (ISO 8601) | Zeitstempel der JSON-Generierung. Gibt an, wie frisch die Antwort ist. |

#### `history[]`-Item-Schema

```json
{
  "date": "2026-04-09",
  "slots": [
    { "slot": "Nachts",      "k": false, "s": false, "e": false, "g": false },
    { "slot": "Morgens",     "k": true,  "s": false, "e": true,  "g": false },
    { "slot": "Vormittags",  "k": true,  "s": true,  "e": false, "g": true  },
    { "slot": "Mittags",     "k": false, "s": true,  "e": false, "g": false },
    { "slot": "Nachmittags", "k": false, "s": true,  "e": true,  "g": false },
    { "slot": "Abends",      "k": true,  "s": true,  "e": false, "g": false }
  ]
}
```

Jeder Tag hat **genau 6 Zeitfenster**:

| Slot-Name | Stunden |
|---|---|
| Nachts | 00–04 |
| Morgens | 04–08 |
| Vormittags | 08–12 |
| Mittags | 12–14 |
| Nachmittags | 14–18 |
| Abends | 18–24 |

Jeder Sensor-Key (`k`, `s`, `e`, `g`) kann folgende Werte haben (siehe `aggregateSensor()` in `backend/Code.gs`):

| Wert | Bedeutung |
|---|---|
| `true` | Mindestens ein Poll in diesem Zeitfenster hat AKTIV gemeldet |
| `false` | Alle Polls in diesem Zeitfenster haben RUHE gemeldet |
| `"offline"` | Sensor war im Zeitfenster als OFFLINE gemeldet (DECT nicht erreichbar) |
| `"fehler"` | Sensor hat einen Fehler gemeldet (z.B. Gmail-Abfrage fehlgeschlagen) |
| `null` | Keine Daten vorhanden (z.B. Script lief nicht oder Zeitfenster in der Zukunft) |

Aggregations-Priorität bei mehreren Polls pro Fenster: `AKTIV > FEHLER > OFFLINE > RUHE > null`. Einmal aktiv gesehen = aktiv für das ganze Fenster.

## Beispiel — vollständige JSON-Response

```json
{
  "version": "4.0.0",
  "history": [
    {
      "date": "2026-04-09",
      "slots": [
        { "slot": "Nachts",      "k": false, "s": false, "e": false, "g": false },
        { "slot": "Morgens",     "k": true,  "s": false, "e": true,  "g": null },
        { "slot": "Vormittags",  "k": null,  "s": null,  "e": null,  "g": null },
        { "slot": "Mittags",     "k": null,  "s": null,  "e": null,  "g": null },
        { "slot": "Nachmittags", "k": null,  "s": null,  "e": null,  "g": null },
        { "slot": "Abends",      "k": null,  "s": null,  "e": null,  "g": null }
      ]
    },
    {
      "date": "2026-04-08",
      "slots": [
        { "slot": "Nachts",      "k": false, "s": false, "e": false, "g": false },
        { "slot": "Morgens",     "k": true,  "s": false, "e": true,  "g": false },
        { "slot": "Vormittags",  "k": true,  "s": true,  "e": false, "g": true  },
        { "slot": "Mittags",     "k": false, "s": true,  "e": false, "g": false },
        { "slot": "Nachmittags", "k": "offline", "s": true, "e": true, "g": false },
        { "slot": "Abends",      "k": true,  "s": true,  "e": false, "g": false }
      ]
    }
  ],
  "lastPoll": "2026-04-09T05:30:12.000Z",
  "generated": "2026-04-09T05:31:04.183Z"
}
```

In diesem Beispiel:

- Heute (2026-04-09): Nur Nachts + Morgens haben Daten, alles danach ist `null` — das Script läuft seit Mitternacht nur ein paar Mal.
- Gestern (2026-04-08): Vollständiger Tag, Küche war am Nachmittag OFFLINE (DECT nicht erreichbar), alles andere normal.

## Error-Cases

| Situation | Response |
|---|---|
| `pw` fehlt oder falsch | HTML-Login-Seite mit dunklem Theme, HTTP 200 (kein 401 — GAS-Limitation, nicht Absicht) |
| Sheet leer, `history[]` leer | Gültiges JSON mit `"history": []`, `"lastPoll": null`. Frontend zeigt Empty-State. |
| Script-Laufzeitfehler | Google Apps Script Standard-Error-Seite (HTML), HTTP 500 |

## HTTP-Header und Caching

Google Apps Script setzt Standard-Header. Es gibt **keine expliziten Cache-Header** — Frontend und API kommunizieren direkt ohne Proxy. Das Frontend kann Frische durch Query-String-Cache-Buster erzwingen. Auto-Refresh im Frontend: alle 10 Minuten.

CORS: Apps-Script-Webapps erlauben Cross-Origin-Requests standardmäßig, sofern Zugriff auf `ANYONE_ANONYMOUS` gesetzt ist (siehe `backend/appsscript.json`).

## Wie das Frontend die Version liest

Das GitHub-Pages-Frontend (`index.html`) fetcht `...&format=json`, liest `data.version` aus der Response und zeigt sie neben der eigenen `FRONTEND_VERSION` im Footer:

```
74653 · Letzte Messung vor 4 Min.
Frontend v1.0.0 · Backend v4.0.0
```

Der GAS-Fallback (`backend/Dashboard.html`) macht dasselbe — er liest aber `SERVER_DATA.version` aus dem Template-Payload statt aus einem fetch, weil bei ihm die Daten bereits server-seitig injiziert sind.

## Gesang-Modus (`?mode=karsten`)

Das GitHub-Pages-Frontend hat einen erweiterten Modus, der über den URL-Parameter `?mode=karsten` aktiviert und danach in `localStorage` unter dem Key `wetter_mode` persistiert wird. In diesem Modus zeigt das Frontend den Gesang-Sensor (Telefon-Aktivität) mit vollem Detail an. Im Normalmodus bleibt dieser Sensor im UI dezent versteckt.

Wichtig: Dieser Modus ist **rein frontend-seitig**. Die JSON-API liefert in beiden Modi dieselben Daten. Der Modus beeinflusst nur die Darstellung im Frontend, nicht den Endpunkt. Auf der Backend-Seite gibt es keinen Mode-Parameter.

Deaktivierung: Über den Toggle „Erweiterten Modus deaktivieren" im Frontend-Footer, der sowohl `localStorage.wetter_mode` löscht als auch den URL-Parameter via `history.replaceState` entfernt.

## Referenzen

- Endpunkt-Implementation: `doGet()` in `backend/Code.gs`
- Aggregations-Logik: `getDashboardData()`, `aggregateSensor()` in `backend/Code.gs`
- Config-Key `DASHBOARD_PW`: `docs/CONFIG.md`
- Deployment-Workflow: `docs/DEPLOYMENT.md`
