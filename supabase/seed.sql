-- ============================================================
-- LeagueOps — Seed Data
-- Run AFTER schema.sql in Supabase SQL editor
-- ============================================================

-- ============================================================
-- EVENT
-- ============================================================
INSERT INTO events (id, name, location, start_date, end_date) VALUES
(1, 'Knights Lacrosse Summer Invitational 2025', 'Riverside Sports Complex, Jacksonville FL', '2025-06-14', '2025-06-15')
ON CONFLICT DO NOTHING;

-- Reset sequence
SELECT setval('events_id_seq', 1);

-- ============================================================
-- EVENT DATES
-- ============================================================
INSERT INTO event_dates (id, event_id, date, label, day_number) VALUES
(1, 1, '2025-06-14', 'SAT · JUN 14, 2025', 1),
(2, 1, '2025-06-15', 'SUN · JUN 15, 2025', 2)
ON CONFLICT DO NOTHING;

SELECT setval('event_dates_id_seq', 2);

-- ============================================================
-- FIELDS
-- ============================================================
INSERT INTO fields (id, event_id, name, number, map_x, map_y, map_w, map_h) VALUES
(1, 1, 'Field 1',  '1',  40,  40,  160, 100),
(2, 1, 'Field 2',  '2',  230, 40,  160, 100),
(3, 1, 'Field 3',  '3',  420, 40,  160, 100),
(4, 1, 'Field 4',  '4',  40,  170, 160, 100),
(5, 1, 'Field 5',  '5',  230, 170, 160, 100),
(6, 1, 'Field 6',  '6',  420, 170, 160, 100),
(7, 1, 'Field 1A', '1A', 40,  300, 160, 100),
(8, 1, 'Field 1B', '1B', 230, 300, 160, 100)
ON CONFLICT DO NOTHING;

SELECT setval('fields_id_seq', 8);

-- ============================================================
-- TEAMS
-- ============================================================
INSERT INTO teams (id, event_id, name, division, association, color) VALUES
(1,  1, 'Creeks',   'U14', 'Jacksonville LAX', '#0B3D91'),
(2,  1, 'Riptide',  'U14', 'Northeast Lacrosse', '#D62828'),
(3,  1, 'Storm',    'U14', 'First Coast LAX', '#22c55e'),
(4,  1, 'Eagles',   'U14', 'Duval County LAX', '#f59e0b'),
(5,  1, 'Phoenix',  'U12', 'Jacksonville LAX', '#8b5cf6'),
(6,  1, 'Thunder',  'U12', 'Northeast Lacrosse', '#06b6d4'),
(7,  1, 'Blaze',    'U12', 'First Coast LAX', '#f97316'),
(8,  1, 'Hawks',    'U12', 'Duval County LAX', '#ec4899'),
(9,  1, 'Wildcats', 'U16', 'Jacksonville LAX', '#0B3D91'),
(10, 1, 'Fury',     'U16', 'Northeast Lacrosse', '#D62828'),
(11, 1, 'Surge',    'U16', 'First Coast LAX', '#22c55e'),
(12, 1, 'Vipers',   'U16', 'Duval County LAX', '#f59e0b'),
(13, 1, 'Knights',  'U12B', 'Jacksonville LAX', '#0B3D91'),
(14, 1, 'Warriors', 'U12B', 'Northeast Lacrosse', '#D62828')
ON CONFLICT DO NOTHING;

SELECT setval('teams_id_seq', 14);

