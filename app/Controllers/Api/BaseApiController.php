<?php

namespace App\Controllers\Api;

use App\Exceptions\ApiException;
use CodeIgniter\Controller;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Basis aller `/api/v1`-Controller (06-backend §4.1). Kapselt den einheitlichen Antwort-Envelope
 * (`data`/`meta` bzw. `error`) und den Shield-User-Zugriff, damit die Domänen-Controller dünn bleiben
 * (Request → Validierung → Service → Envelope; Geschäftslogik liegt im Service-Layer, ADR-013).
 */
abstract class BaseApiController extends Controller
{
    /**
     * Erfolgs-Envelope. `meta` nur bei Listen/Pagination.
     *
     * @param array<string, mixed>|null $meta
     */
    protected function respondData(mixed $data, int $status = 200, ?array $meta = null): ResponseInterface
    {
        $body = ['data' => $data];
        if ($meta !== null) {
            $body['meta'] = $meta;
        }

        return $this->response->setStatusCode($status)->setJSON($body);
    }

    /**
     * Erfolg ohne Nutzlast (leave, markRead, delete, logout). Produktionskonform `204 No Content`
     * (API.md). **Ausnahme nur unter PHPs eingebautem Dev-Server** (`php spark serve`): der sendet hinter
     * den 204-Headern einen fehlerhaften Frame, den Nodes strikter HTTP-Parser im Vite-Proxy mit `502`
     * ablehnt („Data after Connection: close"). Dort weichen wir auf `200 { data: null }` aus — semantisch
     * identisch, vom Frontend (`apiFetch`) gleich behandelt. Apache in Prod liefert das echte 204.
     */
    protected function respondNoContent(): ResponseInterface
    {
        if (str_contains($_SERVER['SERVER_SOFTWARE'] ?? '', 'Development Server')) {
            return $this->response->setStatusCode(200)->setJSON(['data' => null]);
        }

        return $this->response->setStatusCode(204)->setBody('')->setHeader('Content-Length', '0');
    }

    /**
     * Erfolgs-Envelope mit schwachem ETag/`304` für gepollte Lese-Endpunkte (Chat/Notifications,
     * ADR-001). Der ETag wird aus dem serialisierten `data` gebildet; stimmt `If-None-Match` überein,
     * wird `304 Not Modified` (ohne Body) geliefert — sonst der normale `{ data }`-Envelope inkl.
     * `ETag`-Header. So bleiben Leerlauf-Polls billig.
     *
     * **Ausnahme unter PHPs eingebautem Dev-Server** (`php spark serve`): wie bei {@see respondNoContent}
     * verträgt der mit dem strikten Vite-/Node-Proxy keine body-losen Antworten (502). Dort wird das
     * `304` übersprungen und stets der volle `200`-Envelope geliefert (Frontend behandelt beides gleich).
     */
    protected function respondMaybeCached(mixed $data): ResponseInterface
    {
        $etag        = '"' . md5((string) json_encode($data)) . '"';
        $isDevServer = str_contains($_SERVER['SERVER_SOFTWARE'] ?? '', 'Development Server');
        $ifNoneMatch = trim($this->request->getHeaderLine('If-None-Match'));

        if (! $isDevServer && $ifNoneMatch !== '' && $ifNoneMatch === $etag) {
            return $this->response->setStatusCode(304)->setHeader('ETag', $etag)->setBody('');
        }

        return $this->respondData($data)->setHeader('ETag', $etag);
    }

    /**
     * Fehler-Envelope mit stabilem englischem `code` + deutscher `message`.
     *
     * @param array<string, string>|null $fields nur bei `422`
     */
    protected function respondError(string $code, string $message, int $status, ?array $fields = null): ResponseInterface
    {
        $error = ['code' => $code, 'message' => $message];
        if ($fields !== null) {
            $error['fields'] = $fields;
        }

        return $this->response->setStatusCode($status)->setJSON(['error' => $error]);
    }

    /**
     * Übersetzt einen fachlichen {@see ApiException} direkt in den Fehler-Envelope. So bleiben
     * Fehlerpfade auch im FeatureTest-Harness als echte HTTP-Antwort prüfbar (der globale
     * Exceptions-Handler wird dort umgangen).
     */
    protected function fromException(ApiException $e): ResponseInterface
    {
        return $this->respondError($e->getErrorCode(), $e->getMessage(), $e->getStatusCode(), $e->getFields());
    }

    /** Vom `auth`-Filter garantiert gesetzte Shield-User-ID. */
    protected function currentUserId(): int
    {
        return (int) auth()->id();
    }
}
