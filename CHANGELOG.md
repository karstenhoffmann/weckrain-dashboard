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

## 2026-04-10 — backend/Code.gs 4.0.2 (Log-Rotation mit Archivierung)

### backend/Code.gs 4.0.2
- **`cleanupOldLogs()` komplett neu:** Verschiebt alte Zeilen jetzt in Archiv-Tabs (`Log_Archiv`, `Systemlog_Archiv`) statt sie zu löschen. Kein Datenverlust mehr.
- Archiv-Tabs werden beim ersten Lauf automatisch angelegt (Header aus dem Live-Tab übernommen).
- Live-Fenster: `Log` ≤ 30 Tage, `Systemlog` ≤ 90 Tage.
- Neu: `Systemlog` wird jetzt ebenfalls rotiert (vorher: nur `Log`).
- Neuer interner Helper `_archiveTab(ss, sourceName, archiveName, liveDays)` — liest Daten block-weise (effizient), findet den Trennpunkt chronologisch, schreibt ins Archiv per `setValues()`, löscht aus Live per `deleteRows()`.
- **Trigger noch einrichten (manuell durch Karsten):** GAS-Editor → Triggers → `cleanupOldLogs` → monatlich (z.B. 1. des Monats, 03:00 Uhr).
- **Bump-Typ: PATCH (4.0.1 → 4.0.2)** — kein API-Change, kein Breaking Change.

---

## 2026-04-10 — index.html 1.0.7 (Versionsanzeige auf Login-Screen)

### index.html 1.0.7
- `LoginScreen` zeigt jetzt unten mittig `Frontend v{FRONTEND_VERSION}` — identischer Style wie der Footer im Dashboard (fontSize 9/10, `C.textFaint`, opacity 0.6, letterSpacing 0.5). Da auf dem Login-Screen noch keine Backend-Version bekannt ist, entfällt der `· Backend v...`-Teil.
- Positionierung via `position: absolute; bottom: 20px` innerhalb des `minHeight: 100vh`-Containers (dafür `position: relative` ergänzt).
- **Bump-Typ: PATCH (1.0.6 → 1.0.7)** — rein visuell, kein Logik-Change.

---

## 2026-04-10 — index.html 1.0.6 (Passwort case-insensitive)

### index.html 1.0.6
- Passwort-Eingabe wird vor dem API-Aufruf `.toLowerCase()` normalisiert — "Weckrain", "WECKRAIN" und "weckrain" sind damit gleichwertig. Kein Backend-Change nötig, solange das gespeicherte Passwort in `DASHBOARD_PW` lowercase ist.
- Gleiches Normalisierung für `?pw=`-URL-Parameter: wird beim Einlesen sofort lowercased und so in `localStorage` gespeichert.
- **Bump-Typ: PATCH (1.0.5 → 1.0.6)** — kein Breaking Change, nur Eingabe-Normalisierung.

---

## 2026-04-10 — index.html 1.0.5 (fix: Login-Submit funktionslos)

### index.html 1.0.5
- **Bugfix:** `handleLogin` in `App` rief `e.preventDefault()` auf dem übergebenen Passwort-String auf, weil `LoginScreen` `onSubmit(input)` mit dem Klartext-Passwort aufruft — kein DOM-Event. Das warf einen TypeError und blockierte den gesamten Login-Flow.
- **Bugfix:** `handleLogin` las aus dem toten `pwInput`-State (immer `""`), statt den von `LoginScreen` übergebenen Wert zu verwenden. Das Passwort kam also nie an.
- Fix: `handleLogin` nimmt jetzt `(password)` als Argument und ruft direkt `fetchData(password.trim())` auf. Der tote `pwInput`/`setPwInput`-State wurde entfernt.
- **Bump-Typ: PATCH (1.0.4 → 1.0.5)** — reiner Bugfix, kein Verhaltens- oder API-Change.

---

## 2026-04-09 — index.html 1.0.4 (Bambi: größer, süßer, tageszeit-adaptiv)

