# Monitoring — Weckrain Check

Der Weckrain Check überwacht die Wohnung seiner Nutzerin. Wer überwacht den Weckrain Check selbst? Dieses Dokument beschreibt die Meta-Schicht: Welche Alarme das System versendet, wie es sich selbst gegen stillen Ausfall absichert, und in welcher Reihenfolge bei einem Problem diagnostiziert werden sollte.

## Alarm-Typen

Das Backend kennt zwei Alarmklassen, die beide per E-Mail an `ALERT_EMAIL` (siehe `docs/CONFIG.md`) gehen.

### Inaktivitätsalarm

**Trigger:** In den letzten `INAKTIVITAET_STUNDEN` Stunden (Default: 18) gab es keinen einzigen Poll mit `Aktivitaet_erkannt = JA` im `Log`-Tab. Die Prüfung findet in `hatAktivitaetInLetztenStunden()` statt und läuft bei jedem Poll.

**Zweck:** Erkennen, dass in der Wohnung seit 18+ Stunden keine Sensor-Aktivität mehr war. 18 Stunden sind bewusst lang gewählt — sie überdauern eine normale Nachtruhe (spätestens am Morgen gibt es Wasserkocher- oder Türaktivität), schlagen aber bei einer echten Unregelmäßigkeit an.

**Mail-Inhalt:** Betreff `Inaktivitätsalarm — Weckrain Check`, im Body eine kompakte Übersicht der letzten Stunden (Sensor-Spalten aus `getRecentHistory()`), damit der Empfänger sofort sieht, welcher Sensor wann zuletzt AKTIV war.

**Spam-Schutz:** Der Merker `inactivityAlertSent` (Script Properties, siehe `docs/CONFIG.md`) verhindert, dass der Alarm bei jedem folgenden Poll erneut rausgeht. Erst bei Entwarnung (erneutes `AKTIV`) wird der Merker zurückgesetzt.

**Entwarnung:** Sobald ein Poll wieder `AKTIV` meldet, geht eine Entwarnungs-Mail raus (`Entwarnung — Aktivität erkannt`). Das ist wichtig, damit der Empfänger weiß, dass es wieder läuft, und nicht selbst anrufen muss.

### Ausfallalarm

**Trigger:** `consecutiveFailures >= AUSFALL_POLLS` (Default: 6). Bei 30-Minuten-Takt sind das 6 × 30 min = 3 Stunden ohne erfolgreichen Poll.

**Zweck:** Erkennen, dass das Monitoring-System selbst defekt ist — nicht die Wohnung. Fritz!Box nicht erreichbar, Login fehlgeschlagen, HTTP 5xx, DNS-Probleme.

**Mail-Inhalt:** Betreff `Ausfallalarm — Weckrain Check nicht erreichbar`, im Body die letzte Fehlermeldung aus dem Systemlog und die Anzahl der Fehlschläge.

**Spam-Schutz:** Analog zu oben via `outageAlertSent`.

**Entwarnung:** Sobald ein Poll wieder erfolgreich ist, geht eine Entwarnungs-Mail (`Entwarnung — Weckrain Check wieder erreichbar`) raus und `consecutiveFailures` wird auf 0 zurückgesetzt.

**Wichtig — die Unterscheidung:** Ein Inaktivitätsalarm heißt „die Wohnung ist still, aber das System funktioniert". Ein Ausfallalarm heißt „das System selbst ist kaputt, über die Wohnung weiß ich nichts". Diese beiden Fälle werden bewusst getrennt gemeldet, damit der Empfänger bei einem Ausfallalarm nicht Panik bekommt, sondern das Monitoring debuggt.

## Kontext-Historie im Alarm

Beide Alarm-Mails enthalten eine Kontext-Historie. Die stammt aus `getRecentHistory()` in `backend/Code.gs` und zeigt die letzten N Poll-Zeilen in einer lesbaren Form. Der Empfänger soll damit auf einen Blick beurteilen können, ob das normal aussieht (z.B. Inaktivität in der Nacht) oder ungewöhnlich (z.B. Fehler-Kaskade aus dem Haustürsensor).

## Tägliche Status-Mail

Wenn im Config-Sheet `STATUS_EMAILS` gesetzt ist, sendet das Backend einmal pro Tag (getriggert vom ersten Poll nach Mitternacht) eine Status-Mail an diese Empfänger. Inhalt: Zusammenfassung der letzten 24 Stunden pro Sensor, letzter erfolgreicher Poll-Zeitstempel, Anzahl der Polls, Anzahl der Fehler. Zweck: Ein „alles-ok"-Signal, das man im Postfach sehen kann, ohne ins Dashboard zu gucken.

Wenn `STATUS_EMAILS` leer ist, wird keine Status-Mail versendet.

## Heartbeat (Systemlog)

Unabhängig von der Status-Mail schreibt das Backend einmal pro Tag — beim ersten Poll nach Mitternacht — einen `HEARTBEAT`-Eintrag in den `Systemlog`-Tab. Zweck: Im Nachhinein belegen können, dass das Script an einem bestimmten Tag wenigstens einmal gelaufen ist. Im Fehlerfall zeigt das Fehlen eines Heartbeats sofort, ab wann das Problem besteht.

Verhindert wird das mehrfache Heartbeat-Schreiben durch den `lastHeartbeatDay`-Key in den Script Properties.

## Dead Man's Switch (Healthchecks.io)

Das wichtigste Sicherheitsnetz. Wenn das komplette Apps-Script-Projekt ausfällt (Google kündigt, Trigger wird entfernt, Account gesperrt, Monitoring-Account-Passwort abgelaufen), wird **keine** Alarm-Mail mehr versendet — denn derjenige, der sie versenden sollte, ist ja tot. Genau für diesen Fall gibt es den Dead Man's Switch.

