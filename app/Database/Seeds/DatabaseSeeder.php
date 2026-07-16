<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;
use DateTimeImmutable;
use DateTimeZone;

/**
 * Lokaler Demo-/Abnahme-Seed (M6): ein Plattform-Admin plus ein moderat aufgestockter Satz aus Piloten,
 * Startplätzen, Treffen, Gruppen, Chat und Benachrichtigungen — damit jeder Demo-Login (Admin oder
 * Pilot:in Lena) sofort gefüllte Oberflächen zeigt. **Idempotent**: jede Domäne wird übersprungen, wenn
 * ihre Tabelle bereits befüllt ist. Vollständig **hand-kuratiert** (kein Faker) ⇒ deterministisch, der
 * SQL-Dump (ADR-002) ist reproduzierbar. Die Treffen decken **jeden** abgeleiteten Status
 * (`open`/`full`/`finished`/`cancelled`) ab.
 *
 * Wichtige Invariante: Gruppen-/Treffen-Mitgliedschaften referenzieren Piloten über ihren **Array-Index**
 * in $pilots (0/1/2 = Lena/Markus/Sophie). Neue Piloten werden daher **angehängt** (Index 3…), der Admin
 * separat geseedet (kein Pilot-Index), damit bestehende Referenzen stabil bleiben.
 */
class DatabaseSeeder extends Seeder
{
    /**
     * 15 Pilot-Konten (Index = Referenz in Gruppen/Treffen/Chat). Experience-Mix ~beginner/advanced/expert;
     * `bio` ist bei ~30 % bewusst `null`. Passwörter sind demo/local-only (ADR-008).
     * @var list<array{email:string,password:string,display_name:string,handle:string,experience_level:string,home_region:string,license_class:string,glider:string,flight_hours:int,bio:?string}>
     */
    private array $pilots = [
        [
            'email' => 'lena@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Lena Krüger', 'handle' => 'lena_xc',
            'experience_level' => 'advanced', 'home_region' => 'Allgäu', 'license_class' => 'B-Schein (Streckenflug)', 'glider' => 'Ozone Rush 6', 'flight_hours' => 320,
            'bio' => 'Fliege seit 2015, am liebsten lange Thermiktage im Allgäu. Immer für einen Kaffee am Landeplatz zu haben. ☕',
        ],
        [
            'email' => 'markus@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Markus Thaler', 'handle' => 'thaler_fly',
            'experience_level' => 'expert', 'home_region' => 'Tegernsee', 'license_class' => 'Streckenflugberechtigung', 'glider' => 'Ozone Zeno 2', 'flight_hours' => 1050,
            'bio' => 'Streckenflieger aus Leidenschaft. **Sicherheit first**, dann Kilometer.',
        ],
        [
            'email' => 'sophie@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Sophie Berg', 'handle' => 'sophie_b',
            'experience_level' => 'beginner', 'home_region' => 'Rhön', 'license_class' => 'A-Schein', 'glider' => 'Nova Ion 6', 'flight_hours' => 30,
            'bio' => 'Frisch geschlüpfter A-Schein 🐣 — übe noch fleißig am Übungshang.',
        ],
        [
            'email' => 'tobias@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Tobias Lang', 'handle' => 'tobi_air',
            'experience_level' => 'advanced', 'home_region' => 'Chiemgau', 'license_class' => 'B-Schein', 'glider' => 'Nova Mentor 7', 'flight_hours' => 180,
            'bio' => 'Wochenend-Pilot mit Hang zu entspannten Hike-and-Fly-Touren.',
        ],
        [
            'email' => 'nina@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Nina Wagner', 'handle' => 'nina_fly',
            'experience_level' => 'beginner', 'home_region' => 'Schwäbische Alb', 'license_class' => 'A-Schein', 'glider' => 'Advance Alpha 7', 'flight_hours' => 25,
            'bio' => 'Neu dabei und total begeistert. Übe Groundhandling, wann immer es geht.',
        ],
        [
            'email' => 'florian@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Florian Huber', 'handle' => 'flo_xc',
            'experience_level' => 'expert', 'home_region' => 'Tirol (Stubai)', 'license_class' => 'Streckenflugberechtigung', 'glider' => 'Ozone Zeno 2', 'flight_hours' => 950,
            'bio' => 'XC-Junkie. Drei-Länder-Strecken sind mein Ding. Tracklog auf Anfrage. 📈',
        ],
        [
            'email' => 'carolin@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Carolin Mayr', 'handle' => 'caro_thermik',
            'experience_level' => 'advanced', 'home_region' => 'Berner Oberland', 'license_class' => 'B-Schein', 'glider' => 'Gin Bonanza 3', 'flight_hours' => 220,
            'bio' => 'Liebe ruhige Morgenflüge über dem Brienzersee.',
        ],
        [
            'email' => 'david@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'David Schmidt', 'handle' => 'dave_glide',
            'experience_level' => 'advanced', 'home_region' => 'Allgäu', 'license_class' => 'B-Schein', 'glider' => 'Ozone Rush 6', 'flight_hours' => 140,
            'bio' => null,
        ],
        [
            'email' => 'hannah@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Hannah Fischer', 'handle' => 'hannah_b',
            'experience_level' => 'beginner', 'home_region' => 'Mosel/Eifel', 'license_class' => 'A-Schein', 'glider' => 'Nova Ion 6', 'flight_hours' => 18,
            'bio' => 'Fliege am liebsten am Calmont. Suche noch Mitflieger:innen für die Eifel.',
        ],
        [
            'email' => 'lukas@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Lukas Brandl', 'handle' => 'lukas_soar',
            'experience_level' => 'expert', 'home_region' => 'Kärnten', 'license_class' => 'Streckenflugberechtigung', 'glider' => 'Advance Sigma 11', 'flight_hours' => 1100,
            'bio' => 'Soaring-Sessions an der Gerlitzen sind mein Zuhause. 🪂',
        ],
        [
            'email' => 'sarah@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Sarah Köhler', 'handle' => 'sarah_k',
            'experience_level' => 'advanced', 'home_region' => 'Tegernsee', 'license_class' => 'B-Schein', 'glider' => 'Skywalk Cumeo', 'flight_hours' => 300,
            'bio' => 'Acro-neugierig, aber mit Respekt. Erst Sicherheitstraining, dann Spielereien.',
        ],
        [
            'email' => 'jonas@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Jonas Wolf', 'handle' => 'jonas_w',
            'experience_level' => 'advanced', 'home_region' => 'Salzburg (Pinzgau)', 'license_class' => 'B-Schein', 'glider' => 'Ozone Delta 4', 'flight_hours' => 260,
            'bio' => null,
        ],
        [
            'email' => 'elena@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Elena Vogt', 'handle' => 'elena_v',
            'experience_level' => 'beginner', 'home_region' => 'Schwarzwald', 'license_class' => 'A-Schein', 'glider' => 'Advance Alpha 7', 'flight_hours' => 12,
            'bio' => null,
        ],
        [
            'email' => 'philipp@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Philipp Bauer', 'handle' => 'phil_air',
            'experience_level' => 'expert', 'home_region' => 'Wallis', 'license_class' => 'Streckenflugberechtigung', 'glider' => 'Gin Explorer 2', 'flight_hours' => 800,
            'bio' => 'Hohe Strecken im Wallis. Funk und Live-Tracking immer dabei.',
        ],
        [
            'email' => 'mia@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Mia Hoffmann', 'handle' => 'mia_h',
            'experience_level' => 'advanced', 'home_region' => 'Zentralschweiz', 'license_class' => 'B-Schein', 'glider' => 'Swing Nyos RS', 'flight_hours' => 160,
            'bio' => null,
        ],
    ];

    /** Plattform-Admin für die Abnahme (D4) — Shield-Gruppe `admin`. Demo-Passwort, vor Live-Betrieb ersetzen (ADR-008). */
    private array $admin = [
        'email' => 'admin@flightmeet.test', 'password' => 'FlightMeet!2026', 'display_name' => 'FlightMeet Admin', 'handle' => 'admin',
        'experience_level' => 'expert', 'home_region' => 'Trier', 'license_class' => 'Fluglehrer', 'glider' => 'Advance Sigma 11', 'flight_hours' => 1500,
        'bio' => 'Administrator der FlightMeet-Plattform. Bei Fragen oder Meldungen gern melden.',
    ];

