# Deployment — Weckrain Check

Der Weckrain Check besteht aus drei deploybaren Teilen mit je eigenem Workflow. Sie sind entkoppelt: Ein Backend-Deploy zieht kein Frontend-Deploy nach sich und umgekehrt. Die Versionen werden unabhängig voneinander in `VERSIONS.json` geführt.

## Überblick

| Teil | Quelle im Repo | Ziel | Trigger |
|---|---|---|---|
| Frontend | `index.html` (+ `CNAME`, `VERSIONS.json`) | GitHub Pages → `weckrain.derkarsten.de` | Push auf `main` |
| Backend | `backend/Code.gs` + `backend/appsscript.json` + `backend/Dashboard.html` | Google Apps Script Webapp → stabile `<SCRIPT_ID>`-URL | Manueller Copy-Paste oder `clasp push` + Deploy-Aktion |
| Config | `docs/CONFIG.md` beschreibt, Werte liegen im `Config`-Sheet + Script Properties | Google Sheet + Apps-Script-Editor | Sofort beim Speichern, kein Re-Deploy |

## Frontend-Deployment

### Voraussetzungen

Das Frontend ist eine einzige `index.html`-Datei. Sie wird ohne Build-Step an GitHub Pages ausgeliefert — React läuft über Babel Standalone in-browser. Kein Node, kein Webpack, kein Vite. Das ist eine bewusste Entscheidung, damit das Projekt auf einem Laptop ohne Toolchain reparierbar bleibt.

### Schritte

1. `index.html` im Repo-Root ändern.
2. `FRONTEND_VERSION`-Konstante im Quelltext bumpen (Semver).
3. `VERSIONS.json` im Repo aktualisieren: `frontend.version`, `frontend.updated`, `frontend.changelog_ref`.
4. `CHANGELOG.md` ergänzen: Neuer Eintrag mit dem gleichen Datum.
5. `git add`, `git commit`, `git push origin main`.
6. GitHub Pages baut automatisch (ein paar Sekunden bis Minuten) und spielt die neue Version auf `weckrain.derkarsten.de` aus.
7. Im Browser mit Hard-Reload (`Cmd+Shift+R` / `Ctrl+Shift+R`) prüfen, ob die neue `FRONTEND_VERSION` im Footer steht.

### Domain und CNAME

Die Domain `weckrain.derkarsten.de` zeigt per CNAME-Record auf `karstenhoffmann.github.io`. Die Datei `CNAME` im Repo-Root enthält genau eine Zeile: `weckrain.derkarsten.de`. Diese Datei darf nicht gelöscht werden — ohne sie fällt die Custom-Domain-Zuordnung weg.

### Rollback Frontend

GitHub Pages serviert immer den aktuellen Stand von `main`. Rollback = `git revert <commit>` + push. Es gibt keinen separaten Deploy-Knopf, und es gibt keine Deploy-Historie zum Klicken.

## Backend-Deployment

Das Backend ist Google Apps Script, gebunden an ein bestimmtes Google Sheet. Es gibt zwei Wege, Code reinzuspielen: Copy-Paste über die Web-UI (Variante A) und `clasp` über die Kommandozeile (Variante B). Für einmalige Fixes ist Variante A schneller, für häufige Iterationen lohnt sich Variante B.

### Variante A — Copy-Paste (einfach, kein Tooling)

