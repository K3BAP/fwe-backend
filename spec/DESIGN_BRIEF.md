# FlightMeet – Design-Brief (Prompt für Claude Design)

> **Verwendung:** Der Abschnitt „PROMPT" unten ist 1:1 in **Claude Design** einsetzbar. Das Ergebnis wird
> anschließend als **visuelle Referenz** importiert (`spec/DESIGN.md` + Screenshots/Tokens) und in **M0**
> in ein DaisyUI-Theme übersetzt. Der Entwurf ist die *visuelle Wahrheit* — gebaut wird mit unserem Stack
> (React-Router-SPA, Tailwind + DaisyUI, deutsche UI). Fonts/Hex-Werte sind Vorschläge und dürfen vom
> Designer verfeinert werden, solange die Richtung erhalten bleibt.
>
> **Festgelegte Richtung (Interview):** abenteuerlich & sportlich · Himmelblau + warmer Sonnenuntergang-
> Akzent · freundlich & großzügig (Consumer-App, mobile-first) · Inspiration: **Komoot / Strava**.

---

## PROMPT

Entwirf das visuelle Design und ein zusammenhängendes Design-System für **FlightMeet**, eine
Community-Plattform für Gleitschirm-Pilotinnen und -Piloten. Nutzer finden und erstellen **Flugtreffen**
(gemeinsame Flugtage an einem Startplatz), organisieren sich in **Gruppen/Communities**, tauschen sich
in einem **Chat** aus und pflegen ein **Profil**. Die gesamte Oberfläche ist auf **Deutsch**.

### Designrichtung
- **Persönlichkeit:** abenteuerlich & sportlich — energetisch, outdoor, in Bewegung; das Gefühl von
  Freiheit und Höhe. Trotzdem **aufgeräumt und vertrauenswürdig**, nicht überladen.
- **Charakter & Dichte:** freundlich & großzügig, **Consumer-App-Gefühl** wie **Komoot/Strava** — große
  Cards, viel Luft, runde Formen, einladend. **Mobile-first** (Piloten nutzen die App am Startplatz),
  sauber skalierend auf Tablet/Desktop. Gut antippbare Flächen.
- **Inspiration:** Outdoor-Sport-Apps **Komoot** und **Strava** — karten- und aktivitätszentriert,
  Statistik-Chips, Aktivitäts-/Community-Feeds, hochwertige Landschafts-/Himmel-Fotografie, energetische
  Akzente auf ruhiger Basis.

### Farbwelt (Light + Dark Mode, beide Pflicht)
- **Primär – Himmelblau:** klares, leuchtendes Himmelblau (Richtwert `#1E90E6`, Spektrum ~`#0F6FBE`…`#5BB8F5`).
  Für primäre Aktionen, Links, aktive Zustände.
- **Akzent – Sonnenuntergang:** warmes Coral/Orange (Richtwert `#FF6B4A`, ~`#F97316`) als Energie-/
  Highlight-Farbe (CTAs-Sekundär, Badges, Hervorhebungen wie Ersteller-Nachrichten im Chat).
- **Sekundär (optional):** ein tiefes Abend-Indigo oder Petrol als ruhiger dritter Ton.
- **Neutrale Basis:** kühles, leicht bläuliches Off-White im Light-Mode (`#F6F9FC` Flächen, `#FFFFFF`
  Cards); im Dark-Mode tiefes Nacht-Slate (`#0E1726`/`#0B1220`) mit erhöhten Card-Flächen.
- **Semantisch:** Erfolg (Grün), Warnung (Amber), Fehler (Rot), Info (Himmelblau) — dezent, nicht grell.
- Verläufe sehr sparsam (höchstens ein subtiler Himmel-Verlauf im Hero). Kontraste WCAG-AA-konform.

### Typografie
- **Headings:** moderne, leicht geometrisch-sportliche Sans (Vorschlag: **Sora**, **Outfit** oder
  **Plus Jakarta Sans**) — kräftig, selbstbewusst.
- **Fließtext/UI:** klare, gut lesbare Sans (Vorschlag: **Inter**).
- Klare Hierarchie, große Headlines auf Marketing-Flächen, kompaktere, ruhige Typo in Listen/Tabellen.

### Form- & Komponenten-Sprache
- **Runde, weiche Formen:** großzügige Radien (Cards ~`rounded-2xl`), Pille-Buttons/Chips, sanfte,
  diffuse Schatten (kein harter Materialschatten). Klare, aber dezente Borders.
- **Badges/Chips:** für Erfahrungslevel (Anfänger/Fortgeschritten/Experte/Alle Level), Region, Status
  (Offen/Ausgebucht/Abgesagt/Beendet), freie Plätze, Gruppen-Tags. Farbcodiert & sofort scanbar.
- **Buttons:** Primär (Himmelblau, gefüllt), Sekundär/Akzent (Coral), Ghost/Outline. Deutliche Hover-/
  Active-/Disabled-Zustände.
- **Karten (Leaflet/OSM-Look):** große Map-Flächen mit markanten, gut lesbaren Markern (Pin in
  Akzentfarbe), Cluster, Map↔Liste-Umschalter.
