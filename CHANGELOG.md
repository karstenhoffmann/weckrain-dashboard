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

## 2026-04-13 — backend/Code.gs 4.0.3 (Telefon-Erkennung: Typ-3 fix + Diagnose-Log)

### backend/Code.gs 4.0.3
- **Fix Typ-Code-Filter:** `TYPES_ANSWERED` von `["1","4"]` auf `["1","3","4"]` erweitert.
  Die Verifikation in 4.0.1 bestätigte Typ 4 für einen konkreten CSV-Export (Fritz!OS 8.21), aber in der Praxis tauchen weiterhin fehlende Erkennungen auf. Manche Fritz!OS-Versionen oder Anruf-Konstellationen liefern Typ 3 (TR-064-Semantik) statt Typ 4 (Web-UI-Semantik) — oder es gibt noch einen anderen Typ. Belt-and-suspenders: alle Typ-Codes außer 2 (CALLFAIL) werden akzeptiert.
- **Fix Dauer-Filter:** `MIN_DURATION_MINUTES` von `1` auf `0` gesenkt.
  Kein Anrufbeantworter vorhanden → jede Verbindung (Typ 1/3/4) ist ein Lebenszeichen, unabhängig von der Dauer. Der Dauer-Filter war als Safety-Net gedacht, kann aber bei fehlender Dauer-Auflösung in manchen Gigaset-DECT-Konfigurationen fälschlicherweise gültige Gespräche herausfiltern.
- **Neu: Diagnose-Logging ins Systemlog:** `checkPhoneActivity()` schreibt jetzt bei jedem RUHE-Ergebnis eine kompakte Zeile ins Systemlog (Label `TEL`) mit Separator, Anzahl CSV-Zeilen, lastPoll-Timestamp und Ablehnungsgrund pro Zeile (z.B. `typ2`, `0:00<=poll`). Bei AKTIV-Erkennung wird ebenfalls geloggt. So ist nachvollziehbar, warum ein Anruf nicht erkannt wurde.

---

## 2026-04-13 — index.html 1.0.22 (PNG-Dateien committed, OG-Image-Extension fix)

### index.html 1.0.22
- **App-Icons committed:** `apple-touch-icon.png` (180×180), `icon-192.png` (192×192), `icon-512.png` (256×256) — alle generierten PNG-Icons sind jetzt im Repo
- **OG-Image committed:** `og-image.jpg` (1200×630 JPEG) — generiertes Link-Preview-Bild ist jetzt im Repo
- **Fix:** `og:image` und `twitter:image` Meta-Tags korrigiert von `/og-image.png` auf `/og-image.jpg` (tatsächliches Format war JPEG)

---

## 2026-04-13 — index.html 1.0.21 (Favicon, App-Icons, OG-Image, PWA-Manifest)

### index.html 1.0.21
- **Favicon:** `<link rel="icon" type="image/svg+xml" href="/favicon.svg">` — funktioniert sofort in allen modernen Browsern (Browser-Tab, Bookmark).
- **Apple Touch Icon + PWA:** `<link rel="apple-touch-icon">` + `<link rel="manifest">` — Infrastruktur steht, PNG-Dateien noch ausstehend.
- **Theme Color + iOS-PWA-Modus:** sauberes Vollbild wenn "Zum Home-Bildschirm hinzufügen".
- **Open Graph + Twitter Card:** WhatsApp/iMessage/Slack Link-Previews via `og:image`. PNG noch ausstehend.
- **Bump-Typ: MINOR (1.0.20 → 1.0.21)** — neue Meta-Infrastruktur.

### Neue Asset-Dateien
- `favicon.svg` — SVG-Reh-Icon (100×100 viewBox, Nacht-Gradient + Reh). Sofort als Browser-Favicon aktiv.
- `og-image.svg` — Quell-SVG für OG-Image (190×100 ≈ 1200×630). Muss noch als `og-image.png` exportiert werden.
- `manifest.json` — PWA-Manifest. Verweist auf `icon-192.png` / `icon-512.png` (noch nicht committed).

