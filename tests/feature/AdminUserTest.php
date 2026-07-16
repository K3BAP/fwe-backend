<?php

use App\Models\ProfileModel;
use CodeIgniter\Config\Services;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;
use CodeIgniter\Shield\Test\AuthenticationTesting;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;

/**
 * Benutzer-Verwaltung des Admin-Bereichs (ADR-019): Liste/Filter, Profil-Edit, Rollen, Sperre,
 * Soft-Delete + Wiederherstellen, Selbstschutz.
 *
 * @internal
 */
final class AdminUserTest extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;
    use AuthenticationTesting;

    protected $refresh   = true;
    protected $namespace = null;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Services::resetSingle('throttler'); // s. CLAUDE.md §9
        $this->admin = $this->createAdmin('admin@flightmeet.test');
        $this->actingAs($this->admin);
    }

    protected function tearDown(): void
    {
        if (auth()->loggedIn()) {
            auth()->logout();
        }
        parent::tearDown();
    }

    // ──────────────────────────── Liste ────────────────────────────

    public function testListExposesEmailRoleAndCounts(): void
    {
        $lena = $this->createPilot('lena@flightmeet.test', ['display_name' => 'Lena Krüger', 'handle' => 'lena_xc']);
        $this->createMeetup((int) $lena->id);

        $data = $this->json('get', 'api/v1/admin/users?sort=name_asc')['data'];
        $row  = $this->rowFor($data, (int) $lena->id);

        $this->assertSame('lena@flightmeet.test', $row['email']);
        $this->assertFalse($row['is_admin']);
        $this->assertTrue($row['active']);
        $this->assertSame(1, $row['meetups_count']);
        $this->assertSame(0, $row['groups_count']);
    }

    /** Der Vertrag verlangt echte JSON-Typen — MySQL liefert `active` als 0/1 und COUNT als String. */
    public function testListEmitsRealJsonTypes(): void
    {
        $this->createPilot('typen@flightmeet.test');

        $row = $this->json('get', 'api/v1/admin/users')['data'][0];

        $this->assertIsBool($row['active']);
        $this->assertIsBool($row['is_admin']);
        $this->assertIsInt($row['meetups_count']);
        $this->assertIsInt($row['id']);
    }

    /** Die Admin-Liste zeigt standardmäßig die Wahrheit — gelöschte Konten inklusive. */
    public function testListIncludesSoftDeletedUsersByDefault(): void
    {
        $ghost = $this->createPilot('ghost@flightmeet.test');
        model(UserModel::class)->delete($ghost->id);

        $data = $this->json('get', 'api/v1/admin/users')['data'];

        $this->assertNotNull($this->rowFor($data, (int) $ghost->id), 'Soft-gelöschte Konten müssen in der Admin-Liste auftauchen.');
        $this->assertNotNull($this->rowFor($data, (int) $ghost->id)['deleted_at']);
    }

    public function testStatusFilterDeletedReturnsOnlyDeleted(): void
    {
        $ghost = $this->createPilot('ghost@flightmeet.test');
        $this->createPilot('lebendig@flightmeet.test');
        model(UserModel::class)->delete($ghost->id);

        $body = $this->json('get', 'api/v1/admin/users?status=deleted');

        $this->assertCount(1, $body['data']);
        $this->assertSame((int) $ghost->id, $body['data'][0]['id']);
        $this->assertSame(1, $body['meta']['total']);
    }

    public function testStatusFilterAdminsUsesTheGroupJoin(): void
    {
        $this->createPilot('pilot@flightmeet.test');

        $body = $this->json('get', 'api/v1/admin/users?status=admins');

        $this->assertCount(1, $body['data']);
        $this->assertSame((int) $this->admin->id, $body['data'][0]['id']);
    }

    public function testStatusFilterSuspended(): void
    {
        $gesperrt = $this->createPilot('gesperrt@flightmeet.test');
        model(UserModel::class)->update($gesperrt->id, ['active' => false]);

        $body = $this->json('get', 'api/v1/admin/users?status=suspended');

        $this->assertCount(1, $body['data']);
        $this->assertSame((int) $gesperrt->id, $body['data'][0]['id']);
    }

    public function testSearchMatchesEmail(): void
    {
        $lena = $this->createPilot('lena@flightmeet.test', ['display_name' => 'Lena Krüger', 'handle' => 'lena_xc']);

        $body = $this->json('get', 'api/v1/admin/users?q=lena@flight');

        $this->assertCount(1, $body['data']);
        $this->assertSame((int) $lena->id, $body['data'][0]['id']);
    }

    /**
     * `meta.total` muss die *gefilterte* Menge zählen. Der klassische Fehler in diesem Listen-Muster:
     * Daten- und Count-Builder laufen auseinander und der Pager zeigt Phantom-Seiten.
     */
    public function testMetaTotalMatchesTheFilteredSet(): void
    {
        foreach (['a', 'b', 'c'] as $i) {
            $this->createPilot("pilot{$i}@flightmeet.test");
        }
        $ghost = $this->createPilot('ghost@flightmeet.test');
        model(UserModel::class)->delete($ghost->id);

        $body = $this->json('get', 'api/v1/admin/users?status=deleted&limit=1');

        $this->assertSame(1, $body['meta']['total'], 'meta.total darf nur die gefilterten Zeilen zählen.');
        $this->assertCount(1, $body['data']);
    }

    /** Die Admin-Rolle wird per JOIN aufgelöst, nicht per inGroup() je Zeile — sonst N+1. */
    public function testAdminFlagIsCorrectAcrossAMixedPage(): void
    {
        $zweiter = $this->createAdmin('admin2@flightmeet.test');
        $pilot   = $this->createPilot('pilot@flightmeet.test');

        $data = $this->json('get', 'api/v1/admin/users')['data'];

        $this->assertTrue($this->rowFor($data, (int) $this->admin->id)['is_admin']);
        $this->assertTrue($this->rowFor($data, (int) $zweiter->id)['is_admin']);
        $this->assertFalse($this->rowFor($data, (int) $pilot->id)['is_admin']);
    }

    // ──────────────────────────── Profil ────────────────────────────

    public function testUpdateChangesTheProfile(): void
    {
        $lena = $this->createPilot('lena@flightmeet.test');

        $body = $this->jsonRequest('patch', 'api/v1/admin/users/' . $lena->id, ['display_name' => 'Lena K.', 'home_region' => 'Allgäu']);

        $this->assertSame('Lena K.', $body['data']['display_name']);
        $this->assertSame('Allgäu', $body['data']['home_region']);
    }

    public function testUpdateRejectsATakenHandle(): void
    {
        $this->createPilot('markus@flightmeet.test', ['handle' => 'markus']);
        $lena = $this->createPilot('lena@flightmeet.test', ['handle' => 'lena_xc']);

        $result = $this->withBodyFormat('json')->patch('api/v1/admin/users/' . $lena->id, ['handle' => 'markus']);

        $result->assertStatus(409);
        $this->assertSame('handle_taken', json_decode($result->getJSON(), true)['error']['code']);
    }

    public function testUpdateOnUnknownUserIs404(): void
    {
        $this->withBodyFormat('json')->patch('api/v1/admin/users/999999', ['display_name' => 'Niemand'])->assertStatus(404);
    }

    // ──────────────────────────── Rollen ────────────────────────────

    public function testSetAdminPromotesAndDemotes(): void
    {
        $lena = $this->createPilot('lena@flightmeet.test');

        $body = $this->jsonRequest('post', 'api/v1/admin/users/' . $lena->id . '/admin', ['is_admin' => true]);
        $this->assertTrue($body['data']['is_admin']);
        $this->assertTrue(model(UserModel::class)->findById($lena->id)->inGroup('admin'));

        $body = $this->jsonRequest('post', 'api/v1/admin/users/' . $lena->id . '/admin', ['is_admin' => false]);
        $this->assertFalse($body['data']['is_admin']);
        $this->assertFalse(model(UserModel::class)->findById($lena->id)->inGroup('admin'));
    }

    // ──────────────────────────── Selbstschutz ────────────────────────────
    // Zusammen garantieren die drei die Invariante „es gibt immer ≥ 1 Admin".

    public function testAdminCannotDemoteThemselves(): void
    {
        $result = $this->withBodyFormat('json')->post('api/v1/admin/users/' . $this->admin->id . '/admin', ['is_admin' => false]);

        $result->assertStatus(409);
        $this->assertSame('admin_self_demote', json_decode($result->getJSON(), true)['error']['code']);
        $this->assertTrue(model(UserModel::class)->findById($this->admin->id)->inGroup('admin'));
    }

    public function testAdminCannotDeactivateThemselves(): void
    {
        $result = $this->withBodyFormat('json')->post('api/v1/admin/users/' . $this->admin->id . '/active', ['active' => false]);

        $result->assertStatus(409);
        $this->assertSame('admin_self_deactivate', json_decode($result->getJSON(), true)['error']['code']);
        $this->assertTrue((bool) model(UserModel::class)->findById($this->admin->id)->active);
    }

    public function testAdminCannotDeleteThemselves(): void
    {
        $result = $this->withBodyFormat('json')->delete('api/v1/admin/users/' . $this->admin->id);

        $result->assertStatus(409);
        $this->assertSame('admin_self_delete', json_decode($result->getJSON(), true)['error']['code']);
        $this->assertNotNull(model(UserModel::class)->findById($this->admin->id));
    }

    /** Sich selbst *befördern* ist ein harmloser No-Op und bleibt erlaubt. */
    public function testAdminMayPromoteThemselves(): void
    {
        $this->withBodyFormat('json')->post('api/v1/admin/users/' . $this->admin->id . '/admin', ['is_admin' => true])
            ->assertStatus(200);
    }

    public function testDetailMarksIsSelf(): void
    {
        $lena = $this->createPilot('lena@flightmeet.test');

        $this->assertTrue($this->json('get', 'api/v1/admin/users/' . $this->admin->id)['data']['is_self']);
        $this->assertFalse($this->json('get', 'api/v1/admin/users/' . $lena->id)['data']['is_self']);
    }

    // ──────────────────────────── Sperre ────────────────────────────

    public function testSetActiveFalseBlocksLogin(): void
    {
        $lena = $this->createPilot('lena@flightmeet.test');

        $body = $this->jsonRequest('post', 'api/v1/admin/users/' . $lena->id . '/active', ['active' => false]);
        $this->assertFalse($body['data']['active']);

        auth()->logout();
        $result = $this->withBodyFormat('json')->post('api/v1/auth/login', ['email' => 'lena@flightmeet.test', 'password' => 'passwort123']);
        $result->assertStatus(403);
        $this->assertSame('account_suspended', json_decode($result->getJSON(), true)['error']['code']);
    }

    public function testSetActiveTrueLetsThemBackIn(): void
    {
        $lena = $this->createPilot('lena@flightmeet.test');
        model(UserModel::class)->update($lena->id, ['active' => false]);

        $this->jsonRequest('post', 'api/v1/admin/users/' . $lena->id . '/active', ['active' => true]);

        auth()->logout();
        $this->withBodyFormat('json')->post('api/v1/auth/login', ['email' => 'lena@flightmeet.test', 'password' => 'passwort123'])
            ->assertStatus(200);
    }

    // ──────────────────────────── Soft-Delete / Restore ────────────────────────────

    public function testDestroySoftDeletesAndBlocksLogin(): void
    {
        $lena = $this->createPilot('lena@flightmeet.test');

        $body = $this->jsonRequest('delete', 'api/v1/admin/users/' . $lena->id);
        $this->assertNotNull($body['data']['deleted_at'], 'Der Soft-Delete muss im DTO sichtbar sein.');

        auth()->logout();
        $this->withBodyFormat('json')->post('api/v1/auth/login', ['email' => 'lena@flightmeet.test', 'password' => 'passwort123'])
            ->assertStatus(401);
    }

    /**
     * Der wichtigste Test der Datei. `deleted_at` steht **nicht** in Shields `$allowedFields`, ein
     * `$users->update(...)` würde das Feld also stillschweigend verwerfen — Restore täte dann einfach
     * nichts, ohne Fehler. Nur der erneut mögliche Login beweist, dass es wirklich wirkt.
     */
    public function testRestoreUndeletesAndLoginWorksAgain(): void
    {
        $lena = $this->createPilot('lena@flightmeet.test');
        $this->jsonRequest('delete', 'api/v1/admin/users/' . $lena->id);

        $body = $this->jsonRequest('post', 'api/v1/admin/users/' . $lena->id . '/restore');
        $this->assertNull($body['data']['deleted_at']);

        auth()->logout();
        $this->withBodyFormat('json')->post('api/v1/auth/login', ['email' => 'lena@flightmeet.test', 'password' => 'passwort123'])
            ->assertStatus(200);
    }

    /** Soft-Delete ist ein UPDATE — die FK-Kaskade auf `auth_groups_users` feuert also nicht. */
    public function testRestoredAdminKeepsTheirRole(): void
    {
        $zweiter = $this->createAdmin('admin2@flightmeet.test');

        $this->jsonRequest('delete', 'api/v1/admin/users/' . $zweiter->id);
        $body = $this->jsonRequest('post', 'api/v1/admin/users/' . $zweiter->id . '/restore');

        $this->assertTrue($body['data']['is_admin'], 'Ein wiederhergestellter Admin muss seine Rolle behalten.');
    }

    /** Soft-Delete löscht keine Inhalte — das Treffen des Nutzers überlebt (und wird im UI so benannt). */
    public function testSoftDeleteKeepsTheirContent(): void
    {
        $lena     = $this->createPilot('lena@flightmeet.test');
        $meetupId = $this->createMeetup((int) $lena->id);

        $this->jsonRequest('delete', 'api/v1/admin/users/' . $lena->id);

        $this->assertNotNull(db_connect()->table('meetups')->where('id', $meetupId)->get()->getRowArray());
        $this->assertNotNull(db_connect()->table('profiles')->where('user_id', $lena->id)->get()->getRowArray());
    }

    // ──────────────────────────── Helfer ────────────────────────────

    /** @return array<string, mixed> */
    private function json(string $method, string $path): array
    {
        $result = $this->call($method, $path);
        $result->assertStatus(200);

        return json_decode($result->getJSON(), true);
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    private function jsonRequest(string $method, string $path, array $body = []): array
    {
        $result = $this->withBodyFormat('json')->{$method}($path, $body);
        $result->assertStatus(200);

        return json_decode($result->getJSON(), true);
    }

    /**
     * @param list<array<string, mixed>> $rows
     * @return array<string, mixed>|null
     */
    private function rowFor(array $rows, int $userId): ?array
    {
        foreach ($rows as $row) {
            if ($row['id'] === $userId) {
                return $row;
            }
        }

        return null;
    }

    /** @param array<string, mixed> $profile */
    private function createPilot(string $email, array $profile = []): User
    {
        /** @var UserModel $users */
        $users = model(UserModel::class);
        $user  = new User(['email' => $email, 'password' => 'passwort123', 'active' => true]);
        $users->save($user);
        $user = $users->findById($users->getInsertID());
        $users->addToDefaultGroup($user);
        model(ProfileModel::class)->insert(array_merge([
            'user_id'      => $user->id,
            'display_name' => 'Test Pilot',
            'handle'       => 'u' . substr(md5($email), 0, 12),
        ], $profile));

        return $user;
    }

    private function createAdmin(string $email): User
    {
        $user = $this->createPilot($email, ['display_name' => 'FlightMeet Admin']);
        $user->addGroup('admin');

        return $user;
    }

    private function createMeetup(int $creatorId): int
    {
        return (int) db_connect()->table('meetups')->insert([
            'creator_user_id'  => $creatorId,
            'title'            => 'Testtreffen',
            'spot_name'        => 'Wallberg',
            'region'           => 'Bayern',
            'lat'              => 47.704200,
            'lng'              => 11.758300,
            'starts_at'        => gmdate('Y-m-d H:i:s', strtotime('+7 days')),
            'experience_level' => 'all',
            'status'           => 'open',
        ], true) ? (int) db_connect()->insertID() : 0;
    }
}
