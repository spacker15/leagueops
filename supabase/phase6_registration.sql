-- ============================================================
-- Phase 6: Registration Flow Enhancements
-- ============================================================

-- coaches: individual coach records (no auth account required)
CREATE TABLE IF NOT EXISTS coaches (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  certifications  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coaches_email ON coaches(email);

-- coach_teams: links coaches to team_registrations within an event
CREATE TABLE IF NOT EXISTS coach_teams (
  id                    BIGSERIAL PRIMARY KEY,
  coach_id              BIGINT NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  team_registration_id  BIGINT NOT NULL REFERENCES team_registrations(id) ON DELETE CASCADE,
  event_id              BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role                  TEXT DEFAULT 'assistant' CHECK (role IN ('head', 'assistant')),
  added_by              TEXT DEFAULT 'program_leader' CHECK (added_by IN ('program_leader', 'self_registration', 'admin')),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coach_id, team_registration_id)
);
CREATE INDEX IF NOT EXISTS idx_coach_teams_event ON coach_teams(event_id);
CREATE INDEX IF NOT EXISTS idx_coach_teams_coach ON coach_teams(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_teams_team_reg ON coach_teams(team_registration_id);

-- coach_invites: program-scoped invite tokens for coach self-registration
CREATE TABLE IF NOT EXISTS coach_invites (
  id          BIGSERIAL PRIMARY KEY,
  program_id  BIGINT NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_coach_invites_token ON coach_invites(token);
CREATE INDEX IF NOT EXISTS idx_coach_invites_program ON coach_invites(program_id);

-- coach_conflicts: materialized conflict flags
CREATE TABLE IF NOT EXISTS coach_conflicts (
  id          BIGSERIAL PRIMARY KEY,
  coach_id    BIGINT NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_ids    BIGINT[] NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved    BOOLEAN DEFAULT FALSE,
  UNIQUE(coach_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_coach_conflicts_event ON coach_conflicts(event_id);

-- Modifications to existing tables
ALTER TABLE team_registrations
  ADD COLUMN IF NOT EXISTS available_date_ids JSONB DEFAULT '[]'::jsonb;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS registration_opens_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS registration_closes_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS registration_open      BOOLEAN DEFAULT TRUE;
