<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;

/**
 * Lokaler Entwicklungs-Seed: ein paar Pilot-Konten plus die Flugtreffen-Domäne (Spots + Treffen +
 * Teilnahmen), damit Liste/Karte/Detail nach dem Seam-Flip sofort „voll" wirken. Idempotent: jede
 * Domäne wird übersprungen, wenn ihre Tabelle bereits befüllt ist. Der vollständige Faker-Seed
 * (SEED_DATA.md, ADR-002) folgt später; hier reicht ein M3-fokussierter Satz, der **jeden**
 * abgeleiteten Status (`open`/`full`/`finished`/`cancelled`) sichtbar macht.
 */
class DatabaseSeeder extends Seeder
{
    /** @var list<array{email:string,password:string,display_name:string,handle:string,experience_level:string,home_region:string}> */
    private array $pilots = [
        ['email' => 'lena@flightmeet.test',  'password' => 'passwort123', 'display_name' => 'Lena Krüger',  'handle' => 'lena_xc',   'experience_level' => 'advanced', 'home_region' => 'Allgäu'],
        ['email' => 'markus@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Markus Thaler', 'handle' => 'thaler_fly', 'experience_level' => 'expert',   'home_region' => 'Tegernsee'],
        ['email' => 'sophie@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Sophie Berg',   'handle' => 'sophie_b',  'experience_level' => 'beginner', 'home_region' => 'Rhön'],
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
     * M3-Treffen, gezielt über alle abgeleiteten Status verteilt (`creator`/`extra` = Index in $pilots).
     * @var list<array{title:string,spot:string,days:int,level:string,max:int|null,status:string,creator:int,extra:list<int>,description:string}>
     */
    private array $meetups = [
        ['title' => 'Frühflug Wasserkuppe',             'spot' => 'Wasserkuppe',              'days' => 7,   'level' => 'beginner', 'max' => 6,    'status' => 'open',      'creator' => 0, 'extra' => [1],    'description' => 'Ruhiger Morgenflug am Westhang – ideal für frische A-Scheine. Kleine Gruppe, viel Betreuung.'],
        ['title' => 'Abendthermik am Tegelberg',        'spot' => 'Tegelberg',               'days' => 9,   'level' => 'advanced', 'max' => 2,    'status' => 'open',      'creator' => 1, 'extra' => [2],    'description' => 'Gemeinsamer Abendflug bei schöner Restthermik. Treffpunkt am oberen Parkplatz.'],
        ['title' => 'XC-Streckenflug Brauneck',         'spot' => 'Brauneck',                'days' => 12,  'level' => 'expert',   'max' => 10,   'status' => 'open',      'creator' => 2, 'extra' => [0],    'description' => 'Ambitionierter Streckentag Richtung Karwendel. Funk und Live-Tracking empfohlen.'],
        ['title' => 'Soaring am Calmont',               'spot' => 'Mosel — Calmont / Bremm', 'days' => 14,  'level' => 'all',      'max' => null, 'status' => 'open',      'creator' => 0, 'extra' => [],     'description' => 'Dynamischer Hangflug überm Moseltal. Offen für alle Level – Soaring-Bedingungen vorausgesetzt.'],
        ['title' => 'Anfänger-Übungstag Beuren',        'spot' => 'Beuren (Schwäbische Alb)','days' => -8,  'level' => 'beginner', 'max' => 12,   'status' => 'open',      'creator' => 1, 'extra' => [2, 0], 'description' => 'Übungshang-Session mit Groundhandling und kurzen Hüpfern.'],
        ['title' => 'Gleitschirm-Treffen Hochfelln',    'spot' => 'Hochfelln',               'days' => 18,  'level' => 'advanced', 'max' => 10,   'status' => 'cancelled', 'creator' => 2, 'extra' => [0],    'description' => 'Leider abgesagt wegen unsicherer Wetterlage – wir verschieben auf nächste Woche.'],
        ['title' => 'Thermikfliegen Gerlitzen',         'spot' => 'Gerlitzen',               'days' => 20,  'level' => 'advanced', 'max' => 15,   'status' => 'open',      'creator' => 0, 'extra' => [1, 2], 'description' => 'Klassiker über dem Ossiacher See. Lange Flüge bei guter Thermik möglich.'],
        ['title' => 'Sonnenaufgangsflug Wallberg',      'spot' => 'Wallberg (Tegernsee)',    'days' => -13, 'level' => 'advanced', 'max' => 8,    'status' => 'open',      'creator' => 1, 'extra' => [],     'description' => 'Magischer Morgenflug überm Tegernsee. Früh aufstehen lohnt sich.'],
        ['title' => 'Eifel-Treff Nürburg',              'spot' => 'Nürburg / Hohe Acht (Eifel)', 'days' => 10, 'level' => 'all',  'max' => 20,   'status' => 'open',      'creator' => 0, 'extra' => [1],    'description' => 'Lockeres Treffen an der Hohen Acht mit anschließendem Grillen am Landeplatz.'],
        ['title' => 'Kössen Cross-Country',             'spot' => 'Kössen (Unterberghorn)',  'days' => 25,  'level' => 'expert',   'max' => 3,    'status' => 'open',      'creator' => 2, 'extra' => [0, 1], 'description' => 'Strecke Richtung Kaisergebirge. Erfahrung mit großen Talquerungen empfohlen.'],
    ];

    public function run(): void
    {
        $pilotIds = $this->seedPilots();
        $this->seedSpots();
        $this->seedMeetups($pilotIds);
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

            $this->db->table('profiles')->insert([
                'user_id'          => $user->id,
                'display_name'     => $pilot['display_name'],
                'handle'           => $pilot['handle'],
                'experience_level' => $pilot['experience_level'],
                'home_region'      => $pilot['home_region'],
            ]);

            $ids[] = (int) $user->id;
        }

        return $ids;
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
     * Legt die M3-Treffen + Teilnahmen an (idempotent). Kopiert Spot-Geo als Snapshot (Denormalisierung)
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
                'starts_at'        => gmdate('Y-m-d H:i:s', time() + $m['days'] * 86400),
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
}
