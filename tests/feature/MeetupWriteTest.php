<?php

use App\Models\ConversationModel;
use App\Models\MeetupModel;
use App\Models\MeetupParticipantModel;
use App\Models\ProfileModel;
use App\Models\SpotModel;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;
use CodeIgniter\Shield\Test\AuthenticationTesting;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;

/**
 * Feature-Tests der schreibenden Flugtreffen-Endpunkte (M3 Slice 3, API.md §5.3–§5.5): Erstellen
 * (Auth, Auto-Join, Geo-Snapshot, Validierung), Bearbeiten/Absagen (BOLA, capacity_below_current),
 * Hard-Delete (BOLA, FK-Cascade).
 *
 * @internal
 */
final class MeetupWriteTest extends CIUnitTestCase
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
            'handle'       => 'u' . substr(md5($email), 0, 12),
        ], $profile));

        return $user;
    }

    /** @param array<string, mixed> $o */
    private function createSpot(array $o = []): int
    {
        return (int) model(SpotModel::class)->insert(array_merge([
            'name'    => 'Testspot ' . bin2hex(random_bytes(3)),
            'region'  => 'Testregion',
            'country' => 'DE',
            'lat'     => 47.5,
            'lng'     => 11.0,
            'type'    => 'launch',
        ], $o), true);
    }

    /** @param array<string, mixed> $o */
    private function createMeetup(int $creatorId, array $o = []): int
    {
        $spotId = $o['spot_id'] ?? $this->createSpot();
        $id     = (int) model(MeetupModel::class)->insert(array_merge([
            'creator_user_id'  => $creatorId,
            'spot_id'          => $spotId,
            'spot_name'        => 'Testspot',
            'region'           => 'Testregion',
            'lat'              => 47.5,
            'lng'              => 11.0,
            'title'            => 'Testtreffen',
            'starts_at'        => gmdate('Y-m-d H:i:s', time() + 7 * 86400),
            'experience_level' => 'all',
            'max_participants' => 10,
            'status'           => 'open',
        ], $o), true);
        model(MeetupParticipantModel::class)->insert(['meetup_id' => $id, 'user_id' => $creatorId]);

        return $id;
    }

    /** @return array<string, mixed> */
    private function validPayload(int $spotId, array $o = []): array
    {
        return array_merge([
            'title'            => 'Gemeinsamer Flugtag',
            'spot_id'          => $spotId,
            'starts_at'        => gmdate('Y-m-d\TH:i:s\Z', time() + 7 * 86400),
            'experience_level' => 'advanced',
            'max_participants' => 8,
            'description'      => 'Treffpunkt am Parkplatz.',
        ], $o);
    }

    public function testCreateRequiresAuth(): void
    {
        $spot = $this->createSpot();
        $this->withBodyFormat('json')->post('api/v1/meetups', $this->validPayload($spot))->assertStatus(401);
    }

    public function testCreateAutoJoinsCreator(): void
    {
        $user = $this->createPilot('a@flightmeet.test', ['display_name' => 'Lena']);
        $spot = $this->createSpot(['region' => 'Allgäu', 'lat' => 47.585, 'lng' => 10.764]);

        $result = $this->actingAs($user)->withBodyFormat('json')->post('api/v1/meetups', $this->validPayload($spot));

        $result->assertStatus(201);
        $body = json_decode($result->getJSON(), true)['data'];
        $this->assertSame(1, $body['participant_count']);
        $this->assertSame((int) $user->id, $body['creator_user_id']);
        $this->assertSame((int) $user->id, $body['participants'][0]['id']);
        $this->assertTrue($body['is_participant']);
        $this->assertTrue($body['can_edit']);
        $this->assertSame('Allgäu', $body['region']); // Geo aus Spot abgeleitet

        // Der Treffen-Chat entsteht in derselben Transaktion (ADR-005) — genau eine Konversation.
        $this->assertIsInt($body['conversation_id']);
        $conv = model(ConversationModel::class)->find($body['conversation_id']);
        $this->assertSame('meetup', $conv['type']);
        $this->assertSame($body['id'], (int) $conv['context_id']);
    }

    public function testCreateIgnoresClientGeoAndUsesSpot(): void
    {
        $user = $this->createPilot('a@flightmeet.test');
        $spot = $this->createSpot(['region' => 'Rhön', 'lat' => 50.498, 'lng' => 9.948]);

        // manipulierte Geo-Felder im Body — der Server muss sie ignorieren (Vertrauensgrenze).
        $payload = $this->validPayload($spot, ['region' => 'HACKED', 'lat' => 0.0, 'lng' => 0.0]);
        $body    = json_decode($this->actingAs($user)->withBodyFormat('json')->post('api/v1/meetups', $payload)->getJSON(), true)['data'];

        $this->assertSame('Rhön', $body['region']);
        $this->assertSame(50.498, $body['lat']);
    }

    public function testCreateRejectsPastDate(): void
    {
        $user = $this->createPilot('a@flightmeet.test');
        $spot = $this->createSpot();

        $result = $this->actingAs($user)->withBodyFormat('json')
            ->post('api/v1/meetups', $this->validPayload($spot, ['starts_at' => gmdate('Y-m-d\TH:i:s\Z', time() - 86400)]));

        $result->assertStatus(422);
        $body = json_decode($result->getJSON(), true);
        $this->assertSame('validation_error', $body['error']['code']);
        $this->assertArrayHasKey('starts_at', $body['error']['fields']);
    }

    public function testCreateRejectsUnknownSpot(): void
    {
        $user = $this->createPilot('a@flightmeet.test');

        $result = $this->actingAs($user)->withBodyFormat('json')->post('api/v1/meetups', $this->validPayload(9999));

        $result->assertStatus(422);
        $this->assertArrayHasKey('spot_id', json_decode($result->getJSON(), true)['error']['fields']);
    }

    public function testCreateRejectsShortTitle(): void
    {
        $user = $this->createPilot('a@flightmeet.test');
        $spot = $this->createSpot();

        $this->actingAs($user)->withBodyFormat('json')
            ->post('api/v1/meetups', $this->validPayload($spot, ['title' => 'ab']))
            ->assertStatus(422);
    }

    public function testCreateAllowsUnlimitedCapacity(): void
    {
        $user = $this->createPilot('a@flightmeet.test');
        $spot = $this->createSpot();

        $body = json_decode($this->actingAs($user)->withBodyFormat('json')
            ->post('api/v1/meetups', $this->validPayload($spot, ['max_participants' => null]))->getJSON(), true)['data'];

        $this->assertNull($body['max_participants']);
        $this->assertNull($body['free_spots']);
        $this->assertSame('open', $body['derived_status']);
    }

    public function testUpdateByCreator(): void
    {
        $user = $this->createPilot('a@flightmeet.test');
        $id   = $this->createMeetup($user->id, ['title' => 'Alt']);

        $body = json_decode($this->actingAs($user)->withBodyFormat('json')
            ->patch("api/v1/meetups/{$id}", ['title' => 'Neuer Titel'])->getJSON(), true)['data'];

        $this->assertSame('Neuer Titel', $body['title']);
    }

    public function testUpdateForbiddenForNonCreator(): void
    {
        $owner   = $this->createPilot('owner@flightmeet.test');
        $stranger = $this->createPilot('stranger@flightmeet.test');
        $id      = $this->createMeetup($owner->id);

        $result = $this->actingAs($stranger)->withBodyFormat('json')->patch("api/v1/meetups/{$id}", ['title' => 'Hijack']);

        $result->assertStatus(403);
        $this->assertSame('forbidden', json_decode($result->getJSON(), true)['error']['code']);
        $this->assertSame('Testtreffen', model(MeetupModel::class)->find($id)['title']); // unberührt
    }

    public function testUpdateAllowedForAdmin(): void
    {
        $owner = $this->createPilot('owner@flightmeet.test');
        $admin = $this->createPilot('admin@flightmeet.test');
        $admin->addGroup('admin');
        $id = $this->createMeetup($owner->id);

        $this->actingAs($admin)->withBodyFormat('json')
            ->patch("api/v1/meetups/{$id}", ['title' => 'Admin-Edit'])
            ->assertStatus(200);

        $this->assertSame('Admin-Edit', model(MeetupModel::class)->find($id)['title']);
    }

    public function testCancelViaStatus(): void
    {
        $user = $this->createPilot('a@flightmeet.test');
        $id   = $this->createMeetup($user->id);

        $body = json_decode($this->actingAs($user)->withBodyFormat('json')
            ->patch("api/v1/meetups/{$id}", ['status' => 'cancelled'])->getJSON(), true)['data'];

        $this->assertSame('cancelled', $body['derived_status']);
        $this->assertSame('cancelled', model(MeetupModel::class)->find($id)['status']);
    }

    public function testUpdateRejectsCapacityBelowCurrent(): void
    {
        $owner = $this->createPilot('owner@flightmeet.test');
        $other = $this->createPilot('other@flightmeet.test');
        $id    = $this->createMeetup($owner->id, ['max_participants' => 10]);
        model(MeetupParticipantModel::class)->insert(['meetup_id' => $id, 'user_id' => $other->id]); // jetzt 2

        $result = $this->actingAs($owner)->withBodyFormat('json')->patch("api/v1/meetups/{$id}", ['max_participants' => 1]);

        $result->assertStatus(409);
        $this->assertSame('capacity_below_current', json_decode($result->getJSON(), true)['error']['code']);
    }

    public function testUpdateSpotReDerivesGeo(): void
    {
        $user    = $this->createPilot('a@flightmeet.test');
        $id      = $this->createMeetup($user->id);
        $newSpot = $this->createSpot(['name' => 'Wallberg', 'region' => 'Tegernsee', 'lat' => 47.66, 'lng' => 11.77]);

        $body = json_decode($this->actingAs($user)->withBodyFormat('json')
            ->patch("api/v1/meetups/{$id}", ['spot_id' => $newSpot])->getJSON(), true)['data'];

        $this->assertSame($newSpot, $body['spot_id']);
        $this->assertSame('Tegernsee', $body['region']);
        $this->assertSame(47.66, $body['lat']);
    }

    public function testDeleteByCreatorCascadesParticipants(): void
    {
        $owner = $this->createPilot('owner@flightmeet.test');
        $other = $this->createPilot('other@flightmeet.test');
        $id    = $this->createMeetup($owner->id);
        model(MeetupParticipantModel::class)->insert(['meetup_id' => $id, 'user_id' => $other->id]);
        $convId = (int) model(ConversationModel::class)->insert([
            'type' => 'meetup', 'context_type' => 'meetup', 'context_id' => $id, 'created_by' => $owner->id,
        ], true);
        model(MeetupModel::class)->update($id, ['conversation_id' => $convId]);

        $this->actingAs($owner)->delete("api/v1/meetups/{$id}")->assertStatus(204); // CLI/Test: echtes 204

        $this->assertNull(model(MeetupModel::class)->find($id));
        $this->assertSame(0, model(MeetupParticipantModel::class)->where('meetup_id', $id)->countAllResults()); // FK CASCADE
        $this->assertNull(model(ConversationModel::class)->find($convId)); // Treffen-Chat mit-aufgeräumt (ADR-014)
    }

    public function testDeleteForbiddenForNonCreator(): void
    {
        $owner    = $this->createPilot('owner@flightmeet.test');
        $stranger = $this->createPilot('stranger@flightmeet.test');
        $id       = $this->createMeetup($owner->id);

        $this->actingAs($stranger)->delete("api/v1/meetups/{$id}")->assertStatus(403);
        $this->assertNotNull(model(MeetupModel::class)->find($id)); // nicht gelöscht
    }

    public function testDeleteReturns404ForUnknown(): void
    {
        $user = $this->createPilot('a@flightmeet.test');
        $this->actingAs($user)->delete('api/v1/meetups/9999')->assertStatus(404);
    }

    public function testDeleteAllowedForAdmin(): void
    {
        $owner = $this->createPilot('owner@flightmeet.test');
        $admin = $this->createPilot('admin@flightmeet.test');
        $admin->addGroup('admin'); // Plattform-Admin umgeht die Creator-Schranke (ADR-012/D4)
        $id = $this->createMeetup($owner->id);

        $this->actingAs($admin)->delete("api/v1/meetups/{$id}")->assertStatus(204);
        $this->assertNull(model(MeetupModel::class)->find($id));
    }
}