    /**
     * 30 reale Startplätze im DACH-Raum (SEED_DATA.md §1). Koordinaten sind Näherungswerte.
     * @var list<array{name:string,region:string,country:string,lat:float,lng:float,type:string}>
     */
    private array $spots = [
        ['name' => 'Wasserkuppe',                          'region' => 'Rhön',                    'country' => 'DE', 'lat' => 50.498, 'lng' => 9.948,  'type' => 'launch'],
        ['name' => 'Tegelberg',                            'region' => 'Allgäu',                  'country' => 'DE', 'lat' => 47.585, 'lng' => 10.764, 'type' => 'launch'],
        ['name' => 'Brauneck',                             'region' => 'Bayerische Voralpen',     'country' => 'DE', 'lat' => 47.667, 'lng' => 11.555, 'type' => 'launch'],
        ['name' => 'Hochfelln',                            'region' => 'Chiemgau',                'country' => 'DE', 'lat' => 47.768, 'lng' => 12.610, 'type' => 'launch'],
        ['name' => 'Hochries',                             'region' => 'Chiemgau',                'country' => 'DE', 'lat' => 47.733, 'lng' => 12.230, 'type' => 'launch'],
        ['name' => 'Blomberg',                             'region' => 'Bayerische Voralpen',     'country' => 'DE', 'lat' => 47.683, 'lng' => 11.450, 'type' => 'launch'],
        ['name' => 'Jochberg (Walchensee)',                'region' => 'Bayerische Voralpen',     'country' => 'DE', 'lat' => 47.600, 'lng' => 11.330, 'type' => 'launch'],
        ['name' => 'Wallberg (Tegernsee)',                 'region' => 'Tegernsee',               'country' => 'DE', 'lat' => 47.660, 'lng' => 11.770, 'type' => 'launch'],
        ['name' => 'Hohe Bracht',                          'region' => 'Sauerland',               'country' => 'DE', 'lat' => 51.130, 'lng' => 7.970,  'type' => 'launch'],
        ['name' => 'Greifenburg / Emberger Alm',           'region' => 'Kärnten (Drautal)',       'country' => 'AT', 'lat' => 46.760, 'lng' => 13.150, 'type' => 'launch'],
        ['name' => 'Sattnitz / Kraig',                     'region' => 'Kärnten',                 'country' => 'AT', 'lat' => 46.720, 'lng' => 14.340, 'type' => 'launch'],
        ['name' => 'Stubaital (Elfer / Kreuzjoch)',        'region' => 'Tirol (Stubai)',          'country' => 'AT', 'lat' => 47.110, 'lng' => 11.310, 'type' => 'launch'],
        ['name' => 'Kössen (Unterberghorn)',               'region' => 'Tirol (Kaisergebirge)',   'country' => 'AT', 'lat' => 47.680, 'lng' => 12.400, 'type' => 'launch'],
        ['name' => 'Zell am See (Schmittenhöhe)',          'region' => 'Salzburg (Pinzgau)',      'country' => 'AT', 'lat' => 47.330, 'lng' => 12.740, 'type' => 'launch'],
        ['name' => 'Gerlitzen',                            'region' => 'Kärnten',                 'country' => 'AT', 'lat' => 46.690, 'lng' => 13.910, 'type' => 'launch'],
        ['name' => 'Stoderzinken',                         'region' => 'Steiermark (Ennstal)',    'country' => 'AT', 'lat' => 47.530, 'lng' => 13.890, 'type' => 'launch'],
        ['name' => 'Achensee (Maurach / Rofan)',           'region' => 'Tirol',                   'country' => 'AT', 'lat' => 47.430, 'lng' => 11.730, 'type' => 'launch'],
        ['name' => 'Niederöblarn / Wörschachwald',         'region' => 'Steiermark (Ennstal)',    'country' => 'AT', 'lat' => 47.500, 'lng' => 14.030, 'type' => 'launch'],
        ['name' => 'Interlaken (Beatenberg / Niederhorn)', 'region' => 'Berner Oberland',         'country' => 'CH', 'lat' => 46.700, 'lng' => 7.800,  'type' => 'launch'],
        ['name' => 'Fiesch / Eggishorn',                   'region' => 'Wallis',                  'country' => 'CH', 'lat' => 46.400, 'lng' => 8.130,  'type' => 'launch'],
        ['name' => 'Verbier (La Chaux)',                   'region' => 'Wallis',                  'country' => 'CH', 'lat' => 46.090, 'lng' => 7.250,  'type' => 'launch'],
        ['name' => 'Grindelwald (First)',                  'region' => 'Berner Oberland',         'country' => 'CH', 'lat' => 46.660, 'lng' => 8.060,  'type' => 'launch'],
        ['name' => 'Klewenalp (Vierwaldstättersee)',       'region' => 'Zentralschweiz',          'country' => 'CH', 'lat' => 46.950, 'lng' => 8.490,  'type' => 'launch'],
        ['name' => 'Beuren (Schwäbische Alb)',             'region' => 'Schwäbische Alb',         'country' => 'DE', 'lat' => 48.560, 'lng' => 9.390,  'type' => 'launch'],
        ['name' => 'Hohenneuffen',                         'region' => 'Schwäbische Alb',         'country' => 'DE', 'lat' => 48.555, 'lng' => 9.380,  'type' => 'launch'],
        ['name' => 'Kandel (Schwarzwald)',                 'region' => 'Schwarzwald',             'country' => 'DE', 'lat' => 48.060, 'lng' => 8.010,  'type' => 'launch'],
        ['name' => 'Hocheck / Oberaudorf',                 'region' => 'Inntal (Bayern)',         'country' => 'DE', 'lat' => 47.640, 'lng' => 12.180, 'type' => 'launch'],
        ['name' => 'Mosel — Calmont / Bremm',              'region' => 'Mosel/Eifel',             'country' => 'DE', 'lat' => 50.090, 'lng' => 7.130,  'type' => 'area'],
        ['name' => 'Nürburg / Hohe Acht (Eifel)',          'region' => 'Mosel/Eifel',             'country' => 'DE', 'lat' => 50.380, 'lng' => 7.000,  'type' => 'launch'],
        ['name' => 'Idarkopf (Hunsrück)',                  'region' => 'Hunsrück',                'country' => 'DE', 'lat' => 49.800, 'lng' => 7.250,  'type' => 'launch'],
    ];

