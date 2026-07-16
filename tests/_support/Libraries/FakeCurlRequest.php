<?php

namespace Tests\Support\Libraries;

use CodeIgniter\HTTP\CURLRequest;
use CodeIgniter\HTTP\Response;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\HTTP\URI;
use RuntimeException;
use Throwable;

/**
 * HTTP-Client-Attrappe für Tests der Proxy-Dienste (Wetter ADR-017, KI-Briefing ADR-018):
 * liefert vorgegebene Antworten statt echter Upstream-Calls und zählt die Aufrufe — so lässt
 * sich prüfen, dass Caches greifen und „nicht verfügbar" ganz ohne Upstream auskommt.
 *
 * Zwei Betriebsarten:
 *  - `returning()`/`throwing()`: eine Antwort für alle Aufrufe (Wetter-Tests).
 *  - `routing()`: URL-Teilstring → Antwort, für Abläufe mit **mehreren** Upstreams
 *    (Briefing = Open-Meteo `forecast` + Gemini `generateContent`). Ein Aufruf ohne
 *    passende Route wirft laut — unerwartete Upstream-Calls fallen sofort auf.
 *
 * Wird per `Services::injectMock('curlrequest', …)` eingeschleust und ersetzt damit den
 * **geteilten** Service für alle beteiligten Dienste zugleich.
 */
final class FakeCurlRequest extends CURLRequest
{
    public int $calls = 0;

    /** Aufrufe je Routen-Schlüssel (nur im `routing()`-Modus gefüllt). @var array<string, int> */
    public array $callsByRoute = [];

    /** @param array<string, array{0: array<string, mixed>, 1?: int}|Throwable>|null $routes */
    private function __construct(
        private readonly int $status,
        private readonly string $bodyJson,
        private readonly ?Throwable $failure,
        private readonly ?array $routes = null,
    ) {
        $config = config('App');
        parent::__construct($config, new URI('https://example.test/'), new Response($config), []);
    }

    /** @param array<string, mixed> $body wird als JSON geliefert */
    public static function returning(array $body, int $status = 200): self
    {
        return new self($status, (string) json_encode($body), null, null);
    }

    /** Simuliert Timeout/DNS-Fehler/fehlendes ext-curl. */
    public static function throwing(Throwable $failure): self
    {
        return new self(0, '', $failure, null);
    }

    /**
     * Antworten je URL-Teilstring, z.B.
     * `::routing(['forecast' => [$openMeteo], 'generateContent' => [$gemini, 200]])`.
     * Werte: `[body, status = 200]` — oder ein `Throwable`, das beim Treffer geworfen wird.
     *
     * @param array<string, array{0: array<string, mixed>, 1?: int}|Throwable> $routes
     */
    public static function routing(array $routes): self
    {
        return new self(0, '', null, $routes);
    }

    /** @param array<string, mixed> $options */
    public function get(string $url, array $options = []): ResponseInterface
    {
        return $this->respond($url);
    }

    /** @param array<string, mixed> $options */
    public function post(string $url, array $options = []): ResponseInterface
    {
        return $this->respond($url);
    }

    private function respond(string $url): ResponseInterface
    {
        $this->calls++;

        if ($this->routes !== null) {
            foreach ($this->routes as $needle => $route) {
                if (! str_contains($url, $needle)) {
                    continue;
                }
                $this->callsByRoute[$needle] = ($this->callsByRoute[$needle] ?? 0) + 1;
                if ($route instanceof Throwable) {
                    throw $route;
                }

                return (new Response(config('App')))
                    ->setStatusCode($route[1] ?? 200)
                    ->setBody((string) json_encode($route[0]));
            }

            throw new RuntimeException('FakeCurlRequest: unerwarteter Upstream-Call an ' . $url);
        }

        if ($this->failure !== null) {
            throw $this->failure;
        }

        return (new Response(config('App')))->setStatusCode($this->status)->setBody($this->bodyJson);
    }
}