**Prinzip:** Ein externer Dienst ([Healthchecks.io](https://healthchecks.io)) erwartet in regelmäßigen Abständen einen Ping vom Backend. Bleibt der Ping länger als die konfigurierte Grace-Period aus, sendet Healthchecks.io von seiner Seite aus einen Alarm.

**Umsetzung:** Bei jedem erfolgreichen Poll ruft `backend/Code.gs` die URL aus dem Config-Key `HEALTHCHECK_URL` per `UrlFetchApp.fetch()` auf. Bei Fehlschlag wird nicht gepingt — das ist der Punkt, der den Switch auslöst.

**Konfiguration auf Healthchecks.io-Seite:**

- Period: 30 Minuten (gleich dem Poll-Intervall)
- Grace: 90 Minuten (toleriert bis zu 3 Fehl-Pings in Folge — bei temporären Fritz!Box-Störungen fällt sonst ständig der Dead Man's Switch, nicht nur bei echten Ausfällen)
- Empfänger: Primär-Mailadresse + ggf. SMS

Wenn `HEALTHCHECK_URL` im Config-Sheet leer ist, wird nicht gepingt. Das ist explizit erlaubt, damit ein Setup ohne Healthchecks.io-Account laufen kann — aber nicht empfohlen. Ohne Dead Man's Switch kann ein stiller Systemausfall unbemerkt tage- oder wochenlang bestehen.

## Diagnose-Reihenfolge

Wenn eine Alarm-Mail reinkommt oder gemeldet wird, dass etwas nicht stimmt, ist diese Reihenfolge die effizienteste:

1. **Dashboard im Browser öffnen.** Läuft es? Zeigt es frische Daten an (Footer: „Letzte Messung vor X Min.")? Wenn der Footer-Timestamp frisch ist, läuft das Backend im Prinzip.
2. **Systemlog-Tab im Google Sheet öffnen.** Die letzten 20 Einträge durchlesen. Heartbeat heute drin? FEHLER- oder WARNUNG-Einträge? Der Systemlog ist strukturierter und chronologischer als das Apps Script Execution Log.
3. **Apps Script Execution Log öffnen.** Nur wenn der Systemlog nichts zeigt — zum Beispiel wenn das Script so früh abschmiert, dass `logSystem()` nie aufgerufen wurde. Im Editor unter `Executions` (nicht `Execution log` — das sind zwei verschiedene Views).
4. **Healthchecks.io-Dashboard öffnen.** Wenn dort ein Ausfall seit Zeit X angezeigt wird und im Systemlog ab Zeit X Ruhe ist, stimmen die beiden Quellen überein — Ausfall ist real.
5. **`testPoll()` manuell im Apps-Script-Editor ausführen.** Liefert den vollständigen Fehler-Stack synchron zurück. Ideal, um eine Vermutung ("Fritz!Box-Login kaputt?") schnell zu prüfen.
6. **Fritz!Box direkt prüfen.** Im Browser die MyFRITZ!-URL aufrufen, mit dem Monitoring-User `monitor_api` einloggen, Smart-Home-Seite öffnen. Wenn das manuell geht, ist das Passwort und der Account ok — dann liegt der Fehler im Code.
7. **Google Drive öffnen und Zugriff auf das Sheet prüfen.** Sehr seltener Fall: Sheet umbenannt, verschoben, Berechtigungen kaputt. Erkennbar an generischen `Cannot access spreadsheet`-Fehlern im Execution Log.
8. **Domain/DNS prüfen (nur Frontend-Probleme).** `weckrain.derkarsten.de` antwortet nicht? CNAME-Eintrag im DNS-Panel prüfen, `CNAME`-Datei im Repo prüfen (muss `weckrain.derkarsten.de` enthalten).

## Was NICHT überwacht wird

Bewusste Grenzen, damit keine falschen Erwartungen entstehen:

- **Keine Überwachung des Monitorings des Monitorings.** Healthchecks.io ist der Endpunkt dieser Kette. Wenn Healthchecks.io selbst ausfällt, fällt es nicht auf.
- **Keine Überwachung der Fritz!Box-Internetverbindung.** Wenn die Fritz!Box offline geht (Kabelmodem kaputt), reißt als Folge zwar das Monitoring — also schlägt der Ausfallalarm irgendwann zu, und parallel der Dead Man's Switch. Aber es gibt keinen eigenen „Internet down"-Alarm.
- **Keine Echtzeit-Benachrichtigung.** Alarme gehen frühestens mit 30 Minuten Verzögerung raus (Poll-Intervall). Das ist bewusst — Echtzeit wäre über die Fritz!Box-Push-Schiene möglich, würde aber die Komplexität verdoppeln.
- **Keine Wochenend-Unterdrückung.** Alarme gehen 24/7 raus. Es gibt keine „quiet hours".

## Referenzen

- Alarm-Funktionen: `sendAlert()`, `sendHeartbeat()`, `checkStatusRequests()` in `backend/Code.gs`
- Inaktivitäts-Prüfung: `hatAktivitaetInLetztenStunden()` in `backend/Code.gs`
- Poll-Schleife mit Fehlerzähler: `pollFritzBox()` in `backend/Code.gs`
- Config-Keys `INAKTIVITAET_STUNDEN`, `AUSFALL_POLLS`, `HEALTHCHECK_URL`, `STATUS_EMAILS`: `docs/CONFIG.md`
- Systemlog-Tab: `docs/GOOGLE_SHEET.md`
