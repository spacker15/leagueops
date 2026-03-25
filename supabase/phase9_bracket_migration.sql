-- Phase 9: Bracket tables + standings view for public results site

-- Add has_bracket flag to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS has_bracket BOOLEAN DEFAULT FALSE;

-- bracket_rounds: one row per bracket round
CREATE TABLE IF NOT EXISTS bracket_rounds (
  id          BIGSERIAL PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES events(id),
  format      TEXT NOT NULL CHECK (format IN ('single', 'double')),
  bracket_side TEXT CHECK (bracket_side IN ('winners', 'losers', 'grand_final')),
  round_number INT NOT NULL,
  round_label  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- bracket_matchups: individual matchups within a round
CREATE TABLE IF NOT EXISTS bracket_matchups (
  id              BIGSERIAL PRIMARY KEY,
  round_id        BIGINT NOT NULL REFERENCES bracket_rounds(id),
  event_id        BIGINT NOT NULL REFERENCES events(id),
  seed_top        INT,
  seed_bottom     INT,
  team_top_id     BIGINT REFERENCES teams(id),
  team_bottom_id  BIGINT REFERENCES teams(id),
  game_id         BIGINT REFERENCES games(id),
  score_top       INT DEFAULT 0,
  score_bottom    INT DEFAULT 0,
  winner_id       BIGINT REFERENCES teams(id),
  winner_advances_to_matchup_id BIGINT REFERENCES bracket_matchups(id),
  loser_advances_to_matchup_id  BIGINT REFERENCES bracket_matchups(id),
  position        INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- standings_by_division: PostgreSQL view for division standings (PUB-03)
-- ROADMAP success criterion #3: "sourced from a PostgreSQL view (not computed client-side)"
CREATE OR REPLACE VIEW standings_by_division AS
SELECT
  t.id AS team_id,
  t.name AS team_name,
  t.division,
  t.association,
  t.event_id,
  COALESCE(w.wins, 0) AS wins,
  COALESCE(l.losses, 0) AS losses,
  COALESCE(d.ties, 0) AS ties,
  COALESCE(pf.points_for, 0) AS points_for,
  COALESCE(pa.points_against, 0) AS points_against,
  COALESCE(pf.points_for, 0) - COALESCE(pa.points_against, 0) AS goal_diff
FROM teams t
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS wins FROM games g
  WHERE g.status = 'Final'
    AND ((g.home_team_id = t.id AND g.home_score > g.away_score)
      OR (g.away_team_id = t.id AND g.away_score > g.home_score))
) w ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS losses FROM games g
  WHERE g.status = 'Final'
    AND ((g.home_team_id = t.id AND g.home_score < g.away_score)
      OR (g.away_team_id = t.id AND g.away_score < g.home_score))
) l ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS ties FROM games g
  WHERE g.status = 'Final'
    AND ((g.home_team_id = t.id OR g.away_team_id = t.id)
      AND g.home_score = g.away_score)
) d ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(CASE WHEN g.home_team_id = t.id THEN g.home_score ELSE g.away_score END), 0)::int AS points_for
  FROM games g
  WHERE g.status = 'Final'
    AND (g.home_team_id = t.id OR g.away_team_id = t.id)
) pf ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(CASE WHEN g.home_team_id = t.id THEN g.away_score ELSE g.home_score END), 0)::int AS points_against
  FROM games g
  WHERE g.status = 'Final'
    AND (g.home_team_id = t.id OR g.away_team_id = t.id)
) pa ON true;

-- Grant anon access to the view (required for public results site)
GRANT SELECT ON standings_by_division TO anon;
GRANT SELECT ON standings_by_division TO authenticated;

-- Indexes for bracket queries
CREATE INDEX IF NOT EXISTS idx_bracket_rounds_event ON bracket_rounds(event_id);
CREATE INDEX IF NOT EXISTS idx_bracket_matchups_event ON bracket_matchups(event_id);
CREATE INDEX IF NOT EXISTS idx_bracket_matchups_round ON bracket_matchups(round_id);

-- Indexes for games queries (from ROADMAP scope notes)
CREATE INDEX IF NOT EXISTS idx_games_event_date ON games(event_id, game_date);
CREATE INDEX IF NOT EXISTS idx_games_event_division ON games(event_id, division);

-- Enable RLS
ALTER TABLE bracket_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_matchups ENABLE ROW LEVEL SECURITY;

-- Anon read policies (same pattern as existing public tables in rls_migration.sql)
CREATE POLICY "anon_select_bracket_rounds" ON bracket_rounds FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_bracket_matchups" ON bracket_matchups FOR SELECT TO anon USING (true);

-- Authenticated read policies
CREATE POLICY "auth_select_bracket_rounds" ON bracket_rounds FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));
CREATE POLICY "auth_select_bracket_matchups" ON bracket_matchups FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- Admin write policies
CREATE POLICY "auth_insert_bracket_rounds" ON bracket_rounds FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));
CREATE POLICY "auth_insert_bracket_matchups" ON bracket_matchups FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));
CREATE POLICY "auth_update_bracket_rounds" ON bracket_rounds FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));
CREATE POLICY "auth_update_bracket_matchups" ON bracket_matchups FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));
CREATE POLICY "auth_delete_bracket_rounds" ON bracket_rounds FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));
CREATE POLICY "auth_delete_bracket_matchups" ON bracket_matchups FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));