### index.html 1.0.4
- **Größer:** Reh-Proportionen um ca. 40% hochgezogen. Körper `rx=17 ry=8` (vorher 13/6), Kopf `r=7` (vorher 5), Schatten `rx=19` (vorher 14), Beine dicker (`width=2.6` statt 1.8) und länger (13 statt 10), Ohren größer, Hals kräftiger. Position leicht verschoben auf `translate(65, 293)` damit es nicht aus dem Frame ragt.
- **Süßer:** Kopf ist jetzt ein echter Kreis statt einer flachen Ellipse (wirkt rundlicher, kindlicher). Auge deutlich vergrößert (`rx=1.6 ry=2`), mit zwei Reflex-Punkten statt einem (großer Highlight + zweiter kleiner Reflex — gibt mehr Leben im Blick). Mini-Nasen-Highlight dazu. Ohren stärker gewinkelt, inneres Ohr heller (`#e0a88a` statt `#d89b7a`). Vier statt nur sieben Bambi-Flecken auf dem Rücken. Kleine dunkle Hufe an den Beinen (Ellipsen am Bein-Ende).
- **Tageszeit-adaptive Sichtbarkeit:** Der Helligkeits-Bug („nachts am hellsten") war ein Kontrast-Problem: Das warme Braun leuchtet auf dem dunklen Nacht-Untergrund stark heraus, während es auf dem helleren Tag-Untergrund mit dem Grün verschmilzt. Fix: CSS `filter: brightness() saturate()` auf der gesamten Reh-Group, abhängig von `isDay`/`isDawn`/`isDusk`:
  - **Tag**: `brightness(1.15) saturate(1.05)` — heller und satter, sticht vom hellen Grund ab
  - **Morgen**: `brightness(0.9) saturate(0.95)` — warmer Morgenton
  - **Abend**: `brightness(0.72) saturate(0.9)` — gedämpfter Abendton
  - **Nacht**: `brightness(0.55) saturate(0.75)` — deutlich gedeckter, „leuchtet" nicht mehr
  - CSS `transition: filter 1.2s cubic-bezier(...)` sorgt für smoothe Übergänge beim Zeitfenster-Wechsel, synchron zur Hintergrund-Animation.
- **Bump-Typ: PATCH (1.0.3 → 1.0.4)** — visuelles Refinement.

---

## 2026-04-09 — index.html 1.0.3 (Süßes Bambi im Garten)

### index.html 1.0.3
- **Experimentelles Feature:** Ein süßes grasendes Bambi lebt jetzt im linken Garten zwischen den Blumen. Immer sichtbar, unabhängig vom `?mode=karsten`. Zusätzliche Deko, kein Sensor-Indikator.
- **Anatomie:** Tropfenförmiger brauner Körper mit weißem Bauch, fünf weißen Bambi-Flecken auf dem Rücken, vier dünnen Beinen mit Schatten darunter, kurzem weißem Schwanz, Hals-Kopf-Einheit mit zwei unterschiedlich gerichteten Ohren (vorderes in Fellfarbe, hinteres dunkler für Tiefe), großem süßem schwarzen Auge mit weißem Glanzpunkt und zarter Schnauze mit Nase.
- **Animationen:**
  - **Grasen-Zyklus (16s)**: Hals + Kopf rotieren alle 16 Sekunden nach unten (Grasen ~3s) und wieder hoch, mit smoother Cubic-Bezier-Easing. Dazwischen steht es einfach lieb da und „schaut in die Kamera".
  - **Blinzeln**: Zwei Mal pro 7-Sekunden-Zyklus, jeweils ~35ms kurz — unregelmäßig genug um natürlich zu wirken.
  - **Schwanz-Wackeln**: Kurze Wackel-Sequenz einmal pro 6s, sonst ruhig.
- **Position:** `translate(50, 290)` innerhalb der HOUSE-Gruppe — links neben dem Haus, zwischen/zwischen den Blumen, nicht vor den Wänden (damit das Haus nicht verdeckt wird).
- **Bump-Typ: PATCH (1.0.2 → 1.0.3)** — visuelles Feature, rein dekorativ, kein Verhaltens- oder API-Impact.

---

## 2026-04-09 — index.html 1.0.2 (Schönerer Singvogel)

### index.html 1.0.2
- **Verbesserung:** Der Singvogel im House-SVG (nur im `?mode=karsten`-Modus sichtbar) war bisher aus ein paar Ellipsen und Kreisen zusammengesetzt, wirkte klobig und war klein. Neu:
  - Tropfenförmiger Körper via `<path>`, organische Form
  - Gefalteter Flügel mit zusätzlicher Feder-Linie
  - Größerer Kopf (r=6 statt r=4.5)
  - Auge mit Highlight (weißer Glanzpunkt)
  - Zweiteiliger Schnabel (Ober-/Unterschnabel, leicht geöffnet = singt)
  - Zwei Schwanzfedern statt einer Kurve
  - Bauch-Highlight (dezenter weißer Schimmer)
  - Position verschoben: Vogel sitzt jetzt auf der linken Dachschräge (`translate(180, 75)` innerhalb der HOUSE-Gruppe) statt frei im Himmel zu schweben. Verankert, natürlicher.
  - Drei schwebende Musiknoten (♪ ♫ ♬) die jetzt nicht nur opacity pulsen, sondern tatsächlich nach oben schweben und währenddessen faden (staffelweise zeitversetzt für natürliches Gefühl).
- **Bump-Typ: PATCH (1.0.1 → 1.0.2)** — visuelle Verbesserung, kein API-Impact, nur sichtbar im Karsten-Modus.

---

## 2026-04-09 — index.html 1.0.1 (Background-Gradient Smooth-Transition)

### index.html 1.0.1
- **Fix:** Beim Wechsel zwischen Zeitfenstern (Nachts → Morgens → …) schaltete der Body-Hintergrund-Gradient hart um, während das House-SVG smooth animierte. Ursache: CSS `transition` kann `linear-gradient` nicht nativ interpolieren — Browser interpolieren nur einzelne Farbwerte, nicht Gradient-Strings.
- **Lösung:** Neuer Hook `useAnimatedColor(targetHex, duration)` interpoliert RGB-Komponenten JS-seitig via `requestAnimationFrame`, analog zum bestehenden `useAnimatedValue`. Der Hintergrund-Gradient in `DashboardMain` verwendet jetzt zwei animierte Farbwerte (`bgTop`, `bgBot`) statt der statischen Hex-Strings. Übergang dauert 1200ms mit derselben `easeInOut`-Kurve wie die Sonne-Position und die SVG-Properties.
- **Bump-Typ: PATCH (1.0.0 → 1.0.1)** — UX-Verbesserung ohne API-Änderung, kein Verhaltens-Impact außer smootherer Optik.

---

## 2026-04-09 — backend/Code.gs 4.0.1 (Gesang-Fix)

### backend/Code.gs 4.0.1
- **Fix:** Gesang/Telefon-Aktivitätserkennung in `checkPhoneActivity()` war in 4.0.0 fehlerhaft. Siehe `docs/KNOWN_ISSUES.md` Issue 1 für die vollständige Analyse.
- **Ursache:** Der Code filterte auf `typ === "1" || typ === "3"` mit dem Kommentar „Nur angenommen + ausgehend". Das stimmt aber nicht mit der Semantik des tatsächlich genutzten Endpoints (`foncalls_list.lua?csv=`, die Web-UI-URL) überein. In Fritz!OS 8.x bedeuten die Typ-Codes dort: `1 = CALLIN` (eingehend angenommen), `2 = CALLFAIL` (nicht zustande gekommen), `4 = CALLOUT` (ausgehend erfolgreich). Der alte Filter zählte also fälschlich `3` (unbekannte Semantik bei dieser URL) und ignorierte `4` (die ausgehenden Anrufe).
- **Zusätzlich:** Keine Dauer-Filterung; Separator hartkodiert auf `;`; Spalten-Offset-Kommentar war inkorrekt (7 Spalten statt realer 8).
- **Fix:**
  - Separator-Auto-Detection via `sep=<char>`-Präambel (Semikolon bei Web-UI-URL, Tab bei manuellem Web-UI-Export).
  - Spalten-Offset korrigiert: Dauer = `fields[7]`, Plausi-Check `fields.length >= 8`.
  - Neuer Helper `parseDurationMinutes()` für AVM-`H:MM`-Format mit Minuten-Aufrundung.
  - Filter: `typ ∈ {"1", "4"}` AND `dauerMinuten >= 1`.
  - Ausführliche Inline-Kommentare mit Rationale und Verweis auf Recherche-Quellen.
- **Filter-Schwelle begründet:** Die Mutter nutzt keinen Anrufbeantworter. Deshalb ist jeder Typ-1-Eintrag zu 100% eine menschliche Hörer-Abnahme und damit ein eindeutiges Lebenszeichen — auch bei sehr kurzen Gesprächen. Primärziel des Systems („lebt die Mutter, ist sie handlungsfähig?") rechtfertigt eine liberale Filterung.
- **Verifikation:** Gegen realen CSV-Export mit 20 Zeilen abgeglichen. Alle echten Gespräche (Schrozberg 50 Min, Langenau 95 Min, Weinheim 9 Min, Künzelsau 12 Min, sowie mehrere kurze) werden korrekt gezählt. Alle CALLFAIL-Einträge (insbesondere die vielen verpassten „Karsten (mobil)"-Versuche) werden korrekt verworfen.
- **Bump-Typ: PATCH (4.0.0 → 4.0.1)** — Bugfix ohne API-Änderung, kein Frontend-Impact.
- **Deploy erforderlich:** Backend-Datei muss manuell im GAS-Editor aktualisiert und neu deployed werden (siehe `docs/DEPLOYMENT.md`). Nach dem ersten Poll im Google Sheet `Systemlog`-Tab nach `HEARTBEAT: Code.gs v4.0.1 läuft` prüfen.

### docs/KNOWN_ISSUES.md
- Issue 1 auf „gelöst in Version 4.0.1" gesetzt.
- Typ-Code-Tabelle vollständig korrigiert (TR-064 vs. Web-UI-URL-Drift dokumentiert).
- Dauer-Format-Eigenheiten (Minuten-Aufrundung, keine Sekunden-Auflösung) erklärt.
- Produktentscheidung zur Filter-Schwelle dokumentiert (kein AB → liberaler Filter).
- Quellen-Verweise (AVM TR-064 Spec, Community-Recherche, empirische Verifikation).

### VERSIONS.json
- `backend/Code.gs` von `4.0.0` auf `4.0.1` gebumpt.

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