- **Avatare & Profilkarte:** runde Avatare; eine kompakte **Profilkarte (Hovercard/Popover)** mit Avatar,
  Name, @handle, Erfahrungslevel-Badge, Kurz-Bio und Buttons „Profil ansehen" / „Direktchat öffnen".

### Layout & Navigation
- **Mobile:** **Bottom-Navigation** mit 4 Punkten — **Home · Flugtreffen · Gruppen · Chat** — plus
  Avatar/Profil-Zugang oben. Ungelesen-Badge auf „Chat".
- **Desktop:** dieselben Punkte als Top-Bar oder schlanke Sidebar; mehrspaltige Layouts (z.B. Chat:
  Konversationsliste + Verlauf; Flugtreffen: Karte + Liste nebeneinander).
- Konsistente Such-/Filter-Leiste, klare Empty-States (z.B. „Noch keine Flugtreffen in deiner Region").

### Zu gestaltende Screens (Priorität A = Pflicht, B = wenn möglich)
1. **(A) Landing-Page (Gast):** Hero mit Himmel/Gleitschirm-Stimmung, Wortmarke „FlightMeet" + kurzer
   Claim (z.B. „Finde deine nächste Thermik – gemeinsam fliegen."), CTAs „Registrieren" / „Anmelden",
   3–4 Feature-Highlights (Treffen finden · Gruppen · Chat · Profil).
2. **(A) Flugtreffen-Übersicht:** Card-Ansicht (Spot-Bild/Region, Titel, Datum/Uhrzeit, Erfahrungslevel-
   Badge, Teilnehmer X/Y, Status) **plus** sichtbarer Umschalter zu **Karte** und **Tabelle**; Suchfeld +
   Filter (Region, Erfahrungslevel, Datum). Zeige idealerweise auch die **Karten-Ansicht**.
3. **(A) Flugtreffen-Detail:** großes Spot-Bild/Karte, Titel, Spot/Region, Datum/Uhrzeit, Erfahrungslevel,
   Beschreibung, **Teilnehmerliste** (Ersteller markiert), freie Plätze, primärer Button „Teilnehmen"
   (bzw. „Absagen"), „Zurück".
4. **(A) Chat:** Konversationsliste (Channels, Treffen-Chats, Direktnachrichten mit Ungelesen-Zähler) +
   Nachrichtenverlauf mit Bubbles; **Nachrichten des Treffen-Erstellers hervorgehoben** (Akzentfarbe);
   Reaktionen, Reply-Zitat, Eingabezeile.
5. **(B) Dashboard (eingeloggt):** Begrüßung + „Aktuelle Flugtreffen" (eigene & Vorschläge) + „Deine
   Gruppen" + Gruppen-Vorschläge, je als Card-Reihen.
6. **(B) Gruppe (Detail):** Header (Logo, Name, Sichtbarkeit, Mitgliederzahl, Beitreten/Anfragen),
   öffentlicher **Feed** (Admin-Posts + Emoji-Reaktionen), **Channel-Liste**, Mitglieder.
7. **(B) Profilseite + Profilkarte-Popover:** Avatar, Name, @handle, Bio (formatiert), Pilot-Infos
   (Erfahrungslevel, Schirm, Heimat-Region, Flugstunden); plus die schwebende Profilkarte separat.

### Technische Leitplanken (wichtig für die Umsetzbarkeit)
- Das System muss sich sauber auf **Tailwind + DaisyUI**-Tokens abbilden lassen: definiere eine klare
  **Farbpalette** (primary, secondary, accent, neutral/base, info/success/warning/error), **Radius-**,
  **Schatten-**, **Spacing-** und **Typo-Skala**. Bitte die Tokens explizit auflisten (Hex-Werte für
  Light **und** Dark).
- **Echte deutsche Beispieltexte** verwenden (kein Lorem Ipsum): echte Spot-Namen (Wasserkuppe, Tegelberg,
  Mosel, Eifel), realistische Treffen-Titel, deutsche Labels.
- **Barrierefreiheit:** ausreichende Kontraste (AA), klare Fokus-Zustände, antippbare Zielgrößen ≥ 44px.
- **Konsistenz:** ein durchgängiges System über alle Screens (gleiche Buttons, Cards, Badges, Abstände).

### Output
Liefere die gestalteten Screens (Light- und exemplarisch Dark-Mode), das Komponenten-Inventar (Buttons,
Cards, Badges, Inputs, Navigation, Profilkarte, Chat-Bubble) und eine **Design-Token-Übersicht**
(Farben, Typo, Radien, Schatten, Abstände), aus der sich ein DaisyUI-Theme ableiten lässt.

---

## Integration in die Spec (nach dem Lauf)
- Ergebnis-Link/Export → `spec/DESIGN.md` (verbindliche Referenz) + Screenshots unter `spec/design/`.
- Die **Design-Tokens** fließen in **M0** in `tailwind.config` + DaisyUI-Theme (`spec/05-frontend.md`
  „DaisyUI-Theme/Branding" wird dann konkretisiert).
- Abweichungen zwischen Entwurf und Stack (z.B. Custom-Komponenten ohne DaisyUI-Pendant) hier als Notiz.
