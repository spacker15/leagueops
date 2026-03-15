-- ============================================================
-- LeagueOps — Complete Database Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EVENT DATES
-- ============================================================
CREATE TABLE IF NOT EXISTS event_dates (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  label TEXT NOT NULL,
  day_number INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FIELDS
-- ============================================================
CREATE TABLE IF NOT EXISTS fields (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  number TEXT NOT NULL DEFAULT '',
  map_x INT DEFAULT 0,
  map_y INT DEFAULT 0,
  map_w INT DEFAULT 160,
  map_h INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TEAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS teams (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  division TEXT NOT NULL,
  association TEXT,
  color TEXT DEFAULT '#0B3D91',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLAYERS
-- ============================================================
CREATE TABLE IF NOT EXISTS players (
  id BIGSERIAL PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  number INT,
  position TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GAMES
-- ============================================================
CREATE TABLE IF NOT EXISTS games (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_date_id BIGINT NOT NULL REFERENCES event_dates(id) ON DELETE CASCADE,
  field_id BIGINT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  home_team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  division TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Scheduled'
    CHECK (status IN ('Scheduled','Starting','Live','Halftime','Final','Delayed')),
  home_score INT DEFAULT 0,
  away_score INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REFEREES
-- ============================================================
CREATE TABLE IF NOT EXISTS referees (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grade_level TEXT NOT NULL DEFAULT 'Grade 5',
  phone TEXT,
  email TEXT,
  checked_in BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REF ASSIGNMENTS (Game → Referee)
-- ============================================================
CREATE TABLE IF NOT EXISTS ref_assignments (
  id BIGSERIAL PRIMARY KEY,
  game_id BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  referee_id BIGINT NOT NULL REFERENCES referees(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'Center',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, referee_id)
);

-- ============================================================
-- VOLUNTEERS
-- ============================================================
CREATE TABLE IF NOT EXISTS volunteers (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Score Table'
    CHECK (role IN ('Score Table','Clock','Field Marshal','Operations','Gate')),
  phone TEXT,
  checked_in BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VOLUNTEER ASSIGNMENTS (Game → Volunteer)
-- ============================================================
CREATE TABLE IF NOT EXISTS vol_assignments (
  id BIGSERIAL PRIMARY KEY,
  game_id BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  volunteer_id BIGINT NOT NULL REFERENCES volunteers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, volunteer_id)
);

-- ============================================================
-- PLAYER CHECK-INS (Game → Player)
-- ============================================================
CREATE TABLE IF NOT EXISTS player_checkins (
  id BIGSERIAL PRIMARY KEY,
  game_id BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_id)
);

-- ============================================================
-- INCIDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS incidents (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  game_id BIGINT REFERENCES games(id) ON DELETE SET NULL,
  field_id BIGINT REFERENCES fields(id) ON DELETE SET NULL,
  team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
  type TEXT NOT NULL
    CHECK (type IN ('Player Injury','Coach Incident','Spectator Issue','Field Issue',
                    'Equipment Issue','Weather Issue','Warning','Ejection')),
  person_involved TEXT,
  description TEXT NOT NULL,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MEDICAL / TRAINER INCIDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS medical_incidents (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  game_id BIGINT REFERENCES games(id) ON DELETE SET NULL,
  field_id BIGINT REFERENCES fields(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  team_name TEXT,
  injury_type TEXT NOT NULL DEFAULT 'General / Unknown',
  trainer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Dispatched'
    CHECK (status IN ('Dispatched','On Site','Transported','Released','Resolved')),
  notes TEXT,
  dispatched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WEATHER ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS weather_alerts (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  lightning_delay_start TIMESTAMPTZ,
  lightning_delay_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OPERATIONS LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_log (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  log_type TEXT NOT NULL DEFAULT 'info'
    CHECK (log_type IN ('info','alert','warn','ok')),
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_games_event ON games(event_id);
CREATE INDEX IF NOT EXISTS idx_games_event_date ON games(event_date_id);
CREATE INDEX IF NOT EXISTS idx_games_field ON games(field_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_checkins_game ON player_checkins(game_id);
CREATE INDEX IF NOT EXISTS idx_checkins_player ON player_checkins(player_id);
CREATE INDEX IF NOT EXISTS idx_incidents_event ON incidents(event_id);
CREATE INDEX IF NOT EXISTS idx_ops_log_event ON ops_log(event_id);
CREATE INDEX IF NOT EXISTS idx_ref_assignments_game ON ref_assignments(game_id);
CREATE INDEX IF NOT EXISTS idx_vol_assignments_game ON vol_assignments(game_id);

-- ============================================================
-- ROW LEVEL SECURITY (permissive for single-org use)
-- ============================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE referees ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vol_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_log ENABLE ROW LEVEL SECURITY;

-- Allow all for anon (public tournament operations — add auth later for production)
CREATE POLICY "Allow all" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON event_dates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON fields FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON referees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON ref_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON volunteers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON vol_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON player_checkins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON incidents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON medical_incidents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON weather_alerts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON ops_log FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- REAL-TIME: Enable for live updates
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE player_checkins;
ALTER PUBLICATION supabase_realtime ADD TABLE incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE ops_log;
ALTER PUBLICATION supabase_realtime ADD TABLE weather_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE medical_incidents;
