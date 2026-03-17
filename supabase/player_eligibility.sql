-- ============================================================
-- LeagueOps — Player Eligibility Rules
-- Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. DIVISION HIERARCHY
-- Used to enforce "can't play down" rule
-- ============================================================
CREATE TABLE IF NOT EXISTS division_hierarchy (
  id         BIGSERIAL PRIMARY KEY,
  event_id   BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,     -- '14U Boys'
  age_group  TEXT NOT NULL,     -- '14U'
  gender     TEXT NOT NULL,     -- 'Boys', 'Girls', 'Co-Ed'
  rank       INT NOT NULL,      -- higher = older (8U=1, 10U=2, 12U=3, 14U=4, 16U=5, 18U=6)
  UNIQUE(event_id, name)
);

ALTER TABLE division_hierarchy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON division_hierarchy FOR ALL USING (true) WITH CHECK (true);

-- Seed hierarchy for event 1
INSERT INTO division_hierarchy (event_id, name, age_group, gender, rank) VALUES
  (1, '8U Boys',  '8U',  'Boys',  1),
  (1, '10U Boys', '10U', 'Boys',  2),
  (1, '12U Boys', '12U', 'Boys',  3),
  (1, '14U Boys', '14U', 'Boys',  4),
  (1, '16U Boys', '16U', 'Boys',  5),
  (1, '18U Boys', '18U', 'Boys',  6),
  (1, '8U Girls', '8U',  'Girls', 1),
  (1, '10U Girls','10U', 'Girls', 2),
  (1, '12U Girls','12U', 'Girls', 3),
  (1, '14U Girls','14U', 'Girls', 4),
  (1, '16U Girls','16U', 'Girls', 5),
  (1, '18U Girls','18U', 'Girls', 6)
ON CONFLICT (event_id, name) DO NOTHING;

-- ============================================================
-- 2. PLAYER_TEAMS — explicit division assignment per player
-- A player's "home" division — used for eligibility checks
-- ============================================================
ALTER TABLE players ADD COLUMN IF NOT EXISTS home_division TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS event_id BIGINT REFERENCES events(id) ON DELETE SET NULL;

-- ============================================================
-- 3. ELIGIBILITY VIOLATIONS
-- Logged when a check-in fails an eligibility rule
-- ============================================================
CREATE TABLE IF NOT EXISTS eligibility_violations (
  id              BIGSERIAL PRIMARY KEY,
  player_id       BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id         BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  event_id        BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  violation_type  TEXT NOT NULL
    CHECK (violation_type IN ('play_down', 'multi_game_pending', 'multi_game_denied')),
  player_division TEXT,    -- player's registered division
  game_division   TEXT,    -- game's division (lower)
  description     TEXT,
  resolved        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_violations_player ON eligibility_violations(player_id);
CREATE INDEX IF NOT EXISTS idx_violations_game   ON eligibility_violations(game_id);

ALTER TABLE eligibility_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON eligibility_violations FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 4. MULTI-GAME APPROVALS
-- When a player checks into a 2nd+ game, approval is required
-- ============================================================
CREATE TABLE IF NOT EXISTS multi_game_approvals (
  id               BIGSERIAL PRIMARY KEY,
  player_id        BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id          BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,  -- the SECOND game
  first_game_id    BIGINT REFERENCES games(id) ON DELETE SET NULL,          -- the first game played
  event_id         BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_date_id    BIGINT REFERENCES event_dates(id) ON DELETE SET NULL,
  -- Which team needs to approve (opposing team in the second game)
  opposing_team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL,
  opposing_team_name TEXT,
  -- Status
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),
  -- Who approved
  approved_by      TEXT,   -- 'coach', 'referee', 'volunteer', 'admin'
  approved_by_name TEXT,
  approved_at      TIMESTAMPTZ,
  denial_reason    TEXT,
  -- The checkin is held until approved
  checkin_held     BOOLEAN DEFAULT TRUE,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_approvals_player  ON multi_game_approvals(player_id);
CREATE INDEX IF NOT EXISTS idx_approvals_game    ON multi_game_approvals(game_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status  ON multi_game_approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_event   ON multi_game_approvals(event_id);

ALTER TABLE multi_game_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON multi_game_approvals FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE multi_game_approvals;
ALTER PUBLICATION supabase_realtime ADD TABLE eligibility_violations;

-- ============================================================
-- 5. Add eligibility rules to event_rules
-- ============================================================
INSERT INTO event_rules (event_id, category, rule_key, rule_label, rule_value, value_type, unit, description, default_value)
VALUES
  (1, 'scheduling', 'enforce_play_down',     'Enforce No Play-Down Rule',    'true', 'boolean', NULL, 'Prevent players from checking into games below their registered division', 'true'),
  (1, 'scheduling', 'allow_play_up',         'Allow Play Up',                'true', 'boolean', NULL, 'Allow players to play in a higher division than their registered division', 'true'),
  (1, 'scheduling', 'multi_game_require_approval', 'Multi-Game Approval Required', 'true', 'boolean', NULL, 'Require opposing coach approval when a player plays more than 1 game per day', 'true'),
  (1, 'scheduling', 'multi_game_max_per_day','Max Games Per Player Per Day', '2',    'number',  'games', 'Maximum games a player can play in a single day (0 = unlimited)', '2'),
  (1, 'scheduling', 'ref_can_approve_multi', 'Refs Can Approve Multi-Game',  'true', 'boolean', NULL, 'Allow referees and volunteers to approve multi-game requests on behalf of opposing coach', 'true')
ON CONFLICT (event_id, category, rule_key) DO NOTHING;

-- ============================================================
-- VERIFICATION
-- SELECT * FROM division_hierarchy WHERE event_id = 1 ORDER BY gender, rank;
-- SELECT COUNT(*) FROM multi_game_approvals;
-- ============================================================