### Noch ausstehend
PNG-Dateien: `apple-touch-icon.png` (180×180), `icon-192.png`, `icon-512.png` (512×512), `og-image.png` (1200×630). Quell-SVGs im Repo. Konvertierung: cloudconvert.com oder AI-Bildgenerierung.

---

## 2026-04-10 — index.html 1.0.20 (Reh schlafend: Atemzug, Kopf-Neigung, Z-Bubbles)

### index.html 1.0.20
- **Kopf näher am Körper:** `headAngle` von 45° auf 48° erhöht — Nase kommt knapp bis an den Bodenlevel.
- **Kopf-Neigung:** Innere Kopf-Gruppe dreht um Schädelbasis (16,−13) um `−sleepP×10°` (CCW). Nase zeigt leicht nach oben, Stirn leicht nach unten — wirkt als läge der Kopf seitlich. Transform nur aktiv wenn nicht `deerFullyAwake`; kompatibel mit Grasen-SMIL.
- **Atemzug:** Atem-Gruppe wrappet alle Körper+Kopf-Elemente. `<animateTransform type="translate">` oszilliert mit `values="0,0; 0,-breatheAmp; 0,0"` (dur=3.8s, spline-Easing). `breatheAmp = sleepP×1.1` — sanftes Heben/Senken, das beim Einschlafen anschwillt und beim Aufwachen verschwindet.
- **Z-Bubbles:** Drei gestaffelte `<text>`-Elemente (Z, z, z — 5.5/4/3.2pt, dur=4/3.2/2.8s) steigen aus dem Kopfbereich auf und faden aus. `begin="-1.8s"` und `"-2.5s"` sorgen für versetzten Loop. Erscheinen wenn `sleepP > 0.6`, faden mit `(sleepP-0.6)/0.4` ein.
- **deerFullyAwake:** Definition geändert zu `!deerSleeping && sleepP < 0.05` — SMIL-Animationen stoppen sofort beim Einschlafen und starten erst nach vollständigem Aufwachen neu.
- **Bump-Typ: MINOR (1.0.19 → 1.0.20)** — neue Animations-Features.

---

## 2026-04-10 — index.html 1.0.19 (Reh schlafend: Animation für Nachts-Slot)

### index.html 1.0.19
- **Neues Feature: Schlaf-Animation für den Nachts-Slot.** Das Reh legt sich sanft schlafen, wenn `slotName === "Nachts"` aktiv ist.
- **Technische Umsetzung:** `useAnimatedValue(deerSleeping ? 1 : 0, 1800)` liefert `sleepP` (0=wach, 1=schläft). Alle Transformationen werden aus `sleepP` abgeleitet — rein über SVG-`transform`-Attribute (keine CSS-px-Einheiten-Probleme).
- **Follow-Through-Prinzip:** Beine retrahieren zuerst (`legScale`, fertig bei 75% des Übergangs), Körper sinkt leicht verzögert (`bodyShift`, fertig bei 90%), Kopf legt sich zuletzt (`headAngle`, startet bei 12%).
- **Beine:** `translate(0,2) scale(1, legScale) translate(0,-2)` — SVG-Skalierung um die Bein-Oberkante (y=2). Bei sleepP=1 verschwinden Beine hinter dem Körper.
- **Körper + Kopf:** Gemeinsame `translate(0, bodyShift)`-Gruppe — Körper-Unterkante (y=5) erreicht Bodenniveau (y=15).
- **Kopf-Rotation:** `rotate(headAngle, 11, -3)` — dreht Kopf+Hals 45° um Hals-Pivot; Nase legt sich auf Körperhöhe.
- **Grasen/Zucken-Animationen:** `deerFullyAwake = sleepP < 0.05` steuert alle SMIL-Animationen (Grasen, Ohr-Zucken, Wedel-Wackeln) — laufen nur wenn Reh voll wach.
- **Auge:** Offenes Auge blendet über äußere Opacity-Gruppe aus (`1 - sleepP`); geschlossenes Schlaf-Auge (SVG-Bogen) blendet mit `sleepP` ein.
- **Schatten:** Opacity sinkt von 0.28 auf 0.15.
- **Bump-Typ: MINOR (1.0.18 → 1.0.19)** — neues Feature, rückwärtskompatibel.

