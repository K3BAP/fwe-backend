<?php

namespace App\Filters;

use CodeIgniter\Filters\CSRF as BaseCsrfFilter;
use CodeIgniter\HTTP\RequestInterface;

/**
 * CSRF-Filter für die API (ADR-004, Double-Submit). Erweitert den CI4-CSRF-Filter um zwei Dinge:
 *  - **Lesende Methoden** (GET/HEAD/OPTIONS) werden durchgelassen (kein Token nötig).
 *  - In der **Testumgebung** wird CSRF übersprungen — Feature-Tests prüfen die Domänenlogik, nicht
 *    das Token-Handshake; so bleiben Write-Tests schlank, ohne die echte CSRF-Härtung in Dev/Prod
 *    aufzuweichen.
 * Bei ungültigem Token wirft der Eltern-Filter eine SecurityException → `403 csrf_invalid`.
 */
class ApiCsrfFilter extends BaseCsrfFilter
{
    public function before(RequestInterface $request, $arguments = null)
    {
        if (ENVIRONMENT === 'testing') {
            return null;
        }

        if (in_array(strtoupper($request->getMethod()), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return null;
        }

        return parent::before($request, $arguments);
    }
}
