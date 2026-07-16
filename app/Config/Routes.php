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
    // Wetter-Proxy (ADR-017): gedrosselt, weil jeder Aufruf Open-Meteo-Kontingent kosten kann.
    $routes->get('meetups/(:num)/weather', 'MeetupController::weather/$1', ['filter' => 'throttle:weather,30']); // 30/min/IP
    // KI-Briefing (ADR-018): enger gedrosselt — das Gemini-Frei-Kontingent ist knapper als Open-Meteo.
    $routes->get('meetups/(:num)/briefing', 'MeetupController::briefing/$1', ['filter' => 'throttle:briefing,10']); // 10/min/IP

    // Gruppen: Lesen ist sichtbarkeits-/rollenabhängig (Controller autorisiert; Gäste sehen public).
    $routes->get('groups', 'GroupController::index');
    $routes->get('groups/(:num)', 'GroupController::show/$1');
    $routes->get('groups/(:num)/members', 'GroupController::members/$1');
    $routes->get('groups/(:num)/feed', 'GroupController::feed/$1');
    $routes->get('groups/(:num)/join-requests', 'GroupController::joinRequests/$1');
    $routes->get('groups/(:num)/invites', 'GroupController::invites/$1');
    $routes->get('groups/(:num)/channels', 'GroupController::channels/$1');
    $routes->get('invites/(:segment)', 'GroupController::invitePreview/$1'); // öffentliche Token-Vorschau

    // --- auth-pflichtig (Shield-Session); csrf zusätzlich für schreibende Methoden ---
    $routes->group('', ['filter' => ['csrf', 'auth']], static function (RouteCollection $routes): void {
        $routes->post('auth/logout', 'AuthController::logout');
        $routes->get('auth/me', 'AuthController::me');

        $routes->get('me/profile', 'ProfileController::me');
        $routes->patch('me/profile', 'ProfileController::updateMe');
        $routes->post('me/avatar', 'ProfileController::uploadAvatar');
        $routes->delete('me/avatar', 'ProfileController::deleteAvatar');
        $routes->get('users', 'ProfileController::index');

        // Flugtreffen schreiben (Creator/Admin via BOLA im Service), §5.3/§5.4/§5.5.
        $routes->post('meetups', 'MeetupController::store');
        $routes->patch('meetups/(:num)', 'MeetupController::update/$1');
        $routes->delete('meetups/(:num)', 'MeetupController::destroy/$1');

        // Teilnahme (§8). `/me` vor `(:num)`, damit der Selbst-Austritt eindeutig matcht.
        $routes->post('meetups/(:num)/participants', 'MeetupController::join/$1');
        $routes->delete('meetups/(:num)/participants/me', 'MeetupController::leave/$1');
        $routes->delete('meetups/(:num)/participants/(:num)', 'MeetupController::removeParticipant/$1/$2');

        // Gruppen schreiben (owner/admin via BOLA im Service), §6.3/§6.5/§6.6.
        $routes->post('groups', 'GroupController::store');
        $routes->patch('groups/(:num)', 'GroupController::update/$1');
        $routes->delete('groups/(:num)', 'GroupController::destroy/$1');

        // Mitgliedschaft (§6.8/§6.8b/§6.11/§6.11b). Spezifische Segmente vor `(:num)`.
        $routes->post('groups/(:num)/members', 'GroupController::join/$1');
        $routes->delete('groups/(:num)/members', 'GroupController::leave/$1');
        $routes->post('groups/(:num)/join-requests', 'GroupController::requestJoin/$1');
        $routes->delete('groups/(:num)/join-requests/mine', 'GroupController::withdrawRequest/$1');

        // Verwaltung: Rollen/Ban/Kick/Transfer (§6.9*), Antrags-Entscheid (§6.13*), Invites (§6.14/§6.16/§6.18).
        $routes->patch('groups/(:num)/members/(:num)', 'GroupController::setMemberRole/$1/$2');
        $routes->post('groups/(:num)/members/(:num)/ban', 'GroupController::toggleBan/$1/$2');
        $routes->delete('groups/(:num)/members/(:num)', 'GroupController::removeMember/$1/$2');
        $routes->post('groups/(:num)/transfer', 'GroupController::transfer/$1');
        $routes->post('groups/(:num)/join-requests/(:num)/approve', 'GroupController::approveRequest/$1/$2');
        $routes->post('groups/(:num)/join-requests/(:num)/reject', 'GroupController::rejectRequest/$1/$2');
        $routes->post('groups/(:num)/invites', 'GroupController::createInvite/$1');
        $routes->delete('groups/(:num)/invites/(:num)', 'GroupController::revokeInvite/$1/$2');
        $routes->post('invites/(:segment)/accept', 'GroupController::acceptInvite/$1');

        // Channels (§7.2–§7.4) + Feed-Writes (§8.2–§8.6).
        $routes->post('groups/(:num)/channels', 'GroupController::createChannel/$1');
        $routes->patch('groups/(:num)/channels/(:num)', 'GroupController::renameChannel/$1/$2');
        $routes->delete('groups/(:num)/channels/(:num)', 'GroupController::deleteChannel/$1/$2');
        $routes->post('groups/(:num)/feed', 'GroupController::createFeedPost/$1');
        $routes->patch('groups/(:num)/feed/(:num)', 'GroupController::updateFeedPost/$1/$2');
        $routes->delete('groups/(:num)/feed/(:num)', 'GroupController::deleteFeedPost/$1/$2');
        $routes->post('groups/(:num)/feed/(:num)/pin', 'GroupController::togglePin/$1/$2');
        $routes->post('groups/(:num)/feed/(:num)/reactions', 'GroupController::reactToPost/$1/$2');

        // Chat (§9–10) — privat (komplett im Auth-Filter). Spezifische Segmente vor `(:num)`.
        $routes->get('conversations', 'ConversationController::index');
        $routes->get('conversations/unread-count', 'ConversationController::unreadCount');
        $routes->post('conversations/direct', 'ConversationController::openDm');
        $routes->get('conversations/(:num)', 'ConversationController::show/$1');
        $routes->post('conversations/(:num)/read', 'ConversationController::markRead/$1');
        $routes->get('conversations/(:num)/messages', 'ConversationController::messages/$1');
        $routes->post('conversations/(:num)/messages', 'ConversationController::sendMessage/$1');
        $routes->patch('conversations/(:num)/messages/(:num)', 'ConversationController::editMessage/$1/$2');
        $routes->delete('conversations/(:num)/messages/(:num)', 'ConversationController::deleteMessage/$1/$2');
        $routes->post('conversations/(:num)/messages/(:num)/reactions', 'ConversationController::reactToMessage/$1/$2');

        // Benachrichtigungen (§11) — self. Spezifische Segmente vor `(:num)`.
        $routes->get('notifications', 'NotificationController::index');
        $routes->get('notifications/unread-count', 'NotificationController::unreadCount');
        $routes->post('notifications/read-all', 'NotificationController::markAllRead');
        $routes->post('notifications/(:num)/read', 'NotificationController::markRead/$1');

        $routes->get('health/secure', 'HealthController::secure');
    });
});