-- ============================================================
-- PLAYERS
-- ============================================================
INSERT INTO players (id, team_id, name, number, position) VALUES
-- Creeks (team 1)
(1,  1, 'Megan Packer',   8,  'Attack'),
(2,  1, 'Ashton Packer',  12, 'Midfield'),
(3,  1, 'Riley Hanna',    4,  'Defense'),
(4,  1, 'Jess Fowler',    22, 'Goalie'),
(5,  1, 'Tara Bloom',     7,  'Attack'),
(6,  1, 'Claire West',    15, 'Midfield'),
(7,  1, 'Maya Torres',    3,  'Defense'),
(8,  1, 'Lily Chen',      11, 'Midfield'),
(9,  1, 'Ava Brooks',     19, 'Attack'),
(10, 1, 'Grace Kim',      24, 'Defense'),
-- Riptide (team 2)
(11, 2, 'Jordan Reyes',   5,  'Attack'),
(12, 2, 'Kayla Smith',    9,  'Attack'),
(13, 2, 'Nina Russo',     14, 'Midfield'),
(14, 2, 'Aria Patel',     2,  'Defense'),
(15, 2, 'Sam Ortiz',      17, 'Midfield'),
(16, 2, 'Zoe Kim',        21, 'Goalie'),
(17, 2, 'Eva Grant',      6,  'Defense'),
(18, 2, 'Bri Stone',      10, 'Attack'),
(19, 2, 'Chloe Park',     16, 'Midfield'),
(20, 2, 'Nadia Cruz',     28, 'Defense'),
-- Storm (team 3)
(21, 3, 'Cora Fields',    1,  'Goalie'),
(22, 3, 'Lena Park',      16, 'Midfield'),
(23, 3, 'Hanna Beck',     19, 'Attack'),
(24, 3, 'Rae Cole',       7,  'Defense'),
(25, 3, 'Sofia Lane',     13, 'Midfield'),
(26, 3, 'Iris Moon',      20, 'Attack'),
(27, 3, 'Dana Hill',      4,  'Defense'),
(28, 3, 'Luna Ray',       11, 'Midfield'),
-- Eagles (team 4)
(29, 4, 'Ivy Walsh',      3,  'Attack'),
(30, 4, 'Penny Fox',      11, 'Midfield'),
(31, 4, 'Dana Hill',      20, 'Defense'),
(32, 4, 'Luna Ray',       1,  'Goalie'),
(33, 4, 'Beth Snow',      9,  'Attack'),
(34, 4, 'Quinn Wells',    6,  'Midfield'),
(35, 4, 'Hazel Scott',    18, 'Defense'),
-- Phoenix (team 5)
(36, 5, 'Kylie Marsh',    2,  'Attack'),
(37, 5, 'Jade Ellis',     7,  'Midfield'),
(38, 5, 'Nora Bell',      14, 'Defense'),
(39, 5, 'Poppy Rose',     1,  'Goalie'),
(40, 5, 'Wren Lake',      10, 'Attack'),
(41, 5, 'Stella Vance',   5,  'Midfield'),
-- Thunder (team 6)
(42, 6, 'Mae Foster',     3,  'Attack'),
(43, 6, 'Rory Quinn',     8,  'Midfield'),
(44, 6, 'Sage Bloom',     15, 'Defense'),
(45, 6, 'Ember Reed',     1,  'Goalie'),
(46, 6, 'Fern Clay',      12, 'Midfield'),
-- Blaze (team 7)
(47, 7, 'Piper Cross',    4,  'Attack'),
(48, 7, 'Rowan Drake',    9,  'Midfield'),
(49, 7, 'Lark Stone',     16, 'Defense'),
(50, 7, 'Willa Hayes',    1,  'Goalie'),
-- Hawks (team 8)
(51, 8, 'Scout Carr',     6,  'Attack'),
(52, 8, 'River James',    11, 'Midfield'),
(53, 8, 'Blythe Kern',    17, 'Defense'),
(54, 8, 'Echo Nash',      1,  'Goalie'),
-- Wildcats (team 9)
(55, 9, 'Sloane Beck',    2,  'Attack'),
(56, 9, 'Quinn Avery',    7,  'Midfield'),
(57, 9, 'Brynn Cole',     14, 'Defense'),
(58, 9, 'Paige Dunn',     1,  'Goalie'),
(59, 9, 'Harlow King',    10, 'Attack'),
(60, 9, 'Ember West',     5,  'Midfield'),
-- Fury (team 10)
(61, 10, 'Briar Lane',    3,  'Attack'),
(62, 10, 'Camden Ross',   8,  'Midfield'),
(63, 10, 'Reign Fox',     15, 'Defense'),
(64, 10, 'Story Hall',    1,  'Goalie'),
(65, 10, 'Nova Green',    11, 'Midfield'),
-- Surge (team 11)
(66, 11, 'Vera Nash',     4,  'Attack'),
(67, 11, 'Iris Reed',     9,  'Midfield'),
(68, 11, 'Calla Storm',   18, 'Defense'),
(69, 11, 'Wren Bell',     1,  'Goalie'),
-- Vipers (team 12)
(70, 12, 'Lila Cross',    6,  'Attack'),
(71, 12, 'Zara Quinn',    12, 'Midfield'),
(72, 12, 'Faye Adams',    20, 'Defense'),
(73, 12, 'Blair Hunt',    1,  'Goalie'),
-- Knights (team 13)
(74, 13, 'Owen Chase',    7,  'Attack'),
(75, 13, 'Finn Reed',     13, 'Midfield'),
(76, 13, 'Cole Nash',     5,  'Defense'),
(77, 13, 'Blake Storm',   1,  'Goalie'),
(78, 13, 'Tanner Woods',  10, 'Attack'),
-- Warriors (team 14)
(79, 14, 'Reid Cross',    4,  'Attack'),
(80, 14, 'Lane Hayes',    8,  'Midfield'),
(81, 14, 'Drew Carr',     16, 'Defense'),
(82, 14, 'Parker Fox',    1,  'Goalie'),
(83, 14, 'Greer Nash',    11, 'Midfield')
ON CONFLICT DO NOTHING;

