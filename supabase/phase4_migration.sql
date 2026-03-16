-- ============================================================
-- LeagueOps — Phase 4 Migration
-- Field Conflict Engine Schema
-- Run in Supabase SQL Editor AFTER phase3b_rules.sql
-- All changes are additive
-- ============================================================

-- ============================================================
-- 1. Add sort_order and display_time to games
--    so drag-and-drop reordering can be persisted
-- ============================================================
ALTER TABLE games ADD COLUMN IF NOT EXISTS sort_order     INT DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS display_time   TEXT; -- override for display after drag

-- ============================================================
-- 2. Enrich field_blocks with more context
-- ============================================================
ALTER TABLE field_blocks ADD COLUMN IF NOT EXISTS event_id BIGINT REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE field_blocks ADD COLUMN IF NOT EXISTS affects_all_day BOOLEAN DEFAULT FALSE;
ALTER TABLE field_blocks ADD COLUMN IF NOT EXISTS auto_generated  BOOLEAN DEFAULT FALSE;

-- Backfill event_id for existing field blocks
UPDATE field_blocks fb
SET event_id = f.event_id
FROM fields f
WHERE fb.field_id = f.id
  AND fb.event_id IS NULL;

-- ============================================================
-- 3. Schedule snapshots — save/restore named schedule versions
-- ============================================================
CREATE TABLE IF NOT EXISTS schedule_snapshots (
  id          BIGSERIAL PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  games_json  JSONB NOT NULL,  -- serialized game list at snapshot time
  created_by  TEXT DEFAULT 'operator',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE schedule_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON schedule_snapshots FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 4. Field conflict engine run log
--    Records when the engine ran and what it found
-- ============================================================
CREATE TABLE IF NOT EXISTS conflict_engine_runs (
  id              BIGSERIAL PRIMARY KEY,
  event_id        BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_date_id   BIGINT REFERENCES event_dates(id) ON DELETE SET NULL,
  engine_type     TEXT NOT NULL DEFAULT 'field'
    CHECK (engine_type IN ('field', 'referee', 'full')),
  conflicts_found INT DEFAULT 0,
  conflicts_resolved INT DEFAULT 0,
  duration_ms     INT,
  triggered_by    TEXT DEFAULT 'manual',
  ran_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conflict_engine_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON conflict_engine_runs FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 5. Add new conflict types for field engine to allowed values
--    (operational_conflicts table already exists from Phase 1)
-- ============================================================
-- The check constraint already allows: field_overlap, field_blocked, schedule_cascade
-- No migration needed — just adding engine logic on top

-- ============================================================
-- 6. INDEXES for conflict engine queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_games_field_status ON games(field_id, status);
CREATE INDEX IF NOT EXISTS idx_games_event_date   ON games(event_id, event_date_id);
CREATE INDEX IF NOT EXISTS idx_field_blocks_event ON field_blocks(event_id);

-- ============================================================
-- 7. Add new scheduling rules to event_rules
-- ============================================================
INSERT INTO event_rules (event_id, category, rule_key, rule_label, rule_value, value_type, unit, description, default_value)
VALUES
  (1, 'scheduling', 'overlap_tolerance_min',  'Overlap Tolerance',          '0',  'number', 'minutes', 'Allow games to overlap by this many minutes before flagging as conflict. 0 = strict.', '0'),
  (1, 'scheduling', 'flag_back_to_back',       'Flag Back-to-Back Teams',    'true','boolean', NULL,    'Flag when the same team is scheduled for consecutive games with no rest', 'true'),
  (1, 'scheduling', 'cascade_delay_min',       'Cascade Delay Buffer',       '15', 'number', 'minutes', 'When a game runs long, flag games within this window as potentially cascaded', '15'),
  (1, 'scheduling', 'max_games_per_field',     'Max Games Per Field Per Day','8',  'number', 'games',   'Flag when a field is scheduled beyond this many games in one day', '8'),
  (1, 'general',    'conflict_auto_run',        'Auto-Run Conflict Engine',   'false','boolean',NULL,   'Automatically run the conflict engine after any game status or schedule change', 'false')
ON CONFLICT (event_id, category, rule_key) DO NOTHING;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'games' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'field_blocks' ORDER BY ordinal_position;
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT COUNT(*) FROM event_rules WHERE event_id = 1;