    /**
     * 18 Treffen, gezielt über alle abgeleiteten Status verteilt (`creator`/`extra` = Index in $pilots;
     * negatives `days` ⇒ Vergangenheit ⇒ `finished`; `extra`-Zahl = max ⇒ `full`).
     *
     * `days` = Tagesversatz zum Seed-Lauf, `time` = **lokale** Startzeit (Europe/Berlin), die zum Treffen
     * passt — ein Frühflug startet um 07:00, ein Vollmondflug um 21:30. Die künftigen Treffen liegen
     * bewusst dicht (1…16 Tage): das Wetter (ADR-017) reicht nur 16 Tage voraus, sonst zeigt die
     * Detailseite `out_of_range`. `Kössen Cross-Country` bleibt als einziges absichtlich dahinter,
     * damit auch dieser Zustand demonstrierbar ist.
     *
     * @var list<array{title:string,spot:string,days:int,time:string,level:string,max:int|null,status:string,creator:int,extra:list<int>,description:string}>
     */
    private array $meetups = [
        ['title' => 'Frühflug Wasserkuppe',             'spot' => 'Wasserkuppe',                  'days' => 3,   'time' => '07:00', 'level' => 'beginner', 'max' => 6,    'status' => 'open',      'creator' => 0,  'extra' => [1, 3, 7],        'description' => 'Ruhiger Morgenflug am Westhang – ideal für frische A-Scheine. Kleine Gruppe, viel Betreuung.'],
        ['title' => 'Abendthermik am Tegelberg',        'spot' => 'Tegelberg',                    'days' => 1,   'time' => '18:30', 'level' => 'advanced', 'max' => 2,    'status' => 'open',      'creator' => 1,  'extra' => [2],             'description' => 'Gemeinsamer Abendflug bei schöner Restthermik. Treffpunkt am oberen Parkplatz.'],
        ['title' => 'XC-Streckenflug Brauneck',         'spot' => 'Brauneck',                     'days' => 9,   'time' => '11:00', 'level' => 'expert',   'max' => 10,   'status' => 'open',      'creator' => 2,  'extra' => [0, 5, 9, 13],    'description' => 'Ambitionierter Streckentag Richtung Karwendel. Funk und Live-Tracking empfohlen.'],
        ['title' => 'Soaring am Calmont',               'spot' => 'Mosel — Calmont / Bremm',      'days' => 12,  'time' => '14:00', 'level' => 'all',      'max' => null, 'status' => 'open',      'creator' => 0,  'extra' => [3, 6, 10, 1],    'description' => 'Dynamischer Hangflug überm Moseltal. Offen für alle Level – Soaring-Bedingungen vorausgesetzt.'],
        ['title' => 'Anfänger-Übungstag Beuren',        'spot' => 'Beuren (Schwäbische Alb)',     'days' => -8,  'time' => '10:00', 'level' => 'beginner', 'max' => 12,   'status' => 'open',      'creator' => 1,  'extra' => [2, 0, 8, 12],    'description' => 'Übungshang-Session mit Groundhandling und kurzen Hüpfern.'],
        ['title' => 'Gleitschirm-Treffen Hochfelln',    'spot' => 'Hochfelln',                    'days' => 4,   'time' => '10:30', 'level' => 'advanced', 'max' => 10,   'status' => 'cancelled', 'creator' => 2,  'extra' => [0],             'description' => 'Leider abgesagt wegen unsicherer Wetterlage – wir verschieben auf nächste Woche.'],
        ['title' => 'Thermikfliegen Gerlitzen',         'spot' => 'Gerlitzen',                    'days' => 13,  'time' => '12:00', 'level' => 'advanced', 'max' => 15,   'status' => 'open',      'creator' => 0,  'extra' => [1, 2, 3, 6, 10], 'description' => 'Klassiker über dem Ossiacher See. Lange Flüge bei guter Thermik möglich.'],
        ['title' => 'Sonnenaufgangsflug Wallberg',      'spot' => 'Wallberg (Tegernsee)',         'days' => -13, 'time' => '05:30', 'level' => 'advanced', 'max' => 8,    'status' => 'open',      'creator' => 1,  'extra' => [0, 3],          'description' => 'Magischer Morgenflug überm Tegernsee. Früh aufstehen lohnt sich.'],
        ['title' => 'Eifel-Treff Nürburg',              'spot' => 'Nürburg / Hohe Acht (Eifel)',  'days' => 6,   'time' => '15:00', 'level' => 'all',      'max' => 20,   'status' => 'open',      'creator' => 0,  'extra' => [1, 4, 8, 12, 7], 'description' => 'Lockeres Treffen an der Hohen Acht mit anschließendem Grillen am Landeplatz.'],
        ['title' => 'Kössen Cross-Country',             'spot' => 'Kössen (Unterberghorn)',       'days' => 25,  'time' => '11:30', 'level' => 'expert',   'max' => 3,    'status' => 'open',      'creator' => 2,  'extra' => [0, 1],          'description' => 'Strecke Richtung Kaisergebirge. Erfahrung mit großen Talquerungen empfohlen.'],
        ['title' => 'Talquerung Zell am See',           'spot' => 'Zell am See (Schmittenhöhe)',  'days' => 14,  'time' => '12:30', 'level' => 'expert',   'max' => 8,    'status' => 'open',      'creator' => 5,  'extra' => [9, 13, 1],       'description' => 'Anspruchsvolle Talquerung Richtung Hohe Tauern. Nur für erfahrene Strecken-Crews.'],
        ['title' => 'Groundhandling-Kurs Hohenneuffen', 'spot' => 'Hohenneuffen',                 'days' => 2,   'time' => '09:30', 'level' => 'beginner', 'max' => 12,   'status' => 'open',      'creator' => 4,  'extra' => [8, 12, 2, 7],    'description' => 'Strukturierte Bodenarbeit für Einsteiger:innen. Material kann gestellt werden.'],
        ['title' => 'Vollmondfliegen Brauneck',         'spot' => 'Brauneck',                     'days' => -20, 'time' => '21:30', 'level' => 'advanced', 'max' => 10,   'status' => 'open',      'creator' => 3,  'extra' => [6, 10, 0],       'description' => 'Stimmungsvoller Abendflug bei Vollmond. War ein unvergesslicher Abend.'],
        ['title' => 'Acro-Auffrischung Kössen',         'spot' => 'Kössen (Unterberghorn)',       'days' => 16,  'time' => '16:00', 'level' => 'advanced', 'max' => 6,    'status' => 'open',      'creator' => 10, 'extra' => [3, 14],          'description' => 'Sicheres Acro über dem Wasser – mit Sicherheitseinweisung vorab.'],
        ['title' => 'Frühjahrsfliegen Gerlitzen',       'spot' => 'Gerlitzen',                    'days' => 10,  'time' => '11:00', 'level' => 'all',      'max' => 16,   'status' => 'open',      'creator' => 9,  'extra' => [5, 13, 6, 11, 14], 'description' => 'Saisonauftakt an der Gerlitzen für alle Level. Anschließend Einkehr.'],
        ['title' => 'Hike & Fly Stubai',                'spot' => 'Stubaital (Elfer / Kreuzjoch)','days' => 8,   'time' => '06:30', 'level' => 'expert',   'max' => 4,    'status' => 'open',      'creator' => 5,  'extra' => [9, 13, 1],       'description' => 'Anspruchsvolle Hike-and-Fly-Tour. Gute Kondition und Bergerfahrung Pflicht.'],
        ['title' => 'Schnupperfliegen Kandel',          'spot' => 'Kandel (Schwarzwald)',         'days' => 5,   'time' => '13:00', 'level' => 'beginner', 'max' => 10,   'status' => 'open',      'creator' => 12, 'extra' => [8, 4, 2],        'description' => 'Lockeres Schnuppertreffen im Schwarzwald. Auch zum Zuschauen willkommen.'],
        ['title' => 'Abendsession Interlaken',          'spot' => 'Interlaken (Beatenberg / Niederhorn)', 'days' => -5, 'time' => '18:00', 'level' => 'advanced', 'max' => 12, 'status' => 'cancelled', 'creator' => 14, 'extra' => [6, 10], 'description' => 'Abgesagt wegen aufziehender Gewitter. Sicherheit geht vor.'],
    ];

