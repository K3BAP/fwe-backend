-- =====================================================================
-- City-Rallye — Beispieldaten "Trier Entdecker-Rallye"
-- Voraussetzung: schema.sql wurde zuvor ausgeführt.
-- In phpMyAdmin auf db_team15 ausführen.
-- ---------------------------------------------------------------------
-- Beispiel-Admin:  Benutzer "admin"   Passwort "rallye2026"
-- Beitritts-Code:  trier  (Link:  /r/trier)
-- =====================================================================

SET NAMES utf8mb4;

-- --- Admin -----------------------------------------------------------
INSERT INTO admins (username, password_hash)
VALUES ('admin', '$2y$12$XxGJnnIYE9fTvQirz4u.HOG50J36c5.macwlK0/ntyb4BAOSCw/eu');
SET @admin_id = LAST_INSERT_ID();

-- --- Rallye ----------------------------------------------------------
INSERT INTO rallyes
    (title, description, theme, join_code, status, teams_enabled, max_team_size, preset_team_count, created_by, started_at)
VALUES
    ('Trier Entdecker-Rallye',
     'Entdeckt die älteste Stadt Deutschlands! Löst Aufgaben an den schönsten Stationen Triers und sammelt Punkte für euer Team.',
     'Stadt Trier', 'trier', 'active', 1, 5, NULL, @admin_id, NOW());
SET @rallye_id = LAST_INSERT_ID();

-- --- Teams -----------------------------------------------------------
INSERT INTO teams (rallye_id, name) VALUES (@rallye_id, 'Die Römer');
SET @team_roemer = LAST_INSERT_ID();
INSERT INTO teams (rallye_id, name) VALUES (@rallye_id, 'Mosel-Piraten');
SET @team_mosel = LAST_INSERT_ID();
INSERT INTO teams (rallye_id, name) VALUES (@rallye_id, 'Porta-Profis');
SET @team_porta = LAST_INSERT_ID();

-- --- Teilnehmende ----------------------------------------------------
INSERT INTO participants (rallye_id, team_id, display_name, token) VALUES
    (@rallye_id, @team_roemer, 'Lena',  'demo-token-lena-0001'),
    (@rallye_id, @team_roemer, 'Tom',   'demo-token-tom-0002'),
    (@rallye_id, @team_mosel,  'Sarah', 'demo-token-sarah-0003'),
    (@rallye_id, @team_porta,  'Jonas', 'demo-token-jonas-0004');

-- --- Aufgaben / Stationen -------------------------------------------
-- 1) Porta Nigra — Multiple Choice
INSERT INTO tasks (rallye_id, type, title, prompt, position, max_points, config) VALUES
    (@rallye_id, 'multiple_choice', 'Porta Nigra',
     'Aus welchem Material wurde die Porta Nigra um 170 n. Chr. erbaut?',
     1, 10, JSON_OBJECT(
        'choices', JSON_ARRAY('Sandstein', 'Backstein', 'Marmor', 'Granit'),
        'correct_index', 0));

-- 2) Trierer Dom — Exakter Text / Code
INSERT INTO tasks (rallye_id, type, title, prompt, position, max_points, config) VALUES
    (@rallye_id, 'exact_text', 'Hoher Dom zu Trier',
     'Findet die Jahreszahl der ersten Bischofskirche auf der Infotafel am Dom und tragt sie ein.',
     2, 10, JSON_OBJECT('accepted', JSON_ARRAY('326', '326 n. Chr.')));

-- 3) Marktbrunnen am Hauptmarkt — Schätzaufgabe
INSERT INTO tasks (rallye_id, type, title, prompt, position, max_points, config) VALUES
    (@rallye_id, 'numeric_estimate', 'Marktbrunnen Hauptmarkt',
     'Wie viele Figuren schmücken den Marktbrunnen? Gebt eure beste Schätzung ab – am nächsten dran gewinnt am meisten Punkte!',
     3, 10, JSON_OBJECT('target', 12, 'tolerance', 0));

-- 4) Karl-Marx-Haus — Freitext (Admin-Bewertung, mit Musterlösungen)
INSERT INTO tasks (rallye_id, type, title, prompt, position, max_points, config) VALUES
    (@rallye_id, 'free_text', 'Karl-Marx-Haus',
     'Nennt ein berühmtes Werk von Karl Marx, das in Trier geboren wurde.',
     4, 10, JSON_OBJECT('sample_solutions', JSON_ARRAY('Das Kapital', 'Kommunistisches Manifest', 'Manifest der Kommunistischen Partei')));

-- 5) Römerbrücke — Foto-Upload (Admin-Bewertung)
INSERT INTO tasks (rallye_id, type, title, prompt, position, max_points, config) VALUES
    (@rallye_id, 'photo_upload', 'Römerbrücke',
     'Macht ein kreatives Gruppenfoto auf der ältesten Brücke Deutschlands!',
     5, 10, NULL);

-- 6) Kaiserthermen — GPS Check-in
INSERT INTO tasks (rallye_id, type, title, prompt, position, max_points, config) VALUES
    (@rallye_id, 'gps_checkin', 'Kaiserthermen',
     'Begebt euch zu den Kaiserthermen und checkt vor Ort ein.',
     6, 10, JSON_OBJECT('lat', 49.7497, 'lng', 6.6447, 'radius_m', 80));

-- 7) Sprint im Palastgarten — On-Site Zeit (rangbasiert)
INSERT INTO tasks (rallye_id, type, title, prompt, position, max_points, config) VALUES
    (@rallye_id, 'onsite_time', 'Sprint im Palastgarten',
     'Lauft die markierte Strecke im Palastgarten. Die Aufsicht stoppt eure Zeit – je schneller, desto mehr Punkte!',
     7, 10, NULL);

-- 8) Flunkyball am Moselufer — On-Site Punkte
INSERT INTO tasks (rallye_id, type, title, prompt, position, max_points, config) VALUES
    (@rallye_id, 'onsite_points', 'Flunkyball am Moselufer',
     'Tretet beim Flunkyball gegen die Aufsicht an. Eure erreichten Punkte werden vor Ort eingetragen.',
     8, 10, NULL);
