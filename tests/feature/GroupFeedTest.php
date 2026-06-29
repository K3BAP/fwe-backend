<?php

use App\Models\ConversationModel;
use App\Models\FeedPostModel;
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
 * Feature-Tests der Gruppen-Feed-Writes (M4 Slice 5, API.md §8.2–§8.6): Anlegen/Bearbeiten (owner/admin),
 * Soft-Delete (moderator+), Pin-Toggle, Emoji-Reaktion-Toggle (Mitglied).
 *
 * @internal
 */
final class GroupFeedTest extends CIUnitTestCase
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

    private function createPost(int $groupId, int $authorId): int
    {
        return (int) model(FeedPostModel::class)->insert([
            'group_id' => $groupId, 'author_user_id' => $authorId, 'title' => 'T', 'body' => 'Inhalt', 'is_pinned' => 0,
        ], true);
    }

    public function testCreateFeedPost(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id);

        $res = $this->actingAs($owner)->withBodyFormat('json')
            ->post("api/v1/groups/{$id}/feed", ['title' => 'Saisonstart', 'body' => 'Es geht los!']);

        $res->assertStatus(201);
        $d = json_decode($res->getJSON(), true)['data'];
        $this->assertSame('Saisonstart', $d['title']);
        $this->assertSame('Es geht los!', $d['body']);
        $this->assertSame((int) $owner->id, $d['author']['id']);
        $this->assertSame([], $d['reactions']);
        $this->assertFalse($d['is_pinned']);
    }

    public function testCreateFeedPostForbiddenForMember(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        $id     = $this->createGroup($owner->id);
        $this->addMember($id, $member->id);

        $this->actingAs($member)->withBodyFormat('json')
            ->post("api/v1/groups/{$id}/feed", ['title' => null, 'body' => 'darf nicht'])->assertStatus(403);
    }

    public function testCreateFeedPostValidation(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id);

        $this->actingAs($owner)->withBodyFormat('json')
            ->post("api/v1/groups/{$id}/feed", ['body' => ''])->assertStatus(422);
    }

    public function testUpdateFeedPost(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id);
        $post  = $this->createPost($id, (int) $owner->id);

        $d = json_decode($this->actingAs($owner)->withBodyFormat('json')
            ->patch("api/v1/groups/{$id}/feed/{$post}", ['body' => 'Geändert'])->getJSON(), true)['data'];

        $this->assertSame('Geändert', $d['body']);
    }

    public function testDeleteFeedPostByModerator(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $mod   = $this->createPilot('mod@flightmeet.test');
        $id    = $this->createGroup($owner->id);
        $this->addMember($id, $mod->id, 'moderator');
        $post = $this->createPost($id, (int) $owner->id);

        $this->actingAs($mod)->delete("api/v1/groups/{$id}/feed/{$post}")->assertStatus(204);

        $this->assertNotNull(model(FeedPostModel::class)->find($post)['deleted_at']);
        $feed = json_decode($this->get("api/v1/groups/{$id}/feed")->getJSON(), true)['data'];
        $this->assertCount(0, $feed);
    }

    public function testDeleteFeedPostForbiddenForMember(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        $id     = $this->createGroup($owner->id);
        $this->addMember($id, $member->id);
        $post = $this->createPost($id, (int) $owner->id);

        $this->actingAs($member)->delete("api/v1/groups/{$id}/feed/{$post}")->assertStatus(403);
    }

    public function testTogglePin(): void
    {
        $owner = $this->createPilot('o@flightmeet.test');
        $id    = $this->createGroup($owner->id);
        $post  = $this->createPost($id, (int) $owner->id);

        $d1 = json_decode($this->actingAs($owner)->post("api/v1/groups/{$id}/feed/{$post}/pin")->getJSON(), true)['data'];
        $this->assertTrue($d1['is_pinned']);

        $d2 = json_decode($this->actingAs($owner)->post("api/v1/groups/{$id}/feed/{$post}/pin")->getJSON(), true)['data'];
        $this->assertFalse($d2['is_pinned']);
    }

    public function testReactToPostToggle(): void
    {
        $owner  = $this->createPilot('o@flightmeet.test');
        $member = $this->createPilot('m@flightmeet.test');
        $id     = $this->createGroup($owner->id);
        $this->addMember($id, $member->id);
        $post = $this->createPost($id, (int) $owner->id);

        $d1 = json_decode($this->actingAs($member)->withBodyFormat('json')
            ->post("api/v1/groups/{$id}/feed/{$post}/reactions", ['emoji' => '🔥'])->getJSON(), true)['data'];
        $this->assertSame('🔥', $d1['reactions'][0]['emoji']);
        $this->assertSame(1, $d1['reactions'][0]['count']);
        $this->assertTrue($d1['reactions'][0]['me']);

        $d2 = json_decode($this->actingAs($member)->withBodyFormat('json')
            ->post("api/v1/groups/{$id}/feed/{$post}/reactions", ['emoji' => '🔥'])->getJSON(), true)['data'];
        $this->assertSame([], $d2['reactions']);
    }

    public function testReactForbiddenForNonMember(): void
    {
        $owner   = $this->createPilot('o@flightmeet.test');
        $outsider = $this->createPilot('x@flightmeet.test');
        $id      = $this->createGroup($owner->id);
        $post    = $this->createPost($id, (int) $owner->id);

        $this->actingAs($outsider)->withBodyFormat('json')
            ->post("api/v1/groups/{$id}/feed/{$post}/reactions", ['emoji' => '🔥'])->assertStatus(403);
    }
}
