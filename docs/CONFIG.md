# Config — Weckrain Check

Konfiguration ist zweigeteilt: Sichtbare Werte liegen im `Config`-Tab des Google Sheets (Key/Value), Geheimnisse liegen in den Script Properties des Apps-Script-Projekts. Dieses Dokument ist die Referenz für alle Keys.

## Config-Sheet (`Config`-Tab)

Lesbar für jeden, der Zugriff auf das Sheet hat. Wird beim Script-Start über `getConfig(key, default)` bzw. `getConfigNumber(key, default)` in `backend/Code.gs` gelesen.

| Key | Typ | Default | Zweck |
|---|---|---|---|
| `FRITZBOX_URL` | String | — | MyFRITZ!-URL der Fritz!Box, inkl. `https://` und ohne Trailing-Slash. Beispiel: `https://xxxxxxxxxxxx.myfritz.net` |
| `FRITZBOX_USER` | String | — | Benutzername des Nur-Lese-Monitor-Users. Konvention: `monitor_api` |
| `ALERT_EMAIL` | String | — | Empfänger-Adresse für Inaktivitäts- und Ausfallalarme. In der Regel die Primär-Adresse, die Alarme erhält (nicht der Monitoring-Account selbst). |
| `STATUS_EMAILS` | String (komma-separiert) | leer | Zusätzliche Empfänger für die tägliche Status-Mail. Wenn leer, geht keine Status-Mail raus — nur Alarme und Heartbeats im Systemlog. |
| `DASHBOARD_PW` | String | — | Passwort für `?pw=...`. Muss mit `FRONTEND_DASHBOARD_PW` (clientseitig hart eingetragen in `index.html`) übereinstimmen. |
| `HEALTHCHECK_URL` | String | leer | Vollständige Ping-URL von Healthchecks.io (Dead Man's Switch). Wenn leer, wird nicht gepingt. |
| `INAKTIVITAET_STUNDEN` | Number | `18` | Schwellwert für den Inaktivitätsalarm. Nach so vielen Stunden ohne `Aktivitaet_erkannt = JA` geht ein Alarm raus. |
| `AUSFALL_POLLS` | Number | `6` | Schwellwert für den Ausfallalarm. Nach so vielen fehlgeschlagenen Polls in Folge geht ein Alarm raus (bei 30-min-Takt: 6 × 30 min = 3 Stunden). |

Fehlende Keys führen nicht zum Absturz. `getConfig()` liefert stattdessen den Default zurück, und `logSystem('WARNUNG', ...)` wird **nicht** automatisch ausgelöst — das Script vertraut darauf, dass der Admin die Config beim Setup einmal gepflegt hat.

## Script Properties (Geheimnisse)

Sichtbar nur für Editoren des Apps-Script-Projekts selbst. Zugriff über `PropertiesService.getScriptProperties().getProperty(key)`.

| Key | Typ | Beschreibung |
|---|---|---|
| `FRITZBOX_PASS` | String | Passwort des `monitor_api`-Users in der Fritz!Box. **Nie in das Config-Sheet.** |

Setzen: Im Apps-Script-Editor unter `Project Settings → Script Properties → Add script property`.

## Runtime-State Properties

Neben dem Geheimnis nutzt das Backend `ScriptProperties` außerdem als kleinen State-Store, um Zustand über die 30-Minuten-Trigger hinweg zu behalten (GAS-Trigger sind stateless). Diese Werte werden vom Script selbst gesetzt und gelesen — Hand weg.

| Key | Typ | Beschreibung |
|---|---|---|
| `lastWasserkocherEnergy` | Number | Letzter bekannter Energiezähler-Stand der Wasserkocher-Steckdose (in Wh). Grundlage der Delta-Prüfung. |
| `lastTvEnergy` | Number | Dito für die TV-Steckdose. |
| `lastSuccessfulPoll` | String (ISO 8601) | Zeitstempel des letzten erfolgreichen Polls. Nur für Diagnose. |
| `consecutiveFailures` | Number | Zähler für aufeinanderfolgende Poll-Fehler. Wird bei Erfolg auf 0 zurückgesetzt. Grundlage für den Ausfallalarm (Schwellwert `AUSFALL_POLLS`). |
| `outageAlertSent` | Boolean-String (`true`/`false`) | Merker, ob der aktuelle Ausfall bereits gemeldet wurde. Verhindert Alarm-Spam. Wird bei Entwarnung auf `false` gesetzt. |
| `inactivityAlertSent` | Boolean-String (`true`/`false`) | Dito für den Inaktivitätsalarm (Schwellwert `INAKTIVITAET_STUNDEN`). |
| `lastHeartbeatDay` | String (`YYYY-MM-DD`) | Tag des letzten Heartbeat-Eintrags im Systemlog. Verhindert mehrere Heartbeats pro Tag. |

Diese Keys können im Apps-Script-Editor eingesehen werden, aber nicht manuell gesetzt werden, wenn alles normal läuft. Manuelles Zurücksetzen ist nur sinnvoll in zwei Fällen: Nach einer Fritz!Box-Umstellung (Energiezähler springen) oder um einen klemmenden Alarm-Merker (`outageAlertSent`, `inactivityAlertSent`) manuell zu lösen.

## Hardcodierte Werte (nicht über Config änderbar)

Zum Überblick — diese Werte stehen direkt im Code und erfordern einen Re-Deploy, wenn sie geändert werden sollen. Liste ist nicht erschöpfend, aber deckt die üblichen Stellschrauben ab.

| Name in `backend/Code.gs` | Wert | Bedeutung |
|---|---|---|
| `CODE_GS_VERSION` | `'4.0.0'` | Backend-Version (wird in JSON-API und Heartbeat sichtbar) |
| `ENABLED_SENSORS` | `{ k: true, s: true, e: true, g: true }` | Sensor-Flag-Map. `false` deaktiviert die Abfrage vollständig und schreibt `N/A` in den Log. |
| `DEVICE_KEYWORDS` | `{ k: ['Wasserkocher', 'Kettle'], s: ['Fernseher', 'TV'] }` | Substrings für das Matching Gerätename → Sensor. Siehe `docs/HARDWARE.md`. |
| `ENERGY_DELTA_THRESHOLD` | `2` | Mindest-Energiedifferenz in Wh zwischen zwei Polls, damit eine Steckdose als AKTIV zählt. |
| `DOOR_SEARCH_KEYWORDS` | Liste von Betreff-Fragmenten | Muster für die Gmail-Suche nach Türmails (Fritz!Box Push-Service). |
| `POLL_INTERVAL_MINUTES` | `30` | Trigger-Intervall in Minuten. Änderung erfordert Re-Run von `setupTrigger()`. |
| `LOG_RETENTION_DAYS` | `90` | Cutoff für `cleanupOldLogs()`. Siehe `docs/GOOGLE_SHEET.md`. |

## Auf Frontend-Seite

Das GitHub-Pages-Frontend hat eigene, frontend-seitige Konstanten am Anfang von `index.html`:

| Name | Beispiel | Bedeutung |
|---|---|---|
| `FRONTEND_VERSION` | `'1.0.0'` | Semver des Frontends, wird im Footer angezeigt. Änderung bei jeder Auslieferung. |
| `BACKEND_URL` | `'https://script.google.com/macros/s/.../exec'` | Webapp-URL. Bleibt über Deployments hinweg stabil (siehe `docs/DEPLOYMENT.md`). |
| `FRONTEND_DASHBOARD_PW` | `'...'` | Dashboard-Passwort, clientseitig hart kodiert. Muss mit Config-Key `DASHBOARD_PW` übereinstimmen. |

Hinweis zur Sicherheit: `FRONTEND_DASHBOARD_PW` ist im Quelltext einer öffentlich ausgelieferten HTML-Seite sichtbar. Der Sinn ist nicht Sicherheit gegen zielgerichtete Angriffe, sondern Auffindbarkeits-Schutz — Suchmaschinen sollen das Dashboard nicht indexieren und Zufallsbesucher sollen es nicht einfach aufrufen können. Wer den Pagesource anschaut, findet das Passwort. Das ist Absicht und Teil des Bedrohungsmodells („Schutz gegen Versehen, nicht gegen Angreifer").

## Änderungs-Workflow

Eine Änderung am Config-Sheet wirkt **sofort beim nächsten Poll** — kein Re-Deploy nötig. Eine Änderung an den Script Properties ebenso. Eine Änderung an den hardcodierten Konstanten oder an `FRONTEND_VERSION` benötigt einen neuen Deploy (Backend) bzw. einen Git-Push nach `main` (Frontend, via GitHub Pages).

Beim Bump von `CODE_GS_VERSION` und `FRONTEND_VERSION`: `VERSIONS.json` im Repo ebenfalls aktualisieren — das ist die Single Source of Truth für die Versionsstände. Siehe `docs/DEPLOYMENT.md` und `CHANGELOG.md`.

## Referenzen

- Lese-Helfer: `getConfig()`, `getConfigNumber()` in `backend/Code.gs`
- Sheet-Tabs: `docs/GOOGLE_SHEET.md`
- Deployment-Workflow: `docs/DEPLOYMENT.md`
- Single Source of Truth für Versionen: `VERSIONS.json`
