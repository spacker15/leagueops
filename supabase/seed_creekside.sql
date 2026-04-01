-- ============================================================
-- Creekside High School — LeagueOps Seed Data
-- 100 Knights Lane, St. Johns, FL 32259
-- Athletic Director: Luke Marabell | (904) 547-7331
-- Rosters sourced from MaxPreps 2025-26
-- ============================================================

-- ============================================================
-- EXTEND SPORTS TABLE with additional Creekside sports
-- ============================================================
INSERT INTO sports (name, icon) VALUES
  ('Cross Country',   '🏃'),
  ('Golf',            '⛳'),
  ('Dance',           '💃'),
  ('Cheer',           '📣'),
  ('Weightlifting',   '🏋️'),
  ('Track & Field',   '🏟️'),
  ('Beach Volleyball','🏐')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- EVENTS — 2025–26 School Year
-- ============================================================

-- ── FALL 2025 ─────────────────────────────────────────────────
INSERT INTO events (name, location, start_date, end_date, sport, event_type, slug, status, is_public, time_zone) VALUES
  ('Boys Cross Country 2025',   'Creekside HS, St. Johns FL', '2025-08-11', '2025-11-08', 'Cross Country',   'season', 'chs-xc-boys-2025',      'active', true, 'Eastern'),
  ('Girls Cross Country 2025',  'Creekside HS, St. Johns FL', '2025-08-11', '2025-11-08', 'Cross Country',   'season', 'chs-xc-girls-2025',     'active', true, 'Eastern'),
  ('Boys Golf 2025',            'Creekside HS, St. Johns FL', '2025-08-11', '2025-10-25', 'Golf',            'season', 'chs-golf-boys-2025',    'active', true, 'Eastern'),
  ('Girls Golf 2025',           'Creekside HS, St. Johns FL', '2025-08-11', '2025-10-25', 'Golf',            'season', 'chs-golf-girls-2025',   'active', true, 'Eastern'),
  ('Dance 2025',                'Creekside HS, St. Johns FL', '2025-08-11', '2025-11-30', 'Dance',           'season', 'chs-dance-2025',         'active', true, 'Eastern'),
  ('Football 2025',             'Creekside HS, St. Johns FL', '2025-08-18', '2025-11-29', 'Football',        'season', 'chs-football-2025',      'active', true, 'Eastern'),
  ('Sideline Cheer 2025',       'Creekside HS, St. Johns FL', '2025-08-18', '2025-11-29', 'Cheer',           'season', 'chs-cheer-sideline-2025','active', true, 'Eastern'),
  ('Swimming & Diving 2025',    'Creekside HS, St. Johns FL', '2025-08-11', '2025-10-25', 'Swimming',        'season', 'chs-swimming-2025',      'active', true, 'Eastern'),
  ('Girls Volleyball 2025',     'Creekside HS, St. Johns FL', '2025-08-11', '2025-11-08', 'Volleyball',      'season', 'chs-vb-girls-2025',      'active', true, 'Eastern')
ON CONFLICT (slug) DO NOTHING;

-- ── WINTER 2025–26 ────────────────────────────────────────────
INSERT INTO events (name, location, start_date, end_date, sport, event_type, slug, status, is_public, time_zone) VALUES
  ('Boys Basketball 2025-26',     'Creekside HS, St. Johns FL', '2025-11-17', '2026-03-07', 'Basketball',    'season', 'chs-bball-boys-2526',    'active', true, 'Eastern'),
  ('Girls Basketball 2025-26',    'Creekside HS, St. Johns FL', '2025-11-17', '2026-03-07', 'Basketball',    'season', 'chs-bball-girls-2526',   'active', true, 'Eastern'),
  ('Competitive Cheer 2025-26',   'Creekside HS, St. Johns FL', '2025-11-01', '2026-02-28', 'Cheer',         'season', 'chs-cheer-comp-2526',    'active', true, 'Eastern'),
  ('Boys Soccer 2025-26',         'Creekside HS, St. Johns FL', '2025-11-10', '2026-02-28', 'Soccer',        'season', 'chs-soccer-boys-2526',   'active', true, 'Eastern'),
  ('Girls Soccer 2025-26',        'Creekside HS, St. Johns FL', '2025-11-10', '2026-02-28', 'Soccer',        'season', 'chs-soccer-girls-2526',  'active', true, 'Eastern'),
  ('Girls Weightlifting 2025-26', 'Creekside HS, St. Johns FL', '2025-11-01', '2026-03-14', 'Weightlifting', 'season', 'chs-wl-girls-2526',      'active', true, 'Eastern'),
  ('Wrestling 2025-26',           'Creekside HS, St. Johns FL', '2025-11-10', '2026-02-21', 'Wrestling',     'season', 'chs-wrestling-2526',     'active', true, 'Eastern')
