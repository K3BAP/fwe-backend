<?php

use App\Models\ConversationModel;
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
 * Feature-Tests der schreibenden Gruppen-Endpunkte (M4 Slice 3, API.md §6.3–§6.6/§6.8/§6.11):
 * Gründen (Owner + Default-Channel + Slug), Bearbeiten (BOLA), Soft-Delete (nur Owner), Beitritt
 * (open/Ban/mismatch/already), Austritt (owner_must_transfer), Antrag + Zurückziehen.
 *
 * @internal
 */
final class GroupWriteTest extends CIUnitTestCase
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

    /** @param array<string, mixed> $o */
    private function validPayload(array $o = []): array
    {
        return array_merge([
            'name'        => 'Neue Gruppe',
            'description' => 'Beschreibung',
            'region'      => 'Allgäu',
            'tags'        => ['alpen'],
            'rules_text'  => 'Regeln',
            'visibility'  => 'public',
            'join_policy' => 'open',
        ], $o);
    }

    // ───────────────────────────── Gründen ─────────────────────────────

    public function testCreateRequiresAuth(): void
    {
        $this->withBodyFormat('json')->post('api/v1/groups', $this->validPayload())->assertStatus(401);
    }

    public function testCreateMakesOwnerAndDefaultChannel(): void
    {
        $user = $this->createPilot('o@flightmeet.test');

        $res = $this->actingAs($user)->withBodyFormat('json')->post('api/v1/groups', $this->validPayload(['name' => 'Alpenflieger']));

        $res->assertStatus(201);
        $d = json_decode($res->getJSON(), true)['data'];
        $this->assertSame('Alpenflieger', $d['name']);
        $this->assertSame('alpenflieger', $d['slug']);
        $this->assertSame((int) $user->id, $d['owner_user_id']);
        $this->assertSame('owner', $d['my_membership']['role']);
        $this->assertTrue($d['can_manage']);
        $this->assertSame(1, $d['members_count']);
        $this->assertSame(['alpen'], $d['tags']);

        $this->assertSame(1, model(GroupMemberModel::class)->where('group_id', $d['id'])->where('role', 'owner')->countAllResults());
        $this->assertSame(1, model(ConversationModel::class)->where('context_id', $d['id'])->where('is_default', 1)->countAllResults());
    }

    public function testCreateSlugGetsUniqueSuffix(): void
    {
        $user = $this->createPilot('o@flightmeet.test');
        $a    = json_decode($this->actingAs($user)->withBodyFormat('json')->post('api/v1/groups', $this->validPayload(['name' => 'Gleiche'])) ->getJSON(), true)['data'];
        $b    = json_decode($this->actingAs($user)->withBodyFormat('json')->post('api/v1/groups', $this->validPayload(['name' => 'Gleiche']))->getJSON(), true)['data'];

        $this->assertSame('gleiche', $a['slug']);
        $this->assertSame('gleiche-2', $b['slug']);
    }

    public function testCreateValidationErrors(): void
    {
        $user = $this->createPilot('o@flightmeet.test');

        $this->actingAs($user)->withBodyFormat('json')->post('api/v1/groups', $this->validPayload(['name' => 'ab']))->assertStatus(422);
        $this->actingAs($user)->withBodyFormat('json')->post('api/v1/groups', $this->validPayload(['visibility' => 'bogus']))->assertStatus(422);
    }

    // ───────────────────────────── Bearbeiten ─────────────────────────────

    public function testUpdateByOwner(): void
    {
        $user = $this->createPilot('o@flightmeet.test');
        $id   = $this->createGroup($user->id);

        $d = json_decode($this->actingAs($user)->withBodyFormat('json')
            ->patch("api/v1/groups/{$id}", ['name' => 'Umbenannt', 'visibility' => 'unlisted'])->getJSON(), true)['data'];

        $this->assertSame('Umbenannt', $d['name']);
        $this->assertSame('unlisted', $d['visibility']);
    }

    public function testUpdateForbiddenForNonManager(): void
    {
        $owner    = $this->createPilot('o@flightmeet.test');
        $stranger = $this->createPilot('s@flightmeet.test');
        $id       = $this->createGroup($owner->id);

        $res = $this->actingAs($stranger)->withBodyFormat('json')->patch("api/v1/groups/{$id}", ['name' => 'Hijack']);

        $res->assertStatus(403);
        $this->assertSame('forbidden_role', json_decode($res->getJSON(), true)['error']['code']);
    }

    public function testUpdateSiteAdminOverride(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $admin = $this->createPilot('a@flightmeet.test');
        $admin->addGroup('admin');
        $id = $this->createGroup($owner->id);

        $this->actingAs($admin)->withBodyFormat('json')
            ->patch("api/v1/groups/{$id}", ['name' => 'Admin-Edit'])->assertStatus(200);
    }

    // ───────────────────────────── Löschen ─────────────────────────────

    public function testDeleteByOwnerSoftDeletes(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id);

        $this->actingAs($owner)->delete("api/v1/groups/{$id}")->assertStatus(204);

        $this->get("api/v1/groups/{$id}")->assertStatus(404);
        $this->assertNotNull(model(GroupModel::class)->find($id)['deleted_at']);
        $this->assertSame(0, model(ConversationModel::class)->where('context_id', $id)->where('deleted_at', null)->countAllResults());
    }

    public function testDeleteForbiddenForGroupAdmin(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $admin = $this->createPilot('a@flightmeet.test');
        $id    = $this->createGroup($owner->id);
        $this->addMember($id, $admin->id, 'admin');

        $res = $this->actingAs($admin)->delete("api/v1/groups/{$id}");

        $res->assertStatus(403); // Gruppen-Admin darf nicht löschen, nur Owner
        $this->assertNull(model(GroupModel::class)->find($id)['deleted_at']);
    }

    // ───────────────────────────── Beitritt ─────────────────────────────

    public function testJoinOpenGroup(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $user  = $this->createPilot('u@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['join_policy' => 'open']);

        $d = json_decode($this->actingAs($user)->post("api/v1/groups/{$id}/members")->getJSON(), true)['data'];

        $this->assertSame('member', $d['my_membership']['role']);
        $this->assertSame(2, $d['members_count']);
    }

    public function testJoinAlreadyMember(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id);

        $res = $this->actingAs($owner)->post("api/v1/groups/{$id}/members");

        $res->assertStatus(409);
        $this->assertSame('already_member', json_decode($res->getJSON(), true)['error']['code']);
    }

    public function testJoinBanned(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $user  = $this->createPilot('u@flightmeet.test');
        $id    = $this->createGroup($owner->id);
        $this->addMember($id, $user->id, 'member', 'banned');

        $res = $this->actingAs($user)->post("api/v1/groups/{$id}/members");

        $res->assertStatus(403);
        $this->assertSame('group_member_banned', json_decode($res->getJSON(), true)['error']['code']);
    }

    public function testJoinPolicyMismatch(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $user  = $this->createPilot('u@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['join_policy' => 'request']);

        $res = $this->actingAs($user)->post("api/v1/groups/{$id}/members");

        $res->assertStatus(409);
        $this->assertSame('join_policy_mismatch', json_decode($res->getJSON(), true)['error']['code']);
    }

    // ───────────────────────────── Austritt ─────────────────────────────

    public function testLeaveGroup(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $user  = $this->createPilot('u@flightmeet.test');
        $id    = $this->createGroup($owner->id);
        $this->addMember($id, $user->id);

        $d = json_decode($this->actingAs($user)->delete("api/v1/groups/{$id}/members")->getJSON(), true)['data'];

        $this->assertNull($d['my_membership']);
        $this->assertSame(1, $d['members_count']);
    }

    public function testLeaveOwnerMustTransfer(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id);

        $res = $this->actingAs($owner)->delete("api/v1/groups/{$id}/members");

        $res->assertStatus(409);
        $this->assertSame('owner_must_transfer', json_decode($res->getJSON(), true)['error']['code']);
    }

    // ───────────────────────────── Anträge ─────────────────────────────

    public function testRequestJoin(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $user  = $this->createPilot('u@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['join_policy' => 'request']);

        $d = json_decode($this->actingAs($user)->withBodyFormat('json')
            ->post("api/v1/groups/{$id}/join-requests", ['message' => 'Bitte aufnehmen'])->getJSON(), true)['data'];

        $this->assertTrue($d['has_pending_request']);
        $this->assertNull($d['my_membership']);
        $this->assertSame(1, model(GroupJoinRequestModel::class)->where('group_id', $id)->where('status', 'pending')->countAllResults());
    }

    public function testRequestJoinNoDuplicate(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $user  = $this->createPilot('u@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['join_policy' => 'request']);

        $this->actingAs($user)->withBodyFormat('json')->post("api/v1/groups/{$id}/join-requests", ['message' => 'a']);
        $this->actingAs($user)->withBodyFormat('json')->post("api/v1/groups/{$id}/join-requests", ['message' => 'b']);

        $this->assertSame(1, model(GroupJoinRequestModel::class)->where('group_id', $id)->where('user_id', $user->id)->where('status', 'pending')->countAllResults());
    }

    public function testWithdrawRequest(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $user  = $this->createPilot('u@flightmeet.test');
        $id    = $this->createGroup($owner->id, ['join_policy' => 'request']);
        $this->actingAs($user)->withBodyFormat('json')->post("api/v1/groups/{$id}/join-requests", ['message' => 'a']);

        $d = json_decode($this->actingAs($user)->delete("api/v1/groups/{$id}/join-requests/mine")->getJSON(), true)['data'];

        $this->assertFalse($d['has_pending_request']);
        $this->assertSame(0, model(GroupJoinRequestModel::class)->where('group_id', $id)->where('status', 'pending')->countAllResults());
    }
}
