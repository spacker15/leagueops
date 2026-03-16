-- ============================================================
-- LeagueOps — Auth & Roles Migration
-- Run in Supabase SQL Editor
-- Requires Supabase Auth to be enabled (it is by default)
-- ============================================================

-- ============================================================
-- 1. USER ROLES TABLE
-- Links Supabase auth.users to app roles
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('admin', 'league_admin', 'referee', 'volunteer', 'player')),
  event_id     BIGINT REFERENCES events(id) ON DELETE CASCADE,
  -- For referee/volunteer roles: link to their record
  referee_id   BIGINT REFERENCES referees(id) ON DELETE SET NULL,
  volunteer_id BIGINT REFERENCES volunteers(id) ON DELETE SET NULL,
  player_id    BIGINT REFERENCES players(id) ON DELETE SET NULL,
  -- For league_admin: which league they manage
  league_id    BIGINT, -- future use for multi-league
  display_name TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user    ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role    ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_ref     ON user_roles(referee_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_vol     ON user_roles(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_player  ON user_roles(player_id);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
-- Users can read their own role
CREATE POLICY "Users can read own role" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);
-- Admins can manage all roles (enforced in app layer)
CREATE POLICY "Admins can manage roles" ON user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  ) WITH CHECK (true);

-- ============================================================
-- 2. PLAYER QR TOKENS
-- One token per player per event — used for QR check-in
-- ============================================================
CREATE TABLE IF NOT EXISTS player_qr_tokens (
  id         BIGSERIAL PRIMARY KEY,
  token      TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  player_id  BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  event_id   BIGINT NOT NULL REFERENCES events(id)  ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_token  ON player_qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_player ON player_qr_tokens(player_id);

ALTER TABLE player_qr_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON player_qr_tokens FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 3. QR CHECK-IN LOG
-- Every QR scan is recorded here before checking in the player
-- ============================================================
CREATE TABLE IF NOT EXISTS qr_checkin_log (
  id         BIGSERIAL PRIMARY KEY,
  token      TEXT NOT NULL,
  player_id  BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id    BIGINT REFERENCES games(id) ON DELETE SET NULL,
  event_id   BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  success    BOOLEAN DEFAULT FALSE,
  message    TEXT,
  ip_address TEXT
);

ALTER TABLE qr_checkin_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON qr_checkin_log FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 4. REF/VOLUNTEER PORTAL SESSIONS
-- Track self-check-in events for audit
-- ============================================================
CREATE TABLE IF NOT EXISTS portal_checkins (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  person_type  TEXT NOT NULL CHECK (person_type IN ('referee', 'volunteer')),
  person_id    BIGINT NOT NULL,
  event_id     BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  checked_in   BOOLEAN DEFAULT TRUE,
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  device_info  TEXT
);

ALTER TABLE portal_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON portal_checkins FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 5. Generate QR tokens for all existing players in event 1
-- ============================================================
INSERT INTO player_qr_tokens (player_id, event_id)
SELECT p.id, t.event_id
FROM players p
JOIN teams t ON p.team_id = t.id
WHERE t.event_id = 1
ON CONFLICT (player_id, event_id) DO NOTHING;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT COUNT(*) FROM player_qr_tokens WHERE event_id = 1;
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