    /**
     * 8 Gruppen, die jede `visibility`×`join_policy`-Kombination abdecken (SEED_DATA §2.2). `owner`/
     * Rollen referenzieren den Pilot-Index in $pilots. Verschachtelt: Extra-Mitglieder (`members`),
     * Extra-Channels (`channels` = [titel, min_role]), Beitrittsanträge (`requests`), Einladungen
     * (`invites`) und Feed-Posts (`posts` inkl. Reaktionen).
     * @var list<array<string,mixed>>
     */
    private array $groups = [
        [
            'name' => 'Gleitschirm Alpen Süd', 'visibility' => 'public', 'join_policy' => 'open',
            'owner' => 0, 'region' => 'Kärnten', 'tags' => ['alpen', 'soaring'],
            'description' => 'Die größte Community für Gleitschirmflieger in den Südalpen. Wir teilen Wetter, Strecken und gute Laune.',
            'rules' => 'Respektvoller Umgang. Keine Werbung. Sicherheit geht vor.',
            'members' => [[1, 'admin'], [2, 'member'], [3, 'member'], [6, 'member'], [10, 'member'], [14, 'member']],
            'channels' => [['Wetter', 'member']],
            'posts' => [
                ['title' => 'Saisonstart 2026', 'body' => 'Die Bedingungen werden besser – wer ist diese Woche am Start? 🪂', 'pinned' => true, 'author' => 0, 'reactions' => ['🪂' => [1, 2], '🔥' => [1]]],
                ['title' => null, 'body' => 'Kurzer Hinweis: Am Wochenende ist der Startplatz wegen einer Veranstaltung gesperrt.', 'pinned' => false, 'author' => 1, 'reactions' => []],
                ['title' => 'Veralteter Beitrag', 'body' => 'Dieser Beitrag wurde entfernt.', 'pinned' => false, 'author' => 0, 'deleted' => true, 'reactions' => []],
            ],
        ],
        [
            'name' => 'Mosel & Eifel Flieger', 'visibility' => 'public', 'join_policy' => 'request',
            'owner' => 1, 'region' => 'Mosel/Eifel', 'tags' => ['mosel', 'eifel', 'anfaenger'],
            'description' => 'Lokale Crew rund um Calmont, Nürburg und Hunsrück. Beitritt auf Anfrage.',
            'rules' => 'Bitte beim Beitrittsantrag kurz vorstellen.',
            'members' => [[0, 'moderator'], [8, 'member'], [2, 'member'], [12, 'member']],
            'channels' => [['Streckenmeldungen', 'member']],
            'requests' => [
                [2, 'Hallo! Ich fliege oft an der Mosel und würde gern beitreten.', 'pending'],
            ],
            'posts' => [
                ['title' => 'Willkommen', 'body' => 'Schön, dass ihr da seid. Stellt euch gern im Channel vor.', 'pinned' => true, 'author' => 1, 'reactions' => ['❤️' => [0]]],
            ],
        ],
        [
            'name' => 'Streckenflug-Profis DACH', 'visibility' => 'public', 'join_policy' => 'invite_only',
            'owner' => 2, 'region' => 'Tirol (Stubai)', 'tags' => ['streckenflug', 'xc', 'profi'],
            'description' => 'Geschlossene Runde für ambitionierte XC-Piloten. Beitritt nur per Einladung.',
            'rules' => 'Mindestens 100 Flugstunden. Live-Tracking bei Gruppenflügen Pflicht.',
            'members' => [[0, 'member'], [5, 'member'], [9, 'member'], [13, 'member']],
            'channels' => [['Orga-intern', 'admin']],
            'invites' => [
                ['mode' => 'directed', 'user' => 1, 'status' => 'pending'],
                ['mode' => 'token', 'status' => 'pending', 'max_uses' => 5, 'expires_in_days' => 30],
            ],
            'posts' => [],
        ],
        [
            'name' => 'Stubai Locals', 'visibility' => 'unlisted', 'join_policy' => 'open',
            'owner' => 0, 'region' => 'Tirol (Stubai)', 'tags' => ['stubai', 'locals'],
            'description' => 'Treffpunkt der Stubaital-Locals. Nur per Link auffindbar, Feed öffentlich.',
            'rules' => 'Jeder ist willkommen, der den Link hat.',
            'members' => [[2, 'member'], [5, 'member'], [3, 'member']],
            'posts' => [
                ['title' => null, 'body' => 'Elfer heute in Top-Form! 🔥', 'pinned' => false, 'author' => 0, 'reactions' => ['🔥' => [2]]],
            ],
        ],
        [
            'name' => 'Tegernsee Crew', 'visibility' => 'unlisted', 'join_policy' => 'request',
            'owner' => 1, 'region' => 'Tegernsee', 'tags' => ['tegernsee', 'voralpen'],
            'description' => 'Unlisted Gruppe für die Tegernsee-Region. Beitritt auf Anfrage.',
            'rules' => 'Anfrage bitte mit kurzer Vorstellung.',
            'members' => [[0, 'admin'], [10, 'member'], [3, 'member']],
            'requests' => [
                [2, 'Bin neu am Tegernsee und freue mich auf Kontakte.', 'pending'],
            ],
            'posts' => [],
        ],
        [
            'name' => 'FSR-Trier Akaflieg (privat)', 'visibility' => 'private', 'join_policy' => 'invite_only',
            'owner' => 2, 'region' => 'Hunsrück', 'tags' => ['uni', 'trier', 'akaflieg'],
            'description' => 'Private Hochschulgruppe. Feed und Channels nur für Mitglieder.',
            'rules' => 'Nur für Studierende und Alumni der Uni Trier.',
            'members' => [[1, 'admin'], [0, 'member', 'banned'], [13, 'member']],
            'invites' => [
                ['mode' => 'token', 'status' => 'pending', 'max_uses' => null, 'expires_in_days' => 14],
                ['mode' => 'token', 'status' => 'revoked', 'max_uses' => 1, 'expires_in_days' => 7],
            ],
            'posts' => [
                ['title' => 'Interne Info', 'body' => 'Nächstes Treffen im Hörsaal B. Nur für Mitglieder sichtbar.', 'pinned' => true, 'author' => 2, 'reactions' => []],
            ],
        ],
        [
            'name' => 'Anfänger-Treff Schwäbische Alb', 'visibility' => 'public', 'join_policy' => 'open',
            'owner' => 0, 'region' => 'Schwäbische Alb', 'tags' => ['anfaenger', 'alb', 'uebungshang'],
            'description' => 'Für frische A-Scheine: Übungshänge, Groundhandling und entspanntes Fliegen.',
            'rules' => 'Keine dummen Fragen. Sicherheit und Spaß stehen im Vordergrund.',
            'members' => [[1, 'member'], [2, 'member'], [4, 'member'], [8, 'member'], [12, 'member'], [7, 'member']],
            'posts' => [
                ['title' => 'Übungstag am Wochenende', 'body' => 'Samstag treffen wir uns am Übungshang Beuren. Anfänger willkommen!', 'pinned' => false, 'author' => 0, 'reactions' => ['👍' => [1, 2], '🪂' => [2]]],
            ],
        ],
        [
            'name' => 'Kärnten Soaring (privat)', 'visibility' => 'private', 'join_policy' => 'request',
            'owner' => 1, 'region' => 'Kärnten', 'tags' => ['kaernten', 'soaring'],
            'description' => 'Private Gruppe für Soaring-Sessions in Kärnten. Beitritt auf Anfrage.',
            'rules' => 'Anfrage bitte mit Erfahrungslevel.',
            'members' => [[2, 'admin'], [9, 'member'], [5, 'member']],
            'requests' => [
                [0, 'Würde gern bei den Soaring-Sessions mitmachen.', 'pending'],
            ],
            'posts' => [],
        ],
    ];

    /** Kuratierte DM-Paare (Pilot-Indizes); Lena (0) bewusst in mehreren für eine volle Chat-Seitenleiste. */
    private array $dmPairs = [[0, 1], [0, 2], [0, 3], [0, 6], [1, 2], [1, 4], [2, 8], [3, 10], [5, 9], [6, 14]];

    public function run(): void
    {
        $pilotIds = $this->seedPilots();
        $this->seedSpots();
        $adminId = $this->seedAdmin();
        $this->seedMeetups($pilotIds);
        $this->seedGroups($pilotIds);
        $this->seedChat($pilotIds);
        $this->seedAdminDemo($adminId, $pilotIds);
        $this->seedNotifications($pilotIds, $adminId);
    }

    /**
     * Legt die Pilot-Konten an (Shield-Identität + `profiles`-Zeile) und liefert ihre User-IDs
     * (auch bei idempotentem Re-Run, damit Folge-Seeds referenzieren können).
     * @return list<int> User-IDs in Reihenfolge von $this->pilots
     */
    private function seedPilots(): array
    {
        /** @var UserModel $users */
        $users = model(UserModel::class);
        $ids   = [];

        foreach ($this->pilots as $pilot) {
            $existing = $users->findByCredentials(['email' => $pilot['email']]);
            if ($existing !== null) {
                $ids[] = (int) $existing->id;
                continue;
            }

            // `active` setzen: E-Mail/Passwort wandern in auth_identities, ohne dies wäre der
            // users-Insert leer. Konten sind sofort aktiv (ADR-008: keine E-Mail-Verifikation).
            $user = new User(['email' => $pilot['email'], 'password' => $pilot['password'], 'active' => true]);
            $users->save($user);
            $user = $users->findById($users->getInsertID());
            $users->addToDefaultGroup($user);

            $this->insertProfile((int) $user->id, $pilot);
            $ids[] = (int) $user->id;
        }

        return $ids;
    }

    /**
     * Legt den Plattform-Admin an (Shield-Gruppe `admin` statt `user`) und liefert seine ID. Idempotent.
     */
    private function seedAdmin(): int
    {
        /** @var UserModel $users */
        $users = model(UserModel::class);

        $existing = $users->findByCredentials(['email' => $this->admin['email']]);
        if ($existing !== null) {
            return (int) $existing->id;
        }

        $user = new User(['email' => $this->admin['email'], 'password' => $this->admin['password'], 'active' => true]);
        $users->save($user);
        $user = $users->findById($users->getInsertID());
        $user->addGroup('admin'); // Plattform-Admin: umgeht BOLA bei Meetup-/Gruppen-Verwaltung (ADR-012/D4)

        $this->insertProfile((int) $user->id, $this->admin);

        return (int) $user->id;
    }

