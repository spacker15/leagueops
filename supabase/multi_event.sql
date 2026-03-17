-- ============================================================
-- LeagueOps — Multi-Event / Multi-Tenancy Migration
-- Run in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. EXTEND EVENTS TABLE — tenant metadata
-- ============================================================
ALTER TABLE events ADD COLUMN IF NOT EXISTS slug          TEXT UNIQUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS owner_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_active     BOOLEAN DEFAULT TRUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_code    TEXT UNIQUE; -- short join code e.g. "KNT25"
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_public     BOOLEAN DEFAULT FALSE;

-- Generate slug for existing event
UPDATE events SET slug = 'event-' || id WHERE slug IS NULL;
UPDATE events SET event_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6)) WHERE event_code IS NULL;

-- ============================================================
-- 2. EVENT_ADMINS — which users can manage which events
-- ============================================================
CREATE TABLE IF NOT EXISTS event_admins (
  id         BIGSERIAL PRIMARY KEY,
  event_id   BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner','admin','league_admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE event_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON event_admins FOR ALL USING (true) WITH CHECK (true);

-- Seed existing admins from user_roles
INSERT INTO event_admins (event_id, user_id, role)
SELECT DISTINCT event_id, user_id,
  CASE WHEN role = 'admin' THEN 'owner' ELSE 'admin' END
FROM user_roles
WHERE role IN ('admin','league_admin')
  AND event_id IS NOT NULL
ON CONFLICT (event_id, user_id) DO NOTHING;

-- ============================================================
-- 3. Set current event owner
-- (run after noting your user_id from auth.users)
-- UPDATE events SET owner_id = 'your-user-uuid-here' WHERE id = 1;
-- ============================================================

-- ============================================================
-- VERIFICATION
-- SELECT id, name, slug, event_code FROM events;
-- SELECT * FROM event_admins;
-- ============================================================
