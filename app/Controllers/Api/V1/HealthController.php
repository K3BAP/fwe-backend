<?php

namespace App\Controllers\Api\V1;

use App\Controllers\Api\BaseApiController;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Liveness-Checks. `index` ist öffentlich (Envelope-Smoke, Uptime), `secure` ist auth-pflichtig und
 * belegt im Test, dass der `auth`-Filter greift (ohne Session → `401`).
 */
class HealthController extends BaseApiController
{
    public function index(): ResponseInterface
    {
        return $this->respondData(['status' => 'ok']);
    }

    public function secure(): ResponseInterface
    {
        return $this->respondData(['status' => 'ok', 'user_id' => $this->currentUserId()]);
    }
}
