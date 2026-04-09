# Changelog

Append-only, umgekehrt chronologisch. Neuester Eintrag oben.

Format pro Eintrag:
```
## YYYY-MM-DD — <Release-Tag>

### <komponente> <neue-version>
- Kurze Beschreibung der Änderung
- Optional: Breaking-Change-Hinweis
```

---

## 2026-04-09 — 2026-04-09-initial-handover

### repo-bootstrap
- Initialer Handover von Cowork in dieses Repo als Single Source of Truth für Frontend, Backend und Dokumentation.
- `VERSIONS.json` angelegt — Komponenten-basierte Semver als SSoT für alle Versionsstände.
- `CLAUDE.md` um System-Übersicht, Ordnerstruktur, Scope-Regeln (Repo vs. Cowork), Deployment-Workflow und vollständige Versionierungs-Regeln erweitert.
- `docs/ARCHITECTURE.md` angelegt — Datenfluss-Diagramm, Komponenten-Verantwortlichkeiten, Sicherheits- und Resilienz-Mechanismen.
- `CHANGELOG.md` (diese Datei) angelegt.

### index.html 1.0.0
- Erste getrackte Version des Frontend-Dashboards. Reflektiert den aktuellen Live-Stand auf `weckrain.derkarsten.de` nach dem 2026-04-Redesign (Stacked Bars, zwei-spaltiges Desktop-Layout, Kurzlabels, WCAG-AA-Kontraste, fließende clamp()-Skalierung, geteilter Width-Wrapper, Loading-Screen mit Progress-Animation, `?mode=karsten`-Toggle für Gesang).
- Version-Infrastruktur nachgerüstet: Header-Kommentar nach `<!DOCTYPE html>`, `FRONTEND_VERSION`-Konstante im Config-Block, `backendVersion`-State lest `version`-Feld aus JSON-API-Response (und aus `wetter_cache`-LocalStorage), Footer zeigt `Frontend v<FRONTEND_VERSION> · Backend v<backendVersion>`.

### backend/Code.gs 4.0.0
- Startversion im Repo. Respektiert die V4.0-Historie aus der Pre-Repo-Zeit.
- Vollständiger Funktionsumfang laut Cowork-Block-5-Handover: Fritz!Box-Polling alle 30 Min (MD5-Auth), Smart-Home Energiezähler-Delta mit 2-Wh-Standby-Filter, Gmail-Push-Scan für Tür, CSV-Anrufliste für Telefon, Inaktivitäts- und Ausfallalarme mit Kontext-Historie, Entwarnungs-Mails, E-Mail-Status-Abfrage, Healthchecks.io-Heartbeat, JSON-API via `doGet()` mit `version`-Feld, Systemlog-Setup/Heartbeat mit Version, Log-Rotation >90 Tage.
- **Integritäts-Drift gegenüber Handover-Block:** Datei wurde vor dem Upload ins Repo durch einen Formatter (vermutlich Prettier) gelaufen. Double-Quotes statt Single-Quotes, andere Zeilenumbrüche bei langen Funktionsaufrufen. Funktional identisch zum Cowork-Block 5 (alle 32 Top-Level-Funktionen und -Konstanten matchen, Signaturen identisch). Effektive Repo-Metriken: 1327 Zeilen, sha256 `10d940b5b4fea4d8f3279e5ed4b01a015d08adfbf7d86a7ceb297d7830868707`. Erwartet laut Handover waren 1162 Zeilen / sha256 `369fc0667961d309ba040f69349002d32e0c1601631a7809e733aa692aa5427c`.

### backend/appsscript.json 1.0.0
- Startversion im Repo. GAS-Manifest-Snapshot: V8-Runtime, Europe/Berlin, Web-App mit `USER_DEPLOYING` + `ANYONE_ANONYMOUS`.

### backend/Dashboard.html 1.0.0
- Startversion im Repo. Legacy Desktop-Fallback, server-gerendert von `Code.gs` → `doGet()` via `HtmlService.createTemplateFromFile('Dashboard')`.
- Repo-Metriken: 2189 Zeilen, sha256 `27cb1344de17377569ed489af1e6e7cfd1ce912f0995da9631226c89fd31fb1f`.
- **Offene Abweichung vom Cowork-Prompt:** Datei enthält keinen Version-Header-Kommentar nach `<!doctype html>` und keine `DASHBOARD_HTML_VERSION`-JS-Konstante. Die Version wird derzeit ausschließlich über `VERSIONS.json` und `CHANGELOG.md` getrackt. Das Nachrüsten ist ein kleiner Patch — wird bei der nächsten Iteration dieser Datei mit-erledigt (dann Bump auf 1.0.1 mit Header + Konstante + Footer-Anzeige).

### docs (Runde 2)
- `docs/HARDWARE.md` (78 Zeilen) — Fritz!Box-Modell, DECT-Zuordnung, Sensor→Hardware→Dashboard-Label-Mapping.
- `docs/API.md` (168 Zeilen) — vollständige `doGet()`-Spec inkl. JSON-Schema, Sensor-Werte, Beispiel-Response, Error-Cases, `?mode=karsten`-Abschnitt.
- `docs/GOOGLE_SHEET.md` (90 Zeilen) — Tab-Struktur (Log/Systemlog/Config), Rotation, Zugriff.
- `docs/CONFIG.md` (85 Zeilen) — tabellarische Config-Key-Referenz mit Typen und Defaults, Script-Properties-Abschnitt für `FRITZBOX_PASS`.
- `docs/DEPLOYMENT.md` (114 Zeilen) — Frontend/Backend-Deploy-Pfade, clasp-Workflow, Post-Deploy-Checks, Rollback.
- `docs/MONITORING.md` (95 Zeilen) — Inaktivitäts-/Ausfallalarme, Entwarnungen, Kontext-Historie, Healthchecks.io-Dead-Man's-Switch, Diagnose-Reihenfolge.
- `docs/KNOWN_ISSUES.md` (138 Zeilen) — Issue 1: Gesang/Telefon-Erkennung (offen, Patch-Skizze, Verifikations-Schritt); Issue 2: IP-Rotation (gelöst); ggf. weitere.
