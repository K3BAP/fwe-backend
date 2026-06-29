<?php

use App\Models\ConversationModel;
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
 * Feature-Tests der Gruppen-Channel-Verwaltung (M4 Slice 5, API.md §7.2–§7.4): Anlegen/Umbenennen/
 * Soft-Löschen mit BOLA und Default-/Letzter-Channel-Schutz.
 *
 * @internal
 */
final class GroupChannelTest extends CIUnitTestCase
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

    private function createGroup(int $ownerId): int
    {
        $id = (int) model(GroupModel::class)->insert([
            'slug' => 'g-' . bin2hex(random_bytes(6)), 'name' => 'Testgruppe',
            'visibility' => 'public', 'join_policy' => 'open', 'owner_user_id' => $ownerId, 'members_count' => 1,
        ], true);
        model(GroupMemberModel::class)->insert(['group_id' => $id, 'user_id' => $ownerId, 'role' => 'owner', 'status' => 'active']);
        model(ConversationModel::class)->insert([
            'type' => 'group_channel', 'context_type' => 'group', 'context_id' => $id,
            'title' => 'Allgemein', 'position' => 0, 'is_default' => 1, 'min_role' => 'member', 'created_by' => $ownerId,
        ]);

        return $id;
    }

    private function addMember(int $groupId, int $userId, string $role = 'member'): void
    {
        model(GroupMemberModel::class)->insert(['group_id' => $groupId, 'user_id' => $userId, 'role' => $role, 'status' => 'active']);
        db_connect()->table('groups')->where('id', $groupId)->set('members_count', 'members_count + 1', false)->update();
    }

    public function testCreateChannel(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id);

        $chans = json_decode($this->actingAs($owner)->withBodyFormat('json')
            ->post("api/v1/groups/{$id}/channels", ['name' => 'Wetter'])->getJSON(), true)['data'];

        $this->assertSame(['Allgemein', 'Wetter'], array_column($chans, 'name'));
        $this->assertFalse($chans[1]['is_default']);
    }

    public function testCreateChannelForbiddenForMember(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        $id     = $this->createGroup($owner->id);
        $this->addMember($id, $member->id);

        $this->actingAs($member)->withBodyFormat('json')
            ->post("api/v1/groups/{$id}/channels", ['name' => 'Heimlich'])->assertStatus(403);
    }

    public function testCreateChannelValidation(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id);

        $this->actingAs($owner)->withBodyFormat('json')
            ->post("api/v1/groups/{$id}/channels", ['name' => ''])->assertStatus(422);
    }

    public function testRenameChannel(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id);
        $chId  = (int) model(ConversationModel::class)->insert([
            'type' => 'group_channel', 'context_type' => 'group', 'context_id' => $id,
            'title' => 'Alt', 'position' => 1, 'is_default' => 0, 'min_role' => 'member', 'created_by' => $owner->id,
        ], true);

        $chans = json_decode($this->actingAs($owner)->withBodyFormat('json')
            ->patch("api/v1/groups/{$id}/channels/{$chId}", ['name' => 'Neu'])->getJSON(), true)['data'];

        $this->assertContains('Neu', array_column($chans, 'name'));
        $this->assertNotContains('Alt', array_column($chans, 'name'));
    }

    public function testDeleteChannel(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id);
        $chId  = (int) model(ConversationModel::class)->insert([
            'type' => 'group_channel', 'context_type' => 'group', 'context_id' => $id,
            'title' => 'Wegdamit', 'position' => 1, 'is_default' => 0, 'min_role' => 'member', 'created_by' => $owner->id,
        ], true);

        $chans = json_decode($this->actingAs($owner)->delete("api/v1/groups/{$id}/channels/{$chId}")->getJSON(), true)['data'];

        $this->assertSame(['Allgemein'], array_column($chans, 'name'));
        $this->assertNotNull(model(ConversationModel::class)->find($chId)['deleted_at']);
    }

    public function testCannotDeleteDefaultChannel(): void
    {
        $owner   = $this->createPilot('o@flightmeet.test');
        $id      = $this->createGroup($owner->id);
        $default = (int) model(ConversationModel::class)->where('context_id', $id)->where('is_default', 1)->first()['id'];

        $res = $this->actingAs($owner)->delete("api/v1/groups/{$id}/channels/{$default}");

        $res->assertStatus(409);
        $this->assertSame('default_channel_not_deletable', json_decode($res->getJSON(), true)['error']['code']);
    }
}
