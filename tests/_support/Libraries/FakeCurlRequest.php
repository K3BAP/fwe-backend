<?php

namespace Tests\Support\Libraries;

use CodeIgniter\HTTP\CURLRequest;
use CodeIgniter\HTTP\Response;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\HTTP\URI;
use Throwable;

/**
 * HTTP-Client-Attrappe für Tests des Wetter-Proxys (ADR-017): liefert eine vorgegebene Antwort
 * (oder wirft), statt Open-Meteo zu kontaktieren, und zählt die Aufrufe — so lässt sich prüfen,
 * dass der Cache greift und dass „nicht verfügbar" ganz ohne Upstream-Call auskommt.
 *
 * Wird per `Services::injectMock('curlrequest', …)` eingeschleust.
 */
final class FakeCurlRequest extends CURLRequest
{
    public int $calls = 0;

    private function __construct(
        private readonly int $status,
        private readonly string $bodyJson,
        private readonly ?Throwable $failure,
    ) {
        $config = config('App');
        parent::__construct($config, new URI('https://example.test/'), new Response($config), []);
    }

    /** @param array<string, mixed> $body wird als JSON geliefert */
    public static function returning(array $body, int $status = 200): self
    {
        return new self($status, (string) json_encode($body), null);
    }

    /** Simuliert Timeout/DNS-Fehler/fehlendes ext-curl. */
    public static function throwing(Throwable $failure): self
    {
        return new self(0, '', $failure);
    }

    /** @param array<string, mixed> $options */
    public function get(string $url, array $options = []): ResponseInterface
    {
        $this->calls++;
        if ($this->failure !== null) {
            throw $this->failure;
        }

        return (new Response(config('App')))->setStatusCode($this->status)->setBody($this->bodyJson);
    }
}