---

## 2026-04-10 — index.html 1.0.18 (Reh: Ohr tiefer, braune Schweifkappe entfernt)

### index.html 1.0.18
- **Vorderes Ohr tiefer:** translate y von −25 auf −22 (3 Einheiten näher am Kopf).
- **Braune Kappe am Schweif entfernt:** Der `<ellipse>` oberhalb des weißen Büschels gelöscht — sah komisch aus.
- **Bump-Typ: PATCH (1.0.17 → 1.0.18)** — rein visuell.

---

## 2026-04-10 — index.html 1.0.17 (Reh-Ohren: Konzept korrigiert — gestapelt statt nebeneinander)

### index.html 1.0.17
- **Kern-Missverständnis behoben:** Ohren waren bei x=15 und x=23 (8 Einheiten auseinander). In echten Reh-Illustrationen liegen beide Ohren fast am gleichen Punkt übereinander — das weit entfernte lugt kaum hinter dem nahen hervor, sie sind nicht nebeneinander platziert.
- **Neue Positionen:** Hinteres bei (17,−24), vorderes bei (19,−25). Beide direkt über dem Auge (Auge bei cx=21). Abstand nur 2 Einheiten → gestapelter Look.
- **Rendering-Reihenfolge:** Beide Ohren NACH dem Kopfpfad gerendert (auf Kopf sichtbar). Hinteres zuerst → vorderes überlappt es teilweise = klassischer Cartoon-Ohr-Look.
- **Vorderes Ohr** (Hauptohr): rx=2.3, ry=6.5 — klar dominant.
- **Hinteres Ohr:** rx=1.8, ry=4.5 — kleiner, lugt links vom vorderen hervor.
- **Bump-Typ: PATCH (1.0.16 → 1.0.17)** — rein visuell.

---

## 2026-04-10 — index.html 1.0.16 (Reh-Ohren: Positionen korrigiert + Stroke für Vorderes Ohr)

