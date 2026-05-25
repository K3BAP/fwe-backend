<?php

use CodeIgniter\Router\RouteCollection;

/**
 * @var RouteCollection $routes
 */

// SPA-Einstiegspunkt (Fallback erfolgt über public/.htaccess auf index.html)
$routes->get('/', 'Home::index');

// =====================================================================
// REST-API  — alle Endpunkte unter /api, JSON
// =====================================================================
$routes->group('api', ['namespace' => 'App\Controllers\Api'], static function ($routes) {

    // CORS-Preflight für alle API-Routen zulassen
    $routes->options('(:any)', static fn () => service('response')->setStatusCode(204));

    // ----- Öffentlich (keine Authentifizierung) -----
    $routes->post('admin/login', 'AuthController::login');
    $routes->get('rallyes/(:segment)', 'RallyeController::showByCode/$1');   // Beitritts-Info per join_code
    $routes->post('rallyes/(:segment)/join', 'AuthController::join/$1');     // Teilnehmer anlegen

    // ----- Teilnehmer (Bearer = participant token) -----
    $routes->group('', ['filter' => 'participantAuth'], static function ($routes) {
        $routes->get('me', 'AuthController::me');
        $routes->get('rallyes/(:num)/tasks', 'TaskController::forParticipant/$1');
        $routes->get('rallyes/(:num)/teams', 'TeamController::index/$1');
        $routes->post('teams', 'TeamController::create');
        $routes->post('teams/(:num)/join', 'TeamController::join/$1');
        $routes->post('tasks/(:num)/submit', 'SubmissionController::submit/$1');
        $routes->post('tasks/(:num)/photo', 'SubmissionController::uploadPhoto/$1');
        $routes->get('rallyes/(:num)/leaderboard', 'LeaderboardController::index/$1');
        $routes->get('me/results', 'LeaderboardController::myResults');
    });

    // ----- Admin (Bearer = admin token) -----
    $routes->group('admin', ['filter' => 'adminAuth'], static function ($routes) {
        $routes->post('logout', 'AuthController::logout');
        $routes->get('me', 'AuthController::adminMe');

        // Rallyes
        $routes->get('rallyes', 'Admin\\RallyeAdminController::index');
        $routes->get('rallyes/(:num)', 'Admin\\RallyeAdminController::show/$1');
        $routes->post('rallyes', 'Admin\\RallyeAdminController::create');
        $routes->put('rallyes/(:num)', 'Admin\\RallyeAdminController::update/$1');
        $routes->post('rallyes/(:num)/status', 'Admin\\RallyeAdminController::setStatus/$1');
        $routes->delete('rallyes/(:num)', 'Admin\\RallyeAdminController::delete/$1');

        // Aufgaben
        $routes->get('rallyes/(:num)/tasks', 'Admin\\TaskAdminController::index/$1');
        $routes->post('rallyes/(:num)/tasks', 'Admin\\TaskAdminController::create/$1');
        $routes->put('rallyes/(:num)/tasks/reorder', 'Admin\\TaskAdminController::reorder/$1');
        $routes->put('tasks/(:num)', 'Admin\\TaskAdminController::update/$1');
        $routes->delete('tasks/(:num)', 'Admin\\TaskAdminController::delete/$1');

        // Bewertung
        $routes->get('rallyes/(:num)/pending', 'Admin\\EvaluationController::pending/$1');
        $routes->post('submissions/(:num)/evaluate', 'Admin\\EvaluationController::evaluate/$1');
        $routes->post('submissions/onsite', 'Admin\\EvaluationController::onsite');

        // Leaderboard / Auswertung
        $routes->get('rallyes/(:num)/leaderboard', 'Admin\\LeaderboardAdminController::index/$1');

        // Teilnehmer- & Admin-Verwaltung
        $routes->get('rallyes/(:num)/participants', 'Admin\\ParticipantAdminController::index/$1');
        $routes->post('participants/(:num)/reissue', 'Admin\\ParticipantAdminController::reissue/$1');
        $routes->get('admins', 'Admin\\AdminUserController::index');
        $routes->post('admins', 'Admin\\AdminUserController::create');
        $routes->delete('admins/(:num)', 'Admin\\AdminUserController::delete/$1');
    });
});

// Foto-Auslieferung (geschützt per participant- ODER admin-Token im Controller)
$routes->get('media/photos/(:segment)', 'Media::photo/$1');
