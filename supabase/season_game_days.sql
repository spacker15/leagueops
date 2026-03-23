CREATE TABLE IF NOT EXISTS season_game_days (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT REFERENCES events(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TEXT NOT NULL DEFAULT '09:00',
  end_time TEXT NOT NULL DEFAULT '17:00',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, day_of_week)
);
ALTER TABLE season_game_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on season_game_days" ON season_game_days FOR ALL USING (true) WITH CHECK (true);
