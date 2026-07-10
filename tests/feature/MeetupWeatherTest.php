<?php

use App\Models\MeetupModel;
use App\Models\MeetupParticipantModel;
use App\Models\ProfileModel;
use App\Models\SpotModel;
use CodeIgniter\HTTP\Exceptions\HTTPException;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;
use CodeIgniter\Test\TestResponse;
use Config\Services;
use Tests\Support\Libraries\FakeCurlRequest;

/**
 * Feature-Tests des Wetter-Proxys `GET /meetups/{id}/weather` (ADR-017, API.md §5.6). Open-Meteo wird
 * durch {@see FakeCurlRequest} ersetzt; dessen Aufrufzähler belegt, dass „nicht verfügbar" ohne
 * Upstream-Call auskommt und dass der Cache den zweiten Aufruf abfängt.
 *
 * @internal
 */
final class MeetupWeatherTest extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;

    protected $refresh   = true;
    protected $namespace = null;

    protected function setUp(): void
    {
        parent::setUp();
        // Der Proxy cacht Upstream-Antworten (und der Throttle-Filter zählt im selben Cache) —
        // ohne Leeren würden Tests einander beeinflussen.
        cache()->clean();
    }

    protected function tearDown(): void
    {
        cache()->clean();
        parent::tearDown();
    }

    private function createPilot(): User
    {
        /** @var UserModel $users */
        $users = model(UserModel::class);
        $user  = new User(['email' => 'pilot@flightmeet.test', 'password' => 'passwort123', 'active' => true]);
        $users->save($user);
        $user = $users->findById($users->getInsertID());
        $users->addToDefaultGroup($user);
        model(ProfileModel::class)->insert(['user_id' => $user->id, 'display_name' => 'Test Pilot', 'handle' => 'pilot']);

        return $user;
    }

    /** @param array<string, mixed> $o */
    private function createMeetup(array $o = []): int
    {
        $creatorId = $this->createPilot()->id;
        $spotId    = (int) model(SpotModel::class)->insert([
            'name' => 'Testspot', 'region' => 'Testregion', 'country' => 'DE',
            'lat'  => 47.5, 'lng' => 11.0, 'type' => 'launch',
        ], true);

        $id = (int) model(MeetupModel::class)->insert(array_merge([
            'creator_user_id'  => $creatorId,
            'spot_id'          => $spotId,
            'spot_name'        => 'Testspot',
            'region'           => 'Testregion',
            'lat'              => 47.5,
            'lng'              => 11.0,
            'title'            => 'Testtreffen',
            'description'      => null,
            'starts_at'        => $this->startsAt()->format('Y-m-d H:i:s'),
            'experience_level' => 'all',
            'max_participants' => 10,
            'status'           => 'open',
        ], $o), true);

        model(MeetupParticipantModel::class)->insert(['meetup_id' => $id, 'user_id' => $creatorId]);

        return $id;
    }

    /** Startzeit zwei Tage voraus, auf eine volle Stunde gelegt (= Zielstunde der Vorhersage). */
    private function startsAt(): DateTimeImmutable
    {
        return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->modify('+2 days')->setTime(10, 0);
    }

    /** Open-Meteo-Antwort für den Tag der Startzeit (24 Stunden, konstante Werte). */
    private function openMeteoBody(): array
    {
        $day    = $this->startsAt()->format('Y-m-d');
        $hourly = ['time' => []];
        $fields = [
            'temperature_2m' => 21.5, 'wind_speed_10m' => 12.4, 'wind_gusts_10m' => 18.9,
            'wind_direction_10m' => 225, 'precipitation_probability' => 10, 'precipitation' => 0.0,
            'cloud_cover' => 40, 'weather_code' => 2, 'wind_speed_850hPa' => 24.0,
            'wind_direction_850hPa' => 240, 'cape' => 350.0,
        ];
        for ($i = 0; $i < 24; $i++) {
            $hourly['time'][] = sprintf('%sT%02d:00', $day, $i);
            foreach ($fields as $field => $value) {
                $hourly[$field][] = $value;
            }
        }

        return ['hourly' => $hourly];
    }

    private function fake(FakeCurlRequest $fake): FakeCurlRequest
    {
        Services::injectMock('curlrequest', $fake);

        return $fake;
    }

    /** @return array<string, mixed> dekodierter Antwort-Envelope */
    private function body(TestResponse $result): array
    {
        return json_decode($result->getJSON(), true);
    }

    // --- Erfolgsfall ----------------------------------------------------------

    public function testReturnsTheForecastForTheStartingHour(): void
    {
        $this->fake(FakeCurlRequest::returning($this->openMeteoBody()));
        $id = $this->createMeetup();

        $result = $this->call('get', "api/v1/meetups/{$id}/weather");
        $result->assertStatus(200);

        $data = $this->body($result)['data'];
        $this->assertTrue($data['available']);
        $this->assertNull($data['reason']);
        $this->assertFalse($data['is_current']);
        $this->assertSame($this->startsAt()->format('Y-m-d\TH:i:s\Z'), $data['snapshot']['at']);
        $this->assertSame(12.4, $data['snapshot']['wind_speed_kmh']);
        $this->assertSame(18.9, $data['snapshot']['wind_gusts_kmh']);
        // Ganzzahlige Floats verlieren beim JSON-Roundtrip ihr `.0` — für `z.number()` einerlei.
        $this->assertEquals(24.0, $data['snapshot']['wind_1500m_kmh']);
        $this->assertCount(6, $data['trend']);
    }

    // --- „Nicht verfügbar" ist Datum, kein Fehler — und kostet keinen Upstream-Call ------------

    public function testPastMeetupReportsNoForecastWithoutCallingUpstream(): void
    {
        $fake = $this->fake(FakeCurlRequest::returning($this->openMeteoBody()));
        $id   = $this->createMeetup(['starts_at' => gmdate('Y-m-d H:i:s', time() - 86400)]);

        $result = $this->call('get', "api/v1/meetups/{$id}/weather");
        $result->assertStatus(200);

        $this->assertSame('past', $this->body($result)['data']['reason']);
        $this->assertNull($this->body($result)['data']['snapshot']);
        $this->assertSame(0, $fake->calls);
    }

    public function testMeetupBeyondTheForecastHorizonReportsOutOfRange(): void
    {
        $fake = $this->fake(FakeCurlRequest::returning($this->openMeteoBody()));
        $id   = $this->createMeetup(['starts_at' => gmdate('Y-m-d H:i:s', time() + 20 * 86400)]);

        $result = $this->call('get', "api/v1/meetups/{$id}/weather");
        $result->assertStatus(200);

        $this->assertSame('out_of_range', $this->body($result)['data']['reason']);
        $this->assertSame(0, $fake->calls);
    }

    public function testMeetupWithoutCoordinatesReportsNoLocation(): void
    {
        $fake = $this->fake(FakeCurlRequest::returning($this->openMeteoBody()));
        $id   = $this->createMeetup(['lat' => null, 'lng' => null]);

        $result = $this->call('get', "api/v1/meetups/{$id}/weather");
        $result->assertStatus(200);

        $this->assertSame('no_location', $this->body($result)['data']['reason']);
        $this->assertSame(0, $fake->calls);
    }

    // --- Upstream-Ausfälle ----------------------------------------------------

    public function testUpstreamErrorStatusYieldsServiceUnavailable(): void
    {
        $this->fake(FakeCurlRequest::returning([], 500));
        $id = $this->createMeetup();

        $result = $this->call('get', "api/v1/meetups/{$id}/weather");
        $result->assertStatus(503);
        $this->assertSame('weather_unavailable', $this->body($result)['error']['code']);
    }

    public function testUpstreamTimeoutYieldsServiceUnavailable(): void
    {
        $this->fake(FakeCurlRequest::throwing(new HTTPException('cURL Timeout')));
        $id = $this->createMeetup();

        $result = $this->call('get', "api/v1/meetups/{$id}/weather");
        $result->assertStatus(503);
        $this->assertSame('weather_unavailable', $this->body($result)['error']['code']);
    }

    public function testMissingHourlyBlockYieldsServiceUnavailable(): void
    {
        $this->fake(FakeCurlRequest::returning(['error' => true, 'reason' => 'Invalid date']));
        $id = $this->createMeetup();

        $this->call('get', "api/v1/meetups/{$id}/weather")->assertStatus(503);
    }

    // --- Cache, ETag, 404 -----------------------------------------------------

    public function testSecondRequestIsServedFromTheCache(): void
    {
        $fake = $this->fake(FakeCurlRequest::returning($this->openMeteoBody()));
        $id   = $this->createMeetup();

        $this->call('get', "api/v1/meetups/{$id}/weather")->assertStatus(200);
        $this->call('get', "api/v1/meetups/{$id}/weather")->assertStatus(200);

        $this->assertSame(1, $fake->calls);
    }

    public function testRepeatedRequestWithMatchingEtagYieldsNotModified(): void
    {
        $this->fake(FakeCurlRequest::returning($this->openMeteoBody()));
        $id = $this->createMeetup();

        $etag = $this->call('get', "api/v1/meetups/{$id}/weather")->response()->getHeaderLine('ETag');
        $this->assertNotSame('', $etag);

        $this->withHeaders(['If-None-Match' => $etag])
            ->call('get', "api/v1/meetups/{$id}/weather")
            ->assertStatus(304);
    }

    public function testUnknownMeetupYieldsNotFound(): void
    {
        $result = $this->call('get', 'api/v1/meetups/999999/weather');
        $result->assertStatus(404);
        $this->assertSame('not_found', $this->body($result)['error']['code']);
    }
}
