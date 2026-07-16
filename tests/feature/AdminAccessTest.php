<?php

use App\Models\ProfileModel;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;
use CodeIgniter\Shield\Test\AuthenticationTesting;
use CodeIgniter\Config\Services;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * Zugriffsschutz des Admin-Bereichs (ADR-019) und Konto-Zustände an der Session.
 *
 * Die Routen-Matrix ist bewusst ein DataProvider: sie deckt *jede* Admin-Route ab und veraltet nicht,
 * wenn später Routen dazukommen (dann fällt nur der Provider auf, nicht die Abdeckung).
 *
 * @internal
 */
final class AdminAccessTest extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;
    use AuthenticationTesting;

    protected $refresh   = true;
    protected $namespace = null;

    protected function setUp(): void
    {
        parent::setUp();
        // `throttle:login,5` zählt sonst über den ganzen PHPUnit-Prozess weiter (der Throttler-Singleton
        // behält den Cache seiner ersten Erzeugung) — die Login-Tests würden dann je nach Suite-Reihenfolge
        // mit 429 fehlschlagen. Siehe CLAUDE.md §9.
        Services::resetSingle('throttler');
    }

    protected function tearDown(): void
    {
        if (auth()->loggedIn()) {
            auth()->logout();
        }
        parent::tearDown();
    }

    /** Jede Admin-Route als [Methode, Pfad]. Muss mit dem `admin`-Block in Config/Routes.php mitwachsen. */
    public static function adminRoutes(): array
    {
        return [
            'stats'         => ['get', 'api/v1/admin/stats'],
            'users index'   => ['get', 'api/v1/admin/users'],
            'users show'    => ['get', 'api/v1/admin/users/1'],
            'users update'  => ['patch', 'api/v1/admin/users/1'],
            'users setAdmin' => ['post', 'api/v1/admin/users/1/admin'],
            'users setActive' => ['post', 'api/v1/admin/users/1/active'],
            'users restore' => ['post', 'api/v1/admin/users/1/restore'],
            'users destroy' => ['delete', 'api/v1/admin/users/1'],
            'meetups index' => ['get', 'api/v1/admin/meetups'],
            'groups index'  => ['get', 'api/v1/admin/groups'],
            'groups restore' => ['post', 'api/v1/admin/groups/1/restore'],
            'spots index'   => ['get', 'api/v1/admin/spots'],
            'spots store'   => ['post', 'api/v1/admin/spots'],
            'spots update'  => ['patch', 'api/v1/admin/spots/1'],
            'spots destroy' => ['delete', 'api/v1/admin/spots/1'],
        ];
    }

    #[DataProvider('adminRoutes')]
    public function testGuestGets401(string $method, string $path): void
    {
        $result = $this->call($method, $path);
        $result->assertStatus(401);
        $this->assertSame('unauthenticated', $this->errorCode($result));
    }

    #[DataProvider('adminRoutes')]
    public function testNormalPilotGets403(string $method, string $path): void
    {
        $this->actingAs($this->createPilot('pilot@flightmeet.test'));

        $result = $this->call($method, $path);
        $result->assertStatus(403);
        $this->assertSame('forbidden', $this->errorCode($result));
    }

    #[DataProvider('adminRoutes')]
    public function testAdminPassesTheFilter(string $method, string $path): void
    {
        $this->actingAs($this->createAdmin('admin@flightmeet.test'));

        $result = $this->call($method, $path);

        // Der Filter ist die Prüfung, nicht die Fachlichkeit: 404/422 sind hier legitim (ID 1 existiert
        // ggf. nicht), 401/403 wären der Fehler.
        $this->assertNotContains($result->response()->getStatusCode(), [401, 403]);
    }

    /**
     * Eine gesperrte, *bereits angemeldete* Sitzung wird beim nächsten Request abgewiesen (403) statt
     * unbegrenzt weiterzulaufen. Ohne die `active`-Prüfung im ApiAuthFilter wäre die Admin-Sperre nur
     * eine Login-Hürde — `AuthService::login()` sieht das Flag nur beim Anmelden.
     *
     * Zum Aufbau: `actingAs()` hält den User nur im Speicher des `auth`-Singletons (im FeatureTest gibt
     * es keine echte Session — sie ist hier leer, und ein Reset des Singletons wäre schlicht ein Logout).
     * Der zweite `actingAs()` mit der **neu geladenen** Entity bildet deshalb ab, was in Produktion von
     * allein passiert: dort bootet jeder Request neu und `Session::checkUserState()` liest den User über
     * `findById()` frisch aus der DB. Geprüft wird hier also der Filter-Zweig, nicht Shields Reload.
     */
    public function testSuspendedUserIsRejectedOnNextRequest(): void
    {
        $user = $this->createPilot('gesperrt@flightmeet.test');
        $this->actingAs($user);
        $this->call('get', 'api/v1/auth/me')->assertStatus(200);

        model(UserModel::class)->update($user->id, ['active' => false]);
        $this->actingAs(model(UserModel::class)->findById($user->id));

        $result = $this->call('get', 'api/v1/auth/me');
        $result->assertStatus(403);
        $this->assertSame('account_suspended', $this->errorCode($result));
    }

    /** Gesperrte Konten kommen auch nicht neu herein (AuthService-Pfad). */
    public function testSuspendedUserCannotLogIn(): void
    {
        $user = $this->createPilot('gesperrt2@flightmeet.test');
        model(UserModel::class)->update($user->id, ['active' => false]);

        $result = $this->withBodyFormat('json')->post('api/v1/auth/login', ['email' => 'gesperrt2@flightmeet.test', 'password' => 'passwort123']);
        $result->assertStatus(403);
        $this->assertSame('account_suspended', $this->errorCode($result));
    }

    /**
     * Soft-Delete beendet die Session ohne eigenes Zutun: Shields Provider findet den User nicht mehr
     * (`UserModel::$useSoftDeletes`), `checkUserState()` setzt STATE_ANONYMOUS und verwirft die
     * Session-Info. Genau darauf verlässt sich ADR-019 — deshalb wird das geerbte Verhalten hier an
     * seiner Ursache festgenagelt (der Provider liefert `null`) statt über eine simulierte Session.
     */
    public function testSoftDeletedUserIsInvisibleToTheAuthProvider(): void
    {
        $user = $this->createPilot('geloescht@flightmeet.test');
        model(UserModel::class)->delete($user->id);

        $this->assertNull(auth()->getProvider()->findById($user->id), 'Soft-gelöschte User dürfen für Shield nicht mehr auffindbar sein — sonst überlebt die Session.');
    }

    /** …und der Login ist damit ebenfalls zu (`findByCredentials` nutzt denselben Builder). */
    public function testSoftDeletedUserCannotLogIn(): void
    {
        $this->createPilot('geloescht2@flightmeet.test');
        model(UserModel::class)->delete(
            model(UserModel::class)->findByCredentials(['email' => 'geloescht2@flightmeet.test'])->id
        );

        $this->withBodyFormat('json')->post('api/v1/auth/login', ['email' => 'geloescht2@flightmeet.test', 'password' => 'passwort123'])
            ->assertStatus(401);
    }

    private function errorCode(mixed $result): string
    {
        return (string) (json_decode($result->getJSON(), true)['error']['code'] ?? '');
    }

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

    private function createAdmin(string $email): User
    {
        $user = $this->createPilot($email);
        $user->addGroup('admin');

        return $user;
    }
}
