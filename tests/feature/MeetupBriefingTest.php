<?php

use App\Models\MeetupModel;
use App\Models\MeetupParticipantModel;
use App\Models\ProfileModel;
use App\Models\SpotModel;
use CodeIgniter\Config\Factories;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;
use CodeIgniter\Test\TestResponse;
use Config\Gemini;
use Config\Services;
use Tests\Support\Libraries\FakeCurlRequest;

/**
 * Feature-Tests des KI-Briefing-Proxys `GET /meetups/{id}/briefing` (ADR-018, API.md §5.10).
 * Beide Upstreams (Open-Meteo + Gemini) laufen über den URL-routenden {@see FakeCurlRequest};
 * dessen Zähler belegen, dass Kurzschluss-Pfade upstream-frei sind und der Cache den zweiten
 * Gemini-Call verhindert. Der Gemini-Key kommt per {@see Factories}-Config-Mock.
 *
 * @internal
 */
final class MeetupBriefingTest extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;

    protected $refresh   = true;
    protected $namespace = null;

    protected function setUp(): void
    {
        parent::setUp();
        cache()->clean();
        // CIUnitTestCase injiziert pro Test einen frischen MockCache — der Throttler-Singleton
        // hält aber den Cache seiner ERSTEN Erzeugung fest und zählt dort prozessweit weiter
        // (12 Briefing-GETs > Kapazität 10 → falsche 429). Reset bindet ihn neu an den
        // aktuellen MockCache, damit jeder Test mit vollem Bucket startet.
        Services::resetSingle('throttler');

        $config         = new Gemini();
        $config->apiKey = 'test-key';
        Factories::injectMock('config', 'Gemini', $config);
    }

    protected function tearDown(): void
    {
        cache()->clean();
        Factories::reset('config');
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

    /** Startzeit zwei Tage voraus auf voller Stunde (= Zielstunde von Wetter und Briefing-Cache). */
    private function startsAt(): DateTimeImmutable
    {
        return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->modify('+2 days')->setTime(10, 0);
    }

    /** Open-Meteo-Antwort für den Starttag (24 h, konstante Werte) — wie in MeetupWeatherTest. */
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

    private function geminiBody(string $text = 'Ruhiger Südwestwind bei milden Temperaturen.'): array
    {
        return ['candidates' => [['content' => ['parts' => [['text' => $text]]]]]];
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

    // --- Erfolgsfall + Cache ----------------------------------------------------

    public function testGeneratesTheBriefingFromBothUpstreams(): void
    {
        $fake = $this->fake(FakeCurlRequest::routing([
            'forecast'        => [$this->openMeteoBody()],
            'generateContent' => [$this->geminiBody()],
        ]));
        $id = $this->createMeetup();

        $result = $this->call('get', "api/v1/meetups/{$id}/briefing");
        $result->assertStatus(200);

        $data = $this->body($result)['data'];
        $this->assertTrue($data['available']);
        $this->assertNull($data['reason']);
        $this->assertSame('Ruhiger Südwestwind bei milden Temperaturen.', $data['text']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/', $data['generated_at']);
        $this->assertSame(1, $fake->callsByRoute['forecast']);
        $this->assertSame(1, $fake->callsByRoute['generateContent']);
    }

    public function testSecondRequestServesTheBriefingFromTheCache(): void
    {
        $fake = $this->fake(FakeCurlRequest::routing([
            'forecast'        => [$this->openMeteoBody()],
            'generateContent' => [$this->geminiBody()],
        ]));
        $id = $this->createMeetup();

        $this->call('get', "api/v1/meetups/{$id}/briefing")->assertStatus(200);
        $this->call('get', "api/v1/meetups/{$id}/briefing")->assertStatus(200);

        $this->assertSame(1, $fake->callsByRoute['generateContent']);
        $this->assertSame(1, $fake->callsByRoute['forecast']); // Wetter-Cache greift ebenfalls
    }

    public function testRepeatedRequestWithMatchingEtagYieldsNotModified(): void
    {
        $this->fake(FakeCurlRequest::routing([
            'forecast'        => [$this->openMeteoBody()],
            'generateContent' => [$this->geminiBody()],
        ]));
        $id = $this->createMeetup();

        $etag = $this->call('get', "api/v1/meetups/{$id}/briefing")->response()->getHeaderLine('ETag');
        $this->assertNotSame('', $etag);

        $this->withHeaders(['If-None-Match' => $etag])
            ->call('get', "api/v1/meetups/{$id}/briefing")
            ->assertStatus(304);
    }

    // --- „Nicht verfügbar" ist Datum — und upstream-frei --------------------------

    public function testMissingApiKeyReportsNotConfiguredWithoutUpstreamCalls(): void
    {
        $config         = new Gemini();
        $config->apiKey = '';
        Factories::injectMock('config', 'Gemini', $config);
        $fake = $this->fake(FakeCurlRequest::routing([]));
        $id   = $this->createMeetup();

        $result = $this->call('get', "api/v1/meetups/{$id}/briefing");
        $result->assertStatus(200);

        $this->assertSame('not_configured', $this->body($result)['data']['reason']);
        $this->assertSame(0, $fake->calls);
    }

    public function testPastMeetupReportsPastWithoutUpstreamCalls(): void
    {
        $fake = $this->fake(FakeCurlRequest::routing([]));
        $id   = $this->createMeetup(['starts_at' => gmdate('Y-m-d H:i:s', time() - 86400)]);

        $result = $this->call('get', "api/v1/meetups/{$id}/briefing");
        $result->assertStatus(200);

        $data = $this->body($result)['data'];
        $this->assertFalse($data['available']);
        $this->assertSame('past', $data['reason']);
        $this->assertSame(0, $fake->calls);
    }

    // --- Gemini-Ausfälle ----------------------------------------------------------

    public function testGeminiRateLimitYieldsServiceUnavailableWithBusyMessage(): void
    {
        $this->fake(FakeCurlRequest::routing([
            'forecast'        => [$this->openMeteoBody()],
            'generateContent' => [['error' => ['status' => 'RESOURCE_EXHAUSTED']], 429],
        ]));
        $id = $this->createMeetup();

        $result = $this->call('get', "api/v1/meetups/{$id}/briefing");
        $result->assertStatus(503);

        $error = $this->body($result)['error'];
        $this->assertSame('briefing_unavailable', $error['code']);
        $this->assertStringContainsString('ausgelastet', $error['message']);
    }

    public function testGeminiServerErrorIsNotCachedAndRetriesOnNextRequest(): void
    {
        $fake = $this->fake(FakeCurlRequest::routing([
            'forecast'        => [$this->openMeteoBody()],
            'generateContent' => [['error' => 'boom'], 500],
        ]));
        $id = $this->createMeetup();

        $this->call('get', "api/v1/meetups/{$id}/briefing")->assertStatus(503);
        $this->call('get', "api/v1/meetups/{$id}/briefing")->assertStatus(503);

        // Fehlschläge landen nie im Cache → jeder Versuch geht erneut zu Gemini.
        $this->assertSame(2, $fake->callsByRoute['generateContent']);
    }

    public function testMalformedGeminiResponseYieldsServiceUnavailable(): void
    {
        $this->fake(FakeCurlRequest::routing([
            'forecast'        => [$this->openMeteoBody()],
            'generateContent' => [['candidates' => []]],
        ]));
        $id = $this->createMeetup();

        $result = $this->call('get', "api/v1/meetups/{$id}/briefing");
        $result->assertStatus(503);
        $this->assertSame('briefing_unavailable', $this->body($result)['error']['code']);
    }

    public function testUnknownMeetupYieldsNotFound(): void
    {
        $result = $this->call('get', 'api/v1/meetups/999999/briefing');
        $result->assertStatus(404);
        $this->assertSame('not_found', $this->body($result)['error']['code']);
    }
}
