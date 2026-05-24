<?php

namespace Config;

use CodeIgniter\Config\BaseService;

/**
 * Services Configuration file.
 *
 * Services are simply other classes/libraries that the system uses
 * to do its job. This is used by CodeIgniter to allow the core of the
 * framework to be swapped out easily without affecting the usage within
 * the rest of your application.
 *
 * This file holds any application-specific services, or service overrides
 * that you might need. An example has been included with the general
 * method format you should use for your service methods. For more examples,
 * see the core Services file at system/Config/Services.php.
 */
class Services extends BaseService
{
    /**
     * Im aktuellen Request authentifizierte Identität (Admin/Teilnehmer).
     */
    public static function authState($getShared = true): \App\Libraries\AuthState
    {
        if ($getShared) {
            return static::getSharedInstance('authState');
        }

        return new \App\Libraries\AuthState();
    }

    /**
     * Bewertet eine einzelne Abgabe bei der Abgabe (deterministische Typen).
     */
    public static function grading($getShared = true): \App\Services\GradingService
    {
        if ($getShared) {
            return static::getSharedInstance('grading');
        }

        return new \App\Services\GradingService();
    }

    /**
     * Berechnet Punkte/Leaderboard beim Lesen (inkl. rangbasierter Typen).
     */
    public static function scoring($getShared = true): \App\Services\ScoringService
    {
        if ($getShared) {
            return static::getSharedInstance('scoring');
        }

        return new \App\Services\ScoringService();
    }
}
