<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Services;

/**
 * Rate-Limiting per CI4-`Throttler` (FileCache-/DB-gestützt, kein Redis — 06-backend §14).
 * Verwendung als Routen-Filter mit Argumenten: `throttle:<bucket>,<proMinute>`, z.B.
 * `throttle:login,5` → 5 Versuche/Minute/IP. Bei Überschreitung: `429 rate_limited`.
 */
class ThrottleFilter implements FilterInterface
{
    private const DEFAULT_CAPACITY = 60;

    public function before(RequestInterface $request, $arguments = null)
    {
        $bucket   = $arguments[0] ?? 'global';
        $capacity = isset($arguments[1]) ? (int) $arguments[1] : self::DEFAULT_CAPACITY;

        // Cache-sicherer Schlüssel: IPv6 (`::1`) und Doppelpunkte sind reservierte Cache-Zeichen.
        $key = 'throttle_' . preg_replace('/[^a-z0-9]/i', '_', $bucket . '_' . $request->getIPAddress());

        if (Services::throttler()->check($key, $capacity, MINUTE) === false) {
            return service('response')
                ->setStatusCode(429)
                ->setJSON(['error' => ['code' => 'rate_limited', 'message' => 'Zu viele Versuche. Bitte einen Moment warten.']]);
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        // kein Post-Processing
    }
}
