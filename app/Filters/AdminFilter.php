<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Rollen-Filter für `/api/v1/admin` (ADR-019): verlangt die Shield-Group `admin` (Plattform-Admin,
 * ADR-012/D4). Antwortet wie {@see ApiAuthFilter} als JSON-Envelope statt mit einem Redirect.
 *
 * Bewusst nur eine Rollen-Prüfung: die *fachliche* Autorisierung (BOLA, Selbstschutz) bleibt im
 * Service-Layer (ADR-013) — dieser Filter entscheidet ausschließlich, wer den Bereich überhaupt sieht.
 * Er läuft zusammen mit `auth`, verlässt sich aber nicht darauf und prüft `loggedIn()` selbst.
 */
class AdminFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        if (! auth()->loggedIn() || ! auth()->user()->inGroup('admin')) {
            return service('response')
                ->setStatusCode(403)
                ->setJSON(['error' => ['code' => 'forbidden', 'message' => 'Dazu fehlt dir die Berechtigung.']]);
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        // kein Post-Processing
    }
}
