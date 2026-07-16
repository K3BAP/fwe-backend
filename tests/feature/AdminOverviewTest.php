<?php

use App\Models\ProfileModel;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;
use CodeIgniter\Shield\Test\AuthenticationTesting;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;

/**
 * Kennzahlen der Admin-Übersicht (ADR-019) gegen ein bekanntes Fixture.
 *
 * @internal
 */
final class AdminOverviewTest extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;
    use AuthenticationTesting;

    protected $refresh   = true;
    protected $namespace = null;

    protected function tearDown(): void
    {
        if (auth()->loggedIn()) {
            auth()->logout();
        }
        parent::tearDown();
    }

    public function testOverviewCountsTheFixtureExactly(): void
    {
        // Fixture: 1 Admin + 1 aktiver Pilot + 1 gesperrter + 1 gelöschter = 4 Nutzer.
        $admin    = $this->createAdmin('admin@flightmeet.test');
        $this->createPilot('aktiv@flightmeet.test');
        $gesperrt = $this->createPilot('gesperrt@flightmeet.test');
        $geloescht = $this->createPilot('geloescht@flightmeet.test');
        model(UserModel::class)->update($gesperrt->id, ['active' => false]);
        model(UserModel::class)->delete($geloescht->id);

        $this->createMeetup((int) $admin->id, '+7 days', 'open');      // anstehend
        $this->createMeetup((int) $admin->id, '-7 days', 'open');      // vorbei → nicht anstehend
        $this->createMeetup((int) $admin->id, '+7 days', 'cancelled'); // abgesagt

        $aktiveGruppe = $this->createGroup((int) $admin->id, 'private');
        $tote         = $this->createGroup((int) $admin->id, 'public');
        db_connect()->table('groups')->where('id', $tote)->update(['deleted_at' => gmdate('Y-m-d H:i:s')]);

        $this->createSpot('Wallberg');
        $this->createSpot('Tegelberg');

        $this->actingAs($admin);
        $data = json_decode($this->call('get', 'api/v1/admin/stats')->getJSON(), true)['data'];

        $this->assertSame(['total' => 4, 'active' => 2, 'suspended' => 1, 'deleted' => 1, 'admins' => 1, 'new_7d' => 4], $data['users']);
        $this->assertSame(['total' => 3, 'upcoming' => 1, 'cancelled' => 1], $data['meetups']);
        $this->assertSame(['total' => 2, 'active' => 1, 'deleted' => 1, 'private' => 1], $data['groups']);
        $this->assertSame(['total' => 2], $data['spots']);
    }

    /** MySQL liefert `SUM()` als String — ohne die (int)-Casts im Service bricht der Zod-Vertrag. */
    public function testCountersAreJsonNumbers(): void
    {
        $this->actingAs($this->createAdmin('admin@flightmeet.test'));

        $data = json_decode($this->call('get', 'api/v1/admin/stats')->getJSON(), true)['data'];

        foreach ($data as $bereich => $werte) {
            foreach ($werte as $key => $value) {
                $this->assertIsInt($value, "{$bereich}.{$key} muss eine JSON-Zahl sein, kein String.");
            }
        }
    }

    // ──────────────────────────── Helfer ────────────────────────────

    private function createMeetup(int $creatorId, string $when, string $status): void
    {
        db_connect()->table('meetups')->insert([
            'creator_user_id'  => $creatorId,
            'title'            => 'Testtreffen',
            'spot_name'        => 'Wallberg',
            'region'           => 'Bayern',
            'lat'              => 47.704200,
            'lng'              => 11.758300,
            'starts_at'        => gmdate('Y-m-d H:i:s', strtotime($when)),
            'experience_level' => 'all',
            'status'           => $status,
        ]);
    }

    private function createGroup(int $ownerId, string $visibility): int
    {
        db_connect()->table('groups')->insert([
            'slug'          => 'g-' . bin2hex(random_bytes(6)),
            'name'          => 'Testgruppe',
            'visibility'    => $visibility,
            'join_policy'   => 'open',
            'owner_user_id' => $ownerId,
            'members_count' => 1,
        ]);

        return (int) db_connect()->insertID();
    }

    private function createSpot(string $name): void
    {
        db_connect()->table('spots')->insert([
            'name' => $name, 'region' => 'Bayern', 'country' => 'DE',
            'lat' => 47.704200, 'lng' => 11.758300, 'type' => 'launch',
        ]);
    }

    private function createPilot(string $email): User
    {
        /** @var UserModel $users */
        $users = model(UserModel::class);
        $user  = new User(['email' => $email, 'password' => 'passwort123', 'active' => true]);
        $users->save($user);
        $user = $users->findById($users->getInsertID());
        $users->addToDefaultGroup($user);
        model(ProfileModel::class)->insert([
            'user_id'      => $user->id,
            'display_name' => 'Test Pilot',
            'handle'       => 'u' . substr(md5($email), 0, 12),
        ]);

        return $user;
    }

    private function createAdmin(string $email): User
    {
        $user = $this->createPilot($email);
        $user->addGroup('admin');

        return $user;
    }
}
