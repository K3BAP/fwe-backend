<?php

use App\Models\ProfileModel;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;
use CodeIgniter\Shield\Test\AuthenticationTesting;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;

/**
 * Startplatz-Pflege des Admin-Bereichs (ADR-019 / ADR-012/A4).
 *
 * @internal
 */
final class AdminSpotTest extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;
    use AuthenticationTesting;

    protected $refresh   = true;
    protected $namespace = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs($this->createAdmin('admin@flightmeet.test'));
    }

    protected function tearDown(): void
    {
        if (auth()->loggedIn()) {
            auth()->logout();
        }
        parent::tearDown();
    }

    public function testCreateReturns201AndTheRow(): void
    {
        $result = $this->withBodyFormat('json')->post('api/v1/admin/spots', [
            'name' => 'Wallberg', 'region' => 'Bayern', 'lat' => 47.7042, 'lng' => 11.7583,
            'type' => 'launch', 'description' => 'Klassiker am Tegernsee.',
        ]);

        $result->assertStatus(201);
        $data = json_decode($result->getJSON(), true)['data'];
        $this->assertSame('Wallberg', $data['name']);
        $this->assertSame('DE', $data['country'], 'country defaultet auf DE.');
        $this->assertSame(0, $data['meetups_count']);
    }

    /** `lat`/`lng` sind DECIMAL — MySQL gibt sie als String zurück, Zods z.number() lehnt das ab. */
    public function testCoordinatesAreJsonNumbers(): void
    {
        $id = $this->createSpot();

        $data = json_decode($this->call('get', 'api/v1/admin/spots')->getJSON(), true)['data'][0];

        $this->assertIsFloat($data['lat']);
        $this->assertIsFloat($data['lng']);
        $this->assertIsInt($data['meetups_count']);
    }

    public function testCreateValidatesCoordinatesAndType(): void
    {
        $result = $this->withBodyFormat('json')->post('api/v1/admin/spots', [
            'name' => 'Kaputt', 'region' => 'Bayern', 'lat' => 91, 'lng' => 11.75, 'type' => 'quatsch',
        ]);

        $result->assertStatus(422);
        $body = json_decode($result->getJSON(), true);
        $this->assertSame('validation_error', $body['error']['code']);
        $this->assertArrayHasKey('lat', $body['error']['fields']);
        $this->assertArrayHasKey('type', $body['error']['fields']);
    }

    public function testUpdateChangesFieldsAndUppercasesCountry(): void
    {
        $id = $this->createSpot();

        $result = $this->withBodyFormat('json')->patch('api/v1/admin/spots/' . $id, ['region' => 'Tirol', 'country' => 'at']);

        $result->assertStatus(200);
        $data = json_decode($result->getJSON(), true)['data'];
        $this->assertSame('Tirol', $data['region']);
        $this->assertSame('AT', $data['country']);
        $this->assertSame('Wallberg', $data['name'], 'PATCH darf nicht mitgeschickte Felder nicht leeren.');
    }

    public function testMeetupsCountReflectsLinkedMeetups(): void
    {
        $id = $this->createSpot();
        $this->createMeetup($id);

        $data = json_decode($this->call('get', 'api/v1/admin/spots')->getJSON(), true)['data'][0];

        $this->assertSame(1, $data['meetups_count']);
    }

    /**
     * Rechtfertigt, dass Löschen überhaupt erlaubt ist: der FK ist `ON DELETE SET NULL`, und Ort +
     * Koordinaten liegen als Schnappschuss auf der Treffen-Zeile. Das Treffen behält damit Ortsangabe,
     * Karte und Wetter (ADR-017 liest lat/lng vom Treffen) — nur die Verknüpfung entfällt.
     */
    public function testDeleteKeepsTheMeetupsLocationSnapshot(): void
    {
        $spotId   = $this->createSpot();
        $meetupId = $this->createMeetup($spotId);

        $this->call('delete', 'api/v1/admin/spots/' . $spotId)->assertStatus(204);

        $meetup = db_connect()->table('meetups')->where('id', $meetupId)->get()->getRowArray();
        $this->assertNull($meetup['spot_id'], 'Die Verknüpfung entfällt …');
        $this->assertSame('Wallberg', $meetup['spot_name'], '… der Ortsname bleibt.');
        $this->assertSame('Bayern', $meetup['region']);
        $this->assertNotNull($meetup['lat'], 'Ohne lat/lng verlöre das Treffen Karte und Wetter.');
        $this->assertNotNull($meetup['lng']);
    }

    public function testUnknownSpotIs404(): void
    {
        $this->call('delete', 'api/v1/admin/spots/999999')->assertStatus(404);
        $this->withBodyFormat('json')->patch('api/v1/admin/spots/999999', ['region' => 'Tirol'])->assertStatus(404);
    }

    // ──────────────────────────── Helfer ────────────────────────────

    private function createSpot(): int
    {
        return (int) db_connect()->table('spots')->insert([
            'name' => 'Wallberg', 'region' => 'Bayern', 'country' => 'DE',
            'lat' => 47.704200, 'lng' => 11.758300, 'type' => 'launch',
        ], true) ? (int) db_connect()->insertID() : 0;
    }

    private function createMeetup(int $spotId): int
    {
        db_connect()->table('meetups')->insert([
            'creator_user_id'  => (int) auth()->id(),
            'spot_id'          => $spotId,
            'title'            => 'Testtreffen',
            'spot_name'        => 'Wallberg',
            'region'           => 'Bayern',
            'lat'              => 47.704200,
            'lng'              => 11.758300,
            'starts_at'        => gmdate('Y-m-d H:i:s', strtotime('+7 days')),
            'experience_level' => 'all',
            'status'           => 'open',
        ]);

        return (int) db_connect()->insertID();
    }

    private function createAdmin(string $email): User
    {
        /** @var UserModel $users */
        $users = model(UserModel::class);
        $user  = new User(['email' => $email, 'password' => 'passwort123', 'active' => true]);
        $users->save($user);
        $user = $users->findById($users->getInsertID());
        $users->addToDefaultGroup($user);
        model(ProfileModel::class)->insert([
            'user_id' => $user->id, 'display_name' => 'FlightMeet Admin', 'handle' => 'admin',
        ]);
        $user->addGroup('admin');

        return $user;
    }
}
