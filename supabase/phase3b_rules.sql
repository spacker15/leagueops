-- ============================================================
-- LeagueOps — Rules Engine Schema
-- Run in Supabase SQL Editor AFTER phase3_migration.sql
-- ============================================================

-- ============================================================
-- RULES TABLE
-- Stores all configurable thresholds and rules as key/value pairs
-- grouped by category. Overrides the engine defaults at runtime.
-- ============================================================
CREATE TABLE IF NOT EXISTS event_rules (
  id          BIGSERIAL PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,  -- 'weather', 'lightning', 'heat', 'wind', 'referee', 'scheduling', 'general'
  rule_key    TEXT NOT NULL,
  rule_label  TEXT NOT NULL,
  rule_value  TEXT NOT NULL,
  value_type  TEXT NOT NULL DEFAULT 'number'
    CHECK (value_type IN ('number', 'boolean', 'text', 'select')),
  unit        TEXT,          -- 'miles', 'minutes', '°F', 'mph', etc.
  description TEXT,
  options     TEXT[],        -- for 'select' type: allowed values
  is_override BOOLEAN DEFAULT FALSE,  -- true = user changed from default
  default_value TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  TEXT DEFAULT 'system',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, category, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_rules_event    ON event_rules(event_id);
CREATE INDEX IF NOT EXISTS idx_rules_category ON event_rules(category);

ALTER TABLE event_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON event_rules FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE event_rules;

-- ============================================================
-- RULE CHANGE LOG — audit trail of all rule changes
-- ============================================================
CREATE TABLE IF NOT EXISTS rule_changes (
  id          BIGSERIAL PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rule_id     BIGINT NOT NULL REFERENCES event_rules(id) ON DELETE CASCADE,
  rule_key    TEXT NOT NULL,
  old_value   TEXT NOT NULL,
  new_value   TEXT NOT NULL,
  changed_by  TEXT DEFAULT 'operator',
  changed_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rule_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON rule_changes FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SEED DEFAULT RULES FOR EVENT 1
-- These mirror the hardcoded defaults in the engine files
-- ============================================================
INSERT INTO event_rules (event_id, category, rule_key, rule_label, rule_value, value_type, unit, description, default_value) VALUES

-- ── LIGHTNING ──────────────────────────────────────────────
(1, 'lightning', 'radius_miles',        'Lightning Radius',           '8',   'number',  'miles',   'Trigger delay when lightning detected within this radius', '8'),
(1, 'lightning', 'delay_minutes',       'Delay Hold Duration',        '30',  'number',  'minutes', '30-minute clock after last detected lightning strike', '30'),
(1, 'lightning', 'reset_on_new_strike', 'Reset Timer on New Strike',  'true','boolean', NULL,      'Restart the 30-min timer if new lightning detected during hold', 'true'),
(1, 'lightning', 'auto_detect',         'Auto-Detect from Weather',   'true','boolean', NULL,      'Automatically trigger delay when weather engine detects lightning', 'true'),
(1, 'lightning', 'notify_refs',         'Notify Refs on Delay',       'true','boolean', NULL,      'Send alert to referee operations panel when delay triggered', 'true'),

-- ── HEAT ───────────────────────────────────────────────────
(1, 'heat', 'advisory_f',              'Heat Advisory Threshold',     '95',  'number',  '°F heat index', 'Issue advisory and require water breaks', '95'),
(1, 'heat', 'warning_f',              'Heat Warning Threshold',       '103', 'number',  '°F heat index', 'Mandatory 5-min break every 20 minutes', '103'),
(1, 'heat', 'emergency_f',            'Heat Emergency Threshold',     '113', 'number',  '°F heat index', 'Suspend all play immediately', '113'),
(1, 'heat', 'advisory_break_min',     'Advisory Break Interval',      '30',  'number',  'minutes', 'Water break frequency during heat advisory', '30'),
(1, 'heat', 'warning_break_min',      'Warning Break Interval',       '20',  'number',  'minutes', 'Mandatory break frequency during heat warning', '20'),
(1, 'heat', 'use_heat_index',         'Use Heat Index (not air temp)', 'true','boolean', NULL,      'Calculate heat index from temp + humidity rather than air temp alone', 'true'),

-- ── WIND ───────────────────────────────────────────────────
(1, 'wind', 'advisory_mph',           'Wind Advisory Speed',          '25',  'number',  'mph', 'Issue wind advisory at this sustained wind speed', '25'),
(1, 'wind', 'suspend_mph',            'Wind Suspension Speed',        '40',  'number',  'mph', 'Suspend all play at this sustained wind speed', '40'),
(1, 'wind', 'gust_factor',            'Gust Suspension Speed',        '50',  'number',  'mph', 'Suspend play if wind gusts reach this speed', '50'),

-- ── WEATHER POLLING ────────────────────────────────────────
(1, 'weather', 'poll_interval_min',   'Weather Poll Interval',        '5',   'number',  'minutes', 'How often to auto-fetch weather from API', '5'),
(1, 'weather', 'auto_poll',           'Auto-Poll Weather',            'false','boolean', NULL,     'Automatically poll weather every N minutes', 'false'),
(1, 'weather', 'cache_minutes',       'Weather Cache Duration',        '5',   'number',  'minutes', 'Cache weather results to avoid excess API calls', '5'),
(1, 'weather', 'provider',            'Weather Provider',              'openweathermap', 'select', NULL, 'External weather data provider', 'openweathermap', ARRAY['openweathermap', 'weatherapi', 'mock']),

-- ── REFEREE ────────────────────────────────────────────────
(1, 'referee', 'travel_buffer_min',   'Default Travel Buffer',        '30',  'number',  'minutes', 'Minimum time between consecutive games for a referee', '30'),
(1, 'referee', 'max_games_per_day',   'Default Max Games Per Day',    '4',   'number',  'games',   'Maximum games a referee can be assigned in one day', '4'),
(1, 'referee', 'min_grade_u12',       'Min Grade for U12',            '5',   'number',  'grade',   'Minimum referee grade level required for U12 games', '5'),
(1, 'referee', 'min_grade_u14',       'Min Grade for U14',            '6',   'number',  'grade',   'Minimum referee grade level required for U14 games', '6'),
(1, 'referee', 'min_grade_u16',       'Min Grade for U16',            '7',   'number',  'grade',   'Minimum referee grade level required for U16 games', '7'),
(1, 'referee', 'require_checkin',     'Require Check-In to Assign',   'false','boolean', NULL,     'Only allow checked-in referees to be assigned to games', 'false'),
(1, 'referee', 'refs_per_game',       'Required Refs Per Game',       '2',   'number',  'refs',    'Minimum referees required per game (triggers missing_referee conflict)', '2'),

-- ── SCHEDULING ─────────────────────────────────────────────
(1, 'scheduling', 'game_duration_min','Default Game Duration',        '60',  'number',  'minutes', 'Default game slot length in minutes', '60'),
(1, 'scheduling', 'buffer_min',       'Buffer Between Games',         '10',  'number',  'minutes', 'Minimum gap between games on the same field', '10'),
(1, 'scheduling', 'min_rest_min',     'Minimum Team Rest',            '90',  'number',  'minutes', 'Minimum rest time for a team between games', '90'),
(1, 'scheduling', 'earliest_start',  'Earliest Game Start',           '08:00', 'text',  NULL,      'No games scheduled before this time', '08:00'),
(1, 'scheduling', 'latest_end',      'Latest Game End',               '18:00', 'text',  NULL,      'No games scheduled to end after this time', '18:00'),
(1, 'scheduling', 'allow_doubleheaders','Allow Doubleheaders',         'true', 'boolean', NULL,    'Allow teams to play back-to-back games', 'true'),

-- ── GENERAL ────────────────────────────────────────────────
(1, 'general', 'tournament_name',    'Tournament Name',               'Knights Lacrosse Summer Invitational 2025', 'text', NULL, 'Displayed in the app header', 'Knights Lacrosse Summer Invitational 2025'),
(1, 'general', 'event_location',     'Event Location',                'Riverside Sports Complex, Jacksonville FL', 'text', NULL, 'Tournament venue', 'Riverside Sports Complex, Jacksonville FL'),
(1, 'general', 'ops_log_retention',  'Ops Log Retention',            '500',  'number',  'entries', 'Maximum operations log entries to keep', '500'),
(1, 'general', 'auto_final',         'Auto-Mark Games Final',         'false','boolean', NULL,     'Automatically mark games Final when scheduled end time passes', 'false'),
(1, 'general', 'require_roster_checkin', 'Require Roster for Check-In','false','boolean',NULL,    'Block player check-in unless roster has been uploaded', 'false')

ON CONFLICT (event_id, category, rule_key) DO NOTHING;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT category, rule_key, rule_value, unit FROM event_rules WHERE event_id = 1 ORDER BY category, rule_key;