    /**
     * Schreibt eine `profiles`-Zeile aus einem Pilot-/Admin-Spec (gemeinsamer Pfad für Piloten + Admin).
     * @param array{display_name:string,handle:string,experience_level:string,home_region:string,license_class?:?string,glider?:?string,flight_hours?:?int,bio?:?string} $spec
     */
    private function insertProfile(int $userId, array $spec): void
    {
        $this->db->table('profiles')->insert([
            'user_id'          => $userId,
            'display_name'     => $spec['display_name'],
            'handle'           => $spec['handle'],
            'experience_level' => $spec['experience_level'],
            'home_region'      => $spec['home_region'],
            'license_class'    => $spec['license_class'] ?? null,
            'glider'           => $spec['glider'] ?? null,
            'flight_hours'     => $spec['flight_hours'] ?? null,
            'bio_markdown'     => $spec['bio'] ?? null,
        ]);
    }

    /** Befüllt `spots` aus der kuratierten Liste (idempotent: überspringt, wenn schon befüllt). */
    private function seedSpots(): void
    {
        if ($this->db->table('spots')->countAllResults() > 0) {
            return;
        }
        $this->db->table('spots')->insertBatch($this->spots);
    }

    /**
     * Legt die Treffen + Teilnahmen an (idempotent). Kopiert Spot-Geo als Snapshot (Denormalisierung)
     * und trägt den Ersteller als ersten Teilnehmer ein (ADR-015).
     * @param list<int> $pilotIds
     */
    private function seedMeetups(array $pilotIds): void
    {
        if ($pilotIds === [] || $this->db->table('meetups')->countAllResults() > 0) {
            return;
        }

        // Spot-Lookup name → Zeile (für Geo-Snapshot).
        $spotByName = [];
        foreach ($this->db->table('spots')->get()->getResultArray() as $spot) {
            $spotByName[$spot['name']] = $spot;
        }

        foreach ($this->meetups as $m) {
            $spot = $spotByName[$m['spot']] ?? null;
            if ($spot === null) {
                continue; // Spot fehlt (sollte nicht vorkommen) → Treffen überspringen
            }

            $this->db->table('meetups')->insert([
                'creator_user_id'  => $pilotIds[$m['creator']],
                'spot_id'          => $spot['id'],
                'spot_name'        => $spot['name'],
                'region'           => $spot['region'],
                'lat'              => $spot['lat'],
                'lng'              => $spot['lng'],
                'title'            => $m['title'],
                'description'      => $m['description'],
                'starts_at'        => $this->startsAt($m['days'], $m['time']),
                'experience_level' => $m['level'],
                'max_participants' => $m['max'],
                'status'           => $m['status'],
            ]);
            $meetupId = (int) $this->db->insertID();

            // Ersteller zuerst, dann Extra-Teilnehmer (dedupliziert; zählen zur Kapazität).
            $participantIds = [];
            foreach (array_merge([$m['creator']], $m['extra']) as $idx) {
                $participantIds[$pilotIds[$idx]] = true;
            }
            $rows = array_map(
                static fn (int $userId): array => ['meetup_id' => $meetupId, 'user_id' => $userId],
                array_keys($participantIds),
            );
            $this->db->table('meetup_participants')->insertBatch($rows);
        }
    }

    /**
     * `starts_at` (UTC-DATETIME) aus Tagesversatz + **lokaler** Startzeit. Der Versatz bleibt relativ
     * zum Seed-Lauf, damit jeder Reseed frische Status erzeugt; die Uhrzeit gehört dagegen zum Treffen
     * und darf nicht die Laufzeit des Seeders erben — sonst startet der Frühflug um 16 Uhr.
     * Gerechnet wird in `Europe/Berlin` (alle Spots liegen im DACH-Raum) und erst zum Schluss nach UTC
     * konvertiert, damit die Sommerzeit korrekt einfließt.
     */
    private function startsAt(int $days, string $time): string
    {
        [$hour, $minute] = array_map('intval', explode(':', $time));

        return (new DateTimeImmutable('today', new DateTimeZone('Europe/Berlin')))
            ->modify(sprintf('%+d days', $days))
            ->setTime($hour, $minute)
            ->setTimezone(new DateTimeZone('UTC'))
            ->format('Y-m-d H:i:s');
    }

    /**
     * Legt die 8 Demo-Gruppen samt Mitgliedern, Channels (Default + Extra), Beitrittsanträgen,
     * Einladungen und Feed-Posts (inkl. Reaktionen) an (idempotent). `members_count` wird konsistent zur
     * Zahl **aktiver** Mitglieder gesetzt; jede Gruppe erhält automatisch den Default-Channel „Allgemein".
     * @param list<int> $pilotIds
     */
    private function seedGroups(array $pilotIds): void
    {
        if ($pilotIds === [] || $this->db->table('groups')->countAllResults() > 0) {
            return;
        }

        foreach ($this->groups as $g) {
            $ownerId = $pilotIds[$g['owner']];

            // Aktive Mitglieder zählen (Owner + nicht-gebannte Extra-Mitglieder) für members_count.
            $activeCount = 1;
            foreach ($g['members'] ?? [] as $m) {
                if (($m[2] ?? 'active') !== 'banned') {
                    $activeCount++;
                }
            }

            $this->db->table('groups')->insert([
                'slug'          => $this->slugify($g['name']),
                'name'          => $g['name'],
                'description'   => $g['description'],
                'region'        => $g['region'],
                'tags'          => json_encode($g['tags'], JSON_UNESCAPED_UNICODE),
                'rules_text'    => $g['rules'],
                'visibility'    => $g['visibility'],
                'join_policy'   => $g['join_policy'],
                'owner_user_id' => $ownerId,
                'members_count' => $activeCount,
            ]);
            $groupId = (int) $this->db->insertID();

            // Mitglieder: Owner zuerst, dann Extra-Mitglieder ([pilotIdx, rolle, status?]).
            $memberRows = [['group_id' => $groupId, 'user_id' => $ownerId, 'role' => 'owner', 'status' => 'active']];
            foreach ($g['members'] ?? [] as $m) {
                $memberRows[] = [
                    'group_id' => $groupId,
                    'user_id'  => $pilotIds[$m[0]],
                    'role'     => $m[1],
                    'status'   => $m[2] ?? 'active',
                ];
            }
            $this->db->table('group_members')->insertBatch($memberRows);

            // Channels: Default „Allgemein" (position 0, nicht löschbar) + Extra-Channels ([titel, min_role]).
            $channelRows = [[
                'type' => 'group_channel', 'context_type' => 'group', 'context_id' => $groupId,
                'title' => 'Allgemein', 'position' => 0, 'is_default' => 1, 'min_role' => 'member', 'created_by' => $ownerId,
            ]];
            $pos = 1;
            foreach ($g['channels'] ?? [] as $ch) {
                $channelRows[] = [
                    'type' => 'group_channel', 'context_type' => 'group', 'context_id' => $groupId,
                    'title' => $ch[0], 'position' => $pos++, 'is_default' => 0, 'min_role' => $ch[1], 'created_by' => $ownerId,
                ];
            }
            $this->db->table('conversations')->insertBatch($channelRows);

            // Beitrittsanträge ([pilotIdx, message, status]).
            foreach ($g['requests'] ?? [] as $r) {
                $decided = in_array($r[2], ['approved', 'rejected'], true);
                $this->db->table('group_join_requests')->insert([
                    'group_id'   => $groupId,
                    'user_id'    => $pilotIds[$r[0]],
                    'message'    => $r[1],
                    'status'     => $r[2],
                    'decided_by' => $decided ? $ownerId : null,
                    'decided_at' => $decided ? gmdate('Y-m-d H:i:s') : null,
                ]);
            }

            // Einladungen: gerichtet (invited_user_id) ODER Token-Link (token).
            foreach ($g['invites'] ?? [] as $inv) {
                $this->db->table('group_invites')->insert([
                    'group_id'        => $groupId,
                    'invited_by'      => $ownerId,
                    'invited_user_id' => $inv['mode'] === 'directed' ? $pilotIds[$inv['user']] : null,
                    'token'           => $inv['mode'] === 'token' ? bin2hex(random_bytes(16)) : null,
                    'status'          => $inv['status'],
                    'expires_at'      => isset($inv['expires_in_days']) ? gmdate('Y-m-d H:i:s', time() + $inv['expires_in_days'] * 86400) : null,
                    'max_uses'        => $inv['max_uses'] ?? null,
                    'uses_count'      => 0,
                ]);
            }

            // Feed-Posts (+ Reaktionen). created_at gestaffelt ⇒ Array-Reihenfolge = chronologisch aufsteigend.
            $posts = $g['posts'] ?? [];
            $total = count($posts);
            foreach ($posts as $i => $p) {
                $deleted = $p['deleted'] ?? false;
                $createdAt = gmdate('Y-m-d H:i:s', time() - ($total - $i) * 3600);
                $this->db->table('feed_posts')->insert([
                    'group_id'       => $groupId,
                    'author_user_id' => $pilotIds[$p['author']],
                    'title'          => $p['title'],
                    'body'           => $p['body'],
                    'is_pinned'      => empty($p['pinned']) ? 0 : 1,
                    'created_at'     => $createdAt,
                    'updated_at'     => $createdAt, // = created ⇒ nicht „bearbeitet" (außer echten Edits)
                    'deleted_at'     => $deleted ? gmdate('Y-m-d H:i:s') : null,
                    'deleted_by'     => $deleted ? $ownerId : null,
                ]);
                $postId = (int) $this->db->insertID();

                $reactionRows = [];
                foreach ($p['reactions'] ?? [] as $emoji => $userIdxs) {
                    foreach ($userIdxs as $idx) {
                        $reactionRows[] = ['feed_post_id' => $postId, 'user_id' => $pilotIds[$idx], 'emoji' => $emoji];
                    }
                }
                if ($reactionRows !== []) {
                    $this->db->table('feed_post_reactions')->insertBatch($reactionRows);
                }
            }
        }
    }

