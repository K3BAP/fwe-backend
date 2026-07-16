<?php

use App\Models\ConversationModel;
use App\Models\ConversationParticipantModel;
use App\Models\GroupJoinRequestModel;
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
 * Feature-Tests der Benachrichtigungen (M5 Slice 4, API.md §11): Lesen (Liste/Presenter/unread-count),
 * markRead/markAllRead (liefern die ganze Liste; BOLA) und die domänenübergreifende **Generierung**
 * (Chat new_message aggregiert + Auflösung, message_reaction, Meetup join/cancel, Gruppe
 * request/approve/invite/feed-post).
 *
 * @internal
 */
final class NotificationTest extends CIUnitTestCase
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

    /** @param list<array{0:int,1:string}> $members */
    private function createGroup(int $ownerId, string $joinPolicy = 'open', array $members = []): int
    {
        $id = (int) model(GroupModel::class)->insert([
            'slug' => 'g-' . bin2hex(random_bytes(6)), 'name' => 'Testgruppe', 'visibility' => 'public',
            'join_policy' => $joinPolicy, 'owner_user_id' => $ownerId, 'members_count' => 1 + count($members),
        ], true);
        model(GroupMemberModel::class)->insert(['group_id' => $id, 'user_id' => $ownerId, 'role' => 'owner', 'status' => 'active']);
        foreach ($members as $m) {
            model(GroupMemberModel::class)->insert(['group_id' => $id, 'user_id' => $m[0], 'role' => $m[1], 'status' => 'active']);
        }

        return $id;
    }

    private function createMeetup(int $creatorId): int
    {
        $id = (int) model(MeetupModel::class)->insert([
            'creator_user_id' => $creatorId, 'title' => 'Testtreffen', 'starts_at' => gmdate('Y-m-d H:i:s', time() + 86400),
            'experience_level' => 'all', 'status' => 'open',
        ], true);
        db_connect()->table('meetup_participants')->insert(['meetup_id' => $id, 'user_id' => $creatorId]);

        return $id;
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

    /** @param array<string,mixed> $data */
    private function insertNotif(int $userId, string $type, ?int $actorId, ?string $ctxType, ?int $ctxId, array $data, bool $read): void
    {
        $now = gmdate('Y-m-d H:i:s');
        db_connect()->table('notifications')->insert([
            'user_id' => $userId, 'type' => $type, 'actor_user_id' => $actorId,
            'context_type' => $ctxType, 'context_id' => $ctxId,
            'data' => $data === [] ? null : json_encode($data, JSON_UNESCAPED_UNICODE),
            'read_at' => $read ? $now : null, 'created_at' => $now,
        ]);
    }

    /** @return list<array<string,mixed>> */
    private function notifs(User $u): array
    {
        return json_decode($this->actingAs($u)->get('api/v1/notifications')->getJSON(), true)['data'];
    }

    private function unread(User $u): int
    {
        return (int) json_decode($this->actingAs($u)->get('api/v1/notifications/unread-count')->getJSON(), true)['data'];
    }

    // ──────────────────────────── Lesen ────────────────────────────

    public function testListRendersTextAndLink(): void
    {
        $me    = $this->createPilot('me@flightmeet.test');
        $actor = $this->createPilot('a@flightmeet.test', ['display_name' => 'Tom']);
        $this->insertNotif((int) $me->id, 'meetup_join', (int) $actor->id, 'meetup', 12, ['meetup_title' => 'Mosel-Soaring'], false);

        $n = $this->notifs($me)[0];
        $this->assertSame('meetup_join', $n['type']);
        $this->assertSame('Tom', $n['actor']['display_name']);
        $this->assertSame('Tom nimmt an „Mosel-Soaring“ teil.', $n['text']);
        $this->assertSame('/flugtreffen/12', $n['link']);
        $this->assertNull($n['read_at']);
    }

    public function testGroupRequestLinkPointsToSettings(): void
    {
        $me = $this->createPilot('me@flightmeet.test');
        $this->insertNotif((int) $me->id, 'group_join_request', null, 'group', 5, ['group_name' => 'Rhön'], false);

        $this->assertSame('/gruppen/5/einstellungen', $this->notifs($me)[0]['link']);
    }

    public function testUnreadCount(): void
    {
        $me = $this->createPilot('me@flightmeet.test');
        $this->insertNotif((int) $me->id, 'new_message', null, 'conversation', 1, [], false);
        $this->insertNotif((int) $me->id, 'new_message', null, 'conversation', 2, [], true);

        $this->assertSame(1, $this->unread($me));
    }

    public function testMarkReadReturnsListAndSetsRead(): void
    {
        $me = $this->createPilot('me@flightmeet.test');
        $this->insertNotif((int) $me->id, 'group_feed_post', null, 'group', 1, ['group_name' => 'G'], false);
        $id = (int) db_connect()->table('notifications')->where('user_id', $me->id)->get()->getRowArray()['id'];

        $list = json_decode($this->actingAs($me)->post("api/v1/notifications/{$id}/read")->getJSON(), true)['data'];
        $this->assertNotNull($list[0]['read_at']);
        $this->assertSame(0, $this->unread($me));
    }

    public function testMarkReadForbiddenForOthersNotification(): void
    {
        $me    = $this->createPilot('me@flightmeet.test');
        $other = $this->createPilot('o@flightmeet.test');
        $this->insertNotif((int) $other->id, 'group_feed_post', null, 'group', 1, ['group_name' => 'G'], false);
        $id = (int) db_connect()->table('notifications')->where('user_id', $other->id)->get()->getRowArray()['id'];

        $this->actingAs($me)->post("api/v1/notifications/{$id}/read")->assertStatus(403);
    }

    public function testMarkAllRead(): void
    {
        $me = $this->createPilot('me@flightmeet.test');
        $this->insertNotif((int) $me->id, 'new_message', null, 'conversation', 1, [], false);
        $this->insertNotif((int) $me->id, 'group_feed_post', null, 'group', 1, ['group_name' => 'G'], false);

        $list = json_decode($this->actingAs($me)->post('api/v1/notifications/read-all')->getJSON(), true)['data'];
        $this->assertCount(2, $list);
        $this->assertSame(0, $this->unread($me));
    }

    // ──────────────────────────── Generierung: Chat ────────────────────────────

    public function testNewMessageNotificationAggregatedAndResolved(): void
    {
        $a  = $this->createPilot('a@flightmeet.test', ['display_name' => 'Anna']);
        $b  = $this->createPilot('b@flightmeet.test');
        $dm = $this->createDm((int) $a->id, (int) $b->id);

        // A sendet zwei Nachrichten → B bekommt EINE aggregierte new_message-Benachrichtigung.
        $this->actingAs($a)->withBodyFormat('json')->post("api/v1/conversations/{$dm}/messages", ['body' => 'eins']);
        $this->actingAs($a)->withBodyFormat('json')->post("api/v1/conversations/{$dm}/messages", ['body' => 'zwei']);

        $newMsg = array_values(array_filter($this->notifs($b), static fn (array $n): bool => $n['type'] === 'new_message'));
        $this->assertCount(1, $newMsg);
        $this->assertSame('Neue Nachricht von Anna.', $newMsg[0]['text']);
        $this->assertSame("/chat/{$dm}", $newMsg[0]['link']);

        // B liest die Konversation → die new_message-Benachrichtigung wird aufgelöst.
        $this->actingAs($b)->post("api/v1/conversations/{$dm}/read")->assertStatus(204);
        $stillUnread = array_filter($this->notifs($b), static fn (array $n): bool => $n['type'] === 'new_message' && $n['read_at'] === null);
        $this->assertCount(0, $stillUnread);
    }

    public function testNewMessageInAdminChannelDoesNotNotifyPlainMembers(): void
    {
        // Regression (M5-Review BOLA): die new_message-Benachrichtigung eines min_role='admin'-Channels
        // darf NUR an owner/admins gehen — member/moderator dürfen den Channel nicht lesen (403) und
        // bekämen sonst eine Benachrichtigung mit totem /chat/{id}-Link (Existenz-/Actor-Leak).
        $owner  = $this->createPilot('o@flightmeet.test');
        $admin  = $this->createPilot('a@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        $groupId = $this->createGroup((int) $owner->id, 'open', [[(int) $admin->id, 'admin'], [(int) $member->id, 'member']]);
        $adminConv = (int) model(ConversationModel::class)->insert([
            'type' => 'group_channel', 'context_type' => 'group', 'context_id' => $groupId,
            'title' => 'Orga-intern', 'position' => 1, 'is_default' => 0, 'min_role' => 'admin', 'created_by' => $owner->id,
        ], true);

        $this->actingAs($owner)->withBodyFormat('json')
            ->post("api/v1/conversations/{$adminConv}/messages", ['body' => 'nur für Admins'])->assertStatus(201);

        $isNewMsg = static fn (array $n): bool => $n['type'] === 'new_message';
        $this->assertCount(0, array_filter($this->notifs($member), $isNewMsg), 'plain member must not be notified');
        $this->assertCount(1, array_filter($this->notifs($admin), $isNewMsg), 'admin must be notified');
    }

    public function testMessageReactionNotifiesAuthor(): void
    {
        $a  = $this->createPilot('a@flightmeet.test');
        $b  = $this->createPilot('b@flightmeet.test', ['display_name' => 'Bea']);
        $dm = $this->createDm((int) $a->id, (int) $b->id);
        $mid = (int) json_decode($this->actingAs($a)->withBodyFormat('json')
            ->post("api/v1/conversations/{$dm}/messages", ['body' => 'hi'])->getJSON(), true)['data']['id'];

        $this->actingAs($b)->withBodyFormat('json')->post("api/v1/conversations/{$dm}/messages/{$mid}/reactions", ['emoji' => '🔥']);

        $reaction = array_values(array_filter($this->notifs($a), static fn (array $n): bool => $n['type'] === 'message_reaction'));
        $this->assertCount(1, $reaction);
        $this->assertSame('Bea hat auf deine Nachricht reagiert.', $reaction[0]['text']);
    }

    public function testNewMessageInGroupChannelHasChannelTextAndChannelLink(): void
    {
        $owner   = $this->createPilot('o@flightmeet.test', ['display_name' => 'Olli']);
        $member  = $this->createPilot('m@flightmeet.test');
        $groupId = $this->createGroup((int) $owner->id, 'open', [[(int) $member->id, 'member']]);
        $convId  = (int) model(ConversationModel::class)->insert([
            'type' => 'group_channel', 'context_type' => 'group', 'context_id' => $groupId,
            'title' => 'Allgemein', 'position' => 0, 'is_default' => 1, 'min_role' => 'member', 'created_by' => $owner->id,
        ], true);

        $this->actingAs($owner)->withBodyFormat('json')
            ->post("api/v1/conversations/{$convId}/messages", ['body' => 'servus'])->assertStatus(201);

        $n = array_values(array_filter($this->notifs($member), static fn (array $x): bool => $x['type'] === 'new_message'));
        $this->assertCount(1, $n);
        $this->assertSame('Neue Nachricht im Channel „Allgemein“ der Gruppe „Testgruppe“.', $n[0]['text']);
        $this->assertSame("/gruppen/{$groupId}/channels/{$convId}", $n[0]['link']);
    }

    public function testMessageReactionInGroupChannelLinksToChannelUi(): void
    {
        $owner   = $this->createPilot('o@flightmeet.test');
        $member  = $this->createPilot('m@flightmeet.test', ['display_name' => 'Mara']);
        $groupId = $this->createGroup((int) $owner->id, 'open', [[(int) $member->id, 'member']]);
        $convId  = (int) model(ConversationModel::class)->insert([
            'type' => 'group_channel', 'context_type' => 'group', 'context_id' => $groupId,
            'title' => 'Allgemein', 'position' => 0, 'is_default' => 1, 'min_role' => 'member', 'created_by' => $owner->id,
        ], true);
        $mid = (int) json_decode($this->actingAs($owner)->withBodyFormat('json')
            ->post("api/v1/conversations/{$convId}/messages", ['body' => 'hi'])->getJSON(), true)['data']['id'];

        $this->actingAs($member)->withBodyFormat('json')
            ->post("api/v1/conversations/{$convId}/messages/{$mid}/reactions", ['emoji' => '🔥']);

        $r = array_values(array_filter($this->notifs($owner), static fn (array $x): bool => $x['type'] === 'message_reaction'));
        $this->assertCount(1, $r);
        $this->assertSame("/gruppen/{$groupId}/channels/{$convId}", $r[0]['link']);
    }

    // ──────────────────────────── Generierung: Meetup ────────────────────────────

    public function testMeetupJoinNotifiesOrganizer(): void
    {
        $organizer = $this->createPilot('o@flightmeet.test');
        $joiner    = $this->createPilot('j@flightmeet.test', ['display_name' => 'Jo']);
        $meetupId  = $this->createMeetup((int) $organizer->id);

        $this->actingAs($joiner)->post("api/v1/meetups/{$meetupId}/participants")->assertStatus(200);

        $joinN = array_values(array_filter($this->notifs($organizer), static fn (array $n): bool => $n['type'] === 'meetup_join'));
        $this->assertCount(1, $joinN);
        $this->assertSame("/flugtreffen/{$meetupId}", $joinN[0]['link']);
    }

    public function testMeetupCancelNotifiesParticipants(): void
    {
        $organizer = $this->createPilot('o@flightmeet.test');
        $joiner    = $this->createPilot('j@flightmeet.test');
        $meetupId  = $this->createMeetup((int) $organizer->id);
        $this->actingAs($joiner)->post("api/v1/meetups/{$meetupId}/participants");

        $this->actingAs($organizer)->withBodyFormat('json')->patch("api/v1/meetups/{$meetupId}", ['status' => 'cancelled'])->assertStatus(200);

        $cancelN = array_values(array_filter($this->notifs($joiner), static fn (array $n): bool => $n['type'] === 'meetup_cancelled'));
        $this->assertCount(1, $cancelN);
    }

    // ──────────────────────────── Generierung: Gruppe ────────────────────────────

    public function testGroupJoinRequestNotifiesOwner(): void
    {
        $owner     = $this->createPilot('o@flightmeet.test');
        $requester = $this->createPilot('r@flightmeet.test', ['display_name' => 'Rudi']);
        $groupId   = $this->createGroup((int) $owner->id, 'request');

        $this->actingAs($requester)->withBodyFormat('json')->post("api/v1/groups/{$groupId}/join-requests", ['message' => 'bitte'])->assertStatus(200);

        $reqN = array_values(array_filter($this->notifs($owner), static fn (array $n): bool => $n['type'] === 'group_join_request'));
        $this->assertCount(1, $reqN);
        $this->assertSame('Rudi möchte dem „Testgruppe“ beitreten.', $reqN[0]['text']);
    }

    public function testGroupApproveNotifiesRequester(): void
    {
        $owner     = $this->createPilot('o@flightmeet.test');
        $requester = $this->createPilot('r@flightmeet.test');
        $groupId   = $this->createGroup((int) $owner->id, 'request');
        $this->actingAs($requester)->withBodyFormat('json')->post("api/v1/groups/{$groupId}/join-requests", ['message' => 'bitte']);
        $reqId = (int) model(GroupJoinRequestModel::class)->where('group_id', $groupId)->where('user_id', $requester->id)->first()['id'];

        $this->actingAs($owner)->post("api/v1/groups/{$groupId}/join-requests/{$reqId}/approve")->assertStatus(200);

        $approved = array_values(array_filter($this->notifs($requester), static fn (array $n): bool => $n['type'] === 'group_request_approved'));
        $this->assertCount(1, $approved);
    }

    public function testGroupInviteNotifiesInvitee(): void
    {
        $owner   = $this->createPilot('o@flightmeet.test');
        $invitee = $this->createPilot('i@flightmeet.test');
        $groupId = $this->createGroup((int) $owner->id, 'invite_only');

        $this->actingAs($owner)->withBodyFormat('json')->post("api/v1/groups/{$groupId}/invites", ['user_id' => $invitee->id])->assertStatus(200);

        $inviteN = array_values(array_filter($this->notifs($invitee), static fn (array $n): bool => $n['type'] === 'group_invite'));
        $this->assertCount(1, $inviteN);
    }

    public function testGroupFeedPostNotifiesMembers(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        $groupId = $this->createGroup((int) $owner->id, 'open', [[(int) $member->id, 'member']]);

        $this->actingAs($owner)->withBodyFormat('json')->post("api/v1/groups/{$groupId}/feed", ['title' => 'Hi', 'body' => 'Saisonstart!'])->assertStatus(201);

        $feedN = array_values(array_filter($this->notifs($member), static fn (array $n): bool => $n['type'] === 'group_feed_post'));
        $this->assertCount(1, $feedN);
        // Der Autor selbst bekommt keine Benachrichtigung.
        $this->assertCount(0, array_filter($this->notifs($owner), static fn (array $n): bool => $n['type'] === 'group_feed_post'));
    }
}
