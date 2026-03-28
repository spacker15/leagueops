-- Add color to registration_divisions
ALTER TABLE registration_divisions ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#0B3D91';

-- Field-division many-to-many (a field can host multiple divisions)
CREATE TABLE IF NOT EXISTS field_divisions (
  id BIGSERIAL PRIMARY KEY,
  field_id BIGINT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  division_name TEXT NOT NULL,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(field_id, division_name)
);
ALTER TABLE field_divisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on field_divisions" ON field_divisions FOR ALL USING (true) WITH CHECK (true);