    /**
     * Legt die Chat-Daten an (idempotent): Teilnehmer + Verlauf für Gruppen-Channels, je einen
     * Treffen-Chat (setzt `meetups.conversation_id`) und kuratierte DMs zwischen den Piloten — inkl.
     * Reaktionen, Reply, bearbeiteter und gelöschter (Tombstone) Nachricht. Für den Demo-Login Lena
     * (Pilot 0) bleiben die erste Default-Channel- und die erste DM-Konversation bewusst ungelesen
     * (sichtbares Badge).
     * @param list<int> $pilotIds
     */
    private function seedChat(array $pilotIds): void
    {
        if ($pilotIds === [] || $this->db->table('messages')->countAllResults() > 0) {
            return;
        }
        $lena          = $pilotIds[0];
        $unreadForLena = []; // conv-ID ⇒ last_read_message_id (Lena behält 1 ungelesen)

        // 1) Gruppen-Channels: cp für aktive Mitglieder; Default-Channels bekommen einen Verlauf.
        $firstDefaultDone = false;
        $channels         = $this->db->table('conversations')->where('type', 'group_channel')->orderBy('id', 'ASC')->get()->getResultArray();
        foreach ($channels as $ch) {
            $convId  = (int) $ch['id'];
            $members = $this->db->table('group_members')->where('group_id', $ch['context_id'])->where('status', 'active')->orderBy('id', 'ASC')->get()->getResultArray();
            $memberIds = array_values(array_map(static fn (array $m): int => (int) $m['user_id'], $members));
            if ($memberIds === []) {
                continue;
            }

            $ids = [];
            if ((int) $ch['is_default'] === 1) {
                [, $lastAt, $ids] = $this->seedMessages($convId, $memberIds, $this->channelScript());
                $this->db->table('conversations')->where('id', $convId)->update(['last_message_at' => $lastAt]);
                if (! $firstDefaultDone && in_array($lena, $memberIds, true) && count($ids) >= 2) {
                    $unreadForLena[$convId] = $ids[count($ids) - 2];
                    $firstDefaultDone      = true;
                }
            }

            $rows = array_map(static function (array $m): array {
                $role = in_array($m['role'], ['owner', 'admin'], true) ? $m['role'] : 'member';

                return ['user_id' => (int) $m['user_id'], 'role' => $role];
            }, $members);
            $this->seedParticipants($convId, $rows, $ids === [] ? null : $ids[count($ids) - 1], $unreadForLena, $lena);
        }

        // 2) Treffen-Chats: Konversation je Treffen anlegen, verknüpfen, cp + Verlauf (Ersteller zuerst).
        foreach ($this->db->table('meetups')->orderBy('id', 'ASC')->get()->getResultArray() as $mt) {
            $meetupId  = (int) $mt['id'];
            $creatorId = (int) $mt['creator_user_id'];
            $partIds   = array_values(array_map(static fn (array $p): int => (int) $p['user_id'], $this->db->table('meetup_participants')->where('meetup_id', $meetupId)->orderBy('id', 'ASC')->get()->getResultArray()));
            if ($partIds === []) {
                continue;
            }
            $partIds = array_values(array_unique(array_merge([$creatorId], $partIds))); // Ersteller zuerst (is_creator-Demo)

            $this->db->table('conversations')->insert([
                'type' => 'meetup', 'context_type' => 'meetup', 'context_id' => $meetupId,
                'title' => $mt['title'], 'created_by' => $creatorId,
            ]);
            $convId = (int) $this->db->insertID();
            $this->db->table('meetups')->where('id', $meetupId)->update(['conversation_id' => $convId]);

            [, $lastAt, $ids] = $this->seedMessages($convId, $partIds, $this->meetupScript());
            $this->db->table('conversations')->where('id', $convId)->update(['last_message_at' => $lastAt]);
            $rows = array_map(static fn (int $uid): array => ['user_id' => $uid, 'role' => 'member'], $partIds);
            $this->seedParticipants($convId, $rows, $ids === [] ? null : $ids[count($ids) - 1], [], $lena);
        }

        // 3) DMs: kuratierte Pilot-Paare (deterministischer dm_key = min:max). Lena ist in mehreren vertreten.
        $firstDm = true;
        foreach ($this->dmPairs as [$i, $j]) {
            $a = $pilotIds[$i];
            $b = $pilotIds[$j];
            $this->db->table('conversations')->insert([
                'type' => 'direct', 'dm_key' => min($a, $b) . ':' . max($a, $b), 'created_by' => $a,
            ]);
            $convId           = (int) $this->db->insertID();
            [, $lastAt, $ids] = $this->seedMessages($convId, [$a, $b], $this->dmScript());
            $this->db->table('conversations')->where('id', $convId)->update(['last_message_at' => $lastAt]);
            if ($firstDm && ($a === $lena || $b === $lena) && count($ids) >= 2) {
                $unreadForLena[$convId] = $ids[count($ids) - 2];
                $firstDm               = false;
            }
            $this->seedParticipants($convId, [['user_id' => $a, 'role' => 'member'], ['user_id' => $b, 'role' => 'member']], $ids === [] ? null : $ids[count($ids) - 1], $unreadForLena, $lena);
        }
    }

