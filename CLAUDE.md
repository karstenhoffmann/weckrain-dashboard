# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Weckrain Dashboard is a single-page weather/activity monitoring dashboard for a home in 74653 (Weckrain). It displays sensor activity across time slots for kitchen (Küche), reading room (Lesezimmer), entrance (Eingang), and optionally birdsong/phone (Gesang). The frontend lives in a single `index.html` file — no build system, bundler, or package manager.

## Architecture

- **Single-file frontend**: Everything (HTML, CSS, React components, logic) is in `index.html`
- **Runtime-transpiled React**: Uses React 18 + Babel standalone from CDN (`<script type="text/babel">`) — no JSX build step
- **Backend**: Google Apps Script (`backend/Code.gs`) polls sensors via Fritz!Box AHA-HTTP-Interface every 30 min, logs to Google Sheets, and serves a JSON API (`?format=json&pw=<password>`)
- **Hosting**: GitHub Pages with custom domain `weckrain.derkarsten.de` (CNAME → karstenhoffmann.github.io)
- **Language**: UI is entirely in German
- **Concept**: Displays sensor data as an anonymized "weather station" ("MAMA WETTER") — only insiders know what it really monitors

## Key Concepts

- **Time Slots (SLOTS)**: Day is divided into 6 slots — Nachts (00-04), Morgens (04-08), Vormittags (08-12), Mittags (12-14), Nachmittags (14-18), Abends (18-24)
- **Sensors**: `k`=Küche (FRITZ!DECT 200/Wasserkocher), `s`=Lesezimmer (FRITZ!DECT 200/Fernseher), `e`=Eingang (FRITZ!DECT 350/Haustür), `g`=Gesang (Fritz!Fon X6/Anrufliste). Values: `true` (active), `false` (inactive), `"offline"`, `"fehler"` (error), or `null` (no data)
- **Extended mode (Gesang)**: The `g` sensor (phone activity) is hidden by default. It only becomes visible when `?mode=karsten` URL parameter is used (stored in localStorage as `wetter_mode`). A toggle in the footer deactivates the mode and cleans up the URL.
- **Sky themes (SKY)**: Each slot has a visual theme controlling sun position, star visibility, colors, etc.

## Component Structure

- `App` — state manager (loading/login/error/ready), handles auth via localStorage and URL param `?pw=`, manages `showBird` flag
- `DashboardMain` — main view with day/slot selection, auto-refreshes every 10 minutes, two-column layout on `lg` breakpoint
- `House` — animated SVG house scene with sky, sun arc, windows lit by sensor state, conditional bird rendering
- `MiniHouse` — compact SVG version for the weekly history grid, conditional bird rendering
- `LoginScreen` — password auth
- `LoadingScreen` — animated progress bar with fade-in, shows cached data immediately while background fetch runs

## Responsive Design

Three breakpoints via `useBreakpoint()`: `sm` (<520px), `md` (520–899px), `lg` (900px+). On `lg` the Wochenverlauf moves into a second column next to the House. All content (House, Legend, Hint, Slot-Nav) shares a single width wrapper (`maxWidth: 604px`) so left/right edges are flush-aligned at every viewport. Slot-nav uses CSS `clamp()` for smooth fluid interpolation between breakpoints.

## Development

No build or test commands. To develop:
1. Edit `index.html` directly
2. Open in a browser (or serve with any static file server)
3. Deploy by pushing to `main` — GitHub Pages deploys automatically

## Auth

Password-protected: prompted on first visit, stored in localStorage. The password is configured in the Google Apps Script Config sheet (`DASHBOARD_PW`). Can also be passed via URL param `?pw=`. Cached data is shown immediately on revisit, with fresh data fetched in the background (no loading screen flicker).

## Conventions

