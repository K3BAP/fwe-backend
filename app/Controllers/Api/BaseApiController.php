<?php

namespace App\Controllers\Api;

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

    /** `204 No Content` (leave, markRead, delete, logout). */
    protected function respondNoContent(): ResponseInterface
    {
        return $this->response->setStatusCode(204);
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

    /** Vom `auth`-Filter garantiert gesetzte Shield-User-ID. */
    protected function currentUserId(): int
    {
        return (int) auth()->id();
    }
}
