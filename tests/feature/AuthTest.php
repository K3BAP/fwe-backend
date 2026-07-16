<?php

use App\Models\ProfileModel;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;
use CodeIgniter\Shield\Test\AuthenticationTesting;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;
use Config\Services;

/**
 * Feature-Tests der Auth-Domäne (M2 Slice 2, API.md §2): register/login/logout/me inkl. Fehlerpfade
 * (Validierung, Doppel-E-Mail, falsches Passwort, fehlende Session, Rate-Limit). CSRF ist in der
 * Testumgebung deaktiviert (ApiCsrfFilter), getestet wird die Domänenlogik.
 *
 * @internal
 */
final class AuthTest extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;
    use AuthenticationTesting;

    protected $refresh   = true;
    protected $namespace = null;

    protected function tearDown(): void
    {
        // Die Session überlebt sonst den DB-Refresh und zeigt auf einen gelöschten User → isolieren.
        if (auth()->loggedIn()) {
            auth()->logout();
        }
        parent::tearDown();
    }

    private function createPilot(string $email, string $password = 'passwort123', string $name = 'Test Pilot', ?string $handle = null): User
    {
        /** @var UserModel $users */
        $users = model(UserModel::class);
        $user  = new User(['email' => $email, 'password' => $password, 'active' => true]);
        $users->save($user);
        $user = $users->findById($users->getInsertID());
        $users->addToDefaultGroup($user);
        model(ProfileModel::class)->insert([
            'user_id'      => $user->id,
            'display_name' => $name,
            'handle'       => $handle ?? 'u' . substr(md5($email), 0, 12), // handle ist NOT NULL + UNIQUE
        ]);

        return $user;
    }

    public function testRegisterCreatesUserProfileAndSession(): void
    {
        $result = $this->withBodyFormat('json')->post('api/v1/auth/register', [
            'email'        => 'neu@flightmeet.test',
            'password'     => 'passwort123',
            'display_name' => 'Neue Pilotin',
            'handle'       => 'neue_pilotin',
        ]);

        $result->assertStatus(201);
        $body = json_decode($result->getJSON(), true);
        $this->assertSame('Neue Pilotin', $body['data']['user']['display_name']);
        $this->assertSame('neu@flightmeet.test', $body['data']['profile']['email']);

        $this->seeInDatabase('auth_identities', ['secret' => 'neu@flightmeet.test', 'type' => 'email_password']);
        $this->seeInDatabase('profiles', ['display_name' => 'Neue Pilotin', 'handle' => 'neue_pilotin']);
    }

    public function testRegisterRejectsDuplicateEmail(): void
    {
        $this->createPilot('lena@flightmeet.test');

        $result = $this->withBodyFormat('json')->post('api/v1/auth/register', [
            'email'        => 'lena@flightmeet.test',
            'password'     => 'passwort123',
            'display_name' => 'Klon',
            'handle'       => 'klon_handle',
        ]);

        $result->assertStatus(409);
        $this->assertSame('email_taken', json_decode($result->getJSON(), true)['error']['code']);
    }

    public function testRegisterValidatesInput(): void
    {
        $result = $this->withBodyFormat('json')->post('api/v1/auth/register', [
            'email'        => 'keine-email',
            'password'     => 'kurz',
            'display_name' => 'A',
        ]);

        $result->assertStatus(422);
        $body = json_decode($result->getJSON(), true);
        $this->assertSame('validation_error', $body['error']['code']);
        $this->assertArrayHasKey('email', $body['error']['fields']);
        $this->assertArrayHasKey('password', $body['error']['fields']);
    }

    public function testRegisterRequiresHandle(): void
    {
        $result = $this->withBodyFormat('json')->post('api/v1/auth/register', [
            'email'        => 'neu@flightmeet.test',
            'password'     => 'passwort123',
            'display_name' => 'Ohne Handle',
        ]);

        $result->assertStatus(422);
        $this->assertArrayHasKey('handle', json_decode($result->getJSON(), true)['error']['fields']);
    }

    public function testRegisterRejectsDuplicateHandle(): void
    {
        $this->createPilot('a@flightmeet.test', 'passwort123', 'A', 'taken_handle');

        $result = $this->withBodyFormat('json')->post('api/v1/auth/register', [
            'email'        => 'neu@flightmeet.test',
            'password'     => 'passwort123',
            'display_name' => 'Neu',
            'handle'       => 'taken_handle',
        ]);

        $result->assertStatus(409);
        $this->assertSame('handle_taken', json_decode($result->getJSON(), true)['error']['code']);
    }

    public function testLoginSucceedsWithValidCredentials(): void
    {
        $this->createPilot('lena@flightmeet.test', 'passwort123', 'Lena Krüger', 'lena_xc');

        $result = $this->withBodyFormat('json')->post('api/v1/auth/login', [
            'email'    => 'lena@flightmeet.test',
            'password' => 'passwort123',
        ]);

        $result->assertStatus(200);
        $this->assertSame('lena_xc', json_decode($result->getJSON(), true)['data']['user']['handle']);
    }

    public function testLoginRejectsWrongPassword(): void
    {
        $this->createPilot('lena@flightmeet.test', 'passwort123');

        $result = $this->withBodyFormat('json')->post('api/v1/auth/login', [
            'email'    => 'lena@flightmeet.test',
            'password' => 'falschesPasswort',
        ]);

        $result->assertStatus(401);
        $this->assertSame('invalid_credentials', json_decode($result->getJSON(), true)['error']['code']);
    }

    public function testMeRequiresSession(): void
    {
        $this->get('api/v1/auth/me')->assertStatus(401);
    }

    public function testMeReturnsSessionPayload(): void
    {
        $user = $this->createPilot('lena@flightmeet.test', 'passwort123', 'Lena Krüger', 'lena_xc');

        $result = $this->actingAs($user)->get('api/v1/auth/me');

        $result->assertStatus(200);
        $body = json_decode($result->getJSON(), true);
        $this->assertSame('Lena Krüger', $body['data']['user']['display_name']);
        $this->assertSame(0, $body['data']['unread']['messages']);
    }

    public function testMeExposesIsAdminFlag(): void
    {
        $pilot = $this->createPilot('pilot@flightmeet.test');
        $admin = $this->createPilot('admin@flightmeet.test');
        $admin->addGroup('admin');

        $pilotBody = json_decode($this->actingAs($pilot)->get('api/v1/auth/me')->getJSON(), true);
        $this->assertFalse($pilotBody['data']['is_admin']);

        auth()->logout();
        $adminBody = json_decode($this->actingAs($admin)->get('api/v1/auth/me')->getJSON(), true);
        $this->assertTrue($adminBody['data']['is_admin']);
    }

    public function testLogoutEndsSession(): void
    {
        $user = $this->createPilot('lena@flightmeet.test');

        // Im CLI-/Testlauf (kein PHP-Dev-Server) liefert „No Content" das spec-konforme 204.
        $this->actingAs($user)->post('api/v1/auth/logout')->assertStatus(204);
        $this->assertFalse(auth()->loggedIn());
    }

    public function testLoginIsRateLimited(): void
    {
        // Der Throttler-Singleton hält den MockCache seiner ersten Erzeugung fest — nur ein
        // Reset (nicht `cache()->clean()`, das trifft den falschen Cache) startet den Bucket
        // dieses Tests garantiert bei voller Kapazität (siehe MeetupBriefingTest::setUp).
        Services::resetSingle('throttler');
        $this->createPilot('lena@flightmeet.test', 'passwort123');

        for ($i = 0; $i < 5; $i++) {
            $this->withBodyFormat('json')->post('api/v1/auth/login', ['email' => 'lena@flightmeet.test', 'password' => 'falsch']);
        }
        $result = $this->withBodyFormat('json')->post('api/v1/auth/login', ['email' => 'lena@flightmeet.test', 'password' => 'falsch']);

        $result->assertStatus(429);
        $this->assertSame('rate_limited', json_decode($result->getJSON(), true)['error']['code']);
    }
}