SELECT setval('players_id_seq', 83);

-- ============================================================
-- REFEREES
-- ============================================================
INSERT INTO referees (id, event_id, name, grade_level, phone, checked_in) VALUES
(1, 1, 'Marcus Webb',     'Grade 7', '904-555-0101', true),
(2, 1, 'Danielle Cruz',   'Grade 6', '904-555-0102', true),
(3, 1, 'Trevor Banks',    'Grade 8', '904-555-0103', true),
(4, 1, 'Sandra Okafor',   'Grade 6', '904-555-0104', false),
(5, 1, 'Kyle Marsh',      'Grade 7', '904-555-0105', true),
(6, 1, 'Amy Chen',        'Grade 5', '904-555-0106', true),
(7, 1, 'Deon Williams',   'Grade 7', '904-555-0107', true),
(8, 1, 'Rachel Ford',     'Grade 6', '904-555-0108', false),
(9, 1, 'James Nguyen',    'Grade 8', '904-555-0109', true),
(10,1, 'Priya Sharma',    'Grade 5', '904-555-0110', true)
ON CONFLICT DO NOTHING;

SELECT setval('referees_id_seq', 10);

-- ============================================================
-- VOLUNTEERS
-- ============================================================
INSERT INTO volunteers (id, event_id, name, role, phone, checked_in) VALUES
(1,  1, 'Pat Hughes',   'Score Table',  '904-555-0201', true),
(2,  1, 'Lisa Monroe',  'Clock',        '904-555-0202', true),
(3,  1, 'Jim Carter',   'Field Marshal','904-555-0203', true),
(4,  1, 'Ann Vega',     'Score Table',  '904-555-0204', true),
(5,  1, 'Chris Dunn',   'Clock',        '904-555-0205', false),
(6,  1, 'Maria Leal',   'Field Marshal','904-555-0206', false),
(7,  1, 'Tom Brady',    'Operations',   '904-555-0207', true),
(8,  1, 'Sue Park',     'Score Table',  '904-555-0208', true),
(9,  1, 'Ray Ortiz',    'Gate',         '904-555-0209', true),
(10, 1, 'Dawn Wells',   'Clock',        '904-555-0210', true)
ON CONFLICT DO NOTHING;

SELECT setval('volunteers_id_seq', 10);