1. Im Monitoring-Gmail-Account einloggen.
2. Ziel-Sheet öffnen (siehe `docs/GOOGLE_SHEET.md`, „Zugriff und Ownership").
3. Menü `Extensions → Apps Script` öffnen.
4. Im linken Datei-Baum `Code.gs` auswählen.
5. Den kompletten Inhalt markieren, mit dem aktuellen Stand aus `backend/Code.gs` im Repo überschreiben.
6. Oben die `CODE_GS_VERSION`-Konstante bumpen — **nur** wenn sie nicht schon im Repo-Code korrekt steht.
7. `Ctrl+S` (Speichern).
8. Oben rechts `Deploy → Manage deployments` → aktives Deployment auswählen → `Edit` (Stift) → Version auf `New version` → `Deploy`. **Wichtig:** Niemals ein neues Deployment anlegen — immer das bestehende bearbeiten. Sonst ändert sich die `<SCRIPT_ID>`-URL, und das Frontend läuft gegen eine tote URL.
9. Im Apps-Script-Editor `Execution log` öffnen, `testPoll` manuell ausführen, Ausgabe prüfen: Kein `FEHLER`-Eintrag, alle Sensoren reagieren wie erwartet.
10. `VERSIONS.json` im Repo aktualisieren (`backend.version`, `backend.updated`, `backend.changelog_ref`), `CHANGELOG.md` ergänzen, commit, push.

### Variante B — `clasp` (für häufigere Iterationen)

Voraussetzung: Node installiert, `npm install -g @google/clasp`, `clasp login` einmalig im Monitoring-Account.

1. Im Repo-Unterordner `backend/` ein `.clasp.json` mit der `scriptId` des existierenden Apps-Script-Projekts anlegen. Diese Datei **nie** ins Repo committen (`.gitignore`-Eintrag).
2. `clasp pull` holt den Stand aus dem Script-Editor — einmalig um den lokalen Stand zu verifizieren.
3. Änderungen machen, `clasp push` schiebt sie hoch.
4. Bei Version-Bump: `clasp deploy --deploymentId <existing-id>` überschreibt das bestehende Deployment. Ohne `--deploymentId` entsteht ein neues, was die URL ändert — unerwünscht.
5. Weiter wie in Variante A, Schritt 9 + 10.

### URL-Stabilität

Die Webapp-URL `https://script.google.com/macros/s/<SCRIPT_ID>/exec` bleibt über Deployments hinweg stabil, solange immer das gleiche Deployment aktualisiert wird (`Manage deployments → Edit → New version`, nicht „New deployment"). Das Frontend hat diese URL hart in `index.html` codiert. Ein Wechsel der URL bedeutet einen Frontend-Bump.

### Deploy-Settings prüfen

Beim Bearbeiten des Deployments muss gesetzt sein:

- **Execute as:** Me (der Monitoring-Account)
- **Who has access:** Anyone

„Anyone" ist notwendig, damit das GitHub-Pages-Frontend (ohne Google-Login) die API fetchen kann. Der Zugriffsschutz läuft über den `pw`-Parameter und das Obscurity-Prinzip (siehe `docs/CONFIG.md`, „Sicherheit").

### Rollback Backend

Der Apps-Script-Editor führt eine Versionshistorie unter `Deploy → Manage deployments → Version`. Jedes Speichern + Deploy erzeugt eine neue Version. Rollback = im Deploy-Dialog eine frühere Version wählen und aktivieren. Alternativ: Alte `Code.gs`-Fassung aus dem Git-Repo einchecken, kopieren, neu deployen (Variante A Schritte 5–9).

### Erstes Einrichten (nicht Update)

Für den Erstaufbau eines Scripts von Grund auf — Sheet anlegen, Apps-Script-Projekt binden, Trigger einrichten, erste Werte in Config + Script Properties schreiben — gibt es die Einmalfunktion `setupTrigger()` in `backend/Code.gs`. Sie wird manuell im Apps-Script-Editor gestartet und legt den 30-Minuten-Trigger an. Danach läuft das System selbständig.

## Config-Änderung (kein Deploy)

Eine Änderung am Config-Sheet oder an den Script Properties wirkt **sofort beim nächsten Poll**. Kein Re-Deploy nötig. Siehe `docs/CONFIG.md`.

## Versionierungs-Workflow

Version-Bumps laufen immer durch drei Stellen, sonst laufen Frontend und Backend Footer auseinander:

1. Die Konstante im Code (`FRONTEND_VERSION` oder `CODE_GS_VERSION`).
2. `VERSIONS.json` im Repo.
3. `CHANGELOG.md` im Repo.

`VERSIONS.json` ist die Single Source of Truth für „was ist gerade ausgerollt". Der Footer des Frontends zeigt diese Werte. Beim Debuggen ist es der erste Check: Stimmt die im Browser sichtbare Version mit der in `VERSIONS.json` überein? Wenn nicht, liegt ein Deploy-Drift vor.

## Wartung

### `cleanupOldLogs()`

Die Log-Rotation (Löschen von Log-Einträgen > 90 Tage, siehe `docs/GOOGLE_SHEET.md`) ist nicht automatisch eingerichtet. Empfohlen: Im Apps-Script-Editor unter `Triggers` einen monatlichen Trigger für `cleanupOldLogs` einrichten. Alternativ manuell alle paar Monate. Das Sheet verträgt problemlos 17.500 Zeilen pro Jahr, wird aber langsamer beim Öffnen.

### Zugriffstests nach Router-Umzug

Bei einem Fritz!Box-Wechsel oder Hardware-Reset verlieren die `ScriptProperties` ihren Energiezähler-Stand nicht — aber der tatsächliche Zähler in der Fritz!Box springt auf 0 zurück. Das führt beim nächsten Poll zu einem negativen Delta, das vom Code als „kein AKTIV" interpretiert wird. Empfehlung: Nach einem Router-Reset die Keys `lastWasserkocherEnergy` und `lastTvEnergy` in den Script Properties manuell auf 0 setzen.

## Referenzen

- Setup-Funktion: `setupTrigger()` in `backend/Code.gs`
- Test-Funktionen: `testPoll()`, `testEmail()` in `backend/Code.gs`
- Config-Keys: `docs/CONFIG.md`
- Versionsfeld: `VERSIONS.json`, `CHANGELOG.md`
