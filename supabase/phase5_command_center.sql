-- ============================================================
-- LeagueOps Phase 5 — Operations Command Center
-- Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. OPS_ALERTS — prioritized, auto-resolution suggestions
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_alerts (
  id               BIGSERIAL PRIMARY KEY,
  event_id         BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_date_id    BIGINT REFERENCES event_dates(id) ON DELETE SET NULL,
  -- Source engine
  source           TEXT NOT NULL
    CHECK (source IN ('referee_engine','field_engine','weather_engine','manual','escalation')),
  -- Severity: escalates over time if unresolved
  severity         TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info','warning','critical','resolved')),
  -- Alert content
  alert_type       TEXT NOT NULL,   -- 'missing_referee','field_overlap','lightning','heat_advisory', etc.
  title            TEXT NOT NULL,
  description      TEXT,
  -- Linked entities
  game_id          BIGINT REFERENCES games(id) ON DELETE SET NULL,
  field_id         BIGINT REFERENCES fields(id) ON DELETE SET NULL,
  referee_id       BIGINT REFERENCES referees(id) ON DELETE SET NULL,
  -- Auto-resolution
  resolution_suggestion TEXT,       -- human-readable recommendation
  resolution_action     TEXT,       -- machine action key (e.g. 'delay_game_20min')
  resolution_params     JSONB,      -- params for the action
  -- State
  resolved         BOOLEAN DEFAULT FALSE,
  resolved_by      TEXT,
  resolved_at      TIMESTAMPTZ,
  resolution_note  TEXT,
  -- Escalation
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  escalated_at     TIMESTAMPTZ,     -- set when severity bumped to critical
  escalation_threshold_minutes INT DEFAULT 15
);

CREATE INDEX IF NOT EXISTS idx_alerts_event    ON ops_alerts(event_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON ops_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON ops_alerts(resolved);

ALTER TABLE ops_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON ops_alerts FOR ALL USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE ops_alerts;

-- ============================================================
-- 2. SHIFT_HANDOFFS — log for incoming staff
-- ============================================================
CREATE TABLE IF NOT EXISTS shift_handoffs (
  id           BIGSERIAL PRIMARY KEY,
  event_id     BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_by   TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  summary      TEXT NOT NULL,        -- auto-generated markdown summary
  period_start TIMESTAMPTZ,          -- covers from
  period_end   TIMESTAMPTZ,          -- covers to
  stats        JSONB                 -- { games_completed, incidents, alerts_resolved, ... }
);

ALTER TABLE shift_handoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON shift_handoffs FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 3. Extend ops_log with source tagging
-- ============================================================
ALTER TABLE ops_log ADD COLUMN IF NOT EXISTS source      TEXT;
ALTER TABLE ops_log ADD COLUMN IF NOT EXISTS entity_type TEXT;  -- 'game','field','referee','player'
ALTER TABLE ops_log ADD COLUMN IF NOT EXISTS entity_id   BIGINT;

-- ============================================================
-- VERIFICATION
-- SELECT COUNT(*) FROM ops_alerts;
-- SELECT COUNT(*) FROM shift_handoffs;
-- ============================================================
