<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Authentifizierungs-Filter für `/api/v1` (ADR-004): prüft die Shield-Session. Fehlt sie, antwortet
 * der Filter mit `401 unauthenticated` als JSON-Envelope — **nicht** mit Shields Default-Redirect auf
 * eine Login-Seite (eine SPA braucht JSON, keine 302). Autorisierung (BOLA) passiert zusätzlich
 * pro Aktion im Service-Layer, nicht hier.
 */
class ApiAuthFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        if (! auth()->loggedIn()) {
            return service('response')
                ->setStatusCode(401)
                ->setJSON(['error' => ['code' => 'unauthenticated', 'message' => 'Bitte melde dich an.']]);
        }

        // Gesperrte Konten (Admin-Deaktivierung, ADR-019) verlieren die *laufende* Session sofort.
        // Nötig, weil `active` sonst nirgends pro Request geprüft wird: Shields eigene Filter nutzen wir
        // nicht, und `AuthService::login()` sieht das Flag nur beim Anmelden — ohne diese Prüfung liefe
        // eine bereits offene Sitzung nach der Sperre unbegrenzt weiter. (Soft-Delete braucht das nicht:
        // dort findet Shields Provider den User nicht mehr und verwirft die Session selbst.)
        if (! auth()->user()->active) {
            auth()->logout();

            return service('response')
                ->setStatusCode(403)
                ->setJSON(['error' => ['code' => 'account_suspended', 'message' => 'Dieses Konto ist gesperrt.']]);
        }
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        // kein Post-Processing
    }
}
