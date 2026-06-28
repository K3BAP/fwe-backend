<?php

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
 * Feature-Tests der Teilnahme (M3 Slice 4, API.md §5.6–§5.8): Beitreten (idempotent, Kapazität/409,
 * nicht-beitretbar/409), Austreten (idempotent, creator_cannot_leave), Teilnehmer entfernen (BOLA).
 * Deckt die Kapazitäts-Invariante ab (count überschreitet nie max).
 *
 * @internal
 */
final class MeetupParticipantTest extends CIUnitTestCase
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

    private function createSpot(): int
    {
        return (int) model(SpotModel::class)->insert([
            'name' => 'Testspot ' . bin2hex(random_bytes(3)), 'region' => 'Testregion',
            'country' => 'DE', 'lat' => 47.5, 'lng' => 11.0, 'type' => 'launch',
        ], true);
    }

    /** Legt ein Treffen an + trägt den Ersteller als ersten Teilnehmer ein. @param array<string,mixed> $o */
    private function createMeetup(int $creatorId, array $o = []): int
    {
        $id = (int) model(MeetupModel::class)->insert(array_merge([
            'creator_user_id'  => $creatorId,
            'spot_id'          => $this->createSpot(),
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

    private function countParticipants(int $meetupId): int
    {
        return model(MeetupParticipantModel::class)->where('meetup_id', $meetupId)->countAllResults();
    }

    public function testJoinRequiresAuth(): void
    {
        $owner = $this->createPilot('owner@flightmeet.test');
        $id    = $this->createMeetup($owner->id);

        $this->post("api/v1/meetups/{$id}/participants")->assertStatus(401);
    }

    public function testJoinAddsParticipantAndReturnsDetail(): void
    {
        $owner = $this->createPilot('owner@flightmeet.test');
        $joiner = $this->createPilot('joiner@flightmeet.test');
        $id     = $this->createMeetup($owner->id);

        $result = $this->actingAs($joiner)->post("api/v1/meetups/{$id}/participants");

        $result->assertStatus(200);
        $body = json_decode($result->getJSON(), true)['data'];
        $this->assertSame(2, $body['participant_count']);
        $this->assertTrue($body['is_participant']);
        $this->assertSame(2, $this->countParticipants($id));
    }

    public function testJoinIsIdempotent(): void
    {
        $owner  = $this->createPilot('owner@flightmeet.test');
        $joiner = $this->createPilot('joiner@flightmeet.test');
        $id     = $this->createMeetup($owner->id);

        $this->actingAs($joiner)->post("api/v1/meetups/{$id}/participants")->assertStatus(200);
        $second = $this->actingAs($joiner)->post("api/v1/meetups/{$id}/participants");

        $second->assertStatus(200);
        $this->assertSame(2, json_decode($second->getJSON(), true)['data']['participant_count']); // kein Duplikat
        $this->assertSame(2, $this->countParticipants($id));
    }

    public function testJoinFullReturns409AndDoesNotExceedCapacity(): void
    {
        $owner = $this->createPilot('owner@flightmeet.test');
        $a     = $this->createPilot('a@flightmeet.test');
        $b     = $this->createPilot('b@flightmeet.test');
        $id    = $this->createMeetup($owner->id, ['max_participants' => 2]); // Creator belegt 1

        $this->actingAs($a)->post("api/v1/meetups/{$id}/participants")->assertStatus(200); // jetzt voll (2/2)
        $result = $this->actingAs($b)->post("api/v1/meetups/{$id}/participants");

        $result->assertStatus(409);
        $this->assertSame('meetup_full', json_decode($result->getJSON(), true)['error']['code']);
        $this->assertSame(2, $this->countParticipants($id)); // Invariante: nie über max
    }

    public function testJoinCancelledReturns409(): void
    {
        $owner  = $this->createPilot('owner@flightmeet.test');
        $joiner = $this->createPilot('joiner@flightmeet.test');
        $id     = $this->createMeetup($owner->id, ['status' => 'cancelled']);

        $result = $this->actingAs($joiner)->post("api/v1/meetups/{$id}/participants");

        $result->assertStatus(409);
        $this->assertSame('meetup_not_joinable', json_decode($result->getJSON(), true)['error']['code']);
    }

    public function testJoinFinishedReturns409(): void
    {
        $owner  = $this->createPilot('owner@flightmeet.test');
        $joiner = $this->createPilot('joiner@flightmeet.test');
        $id     = $this->createMeetup($owner->id, ['starts_at' => gmdate('Y-m-d H:i:s', time() - 86400)]);

        $result = $this->actingAs($joiner)->post("api/v1/meetups/{$id}/participants");

        $result->assertStatus(409);
        $this->assertSame('meetup_not_joinable', json_decode($result->getJSON(), true)['error']['code']);
    }

    public function testJoinUnlimitedNeverFull(): void
    {
        $owner = $this->createPilot('owner@flightmeet.test');
        $a     = $this->createPilot('a@flightmeet.test');
        $b     = $this->createPilot('b@flightmeet.test');
        $id    = $this->createMeetup($owner->id, ['max_participants' => null]);

        $this->actingAs($a)->post("api/v1/meetups/{$id}/participants")->assertStatus(200);
        $this->actingAs($b)->post("api/v1/meetups/{$id}/participants")->assertStatus(200);
        $this->assertSame(3, $this->countParticipants($id));
    }

    public function testLeaveRemovesParticipant(): void
    {
        $owner  = $this->createPilot('owner@flightmeet.test');
        $joiner = $this->createPilot('joiner@flightmeet.test');
        $id     = $this->createMeetup($owner->id);
        model(MeetupParticipantModel::class)->insert(['meetup_id' => $id, 'user_id' => $joiner->id]);

        $result = $this->actingAs($joiner)->delete("api/v1/meetups/{$id}/participants/me");

        $result->assertStatus(200);
        $body = json_decode($result->getJSON(), true)['data'];
        $this->assertFalse($body['is_participant']);
        $this->assertSame(1, $body['participant_count']);
        $this->assertSame(1, $this->countParticipants($id));
    }

    public function testLeaveIsIdempotentWhenNotParticipant(): void
    {
        $owner    = $this->createPilot('owner@flightmeet.test');
        $stranger = $this->createPilot('stranger@flightmeet.test');
        $id       = $this->createMeetup($owner->id);

        $this->actingAs($stranger)->delete("api/v1/meetups/{$id}/participants/me")->assertStatus(200); // kein 404
    }

    public function testCreatorCannotLeave(): void
    {
        $owner = $this->createPilot('owner@flightmeet.test');
        $id    = $this->createMeetup($owner->id);

        $result = $this->actingAs($owner)->delete("api/v1/meetups/{$id}/participants/me");

        $result->assertStatus(409);
        $this->assertSame('creator_cannot_leave', json_decode($result->getJSON(), true)['error']['code']);
        $this->assertSame(1, $this->countParticipants($id)); // bleibt drin
    }

    public function testRemoveParticipantByCreator(): void
    {
        $owner  = $this->createPilot('owner@flightmeet.test');
        $member = $this->createPilot('member@flightmeet.test');
        $id     = $this->createMeetup($owner->id);
        model(MeetupParticipantModel::class)->insert(['meetup_id' => $id, 'user_id' => $member->id]);

        $this->actingAs($owner)->delete("api/v1/meetups/{$id}/participants/{$member->id}")->assertStatus(200);
        $this->assertSame(1, $this->countParticipants($id));
    }

    public function testRemoveParticipantForbiddenForNonCreator(): void
    {
        $owner    = $this->createPilot('owner@flightmeet.test');
        $member   = $this->createPilot('member@flightmeet.test');
        $stranger = $this->createPilot('stranger@flightmeet.test');
        $id       = $this->createMeetup($owner->id);
        model(MeetupParticipantModel::class)->insert(['meetup_id' => $id, 'user_id' => $member->id]);

        $this->actingAs($stranger)->delete("api/v1/meetups/{$id}/participants/{$member->id}")->assertStatus(403);
        $this->assertSame(2, $this->countParticipants($id)); // unberührt
    }

    public function testRemoveParticipantAdminOverride(): void
    {
        $owner  = $this->createPilot('owner@flightmeet.test');
        $admin  = $this->createPilot('admin@flightmeet.test');
        $admin->addGroup('admin');
        $member = $this->createPilot('member@flightmeet.test');
        $id     = $this->createMeetup($owner->id);
        model(MeetupParticipantModel::class)->insert(['meetup_id' => $id, 'user_id' => $member->id]);

        $this->actingAs($admin)->delete("api/v1/meetups/{$id}/participants/{$member->id}")->assertStatus(200);
        $this->assertSame(1, $this->countParticipants($id));
    }

    public function testRemoveCreatorIsRejected(): void
    {
        $owner = $this->createPilot('owner@flightmeet.test');
        $id    = $this->createMeetup($owner->id);

        $result = $this->actingAs($owner)->delete("api/v1/meetups/{$id}/participants/{$owner->id}");

        $result->assertStatus(409);
        $this->assertSame('creator_cannot_leave', json_decode($result->getJSON(), true)['error']['code']);
    }
}
