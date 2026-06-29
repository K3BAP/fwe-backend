<?php

use App\Models\ConversationModel;
use App\Models\FeedPostModel;
use App\Models\FeedPostReactionModel;
use App\Models\GroupInviteModel;
use App\Models\GroupJoinRequestModel;
use App\Models\GroupMemberModel;
use App\Models\GroupModel;
use App\Models\ProfileModel;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;
use CodeIgniter\Shield\Test\AuthenticationTesting;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;

/**
 * Feature-Tests der Gruppen-Lese-Endpunkte (M4 Slice 2, API.md §6–8): Verzeichnis-Sichtbarkeit,
 * Detail (inkl. Existenz-Karte bei privat), Mitglieder, Feed (pinned-first, Reaktionen, soft-delete),
 * Anträge/Invites (Verwaltungsrecht) und Channels (min_role). Schreiben folgt in den weiteren Slices.
 *
 * @internal
 */
final class GroupReadTest extends CIUnitTestCase
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

    /** Legt eine Gruppe + Owner-Mitgliedschaft + Default-Channel an. @param array<string, mixed> $o */
    private function createGroup(int $ownerId, array $o = []): int
    {
        $id = (int) model(GroupModel::class)->insert(array_merge([
            'slug'          => 'g-' . bin2hex(random_bytes(6)),
            'name'          => 'Testgruppe',
            'description'   => 'Beschreibung',
            'region'        => 'Testregion',
            'tags'          => json_encode(['alpen', 'test'], JSON_UNESCAPED_UNICODE),
            'rules_text'    => 'Regeln',
            'visibility'    => 'public',
            'join_policy'   => 'open',
            'owner_user_id' => $ownerId,
            'members_count' => 1,
        ], $o), true);

        model(GroupMemberModel::class)->insert(['group_id' => $id, 'user_id' => $ownerId, 'role' => 'owner', 'status' => 'active']);
        model(ConversationModel::class)->insert([
            'type' => 'group_channel', 'context_type' => 'group', 'context_id' => $id,
            'title' => 'Allgemein', 'position' => 0, 'is_default' => 1, 'min_role' => 'member', 'created_by' => $ownerId,
        ]);

        return $id;
    }

    private function addMember(int $groupId, int $userId, string $role = 'member', string $status = 'active'): void
    {
        model(GroupMemberModel::class)->insert(['group_id' => $groupId, 'user_id' => $userId, 'role' => $role, 'status' => $status]);
        if ($status === 'active') {
            db_connect()->table('groups')->where('id', $groupId)->set('members_count', 'members_count + 1', false)->update();
        }
    }

    private function addChannel(int $groupId, string $title, string $minRole, int $ownerId, int $position): void
    {
        model(ConversationModel::class)->insert([
            'type' => 'group_channel', 'context_type' => 'group', 'context_id' => $groupId,
            'title' => $title, 'position' => $position, 'is_default' => 0, 'min_role' => $minRole, 'created_by' => $ownerId,
        ]);
    }

    /** @param array<string, mixed> $o */
    private function createPost(int $groupId, int $authorId, array $o = []): int
    {
        return (int) model(FeedPostModel::class)->insert(array_merge([
            'group_id'       => $groupId,
            'author_user_id' => $authorId,
            'title'          => null,
            'body'           => 'Inhalt',
            'is_pinned'      => 0,
        ], $o), true);
    }

    private function get_data(string $path): mixed
    {
        return json_decode($this->get($path)->getJSON(), true)['data'];
    }

    // ───────────────────────────── Verzeichnis ─────────────────────────────

    public function testListGuestSeesOnlyPublic(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $this->createGroup($owner->id, ['name' => 'Öffentlich', 'visibility' => 'public']);
        $this->createGroup($owner->id, ['name' => 'Privat', 'visibility' => 'private']);
        $this->createGroup($owner->id, ['name' => 'Unlisted', 'visibility' => 'unlisted']);

        $names = array_column($this->get_data('api/v1/groups'), 'name');

        $this->assertSame(['Öffentlich'], $names);
    }

    public function testListMemberSeesOwnPrivateAndUnlisted(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $viewer = $this->createPilot('v@flightmeet.test');
        $this->createGroup($owner->id, ['name' => 'Öffentlich', 'visibility' => 'public']);
        $priv = $this->createGroup($owner->id, ['name' => 'Privat', 'visibility' => 'private']);
        $this->createGroup($owner->id, ['name' => 'FremdPrivat', 'visibility' => 'private']);
        $this->addMember($priv, $viewer->id);

        $names = array_column(json_decode($this->actingAs($viewer)->get('api/v1/groups')->getJSON(), true)['data'], 'name');

        sort($names);
        $this->assertSame(['Privat', 'Öffentlich'], $names);
    }

    // ───────────────────────────── Detail ─────────────────────────────

    public function testDetailShape(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['name' => 'Detailgruppe']);

        $d = $this->get_data("api/v1/groups/{$id}");

        $this->assertSame('Detailgruppe', $d['name']);
        $this->assertSame(['alpen', 'test'], $d['tags']);
        $this->assertSame((int) $owner->id, $d['owner_user_id']);
        $this->assertNull($d['my_membership']);
        $this->assertFalse($d['can_manage']);
        $this->assertFalse($d['has_pending_request']);
        $this->assertArrayHasKey('rules_text', $d);
    }

    public function testDetailPrivateNonMemberGetsExistenceCard(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['visibility' => 'private', 'name' => 'Geheim']);

        $res = $this->get("api/v1/groups/{$id}");

        $res->assertStatus(200);
        $d = json_decode($res->getJSON(), true)['data'];
        $this->assertSame('Geheim', $d['name']);
        $this->assertNull($d['my_membership']);
    }

    public function testDetailNotFound(): void
    {
        $res = $this->get('api/v1/groups/9999');
        $res->assertStatus(404);
        $this->assertSame('group_not_found', json_decode($res->getJSON(), true)['error']['code']);
    }

    public function testDetailOwnerCanManage(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id);

        $d = json_decode($this->actingAs($owner)->get("api/v1/groups/{$id}")->getJSON(), true)['data'];

        $this->assertSame('owner', $d['my_membership']['role']);
        $this->assertTrue($d['can_manage']);
    }

    public function testDetailMemberCannotManage(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        $id     = $this->createGroup($owner->id);
        $this->addMember($id, $member->id);

        $d = json_decode($this->actingAs($member)->get("api/v1/groups/{$id}")->getJSON(), true)['data'];

        $this->assertSame('member', $d['my_membership']['role']);
        $this->assertFalse($d['can_manage']);
    }

    public function testDetailHasPendingRequest(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $user  = $this->createPilot('u@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['join_policy' => 'request']);
        model(GroupJoinRequestModel::class)->insert(['group_id' => $id, 'user_id' => $user->id, 'message' => 'bitte', 'status' => 'pending']);

        $d = json_decode($this->actingAs($user)->get("api/v1/groups/{$id}")->getJSON(), true)['data'];

        $this->assertTrue($d['has_pending_request']);
    }

    // ───────────────────────────── Mitglieder ─────────────────────────────

    public function testMembersOrderedOwnerFirstWithCards(): void
    {
        $owner = $this->createPilot('o@flightmeet.test', ['display_name' => 'Owner P']);
        $mod   = $this->createPilot('mod@flightmeet.test');
        $id    = $this->createGroup($owner->id);
        $this->addMember($id, $mod->id, 'moderator');

        $members = $this->get_data("api/v1/groups/{$id}/members");

        $this->assertSame('owner', $members[0]['role']);
        $this->assertSame('Owner P', $members[0]['user']['display_name']);
        $this->assertSame('moderator', $members[1]['role']);
        $this->assertArrayHasKey('handle', $members[0]['user']);
    }

    public function testMembersPrivateForbiddenForNonMember(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['visibility' => 'private']);

        $res = $this->get("api/v1/groups/{$id}/members");

        $res->assertStatus(403);
        $this->assertSame('forbidden_role', json_decode($res->getJSON(), true)['error']['code']);
    }

    // ───────────────────────────── Feed ─────────────────────────────

    public function testFeedPinnedFirstAndSoftDeletedExcluded(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id);
        $this->createPost($id, $owner->id, ['title' => 'Normal', 'body' => 'eins']);
        $this->createPost($id, $owner->id, ['title' => 'Gepinnt', 'body' => 'zwei', 'is_pinned' => 1]);
        $this->createPost($id, $owner->id, ['title' => 'Gelöscht', 'body' => 'drei', 'deleted_at' => gmdate('Y-m-d H:i:s'), 'deleted_by' => $owner->id]);

        $feed = $this->get_data("api/v1/groups/{$id}/feed");

        $this->assertCount(2, $feed);
        $this->assertSame('Gepinnt', $feed[0]['title']);
        $this->assertTrue($feed[0]['is_pinned']);
        $this->assertArrayHasKey('display_name', $feed[0]['author']);
    }

    public function testFeedReactionsAggregatedWithMe(): void
    {
        $owner   = $this->createPilot('o@flightmeet.test');
        $other   = $this->createPilot('x@flightmeet.test');
        $id      = $this->createGroup($owner->id);
        $postId  = $this->createPost($id, $owner->id, ['body' => 'react']);
        model(FeedPostReactionModel::class)->insert(['feed_post_id' => $postId, 'user_id' => $owner->id, 'emoji' => '🔥']);
        model(FeedPostReactionModel::class)->insert(['feed_post_id' => $postId, 'user_id' => $other->id, 'emoji' => '🔥']);
        model(FeedPostReactionModel::class)->insert(['feed_post_id' => $postId, 'user_id' => $owner->id, 'emoji' => '🪂']);

        $feed = json_decode($this->actingAs($owner)->get("api/v1/groups/{$id}/feed")->getJSON(), true)['data'];

        $reactions = $feed[0]['reactions'];
        $fire      = array_values(array_filter($reactions, static fn (array $r): bool => $r['emoji'] === '🔥'))[0];
        $wing      = array_values(array_filter($reactions, static fn (array $r): bool => $r['emoji'] === '🪂'))[0];
        $this->assertSame(2, $fire['count']);
        $this->assertTrue($fire['me']);
        $this->assertSame(1, $wing['count']);
    }

    public function testFeedPrivateForbiddenForNonMember(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['visibility' => 'private']);

        $this->get("api/v1/groups/{$id}/feed")->assertStatus(403);
    }

    // ───────────────────────── Anträge / Invites ─────────────────────────

    public function testJoinRequestsRequireManagerAndShowPendingOnly(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $u1    = $this->createPilot('u1@flightmeet.test');
        $u2    = $this->createPilot('u2@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['join_policy' => 'request']);
        model(GroupJoinRequestModel::class)->insert(['group_id' => $id, 'user_id' => $u1->id, 'message' => 'a', 'status' => 'pending']);
        model(GroupJoinRequestModel::class)->insert(['group_id' => $id, 'user_id' => $u2->id, 'message' => 'b', 'status' => 'rejected']);

        $this->get("api/v1/groups/{$id}/join-requests")->assertStatus(403); // Gast

        $reqs = json_decode($this->actingAs($owner)->get("api/v1/groups/{$id}/join-requests")->getJSON(), true)['data'];
        $this->assertCount(1, $reqs);
        $this->assertSame('pending', $reqs[0]['status']);
    }

    public function testInvitesRequireManager(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['join_policy' => 'invite_only']);
        model(GroupInviteModel::class)->insert(['group_id' => $id, 'invited_by' => $owner->id, 'token' => 'tok123', 'status' => 'pending']);

        $this->get("api/v1/groups/{$id}/invites")->assertStatus(403);

        $invites = json_decode($this->actingAs($owner)->get("api/v1/groups/{$id}/invites")->getJSON(), true)['data'];
        $this->assertCount(1, $invites);
        $this->assertSame('tok123', $invites[0]['token']);
        $this->assertNull($invites[0]['invited_user']);
    }

    // ───────────────────────────── Channels ─────────────────────────────

    public function testChannelsMemberSeesMemberChannelsOnly(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        $id     = $this->createGroup($owner->id);
        $this->addMember($id, $member->id);
        $this->addChannel($id, 'Orga-intern', 'admin', $owner->id, 1);

        $chans = json_decode($this->actingAs($member)->get("api/v1/groups/{$id}/channels")->getJSON(), true)['data'];

        $titles = array_column($chans, 'name');
        $this->assertSame(['Allgemein'], $titles);
        $this->assertTrue($chans[0]['is_default']);
        $this->assertSame(0, $chans[0]['unread_count']);
    }

    public function testChannelsOwnerSeesAdminChannel(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id);
        $this->addChannel($id, 'Orga-intern', 'admin', $owner->id, 1);

        $chans = json_decode($this->actingAs($owner)->get("api/v1/groups/{$id}/channels")->getJSON(), true)['data'];

        $this->assertSame(['Allgemein', 'Orga-intern'], array_column($chans, 'name'));
    }

    public function testChannelsForbiddenForNonMember(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id);

        $this->get("api/v1/groups/{$id}/channels")->assertStatus(403);
    }
}
