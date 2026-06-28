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
 * Feature-Tests der Flugtreffen-Lese-Endpunkte (M3 Slice 2, API.md §5.1/§5.2): Liste mit Filter/
 * Sort/Pagination, abgeleiteter Status (inkl. Präzedenz), Detail mit Teilnehmerliste + Flags.
 * Schreiben/Teilnahme werden in MeetupWriteTest/MeetupParticipantTest geprüft.
 *
 * @internal
 */
final class MeetupTest extends CIUnitTestCase
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

    /**
     * Legt ein Treffen an und trägt den Ersteller als ersten Teilnehmer ein (Invariante aus dem
     * Create-Pfad, ADR-015). `$o` überschreibt Defaults (status/starts_at/max/level/region/spot_id).
     *
     * @param array<string, mixed> $o
     */
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
            'description'      => null,
            'starts_at'        => gmdate('Y-m-d H:i:s', time() + 7 * 86400),
            'experience_level' => 'all',
            'max_participants' => 10,
            'status'           => 'open',
        ], $o), true);

        model(MeetupParticipantModel::class)->insert(['meetup_id' => $id, 'user_id' => $creatorId]);

        return $id;
    }

    private function addParticipant(int $meetupId, int $userId): void
    {
        model(MeetupParticipantModel::class)->insert(['meetup_id' => $meetupId, 'user_id' => $userId]);
    }

    /** @return list<int> */
    private function listIds(string $query = ''): array
    {
        $data = json_decode($this->get("api/v1/meetups{$query}")->getJSON(), true)['data'];

        return array_map(static fn (array $m): int => $m['id'], $data);
    }

    public function testListReturnsEnvelopeWithMeta(): void
    {
        $creator = $this->createPilot('a@flightmeet.test');
        $this->createMeetup($creator->id);

        $body = json_decode($this->get('api/v1/meetups')->getJSON(), true);

        $this->assertCount(1, $body['data']);
        $this->assertSame(1, $body['meta']['total']);
        $this->assertSame(20, $body['meta']['limit']);
        $this->assertSame(0, $body['meta']['offset']);
        $this->assertSame('starts_at_asc', $body['meta']['sort']);
    }

    public function testDerivedStatusMatrix(): void
    {
        $c    = $this->createPilot('a@flightmeet.test');
        $past = gmdate('Y-m-d H:i:s', time() - 5 * 86400);

        $open      = $this->createMeetup($c->id, ['max_participants' => 10]);                 // count 1 < 10
        $full      = $this->createMeetup($c->id, ['max_participants' => 1]);                  // count 1 == 1
        $finished  = $this->createMeetup($c->id, ['starts_at' => $past]);                     // Vergangenheit
        $cancelled = $this->createMeetup($c->id, ['status' => 'cancelled']);
        $unlimited = $this->createMeetup($c->id, ['max_participants' => null]);               // nie voll

        $status = [];
        foreach (json_decode($this->get('api/v1/meetups')->getJSON(), true)['data'] as $m) {
            $status[$m['id']] = $m['derived_status'];
        }

        $this->assertSame('open', $status[$open]);
        $this->assertSame('full', $status[$full]);
        $this->assertSame('finished', $status[$finished]);
        $this->assertSame('cancelled', $status[$cancelled]);
        $this->assertSame('open', $status[$unlimited]);
    }

    public function testCancelledPastStaysCancelled(): void
    {
        $c   = $this->createPilot('a@flightmeet.test');
        $id  = $this->createMeetup($c->id, ['status' => 'cancelled', 'starts_at' => gmdate('Y-m-d H:i:s', time() - 86400)]);

        $body = json_decode($this->get("api/v1/meetups/{$id}")->getJSON(), true)['data'];

        $this->assertSame('cancelled', $body['derived_status']); // Präzedenz cancelled > finished
    }

    public function testStatusFilterUsesDerivedStatus(): void
    {
        $c         = $this->createPilot('a@flightmeet.test');
        $open      = $this->createMeetup($c->id, ['max_participants' => 10]);
        $full      = $this->createMeetup($c->id, ['max_participants' => 1]);
        $finished  = $this->createMeetup($c->id, ['starts_at' => gmdate('Y-m-d H:i:s', time() - 5 * 86400)]);
        $cancelled = $this->createMeetup($c->id, ['status' => 'cancelled']);

        $this->assertSame([$open], $this->listIds('?status=open'));
        $this->assertSame([$full], $this->listIds('?status=full'));
        $this->assertSame([$finished], $this->listIds('?status=finished'));
        $this->assertSame([$cancelled], $this->listIds('?status=cancelled'));
    }

    public function testLevelFilterIncludesAll(): void
    {
        $c        = $this->createPilot('a@flightmeet.test');
        $advanced = $this->createMeetup($c->id, ['experience_level' => 'advanced']);
        $all      = $this->createMeetup($c->id, ['experience_level' => 'all']);
        $this->createMeetup($c->id, ['experience_level' => 'beginner']);

        $ids = $this->listIds('?level=advanced');

        sort($ids);
        $expected = [$advanced, $all];
        sort($expected);
        $this->assertSame($expected, $ids); // advanced + all, aber nicht beginner
    }

    public function testHasFreeSpotsExcludesFullAndIncludesUnlimited(): void
    {
        $c         = $this->createPilot('a@flightmeet.test');
        $open      = $this->createMeetup($c->id, ['max_participants' => 10]);
        $unlimited = $this->createMeetup($c->id, ['max_participants' => null]);
        $this->createMeetup($c->id, ['max_participants' => 1]);                                   // full
        $this->createMeetup($c->id, ['status' => 'cancelled']);                                   // cancelled
        $this->createMeetup($c->id, ['starts_at' => gmdate('Y-m-d H:i:s', time() - 86400)]);      // finished

        $ids = $this->listIds('?has_free_spots=1');

        sort($ids);
        $expected = [$open, $unlimited];
        sort($expected);
        $this->assertSame($expected, $ids);
    }

    public function testPaginationMetaTotalRespectsFilter(): void
    {
        $c = $this->createPilot('a@flightmeet.test');
        for ($i = 0; $i < 3; $i++) {
            $this->createMeetup($c->id, ['max_participants' => 10]); // open
        }
        $this->createMeetup($c->id, ['status' => 'cancelled']);
        $this->createMeetup($c->id, ['status' => 'cancelled']);

        $body = json_decode($this->get('api/v1/meetups?status=open&limit=2')->getJSON(), true);

        $this->assertCount(2, $body['data']);   // Seite
        $this->assertSame(3, $body['meta']['total']); // gefilterte Gesamtzahl (ohne limit)
    }

    public function testSortTitleAsc(): void
    {
        $c = $this->createPilot('a@flightmeet.test');
        $this->createMeetup($c->id, ['title' => 'Charlie']);
        $this->createMeetup($c->id, ['title' => 'Alpha']);
        $this->createMeetup($c->id, ['title' => 'Bravo']);

        $titles = array_map(
            static fn (array $m): string => $m['title'],
            json_decode($this->get('api/v1/meetups?sort=title_asc')->getJSON(), true)['data'],
        );

        $this->assertSame(['Alpha', 'Bravo', 'Charlie'], $titles);
    }

    public function testShowReturns404ForUnknownMeetup(): void
    {
        $this->get('api/v1/meetups/9999')->assertStatus(404);
    }

    public function testShowReturnsDetailWithCreatorFirst(): void
    {
        $creator = $this->createPilot('creator@flightmeet.test', ['display_name' => 'Creator']);
        $other   = $this->createPilot('other@flightmeet.test', ['display_name' => 'Other']);
        $id      = $this->createMeetup($creator->id);
        $this->addParticipant($id, $other->id);

        $body = json_decode($this->get("api/v1/meetups/{$id}")->getJSON(), true)['data'];

        $this->assertSame(2, $body['participant_count']);
        $this->assertNull($body['conversation_id']); // Chat erst M5
        $this->assertSame((int) $creator->id, $body['participants'][0]['id']); // Ersteller zuerst
        $this->assertSame('Creator', $body['participants'][0]['display_name']);
        $this->assertArrayHasKey('handle', $body['participants'][0]);
    }

    public function testShowFlagsFalseForGuest(): void
    {
        $creator = $this->createPilot('creator@flightmeet.test');
        $id      = $this->createMeetup($creator->id);

        $body = json_decode($this->get("api/v1/meetups/{$id}")->getJSON(), true)['data'];

        $this->assertFalse($body['is_participant']);
        $this->assertFalse($body['can_edit']);
    }

    public function testShowFlagsForCreator(): void
    {
        $creator = $this->createPilot('creator@flightmeet.test');
        $id      = $this->createMeetup($creator->id);

        $body = json_decode($this->actingAs($creator)->get("api/v1/meetups/{$id}")->getJSON(), true)['data'];

        $this->assertTrue($body['is_participant']);
        $this->assertTrue($body['can_edit']);
    }

    public function testShowCanEditForAdmin(): void
    {
        $creator = $this->createPilot('creator@flightmeet.test');
        $admin   = $this->createPilot('admin@flightmeet.test');
        $admin->addGroup('admin');
        $id = $this->createMeetup($creator->id);

        $body = json_decode($this->actingAs($admin)->get("api/v1/meetups/{$id}")->getJSON(), true)['data'];

        $this->assertTrue($body['can_edit']);       // Admin-Override (BOLA)
        $this->assertFalse($body['is_participant']); // aber kein Teilnehmer
    }
}
