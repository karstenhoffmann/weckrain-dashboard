# Hardware-Bestand — Weckrain Check

Dieses Dokument listet die physische Sensorik, die den Weckrain Check speist. Alle Geräte stehen in der Wohnung, die überwacht wird. Ziel der Sensor-Auswahl: passive Aktivitätserkennung ohne Kamera, Mikrofon oder Wearable.

## Router / Gateway

**Fritz!Box 6660 Cable**

- Fritz!OS-Version: 8.21
- Rolle: Zentrale für alle DECT-Sensoren + Datenquelle für die Anrufliste
- Erreichbarkeit für das Monitoring: via MyFRITZ!-URL (siehe `docs/CONFIG.md`, Key `FRITZBOX_URL`)
- Login für das Monitoring: dedizierter Nur-Lese-Benutzer `monitor_api` mit Berechtigung nur für Smart Home + Anrufliste (NIEMALS das Admin-Konto)

## DECT-Sensorik

### Steckdosen-Energiemesser (×2)

**FRITZ!DECT 200** — smarte Steckdose mit Energiezähler

| Position | Gerätename in Fritz!Box | Dashboard-Label | Sensor-Key |
|---|---|---|---|
| Küche, Wasserkocher-Steckdose | `Wasserkocher` | Küche | `k` |
| Wohnzimmer, Steckdose hinter TV | `Fernseher` | Lesezimmer | `s` |

Aktivitäts-Erkennung: Das Backend fragt alle 30 Minuten den kumulativen Energiezähler (`<energy>`-Tag im AHA-HTTP-Response, Einheit Wh) ab und vergleicht mit dem Vorwert aus `PropertiesService`. Ein Delta ≥ 2 Wh zählt als „AKTIV". Der Schwellwert ist bewusst so gewählt, dass er Standby-Verbrauch herausfiltert. Details zur Logik: Funktion `parseDeviceList()` in `backend/Code.gs`.

Wichtig: Die Zuordnung Gerät → Label wird über Substring-Matching auf den Fritz!Box-Gerätenamen gemacht (`DEVICE_KEYWORDS` in `backend/Code.gs`). Wenn jemand das Gerät in der Fritz!Box umbenennt (etwa „Wasserkocher" → „Kocher"), findet das Backend es nicht mehr und der Status bleibt auf `N/A`. Das ist Absicht — lieber sichtbar kaputt als still falsch.

### Türsensor (×1)

**FRITZ!DECT 350** — DECT-Funktürkontakt, batteriebetrieben

| Position | Fritz!Box-Gerätename | Dashboard-Label | Sensor-Key |
|---|---|---|---|
| Haustür EG (Eingangstür) | `Haustür EG` | Eingang | `e` |

Besonderheit: Der DECT 350 sendet Schaltvorgänge **nicht** so an das AHA-HTTP-Interface, dass das Backend sie aus dem Poll-Abstand zuverlässig auslesen könnte. Stattdessen nutzt der Weckrain Check den Fritz!Box **Push-Service**: Bei jedem Schaltvorgang (auf/zu) sendet die Fritz!Box eine E-Mail an `<MONITORING_GMAIL>`. Das Backend prüft alle 30 Minuten via `GmailApp.search()`, ob seit dem letzten Poll solche Mails eingegangen sind, und verschiebt verarbeitete Mails in den Papierkorb (verhindert volles Postfach). Implementation: `checkDoorViaGmail()` in `backend/Code.gs`.

Konfigurations-Voraussetzung in der Fritz!Box: **Heimnetz → Smart Home → Geräte → Haustür EG → Push Service aktivieren**, Empfänger ist die Monitoring-Gmail. Der Betreff muss eines der Schlüsselworte enthalten, nach denen das Backend sucht: `Haustür`, `Haustuer`, `Türkontakt`, `Tuerkontakt`, `DECT 350`. Default-Betreff „Haustür EG Alarm aktiv" matcht automatisch.

### Telefon / Anrufliste

**Fritz!Fon X6** — DECT-Telefon

| Rolle | Fritz!Box-Datenquelle | Dashboard-Label | Sensor-Key |
|---|---|---|---|
| Hauptdatenquelle: geführte Anrufe | Anrufliste (CSV-Export via `foncalls_list.lua`) | Gesang | `g` |

Das Fritz!Fon X6 ist nicht selbst abgefragt — stattdessen liest das Backend die zentrale Anrufliste der Fritz!Box. Funktion: `checkPhoneActivity()` in `backend/Code.gs`.

**Bekannter Bug in Version 4.0.0:** Die Filterlogik für „geführtes Telefonat" ist noch nicht robust. Details in `docs/KNOWN_ISSUES.md` (Issue 1 — Gesang/Telefon-Erkennung).

## Zusammenfassung: Sensor → Spalte → Key → Label

| Sensor (Hardware) | Log-Spalte (Sheet) | JSON-Key | Dashboard-Label |
|---|---|---|---|
| FRITZ!DECT 200 Wasserkocher | B — Wasserkocher-Status | `k` | Küche |
| FRITZ!DECT 200 Fernseher | C — TV-Status | `s` | Lesezimmer |
| FRITZ!DECT 350 Haustür | D — Tür-Status | `e` | Eingang |
| Fritz!Fon X6 / Anrufliste | E — Telefon-Status | `g` | Gesang |

Die vier Buchstaben `k/s/e/g` sind historisch gewachsen und werden nicht umbenannt, weil sie durchgängig in Log-Daten, JSON-API und Frontend konsistent sind. Ein Rename wäre ein harter Breaking Change.

## Was NICHT im System ist

Bewusste Ausschlüsse, damit neue Entwickler die Grenzen kennen:

- **Keine Kamera, kein Mikrofon.** Privacy-by-Design — die Person wird nicht beobachtet, nur das Muster ihres Alltags.
- **Kein Bett- oder Stuhl-Sensor.** Wurde überlegt, aber: Steckdosenmessung genügt in der Praxis und erfordert keine Installation.
- **Kein Wearable.** Wird nicht getragen → keine Daten.
- **Kein direkter Internet-Check der Fritz!Box.** Wenn die Fritz!Box selbst tot ist, merkt das Monitoring das über den Ausfallalarm (`docs/MONITORING.md`) und den Healthchecks.io-Dead-Man's-Switch.

## Referenzen

- Backend-Funktionen: `querySmartHomeDevices`, `parseDeviceList`, `checkDoorViaGmail`, `checkPhoneActivity` in `backend/Code.gs`
- Config-Keys: `docs/CONFIG.md`
- Sheet-Schema: `docs/GOOGLE_SHEET.md`
- Bekannte Bugs: `docs/KNOWN_ISSUES.md`