-- ============================================================
-- GAMES — DAY 1 (event_date_id = 1)
-- ============================================================
INSERT INTO games (id, event_id, event_date_id, field_id, home_team_id, away_team_id, division, scheduled_time, status, home_score, away_score) VALUES
(1,  1, 1, 1, 1,  2,  'U14',  '8:00 AM',  'Final',     3, 1),
(2,  1, 1, 2, 3,  4,  'U14',  '8:00 AM',  'Final',     2, 2),
(3,  1, 1, 3, 5,  6,  'U12',  '8:00 AM',  'Final',     4, 0),
(4,  1, 1, 4, 7,  8,  'U12',  '9:00 AM',  'Final',     1, 3),
(5,  1, 1, 5, 9,  10, 'U16',  '9:00 AM',  'Live',      2, 1),
(6,  1, 1, 6, 11, 12, 'U16',  '9:00 AM',  'Halftime',  1, 1),
(7,  1, 1, 1, 13, 14, 'U12B', '10:00 AM', 'Live',      3, 2),
(8,  1, 1, 2, 2,  3,  'U14',  '10:00 AM', 'Starting',  0, 0),
(9,  1, 1, 3, 4,  1,  'U14',  '10:00 AM', 'Live',      1, 2),
(10, 1, 1, 4, 5,  7,  'U12',  '11:00 AM', 'Scheduled', 0, 0),
(11, 1, 1, 5, 6,  8,  'U12',  '11:00 AM', 'Scheduled', 0, 0),
(12, 1, 1, 6, 9,  11, 'U16',  '11:00 AM', 'Starting',  0, 0),
(13, 1, 1, 1, 10, 12, 'U16',  '12:00 PM', 'Scheduled', 0, 0),
(14, 1, 1, 2, 13, 14, 'U12B', '12:00 PM', 'Scheduled', 0, 0),
(15, 1, 1, 3, 1,  3,  'U14',  '12:00 PM', 'Scheduled', 0, 0),
(16, 1, 1, 4, 2,  4,  'U14',  '1:00 PM',  'Scheduled', 0, 0),
(17, 1, 1, 5, 9,  12, 'U16',  '1:00 PM',  'Scheduled', 0, 0),
(18, 1, 1, 6, 5,  8,  'U12',  '1:00 PM',  'Scheduled', 0, 0),
-- DAY 2 (event_date_id = 2)
(19, 1, 2, 1, 2,  4,  'U14',  '8:00 AM',  'Scheduled', 0, 0),
(20, 1, 2, 2, 5,  8,  'U12',  '8:00 AM',  'Scheduled', 0, 0),
(21, 1, 2, 3, 9,  12, 'U16',  '9:00 AM',  'Scheduled', 0, 0),
(22, 1, 2, 4, 13, 14, 'U12B', '9:00 AM',  'Scheduled', 0, 0),
(23, 1, 2, 5, 1,  2,  'U14',  '10:00 AM', 'Scheduled', 0, 0),
(24, 1, 2, 6, 10, 11, 'U16',  '10:00 AM', 'Scheduled', 0, 0),
(25, 1, 2, 1, 3,  4,  'U14',  '11:00 AM', 'Scheduled', 0, 0),
(26, 1, 2, 2, 6,  7,  'U12',  '11:00 AM', 'Scheduled', 0, 0),
(27, 1, 2, 3, 9,  10, 'U16',  '12:00 PM', 'Scheduled', 0, 0),
(28, 1, 2, 4, 13, 14, 'U12B', '12:00 PM', 'Scheduled', 0, 0)
ON CONFLICT DO NOTHING;

SELECT setval('games_id_seq', 28);

-- ============================================================
-- REF ASSIGNMENTS
-- ============================================================
INSERT INTO ref_assignments (game_id, referee_id, role) VALUES
(1,  1, 'Center'), (1,  2, 'Trail'),
(2,  3, 'Center'), (2,  4, 'Trail'),
(3,  5, 'Center'), (3,  6, 'Trail'),
(4,  7, 'Center'), (4,  8, 'Trail'),
(5,  1, 'Center'), (5,  3, 'Trail'),
(6,  2, 'Center'), (6,  4, 'Trail'),
(7,  5, 'Center'), (7,  7, 'Trail'),
(8,  6, 'Center'), (8,  8, 'Trail'),
(9,  1, 'Center'), (9,  2, 'Trail'),
(10, 3, 'Center'), (10, 4, 'Trail'),
(11, 5, 'Center'), (11, 6, 'Trail'),
(12, 7, 'Center'), (12, 8, 'Trail'),
(13, 1, 'Center'), (13, 9, 'Trail'),
(14, 2, 'Center'), (14, 10,'Trail'),
(15, 5, 'Center'), (15, 7, 'Trail')
ON CONFLICT DO NOTHING;

-- ============================================================
-- VOLUNTEER ASSIGNMENTS
-- ============================================================
INSERT INTO vol_assignments (game_id, volunteer_id) VALUES
(1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 6),
(7, 1), (8, 2), (9, 3), (10, 4), (11, 5), (12, 6),
(13, 7), (14, 8), (15, 9)
ON CONFLICT DO NOTHING;

-- ============================================================
-- PLAYER CHECK-INS (pre-seeded for completed games)
-- ============================================================
-- Game 1: Creeks vs Riptide (Final)
INSERT INTO player_checkins (game_id, player_id) VALUES
(1, 1),(1, 2),(1, 3),(1, 4),(1, 5),(1, 6),(1, 7),(1, 8),(1, 9),(1, 10),
(1, 11),(1, 12),(1, 13),(1, 14),(1, 15),(1, 16),(1, 17),(1, 18)
ON CONFLICT DO NOTHING;

