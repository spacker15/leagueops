-- ============================================================
-- LeagueOps — Field Map Enhancements
-- Run in Supabase SQL Editor
-- ============================================================

ALTER TABLE fields ADD COLUMN IF NOT EXISTS map_rotation INT DEFAULT 0;        -- degrees 0-360
ALTER TABLE fields ADD COLUMN IF NOT EXISTS map_color    TEXT DEFAULT '#1a5e1a'; -- hex fill color
ALTER TABLE fields ADD COLUMN IF NOT EXISTS map_opacity  INT DEFAULT 70;         -- 0-100
ALTER TABLE fields ADD COLUMN IF NOT EXISTS map_shape    TEXT DEFAULT 'rect'
  CHECK (map_shape IN ('rect', 'diamond', 'circle'));                             -- field shape

-- Widen default field size
UPDATE fields SET map_w = 160, map_h = 90 WHERE map_w = 0 OR map_h = 0;