ON CONFLICT (slug) DO NOTHING;

-- ── SPRING 2026 ───────────────────────────────────────────────
INSERT INTO events (name, location, start_date, end_date, sport, event_type, slug, status, is_public, time_zone) VALUES
  ('Baseball 2026',                'Creekside HS, St. Johns FL', '2026-02-16', '2026-05-23', 'Baseball',       'season', 'chs-baseball-2026',       'active', true, 'Eastern'),
  ('Boys Lacrosse Varsity 2026',   'Creekside HS, St. Johns FL', '2026-02-16', '2026-05-23', 'Lacrosse',       'season', 'chs-lax-boys-v-2026',     'active', true, 'Eastern'),
  ('Girls Lacrosse Varsity 2026',  'Creekside HS, St. Johns FL', '2026-02-16', '2026-05-23', 'Lacrosse',       'season', 'chs-lax-girls-v-2026',    'active', true, 'Eastern'),
  ('Girls Lacrosse JV 2026',       'Creekside HS, St. Johns FL', '2026-02-16', '2026-05-23', 'Lacrosse',       'season', 'chs-lax-girls-jv-2026',   'active', true, 'Eastern'),
  ('Softball 2026',                'Creekside HS, St. Johns FL', '2026-02-16', '2026-05-23', 'Softball',       'season', 'chs-softball-2026',        'active', true, 'Eastern'),
  ('Boys Tennis 2026',             'Creekside HS, St. Johns FL', '2026-02-16', '2026-05-02', 'Tennis',         'season', 'chs-tennis-boys-2026',     'active', true, 'Eastern'),
  ('Girls Tennis 2026',            'Creekside HS, St. Johns FL', '2026-02-16', '2026-05-02', 'Tennis',         'season', 'chs-tennis-girls-2026',    'active', true, 'Eastern'),
  ('Boys Track & Field 2026',      'Creekside HS, St. Johns FL', '2026-02-16', '2026-05-02', 'Track & Field',  'season', 'chs-track-boys-2026',      'active', true, 'Eastern'),
  ('Girls Track & Field 2026',     'Creekside HS, St. Johns FL', '2026-02-16', '2026-05-02', 'Track & Field',  'season', 'chs-track-girls-2026',     'active', true, 'Eastern'),
  ('Boys Weightlifting 2026',      'Creekside HS, St. Johns FL', '2026-02-16', '2026-04-25', 'Weightlifting',  'season', 'chs-wl-boys-2026',         'active', true, 'Eastern'),
  ('Boys Volleyball 2026',         'Creekside HS, St. Johns FL', '2026-03-02', '2026-05-16', 'Volleyball',     'season', 'chs-vb-boys-2026',         'active', true, 'Eastern'),
  ('Beach Volleyball 2026',        'Creekside HS, St. Johns FL', '2026-03-02', '2026-05-16', 'Beach Volleyball','season','chs-beachvb-2026',         'active', true, 'Eastern')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- TEAMS & ROSTERS — Girls Lacrosse V & JV, Boys Lacrosse V
-- Source: MaxPreps 2025-26
-- ============================================================

DO $$
DECLARE
  glv_event_id  BIGINT;
  gljv_event_id BIGINT;
  blv_event_id  BIGINT;
  glv_team_id   BIGINT;
  gljv_team_id  BIGINT;
  blv_team_id   BIGINT;
