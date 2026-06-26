<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;

/**
 * Mini-Seed für die lokale Entwicklung: ein paar Pilot-Konten (Shield-Identität + `profiles`-Zeile),
 * damit man sich in Slice 2 sofort einloggen kann. Idempotent (überspringt vorhandene E-Mails).
 * Der vollständige Faker-Seed (ADR-002/10.3) kommt erst in M6.
 */
class DatabaseSeeder extends Seeder
{
    /** @var list<array<string, string>> */
    private array $pilots = [
        ['email' => 'lena@flightmeet.test',  'password' => 'passwort123', 'display_name' => 'Lena Krüger',  'handle' => 'lena_xc',   'experience_level' => 'advanced', 'home_region' => 'Allgäu'],
        ['email' => 'markus@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Markus Thaler', 'handle' => 'thaler_fly', 'experience_level' => 'expert',   'home_region' => 'Tegelberg'],
        ['email' => 'sophie@flightmeet.test', 'password' => 'passwort123', 'display_name' => 'Sophie Berg',   'handle' => 'sophie_b',  'experience_level' => 'beginner', 'home_region' => 'Rhön'],
    ];

    public function run(): void
    {
        /** @var UserModel $users */
        $users = model(UserModel::class);

        foreach ($this->pilots as $pilot) {
            if ($users->findByCredentials(['email' => $pilot['email']]) !== null) {
                continue; // bereits angelegt
            }

            // `active` setzen: ohne eine echte users-Spalte wäre der Insert leer (E-Mail/Passwort
            // wandern in auth_identities). Konten sind sofort aktiv (ADR-008: keine E-Mail-Verifikation).
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
        }
    }
}
