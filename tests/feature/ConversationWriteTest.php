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
 * Feature-Tests der Chat-Writes (M5 Slice 3, API.md §9–10): Senden (+ Reply), Soft-Edit (Sender,
 * 15-min-Fenster), Soft-Delete (Sender/owner-admin, Tombstone), Reaktion-Toggle (Allowlist), markRead
 * (Watermark) und DM find-or-create (idempotent/cannot_dm_self).
 *
 * @internal
 */
final class ConversationWriteTest extends CIUnitTestCase
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
     * @param list<array{0:int,1:string}> $members
     * @return array{0:int,1:int} [groupId, conversationId]
     */
    private function createGroupChannel(int $ownerId, array $members = []): array
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
            'title' => 'Allgemein', 'position' => 0, 'is_default' => 1, 'min_role' => 'member', 'created_by' => $ownerId,
        ], true);

        return [$groupId, $convId];
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

    /** @param array{deleted?:bool,at?:string} $opts */
    private function addMessage(int $convId, int $senderId, ?string $body, array $opts = []): int
    {
        $deleted = $opts['deleted'] ?? false;
        $at      = $opts['at'] ?? gmdate('Y-m-d H:i:s');
        db_connect()->table('messages')->insert([
            'conversation_id' => $convId, 'sender_id' => $senderId,
            'body'            => $deleted ? null : $body,
            'created_at'      => $at, 'updated_at' => $at,
            'deleted_at'      => $deleted ? $at : null,
            'deleted_by'      => $deleted ? $senderId : null,
        ]);

        return (int) db_connect()->insertID();
    }

    private function unreadCount(User $u): int
    {
        return (int) json_decode($this->actingAs($u)->get('api/v1/conversations/unread-count')->getJSON(), true)['data'];
    }

    // ──────────────────────────── Senden ────────────────────────────

    public function testSendMessage(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        [, $conv] = $this->createGroupChannel((int) $owner->id);

        $res = $this->actingAs($owner)->withBodyFormat('json')
            ->post("api/v1/conversations/{$conv}/messages", ['body' => 'Servus!', 'reply_to_id' => null]);

        $res->assertStatus(201);
        $d = json_decode($res->getJSON(), true)['data'];
        $this->assertSame('Servus!', $d['body']);
        $this->assertSame((int) $owner->id, $d['sender']['id']);
        $this->assertSame([], $d['reactions']);
        $this->assertNull($d['reply_to']);
        $this->assertNull($d['edited_at']);
        // Sender hat seine eigene Nachricht „gelesen" ⇒ kein Ungelesen.
        $this->assertSame(0, $this->unreadCount($owner));
    }

    public function testSendMessageForbiddenForNonMember(): void
    {
        $owner    = $this->createPilot('o@flightmeet.test');
        $stranger = $this->createPilot('s@flightmeet.test');
        [, $conv] = $this->createGroupChannel((int) $owner->id);

        $this->actingAs($stranger)->withBodyFormat('json')
            ->post("api/v1/conversations/{$conv}/messages", ['body' => 'darf nicht'])->assertStatus(403);
    }

    public function testSendMessageValidation(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        [, $conv] = $this->createGroupChannel((int) $owner->id);

        $this->actingAs($owner)->withBodyFormat('json')
            ->post("api/v1/conversations/{$conv}/messages", ['body' => ''])->assertStatus(422);
    }

    public function testSendReplyWithinConversation(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        [, $conv] = $this->createGroupChannel((int) $owner->id);
        $target = $this->addMessage($conv, (int) $owner->id, 'Original');

        $d = json_decode($this->actingAs($owner)->withBodyFormat('json')
            ->post("api/v1/conversations/{$conv}/messages", ['body' => 'Antwort', 'reply_to_id' => $target])->getJSON(), true)['data'];

        $this->assertSame($target, $d['reply_to']['id']);
        $this->assertSame('Original', $d['reply_to']['body']);
    }

    public function testSendReplyToForeignMessageRejected(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        [, $convA] = $this->createGroupChannel((int) $owner->id);
        [, $convB] = $this->createGroupChannel((int) $owner->id);
        $foreign = $this->addMessage($convB, (int) $owner->id, 'woanders');

        $this->actingAs($owner)->withBodyFormat('json')
            ->post("api/v1/conversations/{$convA}/messages", ['body' => 'x', 'reply_to_id' => $foreign])
            ->assertStatus(409);
    }

    // ──────────────────────────── Edit ────────────────────────────

    public function testEditMessageBySender(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        [, $conv] = $this->createGroupChannel((int) $owner->id);
        $mid = $this->addMessage($conv, (int) $owner->id, 'alt');

        $d = json_decode($this->actingAs($owner)->withBodyFormat('json')
            ->patch("api/v1/conversations/{$conv}/messages/{$mid}", ['body' => 'neu'])->getJSON(), true)['data'];

        $this->assertSame('neu', $d['body']);
        $this->assertNotNull($d['edited_at']);
    }

    public function testEditForbiddenForNonSender(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        [, $conv] = $this->createGroupChannel((int) $owner->id, [[(int) $member->id, 'member']]);
        $mid = $this->addMessage($conv, (int) $owner->id, 'gehört Owner');

        $this->actingAs($member)->withBodyFormat('json')
            ->patch("api/v1/conversations/{$conv}/messages/{$mid}", ['body' => 'hacked'])->assertStatus(403);
    }

    public function testEditWindowExpired(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        [, $conv] = $this->createGroupChannel((int) $owner->id);
        $mid = $this->addMessage($conv, (int) $owner->id, 'alt', ['at' => gmdate('Y-m-d H:i:s', time() - 1000)]); // > 15 min

        $res = $this->actingAs($owner)->withBodyFormat('json')
            ->patch("api/v1/conversations/{$conv}/messages/{$mid}", ['body' => 'zu spät']);
        $res->assertStatus(409);
        $this->assertSame('edit_window_expired', json_decode($res->getJSON(), true)['error']['code']);
    }

    public function testEditWindowExpiredOnDbDefaultTimestamp(): void
    {
        // Regression (M5-Review HIGH): die LIVE-Nachricht bekommt `created_at` aus dem DB-Default
        // (CURRENT_TIMESTAMP). Nur wenn die DB-Session auf UTC steht, rechnet das 15-min-Fenster korrekt
        // (sonst ist es um den Server-UTC-Offset zu großzügig). Dieser Test geht bewusst über den
        // Endpoint (kein explizites created_at) und datiert in der DB-eigenen Uhr zurück.
        $owner = $this->createPilot('o@flightmeet.test');
        [, $conv] = $this->createGroupChannel((int) $owner->id);
        $mid = (int) json_decode($this->actingAs($owner)->withBodyFormat('json')
            ->post("api/v1/conversations/{$conv}/messages", ['body' => 'frisch'])->getJSON(), true)['data']['id'];

        db_connect()->query('UPDATE messages SET created_at = DATE_SUB(created_at, INTERVAL 30 MINUTE) WHERE id = ?', [$mid]);

        $res = $this->actingAs($owner)->withBodyFormat('json')
            ->patch("api/v1/conversations/{$conv}/messages/{$mid}", ['body' => 'zu spät']);
        $res->assertStatus(409);
        $this->assertSame('edit_window_expired', json_decode($res->getJSON(), true)['error']['code']);
    }

    public function testEditDeletedMessageRejected(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        [, $conv] = $this->createGroupChannel((int) $owner->id);
        $mid = $this->addMessage($conv, (int) $owner->id, 'weg', ['deleted' => true]);

        $res = $this->actingAs($owner)->withBodyFormat('json')
            ->patch("api/v1/conversations/{$conv}/messages/{$mid}", ['body' => 'reanimiert']);
        $res->assertStatus(409);
        $this->assertSame('message_deleted', json_decode($res->getJSON(), true)['error']['code']);
    }

    // ──────────────────────────── Delete ────────────────────────────

    public function testDeleteBySenderReturnsTombstone(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        [, $conv] = $this->createGroupChannel((int) $owner->id);
        $mid = $this->addMessage($conv, (int) $owner->id, 'lösch mich');

        $d = json_decode($this->actingAs($owner)->delete("api/v1/conversations/{$conv}/messages/{$mid}")->getJSON(), true)['data'];
        $this->assertNull($d['body']);
        $this->assertNotNull($d['deleted_at']);
    }

    public function testDeleteByGroupAdmin(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        [, $conv] = $this->createGroupChannel((int) $owner->id, [[(int) $member->id, 'member']]);
        $mid = $this->addMessage($conv, (int) $member->id, 'Mitglieds-Post');

        // Owner (= Konversations-Admin) darf fremde Nachricht löschen.
        $this->actingAs($owner)->delete("api/v1/conversations/{$conv}/messages/{$mid}")->assertStatus(200);
    }

    public function testDeleteForbiddenForPlainMember(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        [, $conv] = $this->createGroupChannel((int) $owner->id, [[(int) $member->id, 'member']]);
        $mid = $this->addMessage($conv, (int) $owner->id, 'Owner-Post');

        $this->actingAs($member)->delete("api/v1/conversations/{$conv}/messages/{$mid}")->assertStatus(403);
    }

    // ──────────────────────────── Reaktionen ────────────────────────────

    public function testReactToggle(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        [, $conv] = $this->createGroupChannel((int) $owner->id, [[(int) $member->id, 'member']]);
        $mid = $this->addMessage($conv, (int) $owner->id, 'reagier mal');

        $d1 = json_decode($this->actingAs($member)->withBodyFormat('json')
            ->post("api/v1/conversations/{$conv}/messages/{$mid}/reactions", ['emoji' => '🔥'])->getJSON(), true)['data'];
        $this->assertSame('🔥', $d1['reactions'][0]['emoji']);
        $this->assertSame(1, $d1['reactions'][0]['count']);
        $this->assertTrue($d1['reactions'][0]['me']);

        $d2 = json_decode($this->actingAs($member)->withBodyFormat('json')
            ->post("api/v1/conversations/{$conv}/messages/{$mid}/reactions", ['emoji' => '🔥'])->getJSON(), true)['data'];
        $this->assertSame([], $d2['reactions']);
    }

    public function testReactInvalidEmoji(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        [, $conv] = $this->createGroupChannel((int) $owner->id);
        $mid = $this->addMessage($conv, (int) $owner->id, 'x');

        $res = $this->actingAs($owner)->withBodyFormat('json')
            ->post("api/v1/conversations/{$conv}/messages/{$mid}/reactions", ['emoji' => '🦄']);
        $res->assertStatus(422);
        $this->assertSame('invalid_emoji', json_decode($res->getJSON(), true)['error']['code']);
    }

    public function testReactOnDeletedRejected(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        [, $conv] = $this->createGroupChannel((int) $owner->id);
        $mid = $this->addMessage($conv, (int) $owner->id, 'weg', ['deleted' => true]);

        $this->actingAs($owner)->withBodyFormat('json')
            ->post("api/v1/conversations/{$conv}/messages/{$mid}/reactions", ['emoji' => '🔥'])->assertStatus(409);
    }

    public function testReactForbiddenForNonParticipant(): void
    {
        $owner    = $this->createPilot('o@flightmeet.test');
        $stranger = $this->createPilot('s@flightmeet.test');
        [, $conv]  = $this->createGroupChannel((int) $owner->id);
        $mid = $this->addMessage($conv, (int) $owner->id, 'x');

        $this->actingAs($stranger)->withBodyFormat('json')
            ->post("api/v1/conversations/{$conv}/messages/{$mid}/reactions", ['emoji' => '🔥'])->assertStatus(403);
    }

    // ──────────────────────────── markRead / DM ────────────────────────────

    public function testMarkReadResetsUnread(): void
    {
        $a  = $this->createPilot('a@flightmeet.test');
        $b  = $this->createPilot('b@flightmeet.test');
        $dm = $this->createDm((int) $a->id, (int) $b->id);
        $this->addMessage($dm, (int) $b->id, '1');
        $this->addMessage($dm, (int) $b->id, '2');
        $this->assertSame(2, $this->unreadCount($a));

        $this->actingAs($a)->post("api/v1/conversations/{$dm}/read")->assertStatus(204);
        $this->assertSame(0, $this->unreadCount($a));
    }

    public function testOpenDmFindOrCreateIdempotent(): void
    {
        $a = $this->createPilot('a@flightmeet.test');
        $b = $this->createPilot('b@flightmeet.test');

        $id1 = (int) json_decode($this->actingAs($a)->withBodyFormat('json')->post('api/v1/conversations/direct', ['user_id' => $b->id])->getJSON(), true)['data']['id'];
        $id2 = (int) json_decode($this->actingAs($a)->withBodyFormat('json')->post('api/v1/conversations/direct', ['user_id' => $b->id])->getJSON(), true)['data']['id'];
        $this->assertSame($id1, $id2);

        // Symmetrisch: B → A liefert dieselbe Konversation (dm_key min:max).
        $id3 = (int) json_decode($this->actingAs($b)->withBodyFormat('json')->post('api/v1/conversations/direct', ['user_id' => $a->id])->getJSON(), true)['data']['id'];
        $this->assertSame($id1, $id3);
    }

    public function testOpenDmCannotDmSelf(): void
    {
        $a = $this->createPilot('a@flightmeet.test');

        $res = $this->actingAs($a)->withBodyFormat('json')->post('api/v1/conversations/direct', ['user_id' => $a->id]);
        $res->assertStatus(409);
        $this->assertSame('cannot_dm_self', json_decode($res->getJSON(), true)['error']['code']);
    }

    public function testOpenDmUserNotFound(): void
    {
        $a = $this->createPilot('a@flightmeet.test');

        $this->actingAs($a)->withBodyFormat('json')->post('api/v1/conversations/direct', ['user_id' => 999999])->assertStatus(404);
    }
}