BEGIN
  SELECT id INTO glv_event_id  FROM events WHERE slug = 'chs-lax-girls-v-2026';
  SELECT id INTO gljv_event_id FROM events WHERE slug = 'chs-lax-girls-jv-2026';
  SELECT id INTO blv_event_id  FROM events WHERE slug = 'chs-lax-boys-v-2026';

  -- ── Girls Lacrosse Varsity team ──────────────────────────────
  INSERT INTO teams (event_id, name, division, association, color)
  VALUES (glv_event_id, 'Creekside Knights', 'Varsity', 'FHSAA District 4-4A', '#0B3D91')
  RETURNING id INTO glv_team_id;

  INSERT INTO players (team_id, name, number, position) VALUES
    (glv_team_id, 'Lilliana Rivera',    1,  'Attack'),
    (glv_team_id, 'Brooke Geerdes',     2,  'Midfield'),
    (glv_team_id, 'Gabriela Ali',       3,  'Attack'),
    (glv_team_id, 'Kelsee Hayes',       4,  'Attack'),
    (glv_team_id, 'Alyssa Ramirez',     5,  'Attack'),
    (glv_team_id, 'Sierra Amescue',     6,  'Midfield'),
    (glv_team_id, 'Emily Stubbs',       7,  'Midfield'),
    (glv_team_id, 'Kaitlyn Auld',       8,  'Attack'),
    (glv_team_id, 'Steffi Kurteva',     9,  'Defense'),
    (glv_team_id, 'Alice Bauman',       10, 'Attack'),
    (glv_team_id, 'Taylor Harris',      11, 'Midfield'),
    (glv_team_id, 'Lauren Pickles',     13, 'Defense'),
    (glv_team_id, 'Isabella Armel',     14, 'Defense'),
    (glv_team_id, 'Bailee Bister',      15, 'Defense'),
    (glv_team_id, 'Addison Venzke',     16, 'Midfield'),
    (glv_team_id, 'Hanan Hassan',       18, 'Defense'),
    (glv_team_id, 'Alexis Charyak',     19, 'Attack'),
    (glv_team_id, 'Madeline Shedlock',  20, 'Defense'),
    (glv_team_id, 'Casey Curzio',       21, 'Goalie'),
    (glv_team_id, 'Lillyana Iasnik',    23, 'Midfield'),
    (glv_team_id, 'Lorelei Anderson',   27, 'Midfield'),
    (glv_team_id, 'Ava Rewey',          28, 'Midfield'),
    (glv_team_id, 'Katelyn Milton',     31, 'Goalie');

  -- ── Girls Lacrosse JV team ───────────────────────────────────
  INSERT INTO teams (event_id, name, division, association, color)
  VALUES (gljv_event_id, 'Creekside Knights JV', 'JV', 'FHSAA District 4-4A', '#0B3D91')
  RETURNING id INTO gljv_team_id;

  INSERT INTO players (team_id, name, number, position) VALUES
    (gljv_team_id, 'Abigail Miller',        1,  'Midfield'),
    (gljv_team_id, 'Charlotte Curzio',      3,  'Midfield'),
    (gljv_team_id, 'Delainey Champion',     4,  'Attack'),
    (gljv_team_id, 'Elizabeth Goforth',     7,  'Attack'),
    (gljv_team_id, 'Milena Houvinen',       8,  'Midfield'),
    (gljv_team_id, 'Noa Azoulay',           9,  'Defense'),
    (gljv_team_id, 'Ava Johnson',           11, 'Defense'),
    (gljv_team_id, 'Saniya Aleem',          12, 'Midfield'),
    (gljv_team_id, 'Sierra Amescua',        13, 'Midfield'),
    (gljv_team_id, 'Maya Geerdes',          15, 'Midfield'),
    (gljv_team_id, 'Abigail Tanner',        16, 'Defense'),
    (gljv_team_id, 'Payten Johnson',        21, 'Midfield'),
    (gljv_team_id, 'Valentina Houvinen',    22, 'Attack'),
    (gljv_team_id, 'Addison Pickus',        23, 'Attack'),
    (gljv_team_id, 'Caylee Booth',          24, 'Defense'),
    (gljv_team_id, 'Camille Garcia-Bordas', 28, 'Defense'),
    (gljv_team_id, 'Giavanna Giglio',       30, 'Defense'),
    (gljv_team_id, 'Casey Curzio',          32, 'Goalie');

  -- ── Boys Lacrosse Varsity team ───────────────────────────────
  INSERT INTO teams (event_id, name, division, association, color)
  VALUES (blv_event_id, 'Creekside Knights', 'Varsity', 'FHSAA District 4-4A', '#0B3D91')
  RETURNING id INTO blv_team_id;

  INSERT INTO players (team_id, name, number, position) VALUES
    (blv_team_id, 'Dominik Szuksztul',  1,  'Goalie'),
    (blv_team_id, 'Christian Wiand',    2,  'Goalie'),
    (blv_team_id, 'Zander Tracy',       3,  'Midfield'),
    (blv_team_id, 'Miles Farmer',       4,  'Defense'),
    (blv_team_id, 'Jason Kenna',        5,  'Midfield'),
    (blv_team_id, 'Max Leonard',        6,  'Attack'),
    (blv_team_id, 'Mason Gridley',      7,  'Midfield'),
    (blv_team_id, 'Nick Sudik',         8,  'Defense'),
    (blv_team_id, 'Jonathan Carver',    9,  'Defense'),
    (blv_team_id, 'Anderson Vlaun',     10, 'Midfield'),
    (blv_team_id, 'Braydon Scott',      11, 'Midfield'),
    (blv_team_id, 'Dominic Robertson',  12, 'Attack'),
    (blv_team_id, 'Zac White',          14, 'Midfield'),
    (blv_team_id, 'Marcus Hamilton',    15, 'Defense'),
    (blv_team_id, 'Grant Hinkel',       16, 'Goalie'),
    (blv_team_id, 'Zandr Altizer',      17, 'Attack'),
    (blv_team_id, 'Bryson Loper',       18, 'Defense'),
    (blv_team_id, 'Kellen Waters',      19, 'Midfield'),
    (blv_team_id, 'Sam Salcedo',        20, 'Defense'),
    (blv_team_id, 'Gunner Lee',         21, 'Midfield'),
    (blv_team_id, 'Madden Stoneback',   22, 'Midfield'),
    (blv_team_id, 'Chris Aspromonti',   23, 'Midfield'),
    (blv_team_id, 'Zach Rutherford',    24, 'Attack'),
    (blv_team_id, 'Ely Williams',       25, 'Midfield'),
    (blv_team_id, 'Xander Lee',         27, 'Defense'),
    (blv_team_id, 'Kellen Tinker',      28, 'Midfield'),
    (blv_team_id, 'Kaleb Mayberry',     30, 'Attack'),
    (blv_team_id, 'Ryan Shedlock',      31, 'Defense'),
    (blv_team_id, 'Nik Aspromonti',     33, 'Midfield');

