-- Schedule Rules table
CREATE TABLE IF NOT EXISTS schedule_rules (
  id            BIGSERIAL PRIMARY KEY,
  event_id      BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rule_name     TEXT NOT NULL,
  rule_type     TEXT NOT NULL CHECK (rule_type IN ('constraint','preference','override','forced_matchup')),
  category      TEXT NOT NULL CHECK (category IN ('global','division','program','team','weekly','season')),
  scope_division   TEXT,
  scope_program_id BIGINT REFERENCES programs(id) ON DELETE CASCADE,
  scope_team_id    BIGINT REFERENCES teams(id) ON DELETE CASCADE,
  scope_week       INT,
  scope_event_date_id BIGINT REFERENCES event_dates(id) ON DELETE CASCADE,
  conditions    JSONB NOT NULL DEFAULT '{}',
  action        TEXT NOT NULL CHECK (action IN ('block','allow','force','warn','set_param')),
  action_params JSONB NOT NULL DEFAULT '{}',
  priority      INT NOT NULL DEFAULT 100,
  enforcement   TEXT NOT NULL DEFAULT 'hard' CHECK (enforcement IN ('hard','soft','info')),
  enabled       BOOLEAN DEFAULT TRUE,
  created_by    TEXT DEFAULT 'system',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  notes         TEXT,
  UNIQUE(event_id, rule_name)
);
CREATE INDEX IF NOT EXISTS idx_schedule_rules_event ON schedule_rules(event_id);
CREATE INDEX IF NOT EXISTS idx_schedule_rules_category ON schedule_rules(category);

ALTER TABLE schedule_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_rules_all" ON schedule_rules FOR ALL USING (true) WITH CHECK (true);

-- Weekly Overrides table
CREATE TABLE IF NOT EXISTS weekly_overrides (
  id              BIGSERIAL PRIMARY KEY,
  event_id        BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_date_id   BIGINT REFERENCES event_dates(id) ON DELETE CASCADE,
  override_type   TEXT NOT NULL CHECK (override_type IN ('skip_date','force_matchup','remove_matchup','team_unavailable','special_event')),
  team_id         BIGINT REFERENCES teams(id) ON DELETE CASCADE,
  home_team_id    BIGINT REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id    BIGINT REFERENCES teams(id) ON DELETE CASCADE,
  params          JSONB NOT NULL DEFAULT '{}',
  enabled         BOOLEAN DEFAULT TRUE,
  created_by      TEXT DEFAULT 'operator',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  notes           TEXT
);
CREATE INDEX IF NOT EXISTS idx_weekly_overrides_event ON weekly_overrides(event_id);
CREATE INDEX IF NOT EXISTS idx_weekly_overrides_date ON weekly_overrides(event_date_id);

ALTER TABLE weekly_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weekly_overrides_all" ON weekly_overrides FOR ALL USING (true) WITH CHECK (true);

-- Schedule Audit Log table
CREATE TABLE IF NOT EXISTS schedule_audit_log (
  id              BIGSERIAL PRIMARY KEY,
  event_id        BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  run_id          UUID NOT NULL,
  log_type        TEXT NOT NULL CHECK (log_type IN ('matchup_placed','matchup_blocked','matchup_forced','slot_skipped','rule_evaluated','validation_result')),
  severity        TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','error')),
  home_team_id    BIGINT,
  away_team_id    BIGINT,
  division        TEXT,
  event_date_id   BIGINT,
  field_id        BIGINT,
  scheduled_time  TEXT,
  rule_id         BIGINT REFERENCES schedule_rules(id) ON DELETE SET NULL,
  rule_name       TEXT,
  message         TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schedule_audit_event ON schedule_audit_log(event_id);
CREATE INDEX IF NOT EXISTS idx_schedule_audit_run ON schedule_audit_log(run_id);

ALTER TABLE schedule_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_audit_log_all" ON schedule_audit_log FOR ALL USING (true) WITH CHECK (true);
