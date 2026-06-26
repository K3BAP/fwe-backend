<?php

namespace App\Controllers\Api\V1;

use App\Controllers\Api\BaseApiController;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Auth-Endpunkte (API.md §2). In Slice 1 nur die CSRF-Token-Ausgabe; register/login/logout/me
 * folgen in Slice 2.
 */
class AuthController extends BaseApiController
{
    /**
     * GET /api/v1/auth/csrf — liefert das CSRF-Token (Double-Submit, ADR-004). Die SPA holt es einmal
     * und sendet es danach als `X-CSRF-TOKEN`-Header bei jedem schreibenden Request.
     */
    public function csrf(): ResponseInterface
    {
        helper('security');

        return $this->respondData(['token' => csrf_hash()]);
    }
}
