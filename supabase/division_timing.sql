CREATE TABLE IF NOT EXISTS division_timing (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
  division_name TEXT NOT NULL,
  schedule_increment INT,
  time_between_games INT,
  periods_per_game INT,
  minutes_per_period INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, division_name)
);
ALTER TABLE division_timing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on division_timing" ON division_timing FOR ALL USING (true) WITH CHECK (true);
