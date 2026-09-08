# WorkTime — Zeiterfassung (Web-App)

Eine eigenständige, installierbare Web-App (PWA) zur Zeiterfassung: Timer mit
Start/Pause/Feierabend für dich und bis zu 3 weitere Mitarbeiter, Projekte mit
Beschreibung, Materiallisten je Arbeitseintrag, Projekt-Übersicht mit Stunden
und Material, sowie Export als Excel- und PDF-Datei.

## Enthaltene Dateien

```
index.html          Grundgerüst der App
styles.css           Design (Farben, Layout, Komponenten)
app.js               Gesamte Logik (Timer, Einträge, Projekte, Export)
manifest.json        PWA-Manifest ("Zum Startbildschirm hinzufügen")
service-worker.js    Offline-Caching der App-Hülle
icons/               App-Icon in verschiedenen Größen (Hammer + Uhr)
```

## Wie starte ich die App?

Wegen des Manifests und des Service Workers funktioniert die App nur korrekt,
wenn sie über **http(s)** ausgeliefert wird — nicht durch Doppelklick auf
`index.html` (file://). Browser blockieren Manifest/Service-Worker sonst.

**Am schnellsten lokal testen** (benötigt Node.js oder Python, jeweils nur
einmalig zum Start):

```bash
# Variante mit Node.js
npx serve .

# oder mit Python
python3 -m http.server 8080
```

Danach im Browser `http://localhost:…` öffnen. Auf dem Smartphone über
"Zum Startbildschirm hinzufügen" (iOS Safari) bzw. "App installieren"
(Android Chrome) lässt sich die Seite wie eine echte App installieren.

**Für den dauerhaften Einsatz** einfach den gesamten Ordner auf einen
kostenlosen statischen Hoster hochladen, z. B.:

- **Netlify** (netlify.com) — Ordner per Drag & Drop hochladen
- **GitHub Pages** — Ordnerinhalt in ein Repository pushen, Pages aktivieren
- **Vercel**, **Firebase Hosting** — ähnliches Prinzip

Kein Server, keine Datenbank, kein Build-Schritt nötig — es sind reine
statische Dateien.

## Daten & Speicherung

Standardmäßig (ohne Einrichtung) werden alle Daten (Profil, Projekte,
Mitarbeiter, Einträge) lokal im Browser gespeichert (`localStorage`) — kein
Login nötig, funktioniert sofort offline, aber gebunden an dieses eine
Gerät/diesen einen Browser.

### Optional: Login & Cloud-Speicherung mit Supabase

Die App unterstützt zusätzlich eine Anmeldung mit E-Mail/Passwort und
Cloud-Speicherung über [Supabase](https://supabase.com) (kostenlos für kleine
Projekte) — mit eigenen Tabellen für Profil, Projekte, Mitarbeiter, Einträge
und Timer (nicht als ein großer JSON-Blob, sondern relational, im selben Stil
wie euer bestehendes Zeiterfassungs-Schema). Solange das nicht eingerichtet
ist, bleibt alles wie oben beschrieben (lokal, kein Login).

So richtest du es ein:

1. **Supabase-Projekt anlegen**: auf supabase.com kostenlos registrieren,
   „New Project" anlegen.
2. **Schema einspielen**: im Supabase-Dashboard unter „SQL Editor" den Inhalt
   von `supabase-schema.sql` einfügen und ausführen. Das Skript legt die
   Tabellen `profiles`, `workers`, `projects`, `entries` und `timers` an,
   sichert sie per Row-Level-Security ab (jede/r sieht nur die eigenen
   Zeilen) und aktiviert Realtime, damit ein zweites Gerät mit demselben
   Konto Änderungen automatisch mitbekommt.
3. **Zugangsdaten eintragen**: unter „Project Settings → API" die „Project
   URL" und den „anon public" Key kopieren und in `config.js` eintragen:
   ```js
   window.APP_CONFIG = {
     SUPABASE_URL: "https://DEINPROJEKT.supabase.co",
     SUPABASE_ANON_KEY: "eyJ....",
   };
   ```
4. Optional zum leichteren Testen: unter „Authentication → Providers → Email"
   die Option „Confirm email" deaktivieren, damit du dich nach der
   Registrierung sofort anmelden kannst (ohne Bestätigungs-Mail abzurufen).
5. Seite neu laden — jetzt erscheint vor der App ein Anmelde-/Registrieren-
   Formular. Nach dem Einloggen werden Profil, Projekte, Mitarbeiter,
   Einträge und laufende Timer aus der Cloud geladen und jede Änderung direkt
   in die passende Tabelle zurückgeschrieben. Meldest du dich auf einem
   zweiten Gerät mit demselben Konto an, siehst du automatisch denselben
   Stand (auch live, ohne Neuladen, dank Realtime). Abmelden geht über das
   Profil-Symbol oben rechts.

**Wichtiger Hinweis:** Dieser Teil wurde nicht gegen ein echtes
Supabase-Projekt getestet (dafür bräuchte es echte Zugangsdaten). Der Code
folgt den Standard-Mustern von Supabase-js v2 und dem Aufbau eures
bestehenden Schemas und sollte funktionieren — prüfe es nach der Einrichtung
einmal in Ruhe (Registrieren, Abmelden, erneut anmelden, auf einem zweiten
Gerät anmelden, Timer auf einem Gerät starten und auf dem anderen prüfen) und
melde dich, falls irgendwo eine Fehlermeldung auftaucht, dann lässt sich das
gezielt beheben.

## Export

- **Excel**: Arbeitsblatt „Zeiterfassung" (alle Einträge), „Übersicht"
  (Stunden je Projekt/Mitarbeiter) und je ein Arbeitsblatt pro Projekt mit
  der Material-Matrix (Material × Tag).
- **PDF**: öffnet den Druckdialog des Browsers mit der Projekt-Übersicht;
  dort „Als PDF speichern" als Ziel wählen.
