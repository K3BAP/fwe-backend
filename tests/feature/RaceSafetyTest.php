<?php

use App\Models\MeetupModel;
use App\Models\MeetupParticipantModel;
use App\Models\ProfileModel;
use App\Models\SpotModel;
use CodeIgniter\Database\Exceptions\DatabaseException;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;

/**
 * Race-/Eindeutigkeits-Sicherungen (M6, MILESTONES „Teilnahme-Race" + „DM-Unique"): die fachliche
 * Logik (FOR-UPDATE-Kapazitätsprüfung beim Beitreten, find-or-create beim DM-Öffnen) ist in den
 * jeweiligen Service-Tests abgedeckt; *diese* Suite prüft den **DB-seitigen Backstop**, der einen
 * echten gleichzeitigen Request abfängt, den die App-Prüfung allein nicht garantieren kann:
 * `uq_meetup_user` (höchstens eine Teilnahme je Treffen+Nutzer) und `uq_conv_dm_key` (genau eine
 * DM je Nutzerpaar). Beide bleiben invariant — egal ob der Treiber die Dublette mit Exception oder
 * `false` quittiert.
 *
 * @internal
 */
final class RaceSafetyTest extends CIUnitTestCase
{
    use DatabaseTestTrait;

    protected $refresh   = true;
    protected $namespace = null;

    private function createPilot(string $email): User
    {
        /** @var UserModel $users */
        $users = model(UserModel::class);
        $user  = new User(['email' => $email, 'password' => 'passwort123', 'active' => true]);
        $users->save($user);
        $user = $users->findById($users->getInsertID());
        $users->addToDefaultGroup($user);
        model(ProfileModel::class)->insert([
            'user_id'      => $user->id,
            'display_name' => 'Test Pilot',
            'handle'       => 'u' . substr(md5($email), 0, 12),
        ]);

        return $user;
    }

    private function createMeetup(int $creatorId): int
    {
        $spotId = (int) model(SpotModel::class)->insert([
            'name' => 'Testspot ' . bin2hex(random_bytes(3)), 'region' => 'Testregion',
            'country' => 'DE', 'lat' => 47.5, 'lng' => 11.0, 'type' => 'launch',
        ], true);

        $id = (int) model(MeetupModel::class)->insert([
            'creator_user_id'  => $creatorId,
            'spot_id'          => $spotId,
            'spot_name'        => 'Testspot',
            'region'           => 'Testregion',
            'lat'              => 47.5,
            'lng'              => 11.0,
            'title'            => 'Testtreffen',
            'starts_at'        => gmdate('Y-m-d H:i:s', time() + 7 * 86400),
            'experience_level' => 'all',
            'max_participants' => 10,
            'status'           => 'open',
        ], true);
        model(MeetupParticipantModel::class)->insert(['meetup_id' => $id, 'user_id' => $creatorId]);

        return $id;
    }

    /**
     * Zwei gleichzeitige Beitritte desselben Nutzers (z. B. Doppelklick / paralleler Request) dürfen
     * nie zwei Teilnahme-Zeilen erzeugen — `uq_meetup_user` fängt die Dublette ab.
     */
    public function testDuplicateMeetupParticipantRejectedByUniqueConstraint(): void
    {
        $db       = db_connect();
        $creator  = $this->createPilot('creator@flightmeet.test');
        $joiner   = $this->createPilot('joiner@flightmeet.test');
        $meetupId = $this->createMeetup($creator->id);

        $db->table('meetup_participants')->insert(['meetup_id' => $meetupId, 'user_id' => $joiner->id]);

        try {
            $db->table('meetup_participants')->insert(['meetup_id' => $meetupId, 'user_id' => $joiner->id]);
        } catch (DatabaseException) {
            // erwartet: uq_meetup_user verhindert die zweite Zeile
        }

        $this->assertSame(
            1,
            model(MeetupParticipantModel::class)->where('meetup_id', $meetupId)->where('user_id', $joiner->id)->countAllResults(),
            'uq_meetup_user muss eine doppelte Teilnahme verhindern',
        );
    }

    /**
     * Zwei gleichzeitige „DM öffnen"-Requests für dasselbe Paar dürfen nie zwei Konversationen
     * erzeugen — `uq_conv_dm_key` (deterministischer Schlüssel `min:max`) fängt die Dublette ab.
     */
    public function testDuplicateDmKeyRejectedByUniqueConstraint(): void
    {
        $db = db_connect();
        $a  = $this->createPilot('a@flightmeet.test');
        $b  = $this->createPilot('b@flightmeet.test');
        $dmKey = min($a->id, $b->id) . ':' . max($a->id, $b->id);

        $db->table('conversations')->insert(['type' => 'direct', 'dm_key' => $dmKey, 'created_by' => $a->id]);

        try {
            $db->table('conversations')->insert(['type' => 'direct', 'dm_key' => $dmKey, 'created_by' => $b->id]);
        } catch (DatabaseException) {
            // erwartet: uq_conv_dm_key verhindert die zweite Konversation
        }

        $this->assertSame(
            1,
            $db->table('conversations')->where('dm_key', $dmKey)->countAllResults(),
            'uq_conv_dm_key muss eine doppelte DM verhindern',
        );
    }
}
