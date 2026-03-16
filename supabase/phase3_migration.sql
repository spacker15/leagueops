-- ============================================================
-- LeagueOps — Phase 3 Migration
-- Weather Engine Schema
-- Run in Supabase SQL Editor AFTER phase1_migration.sql
-- All changes are additive
-- ============================================================

-- ============================================================
-- 1. Add weather_provider_key to complexes (store API key ref)
--    and last_fetched timestamp for cache control
-- ============================================================
ALTER TABLE complexes ADD COLUMN IF NOT EXISTS last_weather_fetch TIMESTAMPTZ;
ALTER TABLE complexes ADD COLUMN IF NOT EXISTS weather_cache      JSONB;
ALTER TABLE complexes ADD COLUMN IF NOT EXISTS auto_monitor       BOOLEAN DEFAULT TRUE;

-- ============================================================
-- 2. Enrich weather_alerts table
--    Add complex_id linkage and structured weather data
-- ============================================================
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS complex_id      BIGINT REFERENCES complexes(id) ON DELETE SET NULL;
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS temperature_f   DECIMAL(5,1);
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS heat_index_f    DECIMAL(5,1);
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS humidity_pct    INT;
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS wind_mph        DECIMAL(5,1);
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS wind_gust_mph   DECIMAL(5,1);
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS conditions      TEXT;
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS lightning_detected BOOLEAN DEFAULT FALSE;
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS lightning_miles    DECIMAL(5,1);
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS source          TEXT DEFAULT 'manual';
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS severity        TEXT DEFAULT 'warning'
  CHECK (severity IN ('info','warning','critical'));
ALTER TABLE weather_alerts ADD COLUMN IF NOT EXISTS auto_resolved   BOOLEAN DEFAULT FALSE;

-- ============================================================
-- 3. Weather monitor log — every poll result stored here
--    Gives operators a history of conditions
-- ============================================================
CREATE TABLE IF NOT EXISTS weather_readings (
  id            BIGSERIAL PRIMARY KEY,
  complex_id    BIGINT NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  event_id      BIGINT NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
  temperature_f DECIMAL(5,1),
  feels_like_f  DECIMAL(5,1),
  heat_index_f  DECIMAL(5,1),
  humidity_pct  INT,
  wind_mph      DECIMAL(5,1),
  wind_gust_mph DECIMAL(5,1),
  wind_dir_deg  INT,
  conditions    TEXT,
  conditions_code INT,
  visibility_mi DECIMAL(5,1),
  pressure_mb   DECIMAL(7,2),
  cloud_pct     INT,
  uv_index      DECIMAL(4,1),
  lightning_detected BOOLEAN DEFAULT FALSE,
  lightning_miles    DECIMAL(5,1),
  raw_response  JSONB,
  fetched_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_readings_complex ON weather_readings(complex_id);
CREATE INDEX IF NOT EXISTS idx_weather_readings_event   ON weather_readings(event_id);
CREATE INDEX IF NOT EXISTS idx_weather_readings_time    ON weather_readings(fetched_at DESC);

ALTER TABLE weather_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON weather_readings FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE weather_readings;

-- ============================================================
-- 4. Lightning strikes log — separate from general alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS lightning_events (
  id                 BIGSERIAL PRIMARY KEY,
  complex_id         BIGINT NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  event_id           BIGINT NOT NULL REFERENCES events(id)    ON DELETE CASCADE,
  detected_at        TIMESTAMPTZ DEFAULT NOW(),
  closest_miles      DECIMAL(5,1),
  delay_started_at   TIMESTAMPTZ,
  delay_ends_at      TIMESTAMPTZ,
  all_clear_at       TIMESTAMPTZ,
  reset_count        INT DEFAULT 0,
  triggered_by       TEXT DEFAULT 'manual',
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lightning_complex ON lightning_events(complex_id);
CREATE INDEX IF NOT EXISTS idx_lightning_event   ON lightning_events(event_id);

ALTER TABLE lightning_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON lightning_events FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE lightning_events;

-- ============================================================
-- 5. Heat protocol log
-- ============================================================
CREATE TABLE IF NOT EXISTS heat_events (
  id              BIGSERIAL PRIMARY KEY,
  complex_id      BIGINT NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
  event_id        BIGINT NOT NULL REFERENCES events(id)    ON DELETE CASCADE,
  heat_index_f    DECIMAL(5,1) NOT NULL,
  protocol_level  TEXT NOT NULL CHECK (protocol_level IN ('advisory','warning','emergency')),
  actions_taken   TEXT[],
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE heat_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON heat_events FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'weather_alerts' ORDER BY ordinal_position;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'complexes' ORDER BY ordinal_position;
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
