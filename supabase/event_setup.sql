-- ============================================================
-- LeagueOps — Event Setup & Configuration
-- Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. EXTEND EVENTS TABLE
-- ============================================================

-- Core setup
ALTER TABLE events ADD COLUMN IF NOT EXISTS sport           TEXT DEFAULT 'Lacrosse';
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_type      TEXT DEFAULT 'tournament'
  CHECK (event_type IN ('tournament','season','clinic','league'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS time_zone       TEXT DEFAULT 'Eastern';
ALTER TABLE events ADD COLUMN IF NOT EXISTS status          TEXT DEFAULT 'draft'
  CHECK (status IN ('draft','active','completed','archived'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS results_link    TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS external_id     TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS info_url        TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS message         TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS hotel_link      TEXT;

-- Scheduling
ALTER TABLE events ADD COLUMN IF NOT EXISTS schedule_increment      INT DEFAULT 60;
ALTER TABLE events ADD COLUMN IF NOT EXISTS time_between_games      INT DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS game_guarantee          INT DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_athletes_per_roster INT DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS lock_roster_date        DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS age_compute_date        DATE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS highlight_schedule_changes INT DEFAULT 0;

-- Public schedule flags
ALTER TABLE events ADD COLUMN IF NOT EXISTS public_schedule          BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS back_to_back_warning     BOOLEAN DEFAULT TRUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_brackets            BOOLEAN DEFAULT TRUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_team_list           BOOLEAN DEFAULT TRUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_seeding             BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_team_pool           BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_bracket_games       BOOLEAN DEFAULT TRUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_team_contact_info   BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_team_city_state     BOOLEAN DEFAULT TRUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS allow_public_post_scores BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_stat_leaders        BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS allow_ties               BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_goals_scored        BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_goals_allowed       BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_goal_diff           BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS show_head_to_head        BOOLEAN DEFAULT FALSE;

-- Scoring
ALTER TABLE events ADD COLUMN IF NOT EXISTS points_for_win  INT DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS points_for_tie  INT DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS points_for_loss INT DEFAULT 0;

-- Advanced features
ALTER TABLE events ADD COLUMN IF NOT EXISTS exhibition_games         BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS schedule_home_games      BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS assign_work_teams        BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS assign_bonus_points      BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS game_by_game_stats       BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS auto_advance_pool_play   BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS filter_drag_drop         BOOLEAN DEFAULT FALSE;

-- Terms / labels
ALTER TABLE events ADD COLUMN IF NOT EXISTS division_term     TEXT DEFAULT 'Division';
ALTER TABLE events ADD COLUMN IF NOT EXISTS game_term_team1   TEXT DEFAULT 'Away';
ALTER TABLE events ADD COLUMN IF NOT EXISTS game_term_team2   TEXT DEFAULT 'Home';
ALTER TABLE events ADD COLUMN IF NOT EXISTS classification    TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS tournament_series TEXT;

-- Period/set stats
ALTER TABLE events ADD COLUMN IF NOT EXISTS periods_per_game   INT DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS minutes_per_period INT DEFAULT 0;
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_sets_per_match INT DEFAULT 0;

-- ============================================================
-- 2. SPORTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS sports (
  id   BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT
);

INSERT INTO sports (name, icon) VALUES
  ('Lacrosse',    '🥍'),
  ('Soccer',      '⚽'),
  ('Basketball',  '🏀'),
  ('Baseball',    '⚾'),
  ('Softball',    '🥎'),
  ('Volleyball',  '🏐'),
  ('Football',    '🏈'),
  ('Hockey',      '🏒'),
  ('Tennis',      '🎾'),
  ('Swimming',    '🏊'),
  ('Track',       '🏃'),
  ('Wrestling',   '🤼'),
  ('Other',       '🏆')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- VERIFICATION
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'events' ORDER BY ordinal_position;
-- ============================================================
