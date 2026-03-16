-- ============================================================
-- LeagueOps — Program Registration Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. PROGRAMS TABLE
-- An organization like "Fleming Island" that has multiple teams
-- ============================================================
CREATE TABLE IF NOT EXISTS programs (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  short_name      TEXT,                          -- "FI", "AIYLA", etc.
  association     TEXT,                          -- NFYLL, US Lacrosse, etc.
  city            TEXT,
  state           TEXT DEFAULT 'FL',
  contact_name    TEXT NOT NULL,
  contact_email   TEXT NOT NULL,
  contact_phone   TEXT,
  website         TEXT,
  logo_url        TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  approved_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  rejection_note  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_programs_status ON programs(status);
CREATE INDEX IF NOT EXISTS idx_programs_email  ON programs(contact_email);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON programs FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE programs;

-- ============================================================
-- 2. PROGRAM_LEADERS — links users to programs they manage
-- ============================================================
CREATE TABLE IF NOT EXISTS program_leaders (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id  BIGINT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  is_primary  BOOLEAN DEFAULT TRUE,   -- primary contact vs co-leader
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, program_id)
);

CREATE INDEX IF NOT EXISTS idx_program_leaders_user    ON program_leaders(user_id);
CREATE INDEX IF NOT EXISTS idx_program_leaders_program ON program_leaders(program_id);

ALTER TABLE program_leaders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON program_leaders FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 3. PROGRAM_TEAMS — links programs to their teams per event
-- ============================================================
CREATE TABLE IF NOT EXISTS program_teams (
  id          BIGSERIAL PRIMARY KEY,
  program_id  BIGINT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  team_id     BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  division    TEXT NOT NULL,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, team_id, event_id)
);

ALTER TABLE program_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON program_teams FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 4. TEAM REGISTRATION REQUESTS
-- Programs request to register teams — admin approves
-- ============================================================
CREATE TABLE IF NOT EXISTS team_registrations (
  id              BIGSERIAL PRIMARY KEY,
  program_id      BIGINT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  event_id        BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_name       TEXT NOT NULL,
  division        TEXT NOT NULL,
  head_coach_name TEXT,
  head_coach_email TEXT,
  head_coach_phone TEXT,
  player_count    INT,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'waitlist')),
  team_id         BIGINT REFERENCES teams(id) ON DELETE SET NULL,  -- set when approved
  reviewed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  rejection_note  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_reg_program ON team_registrations(program_id);
CREATE INDEX IF NOT EXISTS idx_team_reg_status  ON team_registrations(status);
CREATE INDEX IF NOT EXISTS idx_team_reg_event   ON team_registrations(event_id);

ALTER TABLE team_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON team_registrations FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 5. Update user_roles to support program_leader role
-- ============================================================
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('admin', 'league_admin', 'referee', 'volunteer', 'player', 'program_leader'));

-- ============================================================
-- 6. Add program_id to user_roles
-- ============================================================
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS program_id BIGINT REFERENCES programs(id) ON DELETE SET NULL;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'user_roles' ORDER BY ordinal_position;
