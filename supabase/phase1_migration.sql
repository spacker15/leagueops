-- ============================================================
-- LeagueOps — Phase 1 Migration
-- Schema Stabilization
-- Run in Supabase SQL Editor AFTER the original schema.sql
-- All changes are additive — nothing is dropped or modified destructively
-- ============================================================

-- ============================================================
-- 1. COMPLEXES
-- Venues that contain one or more fields.
-- Weather monitoring, lightning radius, and GPS are per-complex.
-- ============================================================
CREATE TABLE IF NOT EXISTS complexes (
  id                     BIGSERIAL PRIMARY KEY,
  event_id               BIGINT REFERENCES events(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  address                TEXT,
  lat                    DECIMAL(10, 7),
  lng                    DECIMAL(10, 7),
  lightning_radius_miles INT DEFAULT 8,
  weather_provider       TEXT DEFAULT 'openweathermap',
  notes                  TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE complexes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON complexes FOR ALL USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE complexes;

-- ============================================================
-- 2. FIELDS — add complex_id (nullable, no existing rows break)
-- ============================================================
ALTER TABLE fields ADD COLUMN IF NOT EXISTS complex_id BIGINT REFERENCES complexes(id) ON DELETE SET NULL;

-- ============================================================
-- 3. FIELD BLOCKS
-- Tracks field unavailability: weather closures, maintenance,
-- reserved windows. The conflict engine checks these.
-- ============================================================
CREATE TABLE IF NOT EXISTS field_blocks (
  id         BIGSERIAL PRIMARY KEY,
  field_id   BIGINT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL CHECK (reason IN ('weather', 'maintenance', 'reserved', 'lightning', 'other')),
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  notes      TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT field_blocks_valid_range CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_field_blocks_field ON field_blocks(field_id);
CREATE INDEX IF NOT EXISTS idx_field_blocks_time  ON field_blocks(starts_at, ends_at);

ALTER TABLE field_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON field_blocks FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE field_blocks;

-- ============================================================
-- 4. SEASONS
-- For ongoing leagues (not just single-weekend tournaments).
-- Additive — existing events table is unchanged.
-- ============================================================
CREATE TABLE IF NOT EXISTS seasons (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  sport      TEXT NOT NULL DEFAULT 'Lacrosse',
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON seasons FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 5. REFEREES — add richer profile columns
-- All nullable so existing referee rows are unaffected
-- ============================================================
ALTER TABLE referees ADD COLUMN IF NOT EXISTS certifications      TEXT[]  DEFAULT '{}';
ALTER TABLE referees ADD COLUMN IF NOT EXISTS eligible_divisions  TEXT[]  DEFAULT '{}';
ALTER TABLE referees ADD COLUMN IF NOT EXISTS max_games_per_day   INT     DEFAULT 4;
ALTER TABLE referees ADD COLUMN IF NOT EXISTS travel_buffer_min   INT     DEFAULT 30;
ALTER TABLE referees ADD COLUMN IF NOT EXISTS home_zip            TEXT;
ALTER TABLE referees ADD COLUMN IF NOT EXISTS notes               TEXT;

-- ============================================================
-- 6. REFEREE AVAILABILITY WINDOWS
-- Defines when a referee is available on a given date.
-- The referee engine uses these to validate assignments.
-- ============================================================
CREATE TABLE IF NOT EXISTS referee_availability (
  id             BIGSERIAL PRIMARY KEY,
  referee_id     BIGINT NOT NULL REFERENCES referees(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  available_from TIME NOT NULL,
  available_to   TIME NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT referee_availability_valid_range CHECK (available_to > available_from),
  UNIQUE (referee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ref_avail_referee ON referee_availability(referee_id);
CREATE INDEX IF NOT EXISTS idx_ref_avail_date    ON referee_availability(date);

ALTER TABLE referee_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON referee_availability FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 7. OPERATIONAL CONFLICTS
-- Written to by the Operations Engine when it detects problems.
-- The command center reads from this table for the conflict panel.
-- ============================================================
CREATE TABLE IF NOT EXISTS operational_conflicts (
  id                  BIGSERIAL PRIMARY KEY,
  event_id            BIGINT REFERENCES events(id) ON DELETE CASCADE,
  conflict_type       TEXT NOT NULL CHECK (conflict_type IN (
                        'ref_double_booked',
                        'ref_unavailable',
                        'field_overlap',
                        'field_blocked',
                        'weather_closure',
                        'schedule_cascade',
                        'missing_referee',
                        'max_games_exceeded'
                      )),
  severity            TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  impacted_game_ids   BIGINT[]  DEFAULT '{}',
  impacted_ref_ids    BIGINT[]  DEFAULT '{}',
  impacted_field_ids  BIGINT[]  DEFAULT '{}',
  description         TEXT NOT NULL,
  resolution_options  JSONB     DEFAULT '[]',
  resolved            BOOLEAN   DEFAULT FALSE,
  resolved_at         TIMESTAMPTZ,
  resolved_by         TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conflicts_event    ON operational_conflicts(event_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_resolved ON operational_conflicts(resolved);
CREATE INDEX IF NOT EXISTS idx_conflicts_severity ON operational_conflicts(severity);

ALTER TABLE operational_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON operational_conflicts FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE operational_conflicts;

-- ============================================================
-- 8. PERFORMANCE INDEXES on existing tables
-- Safe to add — indexes never break queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_games_field_time   ON games(field_id, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_games_status       ON games(status);
CREATE INDEX IF NOT EXISTS idx_ref_assign_referee ON ref_assignments(referee_id);

-- ============================================================
-- 9. SEED: Complexes for existing event
-- Groups the 8 existing fields into 2 complexes
-- ============================================================
INSERT INTO complexes (id, event_id, name, address, lat, lng, lightning_radius_miles) VALUES
(1, 1, 'Riverside Sports Complex — Main',  '4500 Riverside Ave, Jacksonville FL 32210', 30.3322, -81.6557, 8),
(2, 1, 'Riverside Sports Complex — South', '4520 Riverside Ave, Jacksonville FL 32210', 30.3301, -81.6557, 8)
ON CONFLICT DO NOTHING;

SELECT setval('complexes_id_seq', 2);

-- Assign existing fields to complexes
UPDATE fields SET complex_id = 1 WHERE id IN (1, 2, 3, 4) AND event_id = 1;
UPDATE fields SET complex_id = 2 WHERE id IN (5, 6, 7, 8) AND event_id = 1;

-- ============================================================
-- 10. SEED: Referee profile data for existing referees
-- ============================================================
UPDATE referees SET
  certifications     = ARRAY['NFHS Level 1'],
  eligible_divisions = ARRAY['U10','U12','U14'],
  max_games_per_day  = 4,
  travel_buffer_min  = 20
WHERE id IN (1, 2, 6, 8, 10) AND event_id = 1;

UPDATE referees SET
  certifications     = ARRAY['NFHS Level 1', 'NFHS Level 2'],
  eligible_divisions = ARRAY['U12','U14','U16','U18'],
  max_games_per_day  = 5,
  travel_buffer_min  = 30
WHERE id IN (3, 5, 7, 9) AND event_id = 1;

UPDATE referees SET
  certifications     = ARRAY['NFHS Level 1', 'NFHS Level 2', 'NFHS Level 3'],
  eligible_divisions = ARRAY['U14','U16','U18','Open'],
  max_games_per_day  = 6,
  travel_buffer_min  = 30
WHERE id = 4 AND event_id = 1;

-- ============================================================
-- 11. SEED: Referee availability for tournament weekend
-- ============================================================
INSERT INTO referee_availability (referee_id, date, available_from, available_to) VALUES
(1, '2025-06-14', '07:30', '17:00'),
(1, '2025-06-15', '07:30', '15:00'),
(2, '2025-06-14', '07:30', '17:00'),
(2, '2025-06-15', '08:00', '17:00'),
(3, '2025-06-14', '07:00', '18:00'),
(3, '2025-06-15', '07:00', '18:00'),
(4, '2025-06-14', '08:00', '17:00'),
(5, '2025-06-14', '07:30', '16:00'),
(5, '2025-06-15', '07:30', '16:00'),
(6, '2025-06-14', '08:00', '14:00'),
(7, '2025-06-14', '07:00', '17:00'),
(7, '2025-06-15', '08:00', '17:00'),
(8, '2025-06-15', '09:00', '17:00'),
(9, '2025-06-14', '07:30', '17:00'),
(9, '2025-06-15', '07:30', '17:00'),
(10,'2025-06-14', '08:00', '16:00'),
(10,'2025-06-15', '08:00', '16:00')
ON CONFLICT DO NOTHING;

-- ============================================================
-- VERIFICATION QUERIES
-- Run these after the migration to confirm everything landed
-- ============================================================

-- Should return 2 complexes
-- SELECT id, name, lat, lng FROM complexes;

-- Should return 8 fields, all with complex_id set
-- SELECT id, name, complex_id FROM fields WHERE event_id = 1 ORDER BY id;

-- Should return referees with certifications populated
-- SELECT id, name, certifications, eligible_divisions, max_games_per_day FROM referees WHERE event_id = 1;

-- Should return 17 availability rows
-- SELECT referee_id, date, available_from, available_to FROM referee_availability ORDER BY referee_id, date;

-- Should show the 7 new tables
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
