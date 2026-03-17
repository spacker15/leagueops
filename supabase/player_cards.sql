-- ============================================================
-- LeagueOps — Player Card Fields Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- Add USA Lacrosse number to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS usa_lacrosse_number TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS birthdate          DATE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS zipcode            TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS parent_email       TEXT;

-- Index for USA Lacrosse number lookups
CREATE INDEX IF NOT EXISTS idx_players_usa_lax ON players(usa_lacrosse_number);

-- VERIFICATION
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'players' ORDER BY ordinal_position;