    /**
     * Verdrahtet den Admin-Account in bestehende Daten, damit „Login als Admin" sofort gefüllte
     * Oberflächen zeigt: Mitglied der ersten Gruppe (inkl. Default-Channel), Teilnehmer des ersten
     * Treffens (inkl. Treffen-Chat) und eine DM mit Lena. Idempotent über die cp-Existenz des Admins.
     * @param list<int> $pilotIds
     */
    private function seedAdminDemo(int $adminId, array $pilotIds): void
    {
        if ($pilotIds === [] || $this->db->table('conversation_participants')->where('user_id', $adminId)->countAllResults() > 0) {
            return;
        }
        $lena = $pilotIds[0];

        // 1) Mitglied der ersten Gruppe (members_count konsistent halten) + Default-Channel-Teilnahme.
        $group = $this->db->table('groups')->orderBy('id', 'ASC')->get()->getRowArray();
        if ($group !== null) {
            $groupId = (int) $group['id'];
            $this->db->table('group_members')->insert(['group_id' => $groupId, 'user_id' => $adminId, 'role' => 'member', 'status' => 'active']);
            $this->db->table('groups')->where('id', $groupId)->set('members_count', 'members_count + 1', false)->update();

            $channel = $this->db->table('conversations')->where('type', 'group_channel')->where('context_id', $groupId)->where('is_default', 1)->get()->getRowArray();
            if ($channel !== null) {
                $this->addReadParticipant((int) $channel['id'], $adminId);
            }
        }

        // 2) Teilnehmer des ersten Treffens + dessen Treffen-Chat.
        $meetup = $this->db->table('meetups')->orderBy('id', 'ASC')->get()->getRowArray();
        if ($meetup !== null) {
            $this->db->table('meetup_participants')->insert(['meetup_id' => (int) $meetup['id'], 'user_id' => $adminId]);
            if ($meetup['conversation_id'] !== null) {
                $this->addReadParticipant((int) $meetup['conversation_id'], $adminId);
            }
        }

        // 3) DM Admin ↔ Lena mit kurzem Verlauf (für beider Seitenleisten).
        $this->db->table('conversations')->insert(['type' => 'direct', 'dm_key' => min($adminId, $lena) . ':' . max($adminId, $lena), 'created_by' => $adminId]);
        $convId           = (int) $this->db->insertID();
        [, $lastAt, $ids] = $this->seedMessages($convId, [$adminId, $lena], $this->dmScript());
        $this->db->table('conversations')->where('id', $convId)->update(['last_message_at' => $lastAt]);
        $this->seedParticipants($convId, [['user_id' => $adminId, 'role' => 'member'], ['user_id' => $lena, 'role' => 'member']], $ids === [] ? null : $ids[count($ids) - 1], [], $lena);
    }

    /**
     * Fügt einen Nachrichtenverlauf in eine Konversation ein (Autoren rotieren über $authorIds),
     * zurückdatiert, mit optionalen Reaktionen/Reply/Edit/Tombstone laut $script.
     * @param list<int>                                                                                                 $authorIds
     * @param list<array{by:int,text:?string,react?:array<string,list<int>>,reply?:int,edited?:bool,deleted?:bool}>     $script
     * @return array{0:?int,1:?string,2:list<int>} [letzteId, letzterZeitstempel, alleIds]
     */
    private function seedMessages(int $convId, array $authorIds, array $script): array
    {
        $count = count($authorIds);
        $ids   = [];
        $base  = time() - count($script) * 1800 - 3600;
        $last  = null;

        foreach ($script as $i => $s) {
            $sender    = $authorIds[$s['by'] % $count];
            $createdAt = gmdate('Y-m-d H:i:s', $base + $i * 1800);
            $edited    = $s['edited'] ?? false;
            $deleted   = $s['deleted'] ?? false;
            $editStamp = gmdate('Y-m-d H:i:s', $base + $i * 1800 + 120);
            $replyIdx  = $s['reply'] ?? null;

            $this->db->table('messages')->insert([
                'conversation_id' => $convId,
                'sender_id'       => $sender,
                'body'            => $deleted ? null : $s['text'],
                'reply_to_id'     => ($replyIdx !== null && isset($ids[$replyIdx])) ? $ids[$replyIdx] : null,
                'created_at'      => $createdAt,
                'updated_at'      => $edited ? $editStamp : $createdAt,
                'edited_at'       => $edited ? $editStamp : null,
                'deleted_at'      => $deleted ? gmdate('Y-m-d H:i:s', $base + $i * 1800 + 60) : null,
                'deleted_by'      => $deleted ? $sender : null,
            ]);
            $mid   = (int) $this->db->insertID();
            $ids[] = $mid;
            $last  = $createdAt;

            foreach ($s['react'] ?? [] as $emoji => $idxs) {
                $seen = [];
                $rows = [];
                foreach ($idxs as $idx) {
                    $uid = $authorIds[$idx % $count];
                    if (isset($seen[$uid])) {
                        continue; // uq_reaction: ein Emoji pro Nutzer pro Nachricht
                    }
                    $seen[$uid] = true;
                    $rows[]     = ['message_id' => $mid, 'user_id' => $uid, 'emoji' => $emoji];
                }
                if ($rows !== []) {
                    $this->db->table('message_reactions')->insertBatch($rows);
                }
            }
        }

        return [$last === null ? null : $ids[count($ids) - 1], $last, $ids];
    }

    /**
     * Legt die `conversation_participants`-Zeilen an. `last_read_message_id` = letzte Nachricht
     * (gelesen), außer für Lena in den als ungelesen markierten Konversationen.
     * @param list<array{user_id:int,role:string}> $rows
     * @param array<int,int>                        $unreadForLena conv-ID ⇒ last_read_message_id
     */
    private function seedParticipants(int $convId, array $rows, ?int $lastId, array $unreadForLena, int $lenaId): void
    {
        $insert = [];
        foreach ($rows as $r) {
            $lastRead = ($r['user_id'] === $lenaId && array_key_exists($convId, $unreadForLena))
                ? $unreadForLena[$convId]
                : $lastId;
            $insert[] = [
                'conversation_id'      => $convId,
                'user_id'              => $r['user_id'],
                'role'                 => $r['role'],
                'last_read_message_id' => $lastRead,
                'last_read_at'         => $lastRead !== null ? gmdate('Y-m-d H:i:s') : null,
                'muted'                => 0,
            ];
        }
        if ($insert !== []) {
            $this->db->table('conversation_participants')->insertBatch($insert);
        }
    }

    /** Fügt einen Teilnehmer (Rolle member, als gelesen) zu einer bestehenden Konversation hinzu. */
    private function addReadParticipant(int $convId, int $userId): void
    {
        $row    = $this->db->table('messages')->where('conversation_id', $convId)->orderBy('id', 'DESC')->get(1)->getRowArray();
        $lastId = $row !== null ? (int) $row['id'] : null;
        $this->db->table('conversation_participants')->insert([
            'conversation_id'      => $convId,
            'user_id'              => $userId,
            'role'                 => 'member',
            'last_read_message_id' => $lastId,
            'last_read_at'         => $lastId !== null ? gmdate('Y-m-d H:i:s') : null,
            'muted'                => 0,
        ]);
    }

    /** @return list<array<string,mixed>> Verlauf eines Gruppen-Channels (Reply, Edit, Tombstone, Reaktionen). */
    private function channelScript(): array
    {
        return [
            ['by' => 0, 'text' => 'Servus zusammen! Wie sehen die Bedingungen am Wochenende aus?'],
            ['by' => 1, 'text' => 'Sieht gut aus – Nordwest, mäßig. Vormittags fliegbar.', 'react' => ['👍' => [0, 2]]],
            ['by' => 2, 'text' => 'Top, dann bin ich dabei! Treffpunkt wie immer am Parkplatz?', 'reply' => 1],
            ['by' => 0, 'text' => 'Genau, 9 Uhr Talstation. Prognose hier: https://www.dwd.de'],
            ['by' => 3, 'text' => 'Ich bringe noch zwei Leute aus dem Verein mit. 🪂'],
            ['by' => 1, 'text' => 'Korrektur: 8:30 Uhr meinte ich. 🙂', 'edited' => true],
            ['by' => 2, 'text' => null, 'deleted' => true],
            ['by' => 4, 'text' => 'Hat jemand einen aktuellen Wetterbericht für Sonntag?', 'react' => ['👍' => [0]]],
            ['by' => 0, 'text' => 'Sonntag wird’s böig – eher nichts. Samstag ist das Fenster.'],
            ['by' => 3, 'text' => 'Dann Samstag! Wer fährt, wer braucht eine Mitfahrgelegenheit?'],
            ['by' => 1, 'text' => 'Ich habe zwei Plätze frei. Meldet euch per DM.', 'react' => ['🔥' => [2, 3]]],
            ['by' => 0, 'text' => 'Bis Samstag dann! 🪂', 'react' => ['🔥' => [1, 2], '🪂' => [3]]],
        ];
    }

    /** @return list<array<string,mixed>> Verlauf eines Treffen-Chats (Ersteller = Autor-Index 0). */
    private function meetupScript(): array
    {
        return [
            ['by' => 0, 'text' => 'Hallo zusammen! Ich habe das Treffen erstellt – freue mich auf euch. 🪂', 'react' => ['🪂' => [1]]],
            ['by' => 1, 'text' => 'Super, danke fürs Organisieren!'],
            ['by' => 0, 'text' => 'Treffpunkt 17:00 am oberen Parkplatz. Bitte Schirm-Check machen.'],
            ['by' => 1, 'text' => 'Alles klar, bin pünktlich da. 👍', 'reply' => 2],
            ['by' => 0, 'text' => 'Wetter sieht stabil aus – freue mich! ☀️', 'react' => ['👍' => [1]]],
        ];
    }