-- Game 5: Wildcats vs Fury (Live - partial checkins)
INSERT INTO player_checkins (game_id, player_id) VALUES
(5, 55),(5, 56),(5, 57),(5, 58),(5, 59),(5, 60),
(5, 61),(5, 62),(5, 63),(5, 64)
ON CONFLICT DO NOTHING;

-- ============================================================
-- INCIDENTS
-- ============================================================
INSERT INTO incidents (id, event_id, game_id, field_id, team_id, type, person_involved, description, occurred_at) VALUES
(1, 1, 3, 3, 1, 'Player Injury',   'Tara Bloom',    'Player down near crease — knee collision during game. Trainer evaluated on field.', NOW() - INTERVAL '2 hours'),
(2, 1, 2, 2, 4, 'Coach Incident',  'Coach Davis',   'Verbal altercation with referee on sideline. Verbal warning issued.', NOW() - INTERVAL '3 hours'),
(3, 1, 1, 1, 2, 'Spectator Issue', NULL,            'Parent on Riptide sideline using inappropriate language. Asked to leave area.', NOW() - INTERVAL '4 hours')
ON CONFLICT DO NOTHING;

SELECT setval('incidents_id_seq', 3);

-- ============================================================
-- MEDICAL INCIDENTS
-- ============================================================
INSERT INTO medical_incidents (id, event_id, game_id, field_id, player_name, team_name, injury_type, trainer_name, status, dispatched_at) VALUES
(1, 1, 3, 3, 'Tara Bloom', 'Creeks', 'Knee / Leg', 'Sarah Mitchell (AT)', 'Released', NOW() - INTERVAL '1.5 hours')
ON CONFLICT DO NOTHING;

SELECT setval('medical_incidents_id_seq', 1);

-- ============================================================
-- WEATHER ALERTS
-- ============================================================
INSERT INTO weather_alerts (id, event_id, alert_type, description, is_active) VALUES
(1, 1, 'Heat Advisory', 'Heat index 97°F — hydration protocol active. Water breaks required every 20 minutes.', true)
ON CONFLICT DO NOTHING;

SELECT setval('weather_alerts_id_seq', 1);

-- ============================================================
-- OPERATIONS LOG
-- ============================================================
INSERT INTO ops_log (id, event_id, message, log_type, occurred_at) VALUES
(1,  1, 'Tournament Day 1 started — 18 games scheduled across 6 fields', 'ok',    NOW() - INTERVAL '5 hours'),
(2,  1, 'Referee check-in opened — 10 officials on site', 'info',                  NOW() - INTERVAL '4.5 hours'),
(3,  1, 'Heat advisory issued — hydration protocol activated', 'warn',              NOW() - INTERVAL '4 hours'),
(4,  1, 'Spectator incident logged — Field 2, Riptide sideline', 'warn',            NOW() - INTERVAL '4 hours'),
(5,  1, 'Coach incident logged — Field 2, Eagles (Coach Davis)', 'warn',            NOW() - INTERVAL '3 hours'),
(6,  1, 'Games 1, 2, 3 started — 8:00 AM wave', 'info',                            NOW() - INTERVAL '3 hours'),
(7,  1, 'Game 1 Final: Creeks 3 – 1 Riptide', 'info',                              NOW() - INTERVAL '2.5 hours'),
(8,  1, 'Game 2 Final: Storm 2 – 2 Eagles', 'info',                                NOW() - INTERVAL '2.5 hours'),
(9,  1, 'Trainer dispatched to Field 3 — Tara Bloom (knee injury)', 'alert',        NOW() - INTERVAL '2 hours'),
(10, 1, 'Tara Bloom evaluated and released — returning to bench', 'ok',             NOW() - INTERVAL '1.5 hours'),
(11, 1, 'Games 5, 6, 7 started — 9:00 AM wave', 'info',                            NOW() - INTERVAL '1 hour'),
(12, 1, 'Game 5 underway: Wildcats 2 – 1 Fury (Field 5)', 'info',                  NOW() - INTERVAL '45 minutes'),
(13, 1, 'Game 6 at halftime: Surge 1 – 1 Vipers (Field 6)', 'info',                NOW() - INTERVAL '30 minutes'),
(14, 1, 'Games 7, 8, 9 started — 10:00 AM wave', 'ok',                             NOW() - INTERVAL '10 minutes')
ON CONFLICT DO NOTHING;

SELECT setval('ops_log_id_seq', 14);
