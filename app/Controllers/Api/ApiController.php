<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use CodeIgniter\API\ResponseTrait;

/**
 * Basis für alle API-Controller: JSON-Antworten + Zugriff auf den AuthState.
 */
abstract class ApiController extends BaseController
{
    use ResponseTrait;

    protected $format = 'json';

    /** @return array<string,mixed> JSON-Body des Requests als assoziatives Array. */
    protected function body(): array
    {
        $data = $this->request->getJSON(true);

        return is_array($data) ? $data : [];
    }

    /** @return array<string,mixed>|null */
    protected function currentParticipant(): ?array
    {
        return service('authState')->participant;
    }

    /** @return array<string,mixed>|null */
    protected function currentAdmin(): ?array
    {
        return service('authState')->admin;
    }
}