    /** @return list<array<string,mixed>> Verlauf einer DM. */
    private function dmScript(): array
    {
        return [
            ['by' => 0, 'text' => 'Servus! Fliegst du am Wochenende mit?'],
            ['by' => 1, 'text' => 'Klar, bin dabei! Wann am Parkplatz?', 'react' => ['👍' => [0]]],
            ['by' => 0, 'text' => 'So gegen 8. Nehme noch jemanden mit.'],
            ['by' => 1, 'text' => 'Perfekt, bis dann! ☀️'],
        ];
    }

    /**
     * Legt einen repräsentativen Satz Benachrichtigungen an (idempotent), verteilt über die acht
     * Typen des Frontend-Enums, ~40 % ungelesen, mit `data`-Render-Payload und realen Kontext-IDs.
     * Adressiert Lena, weitere Piloten **und** den Admin, damit jeder Demo-Login ein gefülltes Center
     * sieht. Gruppen/Treffen werden in Seed-Reihenfolge per Index referenziert.
     * @param list<int> $pilotIds
     */
    private function seedNotifications(array $pilotIds, int $adminId): void
    {
        if ($pilotIds === [] || $this->db->table('notifications')->countAllResults() > 0) {
            return;
        }
        $P       = $pilotIds; // Pilot-IDs nach Index
        $groups  = $this->db->table('groups')->orderBy('id', 'ASC')->get()->getResultArray();   // [0..7] = $this->groups
        $meetups = $this->db->table('meetups')->orderBy('id', 'ASC')->get()->getResultArray();   // [0..17] = $this->meetups

        $now    = time();
        $rows   = [];
        $push   = static function (int $userId, string $type, ?int $actor, ?string $ctxType, ?int $ctxId, array $data, bool $read, int $hoursAgo) use (&$rows, $now): void {
            $when   = gmdate('Y-m-d H:i:s', $now - $hoursAgo * 3600);
            $rows[] = [
                'user_id'       => $userId,
                'type'          => $type,
                'actor_user_id' => $actor,
                'context_type'  => $ctxType,
                'context_id'    => $ctxId,
                'data'          => json_encode($data, JSON_UNESCAPED_UNICODE),
                'read_at'       => $read ? $when : null,
                'created_at'    => $when,
            ];
        };
        // DM-Konversations-ID für ein Nutzerpaar (deterministischer dm_key).
        $dmId = function (int $u1, int $u2): ?int {
            $row = $this->db->table('conversations')->where('dm_key', min($u1, $u2) . ':' . max($u1, $u2))->get()->getRowArray();

            return $row !== null ? (int) $row['id'] : null;
        };
        // Channel-Konversations-ID einer Gruppe per Titel — für Channel-`new_message`-Benachrichtigungen,
        // die der Presenter (data.group_id gesetzt) auf die Channel-UI statt den globalen Chat führt.
        $channelId = function (int $groupId, string $title): ?int {
            $row = $this->db->table('conversations')
                ->where('type', 'group_channel')->where('context_id', $groupId)->where('title', $title)
                ->get()->getRowArray();

            return $row !== null ? (int) $row['id'] : null;
        };
        // Render-Payload für eine Channel-Nachricht (markiert die Konversation im Presenter als Channel).
        $channelData = static fn (array $group, string $channel): array => [
            'group_id' => (int) $group['id'], 'group_name' => $group['name'], 'channel_name' => $channel,
        ];

        // — Lena (Demo-Pilotin): voll gemischtes Center —
        $push($P[0], 'meetup_join', $P[1], 'meetup', (int) $meetups[0]['id'], ['meetup_title' => $meetups[0]['title']], false, 1);
        $push($P[0], 'meetup_join', $P[2], 'meetup', (int) $meetups[0]['id'], ['meetup_title' => $meetups[0]['title']], true, 20);
        $push($P[0], 'meetup_cancelled', (int) $meetups[5]['creator_user_id'], 'meetup', (int) $meetups[5]['id'], ['meetup_title' => $meetups[5]['title']], false, 5);
        $push($P[0], 'group_join_request', $P[2], 'group', (int) $groups[0]['id'], ['group_name' => $groups[0]['name']], false, 2);
        $push($P[0], 'group_feed_post', $P[1], 'group', (int) $groups[0]['id'], ['group_name' => $groups[0]['name']], true, 30);
        $push($P[0], 'new_message', $P[1], 'conversation', $dmId($P[0], $P[1]), ['title' => 'Markus Thaler'], false, 1);
        $push($P[0], 'new_message', $P[1], 'conversation', $channelId((int) $groups[0]['id'], 'Wetter'), $channelData($groups[0], 'Wetter'), false, 4);
        $push($P[0], 'message_reaction', $P[2], 'conversation', $dmId($P[0], $P[2]), ['emoji' => '👍', 'title' => 'Sophie Berg'], true, 26);

        // — Markus —
        $push($P[1], 'meetup_join', $P[2], 'meetup', (int) $meetups[1]['id'], ['meetup_title' => $meetups[1]['title']], false, 3);
        $push($P[1], 'group_join_request', $P[2], 'group', (int) $groups[1]['id'], ['group_name' => $groups[1]['name']], true, 8);
        $push($P[1], 'new_message', $P[0], 'conversation', $dmId($P[1], $P[0]), ['title' => 'Lena Krüger'], false, 2);
        $push($P[1], 'new_message', $P[0], 'conversation', $channelId((int) $groups[1]['id'], 'Streckenmeldungen'), $channelData($groups[1], 'Streckenmeldungen'), true, 9);
        $push($P[1], 'group_invite', $P[2], 'group', (int) $groups[2]['id'], ['group_name' => $groups[2]['name']], false, 14);

        // — Sophie —
        $push($P[2], 'meetup_join', $P[0], 'meetup', (int) $meetups[2]['id'], ['meetup_title' => $meetups[2]['title']], false, 4);
        $push($P[2], 'new_message', $P[1], 'conversation', $dmId($P[2], $P[1]), ['title' => 'Markus Thaler'], true, 10);
        $push($P[2], 'message_reaction', $P[0], 'conversation', $dmId($P[2], $P[0]), ['emoji' => '🔥', 'title' => 'Lena Krüger'], false, 7);

        // — Weitere Piloten —
        $push($P[3], 'new_message', $P[10], 'conversation', $dmId($P[3], $P[10]), ['title' => 'Sarah Köhler'], false, 3);
        $push($P[6], 'group_feed_post', $P[0], 'group', (int) $groups[0]['id'], ['group_name' => $groups[0]['name']], true, 12);
        $push($P[5], 'meetup_join', $P[9], 'meetup', (int) $meetups[10]['id'], ['meetup_title' => $meetups[10]['title']], false, 6);
        $push($P[6], 'meetup_cancelled', $P[14], 'meetup', (int) $meetups[17]['id'], ['meetup_title' => $meetups[17]['title']], true, 9);
        $push($P[8], 'group_request_approved', $P[1], 'group', (int) $groups[1]['id'], ['group_name' => $groups[1]['name']], false, 5);

        // — Admin —
        $push($adminId, 'new_message', $P[0], 'conversation', $dmId($adminId, $P[0]), ['title' => 'Lena Krüger'], false, 1);
        $push($adminId, 'group_feed_post', $P[1], 'group', (int) $groups[0]['id'], ['group_name' => $groups[0]['name']], true, 15);
        $push($adminId, 'message_reaction', $P[0], 'conversation', $dmId($adminId, $P[0]), ['emoji' => '🪂', 'title' => 'Lena Krüger'], false, 8);

        if ($rows !== []) {
            $this->db->table('notifications')->insertBatch($rows);
        }
    }

    /** Erzeugt einen URL-tauglichen Slug aus dem Gruppennamen (Umlaute → ASCII). */
    private function slugify(string $name): string
    {
        $s = strtr($name, ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss', 'Ä' => 'ae', 'Ö' => 'oe', 'Ü' => 'ue']);
        $s = preg_replace('/[^a-z0-9]+/', '-', strtolower($s)) ?? '';

        return trim($s, '-');
    }
}
