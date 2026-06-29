<?php

use App\Models\ConversationModel;
use App\Models\ConversationParticipantModel;
use App\Models\GroupMemberModel;
use App\Models\GroupModel;
use App\Models\MeetupModel;
use App\Models\ProfileModel;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;
use CodeIgniter\Shield\Test\AuthenticationTesting;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;

/**
 * Feature-Tests der Chat-Reads (M5 Slice 2, API.md §9–10): Sidebar-Liste (nur Teilnehmer, sortiert,
 * Ungelesen), Detail (Peer/Teilnehmer/Ersteller), Verlauf (Reaktionen/Reply/Tombstone/is_creator),
 * `min_role`-Filter, BOLA (403) und ETag/304.
 *
 * @internal
 */
final class ConversationReadTest extends CIUnitTestCase
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

    /**
     * Legt eine Gruppe + Mitglieder + einen Channel an. $members = list<[userId, role]>.
     * @param list<array{0:int,1:string}> $members
     * @return array{0:int,1:int} [groupId, conversationId]
     */
    private function createGroupChannel(int $ownerId, array $members = [], string $minRole = 'member', string $title = 'Allgemein'): array
    {
        $groupId = (int) model(GroupModel::class)->insert([
            'slug' => 'g-' . bin2hex(random_bytes(6)), 'name' => 'Testgruppe',
            'visibility' => 'public', 'join_policy' => 'open', 'owner_user_id' => $ownerId, 'members_count' => 1 + count($members),
        ], true);
        model(GroupMemberModel::class)->insert(['group_id' => $groupId, 'user_id' => $ownerId, 'role' => 'owner', 'status' => 'active']);
        foreach ($members as $m) {
            model(GroupMemberModel::class)->insert(['group_id' => $groupId, 'user_id' => $m[0], 'role' => $m[1], 'status' => 'active']);
        }
        $convId = (int) model(ConversationModel::class)->insert([
            'type' => 'group_channel', 'context_type' => 'group', 'context_id' => $groupId,
            'title' => $title, 'position' => 0, 'is_default' => $title === 'Allgemein' ? 1 : 0, 'min_role' => $minRole, 'created_by' => $ownerId,
        ], true);

        return [$groupId, $convId];
    }

    /**
     * @param list<int> $participantIds
     * @return array{0:int,1:int} [meetupId, conversationId]
     */
    private function createMeetupConv(int $creatorId, array $participantIds = []): array
    {
        $meetupId = (int) model(MeetupModel::class)->insert([
            'creator_user_id' => $creatorId, 'title' => 'Testtreffen', 'starts_at' => gmdate('Y-m-d H:i:s', time() + 86400),
            'experience_level' => 'all', 'status' => 'open',
        ], true);
        $db = db_connect();
        $db->table('meetup_participants')->insert(['meetup_id' => $meetupId, 'user_id' => $creatorId]);
        foreach ($participantIds as $uid) {
            $db->table('meetup_participants')->insert(['meetup_id' => $meetupId, 'user_id' => $uid]);
        }
        $convId = (int) model(ConversationModel::class)->insert([
            'type' => 'meetup', 'context_type' => 'meetup', 'context_id' => $meetupId, 'title' => 'Testtreffen', 'created_by' => $creatorId,
        ], true);
        $db->table('meetups')->where('id', $meetupId)->update(['conversation_id' => $convId]);

        return [$meetupId, $convId];
    }

    private function createDm(int $a, int $b): int
    {
        $convId = (int) model(ConversationModel::class)->insert([
            'type' => 'direct', 'dm_key' => min($a, $b) . ':' . max($a, $b), 'created_by' => $a,
        ], true);
        model(ConversationParticipantModel::class)->insertBatch([
            ['conversation_id' => $convId, 'user_id' => $a, 'role' => 'member'],
            ['conversation_id' => $convId, 'user_id' => $b, 'role' => 'member'],
        ]);

        return $convId;
    }

    /** @param array{reply_to_id?:int,deleted?:bool,reactions?:array<string,list<int>>,at?:string} $opts */
    private function addMessage(int $convId, int $senderId, ?string $body, array $opts = []): int
    {
        $deleted = $opts['deleted'] ?? false;
        $at      = $opts['at'] ?? gmdate('Y-m-d H:i:s');
        $db      = db_connect();
        $db->table('messages')->insert([
            'conversation_id' => $convId, 'sender_id' => $senderId,
            'body'            => $deleted ? null : $body,
            'reply_to_id'     => $opts['reply_to_id'] ?? null,
            'created_at'      => $at, 'updated_at' => $at,
            'deleted_at'      => $deleted ? $at : null,
            'deleted_by'      => $deleted ? $senderId : null,
        ]);
        $mid = (int) $db->insertID();
        foreach ($opts['reactions'] ?? [] as $emoji => $userIds) {
            $db->table('message_reactions')->insertBatch(array_map(static fn (int $uid): array => ['message_id' => $mid, 'user_id' => $uid, 'emoji' => $emoji], $userIds));
        }
        $db->table('conversations')->where('id', $convId)->update(['last_message_at' => $at]);

        return $mid;
    }

    private function setLastRead(int $convId, int $userId, ?int $msgId): void
    {
        $db       = db_connect();
        $existing = $db->table('conversation_participants')->where('conversation_id', $convId)->where('user_id', $userId)->get()->getRowArray();
        if ($existing !== null) {
            $db->table('conversation_participants')->where('id', $existing['id'])->update(['last_read_message_id' => $msgId]);

            return;
        }
        $db->table('conversation_participants')->insert(['conversation_id' => $convId, 'user_id' => $userId, 'role' => 'member', 'last_read_message_id' => $msgId]);
    }

    /** @return list<int> */
    private function listIds(User $viewer): array
    {
        $data = json_decode($this->actingAs($viewer)->get('api/v1/conversations')->getJSON(), true)['data'];

        return array_map('intval', array_column($data, 'id'));
    }

    public function testListReturnsOnlyParticipantConversations(): void
    {
        $a = $this->createPilot('a@flightmeet.test');
        $b = $this->createPilot('b@flightmeet.test');
        [, $convA] = $this->createGroupChannel((int) $a->id);
        $dm        = $this->createDm((int) $a->id, (int) $b->id);
        [, $convB] = $this->createGroupChannel((int) $b->id); // a ist kein Mitglied
        $this->addMessage($convA, (int) $a->id, 'x');
        $this->addMessage($dm, (int) $b->id, 'y');
        $this->addMessage($convB, (int) $b->id, 'z');

        $ids = $this->listIds($a);
        sort($ids);
        $expected = [$convA, $dm];
        sort($expected);
        $this->assertSame($expected, $ids);
    }

    public function testListSortedByLastActivityDesc(): void
    {
        $a   = $this->createPilot('a@flightmeet.test');
        $b   = $this->createPilot('b@flightmeet.test');
        $c   = $this->createPilot('c@flightmeet.test');
        $dm1 = $this->createDm((int) $a->id, (int) $b->id);
        $dm2 = $this->createDm((int) $a->id, (int) $c->id);
        $this->addMessage($dm1, (int) $b->id, 'older', ['at' => gmdate('Y-m-d H:i:s', time() - 3600)]);
        $this->addMessage($dm2, (int) $c->id, 'newer', ['at' => gmdate('Y-m-d H:i:s', time() - 60)]);

        $this->assertSame([$dm2, $dm1], $this->listIds($a));
    }

    public function testListItemCarriesUnreadAndLastMessage(): void
    {
        $a  = $this->createPilot('a@flightmeet.test', ['display_name' => 'Anna']);
        $b  = $this->createPilot('b@flightmeet.test', ['display_name' => 'Bob']);
        $dm = $this->createDm((int) $a->id, (int) $b->id);
        $this->addMessage($dm, (int) $b->id, 'Servus!');

        $item = json_decode($this->actingAs($a)->get('api/v1/conversations')->getJSON(), true)['data'][0];
        $this->assertSame('Bob', $item['title']);
        $this->assertSame('Bob', $item['peer']['display_name']);
        $this->assertSame(1, $item['unread_count']);
        $this->assertSame('Servus!', $item['last_message']['body']);
        $this->assertSame('Bob', $item['last_message']['sender_name']);
    }

    public function testUnreadCountEndpointReflectsWatermark(): void
    {
        $a  = $this->createPilot('a@flightmeet.test');
        $b  = $this->createPilot('b@flightmeet.test');
        $dm = $this->createDm((int) $a->id, (int) $b->id);
        $m1 = $this->addMessage($dm, (int) $b->id, '1');
        $this->addMessage($dm, (int) $b->id, '2');

        $count = fn (User $u): int => (int) json_decode($this->actingAs($u)->get('api/v1/conversations/unread-count')->getJSON(), true)['data'];

        $this->assertSame(2, $count($a));            // a hat nichts gelesen
        $this->assertSame(0, $count($b));            // eigene Nachrichten zählen nicht
        $this->setLastRead($dm, (int) $a->id, $m1);
        $this->assertSame(1, $count($a));            // bis m1 gelesen ⇒ 1 offen
    }

    public function testDetailDmReturnsPeerAndParticipants(): void
    {
        $a  = $this->createPilot('a@flightmeet.test', ['display_name' => 'Anna']);
        $b  = $this->createPilot('b@flightmeet.test', ['display_name' => 'Bob']);
        $dm = $this->createDm((int) $a->id, (int) $b->id);

        $d = json_decode($this->actingAs($a)->get("api/v1/conversations/{$dm}")->getJSON(), true)['data'];
        $this->assertSame('direct', $d['type']);
        $this->assertSame('Bob', $d['title']);
        $this->assertSame('Bob', $d['peer']['display_name']);
        $this->assertCount(2, $d['participants']);
        $this->assertNull($d['creator_user_id']);
    }

    public function testDetailMeetupHasCreatorId(): void
    {
        $creator = $this->createPilot('c@flightmeet.test');
        $part    = $this->createPilot('p@flightmeet.test');
        [, $conv] = $this->createMeetupConv((int) $creator->id, [(int) $part->id]);

        $d = json_decode($this->actingAs($part)->get("api/v1/conversations/{$conv}")->getJSON(), true)['data'];
        $this->assertSame('meetup', $d['type']);
        $this->assertSame((int) $creator->id, $d['creator_user_id']);
        $this->assertNull($d['peer']);
        $this->assertCount(2, $d['participants']);
    }

    public function testDetailForbiddenForNonParticipant(): void
    {
        $a        = $this->createPilot('a@flightmeet.test');
        $other    = $this->createPilot('o@flightmeet.test');
        $stranger = $this->createPilot('s@flightmeet.test');
        $dm       = $this->createDm((int) $a->id, (int) $other->id);

        $this->actingAs($stranger)->get("api/v1/conversations/{$dm}")->assertStatus(403);
    }

    public function testMessagesThreadWithReactionsReplyAndTombstone(): void
    {
        $creator = $this->createPilot('c@flightmeet.test', ['display_name' => 'Cara']);
        $part    = $this->createPilot('p@flightmeet.test', ['display_name' => 'Paul']);
        [, $conv] = $this->createMeetupConv((int) $creator->id, [(int) $part->id]);
        $m1 = $this->addMessage($conv, (int) $creator->id, 'Willkommen', ['reactions' => ['🪂' => [(int) $part->id]]]);
        $this->addMessage($conv, (int) $part->id, 'Danke!', ['reply_to_id' => $m1]);
        $this->addMessage($conv, (int) $part->id, 'weg', ['deleted' => true]);

        $msgs = json_decode($this->actingAs($part)->get("api/v1/conversations/{$conv}/messages")->getJSON(), true)['data'];
        $this->assertCount(3, $msgs);

        $this->assertTrue($msgs[0]['is_creator']);
        $this->assertSame('🪂', $msgs[0]['reactions'][0]['emoji']);
        $this->assertSame(1, $msgs[0]['reactions'][0]['count']);
        $this->assertTrue($msgs[0]['reactions'][0]['me']);

        $this->assertFalse($msgs[1]['is_creator']);
        $this->assertSame($m1, $msgs[1]['reply_to']['id']);
        $this->assertSame('Willkommen', $msgs[1]['reply_to']['body']);

        $this->assertNull($msgs[2]['body']);
        $this->assertNotNull($msgs[2]['deleted_at']);
    }

    public function testMessagesForbiddenForNonParticipant(): void
    {
        $a     = $this->createPilot('a@flightmeet.test');
        $other = $this->createPilot('o@flightmeet.test');
        $strn  = $this->createPilot('s@flightmeet.test');
        $dm    = $this->createDm((int) $a->id, (int) $other->id);
        $this->addMessage($dm, (int) $a->id, 'hi');

        $this->actingAs($strn)->get("api/v1/conversations/{$dm}/messages")->assertStatus(403);
    }

    public function testAdminChannelHiddenFromMember(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        [$groupId, $defaultConv] = $this->createGroupChannel((int) $owner->id, [[(int) $member->id, 'member']]);
        $adminConv = (int) model(ConversationModel::class)->insert([
            'type' => 'group_channel', 'context_type' => 'group', 'context_id' => $groupId,
            'title' => 'Orga', 'position' => 1, 'is_default' => 0, 'min_role' => 'admin', 'created_by' => $owner->id,
        ], true);
        $this->addMessage($defaultConv, (int) $owner->id, 'hi');
        $this->addMessage($adminConv, (int) $owner->id, 'geheim');

        $memberIds = $this->listIds($member);
        $this->assertContains($defaultConv, $memberIds);
        $this->assertNotContains($adminConv, $memberIds);
        $this->actingAs($member)->get("api/v1/conversations/{$adminConv}")->assertStatus(403);
        $this->actingAs($member)->get("api/v1/conversations/{$adminConv}/messages")->assertStatus(403);

        $this->assertContains($adminConv, $this->listIds($owner));
    }

    public function testMessagesEtagReturns304(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        [, $conv] = $this->createGroupChannel((int) $owner->id);
        $this->addMessage($conv, (int) $owner->id, 'Hallo');

        $first = $this->actingAs($owner)->get("api/v1/conversations/{$conv}/messages");
        $first->assertStatus(200);
        $etag = $first->response()->getHeaderLine('ETag');
        $this->assertNotSame('', $etag);

        $this->actingAs($owner)->withHeaders(['If-None-Match' => $etag])
            ->get("api/v1/conversations/{$conv}/messages")->assertStatus(304);
    }
}
