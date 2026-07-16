<?php

use App\Models\ConversationModel;
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
 * Feature-Tests der Gruppen-Verwaltung (M4 Slice 4, API.md §6.9 / §6.13 / §6.14–§6.18): Rollen-Hierarchie,
 * Ban/Kick, Eigentums-Transfer-Invariante, Antrags-Genehmigung/-Ablehnung, Einladungen (Token/gerichtet)
 * + Annahme (gültig/abgelaufen/erschöpft/gebannt) + Vorschau.
 *
 * @internal
 */
final class GroupAdminTest extends CIUnitTestCase
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
    private function createGroup(int $ownerId, array $o = []): int
    {
        $id = (int) model(GroupModel::class)->insert(array_merge([
            'slug'          => 'g-' . bin2hex(random_bytes(6)),
            'name'          => 'Testgruppe',
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

    private function pendingRequest(int $groupId, int $userId): int
    {
        return (int) model(GroupJoinRequestModel::class)->insert(['group_id' => $groupId, 'user_id' => $userId, 'message' => 'bitte', 'status' => 'pending'], true);
    }

    /** @param array<string, mixed> $o */
    private function makeInvite(int $groupId, int $invitedBy, array $o = []): array
    {
        $row = array_merge(['group_id' => $groupId, 'invited_by' => $invitedBy, 'token' => bin2hex(random_bytes(8)), 'status' => 'pending', 'uses_count' => 0], $o);
        model(GroupInviteModel::class)->insert($row);

        return $row;
    }

    /** @param list<array<string, mixed>> $members */
    private function roleOf(array $members, int $userId): ?string
    {
        foreach ($members as $m) {
            if ($m['user']['id'] === $userId) {
                return $m['role'];
            }
        }

        return null;
    }

    // ───────────────────────────── Rollen ─────────────────────────────

    public function testOwnerPromotesMemberToModerator(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        $id     = $this->createGroup($owner->id);
        $this->addMember($id, $member->id);

        $members = json_decode($this->actingAs($owner)->withBodyFormat('json')
            ->patch("api/v1/groups/{$id}/members/{$member->id}", ['role' => 'moderator'])->getJSON(), true)['data'];

        $this->assertSame('moderator', $this->roleOf($members, (int) $member->id));
    }

    public function testAdminCannotGrantAdmin(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $admin  = $this->createPilot('a@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        $id     = $this->createGroup($owner->id);
        $this->addMember($id, $admin->id, 'admin');
        $this->addMember($id, $member->id);

        $res = $this->actingAs($admin)->withBodyFormat('json')->patch("api/v1/groups/{$id}/members/{$member->id}", ['role' => 'admin']);

        $res->assertStatus(403);
        $this->assertSame('forbidden_role', json_decode($res->getJSON(), true)['error']['code']);
    }

    public function testOwnerGrantsAdmin(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        $id     = $this->createGroup($owner->id);
        $this->addMember($id, $member->id);

        $members = json_decode($this->actingAs($owner)->withBodyFormat('json')
            ->patch("api/v1/groups/{$id}/members/{$member->id}", ['role' => 'admin'])->getJSON(), true)['data'];

        $this->assertSame('admin', $this->roleOf($members, (int) $member->id));
    }

    public function testCannotChangeOwnRole(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $admin = $this->createPilot('a@flightmeet.test');
        $id    = $this->createGroup($owner->id);
        $this->addMember($id, $admin->id, 'admin');

        $this->actingAs($admin)->withBodyFormat('json')
            ->patch("api/v1/groups/{$id}/members/{$admin->id}", ['role' => 'moderator'])->assertStatus(403);
    }

    public function testCannotChangeOwnerRole(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $admin = $this->createPilot('a@flightmeet.test');
        $id    = $this->createGroup($owner->id);
        $this->addMember($id, $admin->id, 'admin');

        $this->actingAs($admin)->withBodyFormat('json')
            ->patch("api/v1/groups/{$id}/members/{$owner->id}", ['role' => 'member'])->assertStatus(403);
    }

    // ───────────────────────────── Ban / Kick ─────────────────────────────

    public function testKickMember(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        $id     = $this->createGroup($owner->id);
        $this->addMember($id, $member->id);

        $members = json_decode($this->actingAs($owner)->delete("api/v1/groups/{$id}/members/{$member->id}")->getJSON(), true)['data'];

        $this->assertNull($this->roleOf($members, (int) $member->id));
        $this->assertSame(1, (int) model(GroupModel::class)->find($id)['members_count']);
    }

    public function testModeratorCannotKickAdmin(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $mod   = $this->createPilot('mod@flightmeet.test');
        $admin = $this->createPilot('a@flightmeet.test');
        $id    = $this->createGroup($owner->id);
        $this->addMember($id, $mod->id, 'moderator');
        $this->addMember($id, $admin->id, 'admin');

        $this->actingAs($mod)->delete("api/v1/groups/{$id}/members/{$admin->id}")->assertStatus(403);
    }

    public function testToggleBanReducesActiveCount(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        $id     = $this->createGroup($owner->id);
        $this->addMember($id, $member->id);

        $members = json_decode($this->actingAs($owner)->post("api/v1/groups/{$id}/members/{$member->id}/ban")->getJSON(), true)['data'];
        $banned  = array_values(array_filter($members, static fn (array $m): bool => $m['user']['id'] === (int) $member->id))[0];
        $this->assertSame('banned', $banned['status']);
        $this->assertSame(1, (int) model(GroupModel::class)->find($id)['members_count']);

        // erneut → entbannen
        $this->actingAs($owner)->post("api/v1/groups/{$id}/members/{$member->id}/ban");
        $this->assertSame(2, (int) model(GroupModel::class)->find($id)['members_count']);
    }

    public function testCannotBanOwner(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $admin = $this->createPilot('a@flightmeet.test');
        $id    = $this->createGroup($owner->id);
        $this->addMember($id, $admin->id, 'admin');

        $this->actingAs($admin)->post("api/v1/groups/{$id}/members/{$owner->id}/ban")->assertStatus(403);
    }

    // ───────────────────────────── Transfer ─────────────────────────────

    public function testTransferOwnership(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        $id     = $this->createGroup($owner->id);
        $this->addMember($id, $member->id);

        $members = json_decode($this->actingAs($owner)->withBodyFormat('json')
            ->post("api/v1/groups/{$id}/transfer", ['user_id' => $member->id])->getJSON(), true)['data'];

        $this->assertSame('owner', $this->roleOf($members, (int) $member->id));
        $this->assertSame('admin', $this->roleOf($members, (int) $owner->id));
        $this->assertSame((int) $member->id, (int) model(GroupModel::class)->find($id)['owner_user_id']);
        $this->assertSame(1, model(GroupMemberModel::class)->where('group_id', $id)->where('role', 'owner')->countAllResults());
    }

    public function testTransferRequiresOwner(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $admin  = $this->createPilot('a@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        $id     = $this->createGroup($owner->id);
        $this->addMember($id, $admin->id, 'admin');
        $this->addMember($id, $member->id);

        $this->actingAs($admin)->withBodyFormat('json')
            ->post("api/v1/groups/{$id}/transfer", ['user_id' => $member->id])->assertStatus(403);
    }

    // ───────────────────────────── Anträge ─────────────────────────────

    public function testApproveRequestCreatesMember(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $user  = $this->createPilot('u@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['join_policy' => 'request']);
        $reqId = $this->pendingRequest($id, (int) $user->id);

        $reqs = json_decode($this->actingAs($owner)->post("api/v1/groups/{$id}/join-requests/{$reqId}/approve")->getJSON(), true)['data'];

        $this->assertSame([], $reqs); // keine offenen mehr
        $this->assertSame(1, model(GroupMemberModel::class)->where('group_id', $id)->where('user_id', $user->id)->where('status', 'active')->countAllResults());
        $this->assertSame('approved', model(GroupJoinRequestModel::class)->find($reqId)['status']);
        $this->assertSame(2, (int) model(GroupModel::class)->find($id)['members_count']);
    }

    public function testApproveRequestForbiddenForNonManager(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $user  = $this->createPilot('u@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['join_policy' => 'request']);
        $reqId = $this->pendingRequest($id, (int) $user->id);

        $this->actingAs($user)->post("api/v1/groups/{$id}/join-requests/{$reqId}/approve")->assertStatus(403);
    }

    public function testRejectRequest(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $user  = $this->createPilot('u@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['join_policy' => 'request']);
        $reqId = $this->pendingRequest($id, (int) $user->id);

        $this->actingAs($owner)->post("api/v1/groups/{$id}/join-requests/{$reqId}/reject");

        $this->assertSame('rejected', model(GroupJoinRequestModel::class)->find($reqId)['status']);
        $this->assertSame(0, model(GroupMemberModel::class)->where('group_id', $id)->where('user_id', $user->id)->countAllResults());
    }

    // ───────────────────────────── Invites ─────────────────────────────

    public function testCreateTokenInvite(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['join_policy' => 'invite_only']);

        $invites = json_decode($this->actingAs($owner)->post("api/v1/groups/{$id}/invites")->getJSON(), true)['data'];

        $this->assertCount(1, $invites);
        $this->assertNotNull($invites[0]['token']);
        $this->assertNull($invites[0]['invited_user']);
        $this->assertSame('pending', $invites[0]['status']);
    }

    public function testCreateDirectedInvite(): void
    {
        $owner   = $this->createPilot('o@flightmeet.test');
        $invitee = $this->createPilot('i@flightmeet.test', ['display_name' => 'Invitee P']);
        $id      = $this->createGroup($owner->id, ['join_policy' => 'invite_only']);

        $invites = json_decode($this->actingAs($owner)->withBodyFormat('json')
            ->post("api/v1/groups/{$id}/invites", ['user_id' => $invitee->id])->getJSON(), true)['data'];

        $this->assertNull($invites[0]['token']);
        $this->assertSame('Invitee P', $invites[0]['invited_user']['display_name']);
    }

    public function testRevokeInvite(): void
    {
        $owner    = $this->createPilot('o@flightmeet.test');
        $id       = $this->createGroup($owner->id, ['join_policy' => 'invite_only']);
        $inviteId = (int) model(GroupInviteModel::class)->insert(['group_id' => $id, 'invited_by' => $owner->id, 'token' => 'tok', 'status' => 'pending'], true);

        $invites = json_decode($this->actingAs($owner)->delete("api/v1/groups/{$id}/invites/{$inviteId}")->getJSON(), true)['data'];

        $this->assertSame('revoked', $invites[0]['status']);
    }

    // ───────────────────────────── Token-Annahme ─────────────────────────────

    public function testAcceptTokenInvite(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $user  = $this->createPilot('u@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['join_policy' => 'invite_only']);
        $inv   = $this->makeInvite($id, (int) $owner->id, ['max_uses' => 5]);

        $res = $this->actingAs($user)->post("api/v1/invites/{$inv['token']}/accept");

        $res->assertStatus(201);
        $this->assertTrue(json_decode($res->getJSON(), true)['data']['joined']);
        $this->assertSame(1, model(GroupMemberModel::class)->where('group_id', $id)->where('user_id', $user->id)->where('status', 'active')->countAllResults());
        $this->assertSame(1, (int) model(GroupInviteModel::class)->where('token', $inv['token'])->first()['uses_count']);
    }

    public function testAcceptExpiredInvite(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $user  = $this->createPilot('u@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['join_policy' => 'invite_only']);
        $inv   = $this->makeInvite($id, (int) $owner->id, ['expires_at' => gmdate('Y-m-d H:i:s', time() - 3600)]);

        $res = $this->actingAs($user)->post("api/v1/invites/{$inv['token']}/accept");

        $res->assertStatus(410);
        $this->assertSame('invite_expired', json_decode($res->getJSON(), true)['error']['code']);
    }

    public function testAcceptExhaustedInvite(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $user  = $this->createPilot('u@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['join_policy' => 'invite_only']);
        $inv   = $this->makeInvite($id, (int) $owner->id, ['max_uses' => 1, 'uses_count' => 1]);

        $res = $this->actingAs($user)->post("api/v1/invites/{$inv['token']}/accept");

        $res->assertStatus(409);
        $this->assertSame('invite_exhausted', json_decode($res->getJSON(), true)['error']['code']);
    }

    public function testAcceptBannedRejected(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $user  = $this->createPilot('u@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['join_policy' => 'invite_only']);
        $this->addMember($id, $user->id, 'member', 'banned');
        $inv = $this->makeInvite($id, (int) $owner->id);

        $res = $this->actingAs($user)->post("api/v1/invites/{$inv['token']}/accept");

        $res->assertStatus(403);
        $this->assertSame('group_member_banned', json_decode($res->getJSON(), true)['error']['code']);
    }

    public function testInvitePreview(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['name' => 'Vorschau', 'join_policy' => 'invite_only']);
        $inv   = $this->makeInvite($id, (int) $owner->id, ['max_uses' => 3]);

        $d = json_decode($this->get("api/v1/invites/{$inv['token']}")->getJSON(), true)['data'];

        $this->assertSame('Vorschau', $d['group']['name']);
        $this->assertTrue($d['valid']);
        $this->assertFalse($d['expired']);
        $this->assertSame(3, $d['uses_left']);
    }
}