- Color constants are in the `C` object; sky themes in `SKY`
- All inline styles (no CSS classes beyond the initial `<style>` block)
- Responsive via `useIsMobile()` (mob boolean) and `useBreakpoint()` (sm/md/lg) hooks
- Animations use CSS transitions and SVG `<animate>` elements, plus a custom `useAnimatedValue` hook
- All text in German
- WCAG AA contrast throughout (textLo #8494a7, textFaint #5e7086)

---

## System-Übersicht

Dieses Repo ist ab dem 2026-04-09-Handover die **Single Source of Truth** für das gesamte Weckrain-Check-System:

- **Frontend** (`index.html`) — React-Dashboard, deployed auf GitHub Pages unter `weckrain.derkarsten.de`
- **Backend** (`backend/`) — Google Apps Script (Code.gs, Dashboard.html, appsscript.json), deployed via GAS-Editor oder clasp
- **Dokumentation** (`docs/`) — Architektur, Hardware, API, Google Sheet, Deployment, Monitoring, Known Issues, Config

High-Level-Projektstrategie, Recherche-Notizen, historische Entscheidungen und der persönliche Kontext bleiben bei Cowork. Alles Technische gehört ab jetzt hier ins Repo.

## Ordnerstruktur

```
/
├── index.html              # Frontend-Dashboard (GitHub Pages)
├── CNAME                   # weckrain.derkarsten.de
├── README.md
├── CLAUDE.md               # diese Datei
├── VERSIONS.json           # Single Source of Truth für alle Komponenten-Versionen
├── CHANGELOG.md            # Änderungsprotokoll (append-only, umgekehrt chronologisch)
├── backend/
│   ├── Code.gs             # GAS-Hauptlogik
│   ├── Dashboard.html      # GAS-Template (Legacy Desktop-Fallback)
│   └── appsscript.json     # GAS-Manifest
└── docs/
    ├── ARCHITECTURE.md
    ├── HARDWARE.md
    ├── API.md
    ├── GOOGLE_SHEET.md
    ├── CONFIG.md
    ├── DEPLOYMENT.md
    ├── MONITORING.md
    └── KNOWN_ISSUES.md
```

## Scope: Repo vs. Cowork

**Claude Code (dieses Repo) darf:**
- Alle Dateien im Repo anlegen, ändern, löschen
- Frontend und Backend gleichermaßen weiterentwickeln
- Dokumentation aktuell halten
- Bugs fixen, Features bauen, Refactorings durchführen
- Commits + PRs erstellen

**Claude Code (dieses Repo) soll NICHT:**
- Persönliche/familiäre Kontext-Infos ins Repo schreiben (die bleiben bei Cowork)
- Echte Secrets, Passwörter oder die reale MyFRITZ!-URL committen (nur Platzhalter verwenden)
- Eigenmächtig Deployment auf GAS oder GitHub Pages auslösen — Karsten kontrolliert den Deploy-Moment

**Bei Cowork bleibt:**
- High-Level-Projektstrategie und Entscheidungsrationale
- Verworfene Alternativen (z.B. Raspberry Pi / Home Assistant)
- Recherche-Notizen
- Persönlicher Kontext
- Referenz auf dieses Repo als technische SSoT

## Deployment-Workflow

### Frontend (`index.html`)

```bash
git add index.html VERSIONS.json CHANGELOG.md
git commit -m "index.html X.Y.Z: <kurzbeschreibung>"
git push
```

GitHub Pages deployt automatisch. Live in ~1-2 Minuten unter `weckrain.derkarsten.de`.

### Backend (`backend/Code.gs`, `Dashboard.html`, `appsscript.json`)

**Variante A — Copy-Paste in GAS-Editor:**

1. Datei im Repo ändern, Version bumpen (siehe unten), committen
2. In GAS-Editor einloggen (Google-Konto des Monitors)
3. Inhalt aus dem Repo in die entsprechende Datei im GAS-Editor kopieren
4. **Manage Deployments → Stift → New Version → Deploy** (Web-App-URL bleibt gleich)
5. Healthcheck: nächsten Trigger-Lauf abwarten, `Systemlog`-Tab im Google Sheet prüfen — dort steht die aktive Code.gs-Version (siehe Versionierungs-Abschnitt)

**Variante B — `clasp` (Google Apps Script CLI):**

1. Einmalig: `clasp login`, dann `cd backend && clasp clone <scriptId>` (die Script-ID steht in der Web-App-URL im GAS-Editor)
2. Nach Änderungen: `clasp push` → Code liegt im GAS-Editor
3. Deployment wie in Variante A (manuell über Manage Deployments)

**Wichtig:** Nach jedem Backend-Deploy das `Systemlog` im Google Sheet prüfen — dort erscheint beim nächsten Poll ein Eintrag mit der aktiven Code.gs-Version.

## Versionierung

**Prinzip:** Komponenten-basierte Semver. Jede Komponente (`index.html`, `backend/Code.gs`, `backend/Dashboard.html`, `backend/appsscript.json`) hat ihre eigene Semver-Version. `VERSIONS.json` im Repo-Root ist die **Single Source of Truth**.

### Bump-Regeln (Semver)

- **PATCH** (z.B. 4.0.0 → 4.0.1): Bugfix, Tippfehler, interne Refactorings, Doku-Korrekturen — keine Verhaltens- oder API-Änderung
- **MINOR** (z.B. 4.0.0 → 4.1.0): Neues Feature, rückwärtskompatibel. Neue API-Felder, neue optionale Config-Keys, neue Sensoren sind MINOR
- **MAJOR** (z.B. 4.0.0 → 5.0.0): Breaking Change. API-Feld entfernt oder umbenannt, Config-Key entfernt, Frontend muss zwingend angepasst werden

### Pflicht-Workflow für Claude Code bei jedem Commit

1. **Identifiziere** alle geänderten Komponenten
2. **Entscheide** pro Komponente den Bump-Typ (PATCH/MINOR/MAJOR). Autonomie-Regel:
   - **Eindeutig → autonom entscheiden:** Bugfix ohne Verhaltensänderung nach außen → PATCH. Neues Feature oder neues optionales API-Feld → MINOR. Dokumentiertes Breaking (API-Feld entfernt/umbenannt, Config-Key entfernt, Frontend muss zwingend angepasst werden) → MAJOR.
   - **Unklar → bei Karsten nachfragen.** Typische Grauzonen: Refactoring mit Verhaltens-Subtilitäten (PATCH oder MINOR?), neues Feld, das alte Clients ignorieren können, aber neue Clients brauchen (MINOR oder MAJOR?), interne Umbauten, die theoretisch Side-Effects haben könnten.
3. **Aktualisiere `VERSIONS.json`** (neue `version`, neues `last_updated`)
4. **Aktualisiere den Version-Header-Kommentar** in der geänderten Datei
5. **Aktualisiere die hardcodete Konstante**, die der Footer/die JSON-Response rendert (`CODE_GS_VERSION`, `FRONTEND_VERSION`, etc.)
6. **Füge einen `CHANGELOG.md`-Eintrag hinzu:** Datum, Komponente, neue Version, Beschreibung
7. **Erst dann committen**. Commit-Message-Format:
   - `<komponente> <version>: <kurzbeschreibung>`
   - Beispiel: `backend/Code.gs 4.0.1: fix Gesang false-negative (CSV-Parser)`
   - Beispiel: `index.html 1.1.0: Footer zeigt Backend-Version aus JSON-API`

### Version-Header-Kommentare (Pflicht)

In `backend/Code.gs` ganz oben:

```javascript
// ============================================================================
// Weckrain Backend — Code.gs
// Version: 4.0.0
// Last updated: 2026-04-09
// Source of truth: /VERSIONS.json
// ============================================================================
```

In `index.html` und `backend/Dashboard.html` als HTML-Kommentar direkt nach `<!DOCTYPE html>`:

```html
<!--
  Weckrain Frontend — index.html
  Version: 1.0.0
  Last updated: 2026-04-09
  Source of truth: /VERSIONS.json
-->
```

In `backend/appsscript.json` kein Kommentar möglich (JSON erlaubt keine). Die Version wird nur in `VERSIONS.json` und `CHANGELOG.md` getrackt.

### Laufzeit-Anzeige der Versionen

- **Frontend-Footer** (`index.html`): rendert `Weckrain v<FRONTEND_VERSION> · Backend v<backend.version>`. Die Frontend-Version ist als JS-Konstante `FRONTEND_VERSION` hardcoded. Die Backend-Version kommt aus dem `version`-Feld der JSON-API-Response.
- **Backend JSON-API** (`Code.gs` → `doGet()`): fügt ein `version`-Feld in den JSON-Response ein, Wert aus der hardcodeten Konstante `CODE_GS_VERSION` am Dateianfang.
- **Backend Systemlog** (`Code.gs` → `setupTrigger()` und `pollFritzBox()`): loggt beim Setup einen Eintrag `SETUP: Code.gs v4.0.0 initialisiert`. Zusätzlich loggt `pollFritzBox()` einmal pro Tag (erster Poll nach Mitternacht) einen Eintrag `HEARTBEAT: Code.gs v4.0.0 läuft`.
- **Dashboard.html-Footer** (GAS-Fallback): zeigt eigene Version + Backend-Version analog zum Hauptfrontend.

### Konsistenz-Check vor jedem Commit

Claude Code MUSS vor jedem Commit prüfen, dass diese Stellen übereinstimmen:

1. `VERSIONS.json` — `version` der Komponente
2. Header-Kommentar in der Datei
3. Bei Code-Dateien: hardcodete Konstante (`CODE_GS_VERSION`, `FRONTEND_VERSION`, `DASHBOARD_HTML_VERSION`)
4. Bei Doku: Frontmatter-Version (falls vorhanden)

Falls eine Stelle abweicht → stop, korrigieren, dann committen.

### Grundprinzip

**Kein Version-Bump ohne CHANGELOG-Eintrag. Kein CHANGELOG-Eintrag ohne Version-Bump.** Die beiden sind gekoppelt.

**`VERSIONS.json` wird nicht manuell von Karsten editiert.** Claude Code verwaltet das. Wenn Karsten eine Version sehen will, schaut er in den Footer, in `VERSIONS.json` oder ins `Systemlog`.

**Bei Unsicherheit (PATCH vs. MINOR, MINOR vs. MAJOR) wird Karsten gefragt, nicht geraten.**

**Initialer Stand (2026-04-09):**
- `backend/Code.gs` startet bei 4.0.0 mit voller Version-Infrastruktur (Header-Kommentar, `CODE_GS_VERSION`-Konstante, `version`-Feld in JSON-API, Systemlog-Heartbeat einmal pro Tag).
- `backend/Dashboard.html` startet bei 1.0.0 mit Header-Kommentar und Footer-Anzeige (liest Backend-Version aus `SERVER_DATA.version`).
- `index.html` wurde beim Handover mit Header-Kommentar, `FRONTEND_VERSION`-Konstante und erweitertem Footer nachgerüstet — siehe `CHANGELOG.md` Eintrag zum 2026-04-09.
- `backend/appsscript.json` wird nur in `VERSIONS.json` und `CHANGELOG.md` getrackt (JSON erlaubt keine Kommentare).
