-- Add program_id to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS program_id BIGINT REFERENCES programs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_teams_program ON teams(program_id);

-- Backfill from program_teams join table
UPDATE teams t SET program_id = pt.program_id
FROM program_teams pt
WHERE pt.team_id = t.id AND t.program_id IS NULL;