### index.html 1.0.16
- **Vorderes Ohr nach vorne verschoben:** x=20 (Scheitel, blendete in Kopffarbe ein) → x=23 (zwischen Scheitel und Nase, klar als eigenständige Ohrform lesbar). Subtiler dunkler Stroke (#7a4a2a, 0.4) definiert Kontur gegen Himmel und Kopffarbe.
- **Hinteres Ohr minimiert:** x=16 → x=15 (noch näher am Hinterkopf-Rand x=14), rx=1.3/ry=3 → rx=1.1/ry=2.5. Nur die allerkeine Spitze ragt über den Kopfpfad hinaus.
- **Bump-Typ: PATCH (1.0.15 → 1.0.16)** — rein visuell.

---

## 2026-04-10 — index.html 1.0.15 (Reh-Ohren: Größenverhältnis korrigiert)

### index.html 1.0.15
- **Hinteres Ohr kleiner:** rx=1.8/ry=4.5 → rx=1.3/ry=3 (deutlich kleiner, Perspektive der Rückseite). Lean-Richtung korrigiert: −8° statt +10° (Spitze jetzt weg vom Maul = rückwärts geneigt, korrekt für Rückseiten-Ohr).
- **Vorderes Ohr größer:** rx=2.5/ry=5.5 → rx=2.8/ry=6 (etwas größer, dominant). Lean-Richtung korrigiert: +5° statt −8° (Spitze jetzt leicht zum Maul = vorwärts geneigt, korrekt für Vorderseiten-Ohr).
- **Bump-Typ: PATCH (1.0.14 → 1.0.15)** — rein visuell.

---

## 2026-04-10 — index.html 1.0.14 (Reh: Ohren neu — korrekte Seitenprofilposition + Zuckanimation)

### index.html 1.0.14
- **Ohren neu positioniert:** Alte Ohren saßen zu weit im Kopf (erkennbar als Fell-Flecken). Neue Ohren ragen klar über die Kopfsilhouette hinaus wie echte Reh-Ohren im Profil.
- **Hinteres Ohr (far side):** Wird VOR Hals/Kopf gerendert → Kopfpfad überdeckt die Ohrbasis natürlich. Basis bei (16,−22), Ohr zeigt nach oben-hinten (statischer Lean +10°). Leicht kleiner/dunkler (Perspektive).
- **Vorderes Ohr (near side):** Wird NACH Auge gerendert → komplett sichtbar, ragt klar aus der Kopfsilhouette heraus. Basis bei (20,−25), leicht nach vorne geneigt (statischer Lean −8°). Größer und heller (#e0a88a Innen).
- **Unabhängige Zuckanimation:** Beide Ohren animiert mit `dur="16s"` synchron zum Grasen, `calcMode="linear"` für crisp-schnelle Zuckungen (je ~80ms/Ausschlag). Während der Grasenphase (keyTime 0.40–0.75) sind beide Ohren explizit statisch. Jedes Ohr hat eigene Burst-Muster (Phasenversatz → kein simultanes Zucken).
- **Bump-Typ: PATCH (1.0.13 → 1.0.14)** — rein visuell.

---

## 2026-04-10 — index.html 1.0.13 (Reh-Wedel: größer + schnelle Zuckbewegung)

### index.html 1.0.13
- **Spiegel opacity:** 0.95 → 0.80 — leicht transparenter, damit der wedelnde Teil mehr Fokus bekommt.
- **Wedel größer + gestreckter:** Tränenform-Path von (±1.5, Höhe 3.5) auf (±2, Höhe 5.5). Braune Kappe entsprechend angepasst.
- **Animationscharakter neu:** War smooth-slow (calcMode spline). Jetzt `calcMode="linear"` + 4 separate Flick-Bursts über 14s verteilt: Burst 1 ~0.18s (1× Zucken), Burst 2 ~0.32s (3× Zucken), Burst 3 ~0.18s (1×), Burst 4 ~0.24s (2×). Zwischen den Bursts lange Ruhephasen. Gleiche Zuckgeschwindigkeit (~80ms pro Ausschlag), variable Burst-Länge → wirkt organisch-rapid wie echte Tier-Wedelbewegung.
- **Bump-Typ: PATCH (1.0.12 → 1.0.13)** — rein visuell.

---

## 2026-04-10 — index.html 1.0.12 (Reh: Spiegel + Wedel an Hinterlauf verschoben)

### index.html 1.0.12
- **Position korrigiert:** Spiegel und Wedel saßen bei cx=−14 (Körpermitte). Körper-Rückrand liegt bei x≈−19 (Körper cx=−2, rx=17). Verschoben auf cx=−17 → Spiegel sitzt jetzt korrekt am hinteren Rumpf.
- **Bump-Typ: PATCH (1.0.11 → 1.0.12)** — rein visuell.

---

## 2026-04-10 — index.html 1.0.11 (Reh: Spiegel + Wedel Seitenansicht korrigiert)

### index.html 1.0.11
- **Spiegel Seitenansicht:** Herzform (Rückansicht) durch eine einfache ovale Ellipse ersetzt, die korrekt als weißer Rumpffleck in der Seitenansicht des Rehs lesbar ist.
- **Wedel Seitenansicht:** Zwei überlagerte Ellipsen (erzeugte versehentlich anatomisch unerwünschte Silhouette) durch eine einzelne Tränenform-Path ersetzt (`C`-Bézierkurve, kompaktes Büschel nach oben). Braune Kappe oben trennt Schweif vom Spiegel.
- **Bump-Typ: PATCH (1.0.10 → 1.0.11)** — rein visuell.

---

## 2026-04-10 — index.html 1.0.10 (Reh: subtileres Grasen + Ricke-Wedel mit Spiegel)

### index.html 1.0.10
- **Grasen-Amplitude reduziert:** Rotationsbereich während der Grasphase von 61°–72° auf 63°–69° verkleinert. Die Auf-Ab-Variation ist jetzt sichtbar, aber dezenter — wirkt weniger hektisch.
- **Spiegel (weißer Rumpffleck):** Neuer herzförmiger weißer SVG-Path am Rumpf der Ricke (cx≈-14, cy≈-5), leicht größer als anatomisch exakt, damit er im kleinen Reh gut sichtbar ist. Feine braune Kontur am oberen Rand trennt den Spiegel sauber vom Fell. Bleibt statisch (ist Fell, nicht Bewegung).
- **Reh-Wedel mit unabhängiger Wackel-Animation:** Alter 4-Punkt-Polygon-Schwanz ersetzt durch zwei überlagerte Ellipsen (braune Oberseite #a6724a + weiße Unterseite für das charakteristische „Blitzen" beim Wedeln). Pivot sitzt oben am Spiegel (-14, -8). Wedel-Zyklus 11s — läuft asynchron zur 16s-Grasen-Animation, sodass die Bewegungen zufällig wirken und nicht synchron triggern.
- **Draw-Order-Fix:** Alter Schwanz war VOR dem Body-Ellipse gerendert und damit teilweise vom Körper überdeckt (SVG Painters Algorithm). Neuer Schwanz + Spiegel sitzen jetzt korrekt NACH Body/Flecken und VOR dem Kopf → voll sichtbar.
- **Bump-Typ: PATCH (1.0.9 → 1.0.10)** — rein visuell.

---

## 2026-04-10 — index.html 1.0.9 (Reh: Grasen-Physik korrigiert)

### index.html 1.0.9
- **Grasen-Animation fix:** Separate translate-Animation entfernt (erzeugte falsche "Kopf-zum-Körper-ziehen"-Bewegung in Weltkoordinaten). Stattdessen: Rotations-Keyframes selbst variieren während der Grasphase. Rotation um den Hals-Pivot (11,-3) erzeugt physikalisch korrekte Kreisbogen-Bewegung = automatisch Auf-Ab + leichtes Seitwärtsschwingen wie bei echtem Reh-Körper.
- **Natürliche Biss-Variation:** 3 Bisse mit unterschiedlichen Tiefen (70°, 68°, 72°) und verschiedenen Lift-Höhen (61°, 63°, 62°) in unterschiedlichem Rhythmus. Asymmetrische Easing-Splines: Biss runter schnell (0.6 0 0.2 1), Heben langsamer (0.2 0 0.6 1).
- **Bump-Typ: PATCH (1.0.8 → 1.0.9)** — rein visuell.

---

## 2026-04-10 — index.html 1.0.8 (Reh: Stupsnase + Kopfnicken beim Grasen)

### index.html 1.0.8
- **Stupsnase:** Reh-Kopf ist nicht mehr ein einfacher Kreis, sondern ein SVG-Pfad der eine echte Rehsilhouette hat: runder Schädel hinten, klar abgesetzte Schnauze vorne. Maulbereich (`#c9956b`, heller/wärmer als Kopfbraun) hebt sich deutlich vom Kopf ab. Nase bleibt dunkel mit weißem Highlight.
- **Kopfnicken:** Während der Grasphase (0.47–0.68 des 16s-Zyklus) nickt der Kopf 3× leicht auf und ab (`translate(0, 2.5)` in lokaler Gruppe, smooth via cubic-bezier). Sieht aus wie echtes Grasen.
- **Bump-Typ: PATCH (1.0.7 → 1.0.8)** — rein visuell.

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