END $$;

-- ============================================================
-- EVENT DATES — Girls Lacrosse (Tue/Thu FHSAA pattern)
-- ============================================================

DO $$
DECLARE
  glv_event_id  BIGINT;
  gljv_event_id BIGINT;
  blv_event_id  BIGINT;
BEGIN
  SELECT id INTO glv_event_id  FROM events WHERE slug = 'chs-lax-girls-v-2026';
  SELECT id INTO gljv_event_id FROM events WHERE slug = 'chs-lax-girls-jv-2026';
  SELECT id INTO blv_event_id  FROM events WHERE slug = 'chs-lax-boys-v-2026';

  -- Girls Varsity game days
  INSERT INTO event_dates (event_id, date, label, day_number) VALUES
    (glv_event_id, '2026-02-17', 'TUE · FEB 17', 1),
    (glv_event_id, '2026-02-19', 'THU · FEB 19', 2),
    (glv_event_id, '2026-02-24', 'TUE · FEB 24', 3),
    (glv_event_id, '2026-02-26', 'THU · FEB 26', 4),
    (glv_event_id, '2026-03-03', 'TUE · MAR 3',  5),
    (glv_event_id, '2026-03-05', 'THU · MAR 5',  6),
    (glv_event_id, '2026-03-10', 'TUE · MAR 10', 7),
    (glv_event_id, '2026-03-12', 'THU · MAR 12', 8),
    (glv_event_id, '2026-03-17', 'TUE · MAR 17', 9),
    (glv_event_id, '2026-03-19', 'THU · MAR 19', 10),
    (glv_event_id, '2026-03-24', 'TUE · MAR 24', 11),
    (glv_event_id, '2026-03-26', 'THU · MAR 26', 12),
    (glv_event_id, '2026-03-31', 'TUE · MAR 31', 13),
    (glv_event_id, '2026-04-02', 'THU · APR 2',  14),
    (glv_event_id, '2026-04-07', 'TUE · APR 7',  15),
    (glv_event_id, '2026-04-09', 'THU · APR 9',  16),
    (glv_event_id, '2026-04-14', 'TUE · APR 14', 17),
    (glv_event_id, '2026-04-16', 'THU · APR 16', 18),
    (glv_event_id, '2026-04-21', 'TUE · APR 21', 19),
    (glv_event_id, '2026-04-23', 'THU · APR 23', 20)
  ON CONFLICT DO NOTHING;

  -- Girls JV (same schedule)
  INSERT INTO event_dates (event_id, date, label, day_number) VALUES
    (gljv_event_id, '2026-02-17', 'TUE · FEB 17', 1),
    (gljv_event_id, '2026-02-19', 'THU · FEB 19', 2),
    (gljv_event_id, '2026-02-24', 'TUE · FEB 24', 3),
    (gljv_event_id, '2026-02-26', 'THU · FEB 26', 4),
    (gljv_event_id, '2026-03-03', 'TUE · MAR 3',  5),
    (gljv_event_id, '2026-03-05', 'THU · MAR 5',  6),
    (gljv_event_id, '2026-03-10', 'TUE · MAR 10', 7),
    (gljv_event_id, '2026-03-12', 'THU · MAR 12', 8),
    (gljv_event_id, '2026-03-17', 'TUE · MAR 17', 9),
    (gljv_event_id, '2026-03-19', 'THU · MAR 19', 10),
    (gljv_event_id, '2026-03-24', 'TUE · MAR 24', 11),
    (gljv_event_id, '2026-03-26', 'THU · MAR 26', 12)
  ON CONFLICT DO NOTHING;

  -- Boys Varsity game days
  INSERT INTO event_dates (event_id, date, label, day_number) VALUES
    (blv_event_id, '2026-02-17', 'TUE · FEB 17', 1),
    (blv_event_id, '2026-02-19', 'THU · FEB 19', 2),
    (blv_event_id, '2026-02-24', 'TUE · FEB 24', 3),
    (blv_event_id, '2026-02-26', 'THU · FEB 26', 4),
    (blv_event_id, '2026-03-03', 'TUE · MAR 3',  5),
    (blv_event_id, '2026-03-05', 'THU · MAR 5',  6),
    (blv_event_id, '2026-03-10', 'TUE · MAR 10', 7),
    (blv_event_id, '2026-03-12', 'THU · MAR 12', 8),
    (blv_event_id, '2026-03-17', 'TUE · MAR 17', 9),
    (blv_event_id, '2026-03-19', 'THU · MAR 19', 10),
    (blv_event_id, '2026-03-24', 'TUE · MAR 24', 11),
    (blv_event_id, '2026-03-26', 'THU · MAR 26', 12),
    (blv_event_id, '2026-03-31', 'TUE · MAR 31', 13),
    (blv_event_id, '2026-04-02', 'THU · APR 2',  14),
    (blv_event_id, '2026-04-07', 'TUE · APR 7',  15),
    (blv_event_id, '2026-04-09', 'THU · APR 9',  16),
    (blv_event_id, '2026-04-14', 'TUE · APR 14', 17),
    (blv_event_id, '2026-04-16', 'THU · APR 16', 18)
  ON CONFLICT DO NOTHING;

