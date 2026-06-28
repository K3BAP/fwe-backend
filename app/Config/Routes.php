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
    $routes->post('auth/register', 'AuthController::register', ['filter' => 'csrf']);
    $routes->post('auth/login', 'AuthController::login', ['filter' => ['throttle:login,5', 'csrf']]); // 5/min/IP
    $routes->get('users/(:num)', 'ProfileController::show/$1'); // öffentliche Profilkarte (reduziert)

    // Flugtreffen + Spots: Lesen ist öffentlich (Gäste lesen), §11.
    $routes->get('spots', 'SpotController::index');
    $routes->get('spots/(:num)', 'SpotController::show/$1');
    $routes->get('meetups', 'MeetupController::index');
    $routes->get('meetups/(:num)', 'MeetupController::show/$1');

    // --- auth-pflichtig (Shield-Session); csrf zusätzlich für schreibende Methoden ---
    $routes->group('', ['filter' => ['csrf', 'auth']], static function (RouteCollection $routes): void {
        $routes->post('auth/logout', 'AuthController::logout');
        $routes->get('auth/me', 'AuthController::me');

        $routes->get('me/profile', 'ProfileController::me');
        $routes->patch('me/profile', 'ProfileController::updateMe');
        $routes->post('me/avatar', 'ProfileController::uploadAvatar');
        $routes->delete('me/avatar', 'ProfileController::deleteAvatar');
        $routes->get('users', 'ProfileController::index');

        $routes->get('health/secure', 'HealthController::secure');
    });
});
