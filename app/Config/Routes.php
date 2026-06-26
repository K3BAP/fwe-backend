<?php

use CodeIgniter\Router\RouteCollection;

/**
 * @var RouteCollection $routes
 */
$routes->get('/', 'Home::index');

/**
 * FlightMeet-API, versioniert unter `/api/v1` (06-backend §2). `auto-routing` ist global aus
 * (Config\Routing::$autoRoute = false) — nur die hier definierten Routen existieren.
 *
 * Filter-Strategie:
 *  - `csrf`  → schützt alle schreibenden Methoden (GET wird im ApiCsrfFilter durchgelassen).
 *  - `auth`  → Shield-Session-Pflicht für geschützte Routen.
 * Öffentliche GETs (Liveness, CSRF-Token) sowie register/login (Slice 2) liegen außerhalb von `auth`.
 */
$routes->group('api/v1', ['namespace' => 'App\Controllers\Api\V1'], static function (RouteCollection $routes): void {
    // --- öffentlich ---
    $routes->get('health', 'HealthController::index');
    $routes->get('auth/csrf', 'AuthController::csrf');

    // --- auth-pflichtig (Shield-Session); csrf zusätzlich für schreibende Methoden ---
    $routes->group('', ['filter' => ['csrf', 'auth']], static function (RouteCollection $routes): void {
        $routes->get('health/secure', 'HealthController::secure');
    });
});
