-- =====================================================================
-- City-Rallye — Datenbankschema
-- Zieldatenbank: db_team15  (in phpMyAdmin ausführen)
-- Zeichensatz: utf8mb4 (volle Unicode-/Emoji-Unterstützung)
-- =====================================================================
-- Hinweis: Dieses Skript legt die Tabellen idempotent neu an.
-- Es löscht vorhandene Rallye-Tabellen! Für einen frischen Aufbau gedacht.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS participants;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS rallyes;
DROP TABLE IF EXISTS admin_tokens;
DROP TABLE IF EXISTS admins;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- admins — Verwalter-Konten (explizite Benutzername/Passwort-Anmeldung)
-- ---------------------------------------------------------------------
CREATE TABLE admins (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    username      VARCHAR(64)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_admins_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- admin_tokens — opake Bearer-Token für Admin-Sessions
-- ---------------------------------------------------------------------
CREATE TABLE admin_tokens (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    admin_id   INT UNSIGNED NOT NULL,
    token      VARCHAR(64)  NOT NULL,
    expires_at DATETIME     NULL,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_admin_tokens_token (token),
    KEY idx_admin_tokens_admin (admin_id),
    CONSTRAINT fk_admin_tokens_admin FOREIGN KEY (admin_id)
        REFERENCES admins (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- rallyes — eine Stadt-Rallye
-- ---------------------------------------------------------------------
CREATE TABLE rallyes (
    id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
    title             VARCHAR(150) NOT NULL,
    description       TEXT         NULL,
    theme             VARCHAR(100) NULL,
    join_code         VARCHAR(32)  NOT NULL,             -- Slug für Beitritts-Link/QR
    status            ENUM('draft','active','finished') NOT NULL DEFAULT 'draft',
    teams_enabled     TINYINT(1)   NOT NULL DEFAULT 1,
    max_team_size     INT UNSIGNED NULL,                 -- NULL = unbegrenzt
    preset_team_count INT UNSIGNED NULL,                 -- NULL = Teams frei erstellbar
    created_by        INT UNSIGNED NULL,
    created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at        DATETIME     NULL,
    ended_at          DATETIME     NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_rallyes_join_code (join_code),
    KEY idx_rallyes_created_by (created_by),
    CONSTRAINT fk_rallyes_admin FOREIGN KEY (created_by)
        REFERENCES admins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- teams — Teams innerhalb einer Rallye
-- (is_solo = automatisch erzeugtes 1-Personen-Team, wenn Teams deaktiviert)
-- ---------------------------------------------------------------------
CREATE TABLE teams (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    rallye_id  INT UNSIGNED NOT NULL,
    name       VARCHAR(100) NOT NULL,
    is_solo    TINYINT(1)   NOT NULL DEFAULT 0,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_teams_rallye (rallye_id),
    CONSTRAINT fk_teams_rallye FOREIGN KEY (rallye_id)
        REFERENCES rallyes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- participants — Teilnehmende (on-the-fly, ohne Passwort)
-- token = Identität, wird im localStorage gespeichert, vom Admin neu ausstellbar
-- ---------------------------------------------------------------------
CREATE TABLE participants (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    rallye_id    INT UNSIGNED NOT NULL,
    team_id      INT UNSIGNED NULL,
    display_name VARCHAR(80)  NOT NULL,
    token        VARCHAR(64)  NOT NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_participants_token (token),
    KEY idx_participants_rallye (rallye_id),
    KEY idx_participants_team (team_id),
    CONSTRAINT fk_participants_rallye FOREIGN KEY (rallye_id)
        REFERENCES rallyes (id) ON DELETE CASCADE,
    CONSTRAINT fk_participants_team FOREIGN KEY (team_id)
        REFERENCES teams (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- tasks — Stationen / Aufgaben
-- type-spezifische Einstellungen in config (JSON):
--   multiple_choice : { "choices": ["..."], "correct_index": 0 }
--   exact_text      : { "accepted": ["...","..."] }            (normalisierter Vergleich)
--   numeric_estimate: { "target": 42, "tolerance": 0 }         (rangbasiert bewertet)
--   free_text       : { "sample_solutions": ["..."] }          (Auto-Match, sonst Admin)
--   photo_upload    : { }                                       (immer Admin-Bewertung)
--   gps_checkin     : { "lat": 49.75, "lng": 6.64, "radius_m": 50 }
--   onsite_time     : { }                                       (Admin trägt Sekunden ein, Rang)
--   onsite_points   : { }                                       (Admin trägt Rohpunkte ein)
-- ---------------------------------------------------------------------
CREATE TABLE tasks (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    rallye_id  INT UNSIGNED NOT NULL,
    type       ENUM('multiple_choice','exact_text','numeric_estimate','free_text',
                    'photo_upload','gps_checkin','onsite_time','onsite_points') NOT NULL,
    title      VARCHAR(150) NOT NULL,
    prompt     TEXT         NULL,
    position   INT UNSIGNED NOT NULL DEFAULT 0,
    max_points INT UNSIGNED NOT NULL DEFAULT 10,
    config     JSON         NULL,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tasks_rallye (rallye_id),
    CONSTRAINT fk_tasks_rallye FOREIGN KEY (rallye_id)
        REFERENCES rallyes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- submissions — eine Abgabe pro (task, team); unveränderlich nach Abgabe
-- status:        pending   = wartet auf Admin-Bewertung / on-site Eintrag
--                correct   = automatisch als richtig bewertet
--                incorrect = automatisch/manuell als falsch bewertet
--                evaluated = manuell/rangbasiert bewertet (Punkte gesetzt)
-- awarded_points: gesetzt für deterministische & admin-entschiedene Typen;
--                 NULL für rangbasierte Typen (time/numeric) -> beim Lesen berechnet
-- raw_value:      Sekunden (onsite_time) / Rohpunkte (onsite_points) / Schätzwert (numeric)
-- ---------------------------------------------------------------------
CREATE TABLE submissions (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    task_id        INT UNSIGNED NOT NULL,
    team_id        INT UNSIGNED NOT NULL,
    participant_id INT UNSIGNED NULL,                  -- wer abgegeben hat
    answer_text    TEXT         NULL,
    answer_number  DECIMAL(15,4) NULL,
    answer_choice  INT          NULL,                  -- gewählter Index bei multiple_choice
    photo_path     VARCHAR(255) NULL,
    raw_value      DECIMAL(15,4) NULL,
    status         ENUM('pending','correct','incorrect','evaluated') NOT NULL DEFAULT 'pending',
    awarded_points INT          NULL,
    evaluated_by   INT UNSIGNED NULL,
    submitted_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    evaluated_at   DATETIME     NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_submissions_task_team (task_id, team_id),
    KEY idx_submissions_team (team_id),
    KEY idx_submissions_status (status),
    CONSTRAINT fk_submissions_task FOREIGN KEY (task_id)
        REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_submissions_team FOREIGN KEY (team_id)
        REFERENCES teams (id) ON DELETE CASCADE,
    CONSTRAINT fk_submissions_participant FOREIGN KEY (participant_id)
        REFERENCES participants (id) ON DELETE SET NULL,
    CONSTRAINT fk_submissions_evaluator FOREIGN KEY (evaluated_by)
        REFERENCES admins (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
