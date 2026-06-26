<?php

use App\Models\ProfileModel;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;
use CodeIgniter\Shield\Test\AuthenticationTesting;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;

/**
 * Feature-Tests der Profile-Domäne (M2 Slice 3, API.md §3): öffentliche, je Auth-Status reduzierte
 * Profilkarte; eigenes Profil lesen/ändern (BOLA self-scope, handle_taken); Verzeichnis. Der
 * Avatar-Upload (multipart, GD-Pipeline) ist gegen den laufenden Server per curl verifiziert.
 *
 * @internal
 */
final class ProfileTest extends CIUnitTestCase
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
            'handle'       => 'u' . substr(md5($email), 0, 12), // handle ist NOT NULL + UNIQUE
        ], $profile));

        return $user;
    }

    public function testShowReturnsReducedProfileForGuests(): void
    {
        $user = $this->createPilot('lena@flightmeet.test', ['home_region' => 'Allgäu', 'glider' => 'Rush 6']);

        $body = json_decode($this->get("api/v1/users/{$user->id}")->getJSON(), true)['data'];

        $this->assertArrayHasKey('bio_markdown', $body);
        $this->assertArrayNotHasKey('home_region', $body); // Erweitert-Feld nur für Eingeloggte
        $this->assertArrayNotHasKey('glider', $body);
        $this->assertArrayNotHasKey('email', $body); // nie öffentlich
    }

    public function testShowReturnsExtendedFieldsForAuthenticated(): void
    {
        $viewer = $this->createPilot('viewer@flightmeet.test');
        $target = $this->createPilot('lena@flightmeet.test', ['home_region' => 'Allgäu']);

        $body = json_decode($this->actingAs($viewer)->get("api/v1/users/{$target->id}")->getJSON(), true)['data'];

        $this->assertSame('Allgäu', $body['home_region']);
        $this->assertArrayNotHasKey('email', $body);
    }

    public function testShowReturns404ForUnknownUser(): void
    {
        $this->get('api/v1/users/9999')->assertStatus(404);
    }

    public function testMeReturnsOwnProfileWithEmail(): void
    {
        $user = $this->createPilot('lena@flightmeet.test', ['display_name' => 'Lena Krüger']);

        $body = json_decode($this->actingAs($user)->get('api/v1/me/profile')->getJSON(), true)['data'];

        $this->assertSame('lena@flightmeet.test', $body['email']);
        $this->assertSame('Lena Krüger', $body['display_name']);
    }

    public function testUpdateMeChangesOnlyOwnProfile(): void
    {
        $me    = $this->createPilot('me@flightmeet.test', ['display_name' => 'Ich']);
        $other = $this->createPilot('other@flightmeet.test', ['display_name' => 'Andere']);

        $this->actingAs($me)->withBodyFormat('json')
            ->patch('api/v1/me/profile', ['display_name' => 'Ich Neu', 'home_region' => 'Rhön'])
            ->assertStatus(200);

        $this->assertSame('Ich Neu', model(ProfileModel::class)->find($me->id)['display_name']);
        $this->assertSame('Andere', model(ProfileModel::class)->find($other->id)['display_name']); // unberührt (BOLA)
    }

    public function testUpdateMeRejectsDuplicateHandle(): void
    {
        $this->createPilot('a@flightmeet.test', ['handle' => 'taken_handle']);
        $me = $this->createPilot('me@flightmeet.test');

        $result = $this->actingAs($me)->withBodyFormat('json')
            ->patch('api/v1/me/profile', ['handle' => 'taken_handle']);

        $result->assertStatus(409);
        $this->assertSame('handle_taken', json_decode($result->getJSON(), true)['error']['code']);
    }

    public function testUpdateMeStoresBioRaw(): void
    {
        $me  = $this->createPilot('me@flightmeet.test');
        $xss = '<script>alert(1)</script>**fett**';

        $this->actingAs($me)->withBodyFormat('json')->patch('api/v1/me/profile', ['bio_markdown' => $xss]);

        // Roh gespeichert (ADR-011: Sanitisierung/sichere Darstellung passiert im Frontend via
        // react-markdown ohne rehype-raw) — nichts wird hier ausgeführt oder umgeschrieben.
        $this->assertSame($xss, model(ProfileModel::class)->find($me->id)['bio_markdown']);
    }

    public function testUsersDirectoryFiltersByExperience(): void
    {
        $me = $this->createPilot('me@flightmeet.test', ['experience_level' => 'beginner']);
        $this->createPilot('expert@flightmeet.test', ['display_name' => 'Profi', 'experience_level' => 'expert']);

        $body = json_decode($this->actingAs($me)->get('api/v1/users?experience_level=expert')->getJSON(), true);

        $this->assertSame(1, $body['meta']['total']);
        $this->assertSame('Profi', $body['data'][0]['display_name']);
    }
}
