<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Fachlicher API-Fehler, der 1:1 in den Antwort-Envelope übersetzt wird (06-backend §3):
 * `code` (englisch, stabil, maschinenlesbar) + `message` (deutsch, anzeigbar) + optionale
 * `fields`-Map (nur bei Validierung). Services/Controller werfen ihn, ohne HTTP-Details zu kennen;
 * der {@see \App\Libraries\ApiExceptionHandler} bzw. {@see \App\Controllers\Api\BaseApiController}
 * formt daraus die Antwort.
 */
final class ApiException extends RuntimeException
{
    /** @param array<string, string>|null $fields */
    public function __construct(
        private readonly string $errorCode,
        string $message,
        private readonly int $status,
        private readonly ?array $fields = null,
    ) {
        parent::__construct($message);
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    public function getStatusCode(): int
    {
        return $this->status;
    }

    /** @return array<string, string>|null */
    public function getFields(): ?array
    {
        return $this->fields;
    }

    public static function notFound(string $message = 'Nicht gefunden.'): self
    {
        return new self('not_found', $message, 404);
    }

    public static function forbidden(string $message = 'Dazu fehlt dir die Berechtigung.'): self
    {
        return new self('forbidden', $message, 403);
    }

    public static function conflict(string $code, string $message): self
    {
        return new self($code, $message, 409);
    }

    /** @param array<string, string> $fields */
    public static function validation(array $fields, string $message = 'Bitte prüfe deine Eingaben.'): self
    {
        return new self('validation_error', $message, 422, $fields);
    }

    /** Ein externer Dienst (aktuell: Open-Meteo, ADR-017) antwortet nicht oder fehlerhaft. */
    public static function upstreamUnavailable(string $code, string $message): self
    {
        return new self($code, $message, 503);
    }
}
