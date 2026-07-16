<?php

namespace Config;

use CodeIgniter\Events\Events;
use CodeIgniter\Exceptions\FrameworkException;
use CodeIgniter\HotReloader\HotReloader;
use Throwable;

/*
 * --------------------------------------------------------------------
 * Application Events
 * --------------------------------------------------------------------
 * Events allow you to tap into the execution of the program without
 * modifying or extending core files. This file provides a central
 * location to define your events, though they can always be added
 * at run-time, also, if needed.
 *
 * You create code that can execute by subscribing to events with
 * the 'on()' method. This accepts any form of callable, including
 * Closures, that will be executed when the event is triggered.
 *
 * Example:
 *      Events::on('create', [$myInstance, 'myMethod']);
 */

/*
 * MySQL-Session auf UTC pinnen (ADR: appTimezone = UTC). Ohne dies stehen die Spalten-Defaults
 * `CURRENT_TIMESTAMP` in der **lokalen** Server-Zeit (MAMP/Webspace = CEST), während der Rest der App
 * (PHP `gmdate`, SQL `UTC_TIMESTAMP()`, Presenter `…Z`) UTC annimmt — das verschiebt angezeigte
 * Zeitstempel und bricht das 15-min-Edit-Fenster (Chat) sowie die Notification-Sortierung. In allen
 * Umgebungen aktiv; best-effort (eine fehlende DB darf den Request nicht abbrechen).
 */
Events::on('pre_system', static function (): void {
    try {
        $db = \Config\Database::connect();
        if ($db->DBDriver === 'MySQLi') {
            $db->query("SET time_zone = '+00:00'");
        }
    } catch (Throwable $e) {
        log_message('error', 'Could not pin DB session timezone to UTC: ' . $e->getMessage());
    }
});

Events::on('pre_system', static function (): void {
    if (ENVIRONMENT !== 'testing') {
        if (ini_get('zlib.output_compression')) {
            throw FrameworkException::forEnabledZlibOutputCompression();
        }

        while (ob_get_level() > 0) {
            ob_end_flush();
        }

        ob_start(static fn ($buffer) => $buffer);
    }

    /*
     * --------------------------------------------------------------------
     * Debug Toolbar Listeners.
     * --------------------------------------------------------------------
     * If you delete, they will no longer be collected.
     */
    if (CI_DEBUG && ! is_cli()) {
        Events::on('DBQuery', 'CodeIgniter\Debug\Toolbar\Collectors\Database::collect');
        service('toolbar')->respond();
        // Hot Reload route - for framework use on the hot reloader.
        if (ENVIRONMENT === 'development') {
            service('routes')->get('__hot-reload', static function (): void {
                (new HotReloader())->run();
            });
        }
    }
});
