-- Phase 8: Schedule Change Request Workflow migration

-- ============================================================
-- UPDATE GAMES STATUS CHECK CONSTRAINT to add 'Cancelled'
-- ============================================================
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_status_check;
ALTER TABLE games ADD CONSTRAINT games_status_check
  CHECK (status IN ('Scheduled','Starting','Live','Halftime','Final','Delayed','Cancelled'));

-- ============================================================
-- SCHEDULE_CHANGE_REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS schedule_change_requests (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  submitted_by_role TEXT NOT NULL CHECK (submitted_by_role IN ('coach', 'program_leader')),
  team_id BIGINT NOT NULL REFERENCES teams(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('cancel', 'reschedule', 'change_opponent')),
  reason_category TEXT NOT NULL CHECK (reason_category IN (
    'Coach conflict', 'Team conflict', 'Weather concern', 'Venue issue', 'Opponent issue', 'Other'
  )),
  reason_details TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'approved', 'denied', 'partially_complete', 'completed')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCHEDULE_CHANGE_REQUEST_GAMES (junction table)
-- ============================================================
CREATE TABLE IF NOT EXISTS schedule_change_request_games (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES schedule_change_requests(id) ON DELETE CASCADE,
  game_id BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'approved', 'denied', 'rescheduled', 'cancelled')),
  new_field_id BIGINT REFERENCES fields(id),
  new_scheduled_time TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, game_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_scr_event ON schedule_change_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_scr_status ON schedule_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_scr_team ON schedule_change_requests(team_id);
CREATE INDEX IF NOT EXISTS idx_scrg_request ON schedule_change_request_games(request_id);
CREATE INDEX IF NOT EXISTS idx_scrg_game ON schedule_change_request_games(game_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE schedule_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_change_request_games ENABLE ROW LEVEL SECURITY;

-- Authenticated users can SELECT schedule_change_requests for their events
CREATE POLICY "auth_select_schedule_change_requests"
  ON schedule_change_requests
  FOR SELECT
  TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- Authenticated users can INSERT their own schedule change requests
CREATE POLICY "auth_insert_schedule_change_requests"
  ON schedule_change_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = auth.uid());

-- Admins can UPDATE schedule_change_requests
CREATE POLICY "admin_update_schedule_change_requests"
  ON schedule_change_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND event_id = schedule_change_requests.event_id
        AND role IN ('admin', 'super_admin')
    )
  );

-- Authenticated users can SELECT schedule_change_request_games for their events
CREATE POLICY "auth_select_schedule_change_request_games"
  ON schedule_change_request_games
  FOR SELECT
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM schedule_change_requests
      WHERE event_id IN (SELECT user_event_ids())
    )
  );

-- Admins can UPDATE schedule_change_request_games
CREATE POLICY "admin_update_schedule_change_request_games"
  ON schedule_change_request_games
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM schedule_change_requests scr
      JOIN user_roles ur ON ur.user_id = auth.uid()
        AND ur.event_id = scr.event_id
        AND ur.role IN ('admin', 'super_admin')
      WHERE scr.id = schedule_change_request_games.request_id
    )
  );

-- ============================================================
-- RESCHEDULE_GAME RPC FUNCTION (atomic, conflict-checked)
-- ============================================================
CREATE OR REPLACE FUNCTION reschedule_game(
  p_game_id BIGINT,
  p_new_field_id BIGINT,
  p_new_scheduled_time TIMESTAMPTZ,
  p_request_game_id BIGINT,
  p_event_id BIGINT
) RETURNS JSONB AS $$
DECLARE
  v_conflict_count INT;
  v_game_duration INT := 60;
BEGIN
  SELECT COUNT(*) INTO v_conflict_count
  FROM games
  WHERE field_id = p_new_field_id
    AND event_id = p_event_id
    AND id != p_game_id
    AND status NOT IN ('Final', 'Cancelled')
    AND scheduled_time < p_new_scheduled_time + (v_game_duration || ' minutes')::INTERVAL
    AND scheduled_time + (v_game_duration || ' minutes')::INTERVAL > p_new_scheduled_time;

  IF v_conflict_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Field conflict detected at proposed slot');
  END IF;

  UPDATE games SET
    field_id = p_new_field_id,
    scheduled_time = p_new_scheduled_time,
    status = 'Scheduled'
  WHERE id = p_game_id;

  UPDATE schedule_change_request_games SET
    status = 'rescheduled',
    new_field_id = p_new_field_id,
    new_scheduled_time = p_new_scheduled_time,
    processed_at = NOW()
  WHERE id = p_request_game_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_change_requests;
