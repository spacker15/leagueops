-- ============================================================
-- Ref Requirements per Division
-- Configures how many adult vs youth referees are expected
-- for each division. Stored as JSONB on the events table.
-- ============================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS ref_requirements JSONB DEFAULT '{
    "U8":      {"adult": 0, "youth": 2},
    "U10":     {"adult": 1, "youth": 1},
    "default": {"adult": 2, "youth": 0}
  }'::jsonb;

-- Backfill any existing events that have NULL
UPDATE events
SET ref_requirements = '{
  "U8":      {"adult": 0, "youth": 2},
  "U10":     {"adult": 1, "youth": 1},
  "default": {"adult": 2, "youth": 0}
}'::jsonb
WHERE ref_requirements IS NULL;