END $$;

-- ============================================================
-- COMPLEXES & FIELDS
-- ============================================================

DO $$
DECLARE
  glv_event_id  BIGINT;
  gljv_event_id BIGINT;
  blv_event_id  BIGINT;
  c_id          BIGINT;
BEGIN
  SELECT id INTO glv_event_id  FROM events WHERE slug = 'chs-lax-girls-v-2026';
  SELECT id INTO gljv_event_id FROM events WHERE slug = 'chs-lax-girls-jv-2026';
  SELECT id INTO blv_event_id  FROM events WHERE slug = 'chs-lax-boys-v-2026';

  INSERT INTO complexes (event_id, name, address)
  VALUES (glv_event_id, 'Creekside High School', '100 Knights Lane, St. Johns, FL 32259')
  RETURNING id INTO c_id;
  INSERT INTO fields (event_id, name, number, complex_id) VALUES
    (glv_event_id, 'Main Field',    '1', c_id),
    (glv_event_id, 'Practice Field','2', c_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO complexes (event_id, name, address)
  VALUES (gljv_event_id, 'Creekside High School', '100 Knights Lane, St. Johns, FL 32259')
  RETURNING id INTO c_id;
  INSERT INTO fields (event_id, name, number, complex_id) VALUES
    (gljv_event_id, 'Main Field',    '1', c_id),
    (gljv_event_id, 'Practice Field','2', c_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO complexes (event_id, name, address)
  VALUES (blv_event_id, 'Creekside High School', '100 Knights Lane, St. Johns, FL 32259')
  RETURNING id INTO c_id;
  INSERT INTO fields (event_id, name, number, complex_id) VALUES
    (blv_event_id, 'Main Field',    '1', c_id),
    (blv_event_id, 'Practice Field','2', c_id)
  ON CONFLICT DO NOTHING;

END $$;
