-- ==========================================================
-- RLS Migration: Phase 4 — SEC-01
-- Apply to Supabase branch first, smoke test, then promote
-- ==========================================================
-- Tables covered: 48 application tables
-- user_roles: NOT touched — already has proper policies (auth_migration.sql)
-- payments tables: NOT touched — already have proper policies (payments.sql)
-- storage.objects: NOT touched — already has proper policies (storage_rls.sql)
-- sports: reference-only lookup table, no event scoping needed
-- ==========================================================

-- LAYER 0: user_event_ids() helper function
-- LAYER 1: Drop all permissive policies
-- LAYER 2: Authenticated SELECT policies
-- LAYER 3: Authenticated write policies (INSERT, UPDATE, DELETE)
-- LAYER 4: Anon SELECT policies (public tables only)
-- ROLLBACK BLOCK (commented): restore "Allow all" per table

-- ==========================================================
-- LAYER 0: Deploy user_event_ids() helper function
-- D-03: reads user_roles directly
-- D-04: SECURITY DEFINER — runs as function owner, bypasses caller RLS
-- D-05: empty set = no access (fail-closed)
-- ==========================================================

CREATE OR REPLACE FUNCTION user_event_ids()
RETURNS SETOF BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT event_id
  FROM user_roles
  WHERE user_id = auth.uid()
    AND is_active = TRUE
    AND event_id IS NOT NULL;
$$;

-- Grant execute to all roles (anon calls return empty set since auth.uid() = null)
GRANT EXECUTE ON FUNCTION user_event_ids() TO authenticated, anon;

-- ==========================================================
-- LAYER 1: Drop ALL existing permissive policies
-- Use DROP POLICY IF EXISTS for idempotency
-- CRITICAL: Do NOT drop user_roles policies — already correct
-- ==========================================================

-- --- schema.sql tables ---
DROP POLICY IF EXISTS "Allow all" ON events;
DROP POLICY IF EXISTS "Allow all" ON event_dates;
DROP POLICY IF EXISTS "Allow all" ON fields;
DROP POLICY IF EXISTS "Allow all" ON teams;
DROP POLICY IF EXISTS "Allow all" ON players;
DROP POLICY IF EXISTS "Allow all" ON games;
DROP POLICY IF EXISTS "Allow all" ON referees;
DROP POLICY IF EXISTS "Allow all" ON ref_assignments;
DROP POLICY IF EXISTS "Allow all" ON volunteers;
DROP POLICY IF EXISTS "Allow all" ON vol_assignments;
DROP POLICY IF EXISTS "Allow all" ON player_checkins;
DROP POLICY IF EXISTS "Allow all" ON incidents;
DROP POLICY IF EXISTS "Allow all" ON medical_incidents;
DROP POLICY IF EXISTS "Allow all" ON weather_alerts;
DROP POLICY IF EXISTS "Allow all" ON ops_log;

-- --- phase1_migration.sql tables ---
DROP POLICY IF EXISTS "Allow all" ON complexes;
DROP POLICY IF EXISTS "Allow all" ON field_blocks;
DROP POLICY IF EXISTS "Allow all" ON seasons;
DROP POLICY IF EXISTS "Allow all" ON referee_availability;
DROP POLICY IF EXISTS "Allow all" ON operational_conflicts;

-- --- phase3_migration.sql tables ---
DROP POLICY IF EXISTS "Allow all" ON weather_readings;
DROP POLICY IF EXISTS "Allow all" ON lightning_events;
DROP POLICY IF EXISTS "Allow all" ON heat_events;

-- --- phase3b_rules.sql tables ---
DROP POLICY IF EXISTS "Allow all" ON event_rules;
DROP POLICY IF EXISTS "Allow all" ON rule_changes;

-- --- phase4_migration.sql tables ---
DROP POLICY IF EXISTS "Allow all" ON schedule_snapshots;
DROP POLICY IF EXISTS "Allow all" ON conflict_engine_runs;

-- --- phase5_command_center.sql tables ---
DROP POLICY IF EXISTS "Allow all" ON ops_alerts;
DROP POLICY IF EXISTS "Allow all" ON shift_handoffs;

-- --- schedule_rules_system.sql tables (non-standard names) ---
DROP POLICY IF EXISTS "schedule_rules_all" ON schedule_rules;
DROP POLICY IF EXISTS "weekly_overrides_all" ON weekly_overrides;
DROP POLICY IF EXISTS "schedule_audit_log_all" ON schedule_audit_log;

-- --- player_eligibility.sql tables ---
DROP POLICY IF EXISTS "Allow all" ON division_hierarchy;
DROP POLICY IF EXISTS "Allow all" ON eligibility_violations;
DROP POLICY IF EXISTS "Allow all" ON multi_game_approvals;

-- --- registration_config.sql tables ---
DROP POLICY IF EXISTS "Allow all" ON registration_divisions;
DROP POLICY IF EXISTS "Allow all" ON registration_questions;
DROP POLICY IF EXISTS "Allow all" ON registration_answers;

-- --- registration_invites.sql (non-standard name) ---
DROP POLICY IF EXISTS "Allow all on registration_invites" ON registration_invites;

-- --- season_game_days.sql (non-standard name) ---
DROP POLICY IF EXISTS "Allow all on season_game_days" ON season_game_days;

-- --- division_color_field_divisions.sql (non-standard name) ---
DROP POLICY IF EXISTS "Allow all on field_divisions" ON field_divisions;

-- --- multi_event.sql tables ---
DROP POLICY IF EXISTS "Allow all" ON event_admins;

-- --- program_registration.sql tables ---
DROP POLICY IF EXISTS "Allow all" ON programs;
DROP POLICY IF EXISTS "Allow all" ON program_leaders;
DROP POLICY IF EXISTS "Allow all" ON program_teams;
DROP POLICY IF EXISTS "Allow all" ON team_registrations;

-- --- auth_migration.sql tables ---
DROP POLICY IF EXISTS "Allow all" ON player_qr_tokens;
DROP POLICY IF EXISTS "Allow all" ON qr_checkin_log;
DROP POLICY IF EXISTS "Allow all" ON portal_checkins;

-- --- division_timing.sql (non-standard name) ---
DROP POLICY IF EXISTS "Allow all on division_timing" ON division_timing;

-- ==========================================================
-- Ensure RLS is enabled on all tables that need it
-- (belt-and-suspenders: already enabled in migrations,
--  but some tables added columns later without re-checking)
-- ==========================================================

ALTER TABLE events                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_dates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE fields                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE players                ENABLE ROW LEVEL SECURITY;
ALTER TABLE games                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE referees               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_assignments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE vol_assignments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_checkins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_incidents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_alerts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_log                ENABLE ROW LEVEL SECURITY;
ALTER TABLE complexes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_blocks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons                ENABLE ROW LEVEL SECURITY;
ALTER TABLE referee_availability   ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_conflicts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_readings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE lightning_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE heat_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_changes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_snapshots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_engine_runs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_alerts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_handoffs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_rules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_overrides       ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_audit_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE division_hierarchy     ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligibility_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE multi_game_approvals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_answers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_invites   ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_game_days       ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_divisions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_admins           ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_leaders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_teams          ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_registrations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_qr_tokens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_checkin_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_checkins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE division_timing        ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- LAYER 2: Authenticated SELECT policies
-- ==========================================================

-- ── GROUP A: Public tables — event-scoped for authenticated users ──────────

-- events: the event_id IS the `id` column
CREATE POLICY "auth_select_events" ON events
  FOR SELECT TO authenticated
  USING (id IN (SELECT user_event_ids()));

-- event_dates: direct event_id
CREATE POLICY "auth_select_event_dates" ON event_dates
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- fields: direct event_id
CREATE POLICY "auth_select_fields" ON fields
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- teams: direct event_id
CREATE POLICY "auth_select_teams" ON teams
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- games: direct event_id
CREATE POLICY "auth_select_games" ON games
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- registration_divisions: direct event_id (public — admin-configurable list)
CREATE POLICY "auth_select_registration_divisions" ON registration_divisions
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- ── GROUP B: Authenticated event-scoped tables — direct event_id ───────────

CREATE POLICY "auth_select_referees" ON referees
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_volunteers" ON volunteers
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_incidents" ON incidents
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_medical_incidents" ON medical_incidents
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_weather_alerts" ON weather_alerts
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- ops_log: sensitive (D-02) — authenticated only, no anon
CREATE POLICY "auth_select_ops_log" ON ops_log
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_complexes" ON complexes
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_operational_conflicts" ON operational_conflicts
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_weather_readings" ON weather_readings
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_lightning_events" ON lightning_events
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_heat_events" ON heat_events
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_event_rules" ON event_rules
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_rule_changes" ON rule_changes
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_schedule_snapshots" ON schedule_snapshots
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_conflict_engine_runs" ON conflict_engine_runs
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- ops_alerts: sensitive (D-02) — authenticated only, no anon
CREATE POLICY "auth_select_ops_alerts" ON ops_alerts
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_shift_handoffs" ON shift_handoffs
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_schedule_rules" ON schedule_rules
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_weekly_overrides" ON weekly_overrides
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_schedule_audit_log" ON schedule_audit_log
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_division_hierarchy" ON division_hierarchy
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_eligibility_violations" ON eligibility_violations
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_multi_game_approvals" ON multi_game_approvals
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_registration_questions" ON registration_questions
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_season_game_days" ON season_game_days
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_field_divisions" ON field_divisions
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_event_admins" ON event_admins
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_player_qr_tokens" ON player_qr_tokens
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_qr_checkin_log" ON qr_checkin_log
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_portal_checkins" ON portal_checkins
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_registration_invites" ON registration_invites
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_program_teams" ON program_teams
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_team_registrations" ON team_registrations
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_division_timing" ON division_timing
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- players: event_id added by player_eligibility.sql — use direct scoping
CREATE POLICY "auth_select_players" ON players
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- field_blocks: event_id added by phase4_migration.sql — use direct scoping
CREATE POLICY "auth_select_field_blocks" ON field_blocks
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- ── GROUP C: Indirectly event-scoped tables — EXISTS join pattern ──────────

-- ref_assignments: event scope via games.game_id
CREATE POLICY "auth_select_ref_assignments" ON ref_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = ref_assignments.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  );

-- vol_assignments: event scope via games.game_id
CREATE POLICY "auth_select_vol_assignments" ON vol_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = vol_assignments.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  );

-- player_checkins: event scope via games.game_id
CREATE POLICY "auth_select_player_checkins" ON player_checkins
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = player_checkins.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  );

-- referee_availability: event scope via referees.referee_id
CREATE POLICY "auth_select_referee_availability" ON referee_availability
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM referees r
      WHERE r.id = referee_availability.referee_id
        AND r.event_id IN (SELECT user_event_ids())
    )
  );

-- registration_answers: event scope via team_registrations.team_reg_id
CREATE POLICY "auth_select_registration_answers" ON registration_answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_registrations tr
      WHERE tr.id = registration_answers.team_reg_id
        AND tr.event_id IN (SELECT user_event_ids())
    )
  );

-- ── GROUP E: Event-agnostic tables — no event_id ─────────────────────────

-- programs: org-level, no event_id — all authenticated users can see all programs
CREATE POLICY "auth_select_programs" ON programs
  FOR SELECT TO authenticated
  USING (true);

-- program_leaders: user→program links — all authenticated users can see
CREATE POLICY "auth_select_program_leaders" ON program_leaders
  FOR SELECT TO authenticated
  USING (true);

-- seasons: top-level entity, no event_id — all authenticated users can see
CREATE POLICY "auth_select_seasons" ON seasons
  FOR SELECT TO authenticated
  USING (true);

-- ==========================================================
-- LAYER 3: Authenticated write policies (INSERT, UPDATE, DELETE)
-- ==========================================================

-- ── GROUP A: Public tables (events uses id; others use event_id) ───────────

-- events: id IS the event_id
CREATE POLICY "auth_insert_events" ON events
  FOR INSERT TO authenticated
  WITH CHECK (id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_events" ON events
  FOR UPDATE TO authenticated
  USING (id IN (SELECT user_event_ids()))
  WITH CHECK (id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_events" ON events
  FOR DELETE TO authenticated
  USING (id IN (SELECT user_event_ids()));

-- event_dates
CREATE POLICY "auth_insert_event_dates" ON event_dates
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_event_dates" ON event_dates
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_event_dates" ON event_dates
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- fields
CREATE POLICY "auth_insert_fields" ON fields
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_fields" ON fields
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_fields" ON fields
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- teams
CREATE POLICY "auth_insert_teams" ON teams
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_teams" ON teams
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_teams" ON teams
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- games
CREATE POLICY "auth_insert_games" ON games
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_games" ON games
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_games" ON games
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- registration_divisions
CREATE POLICY "auth_insert_registration_divisions" ON registration_divisions
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_registration_divisions" ON registration_divisions
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_registration_divisions" ON registration_divisions
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- ── GROUP B: Authenticated event-scoped tables ─────────────────────────────

-- referees
CREATE POLICY "auth_insert_referees" ON referees
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_referees" ON referees
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_referees" ON referees
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- volunteers
CREATE POLICY "auth_insert_volunteers" ON volunteers
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_volunteers" ON volunteers
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_volunteers" ON volunteers
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- incidents
CREATE POLICY "auth_insert_incidents" ON incidents
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_incidents" ON incidents
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_incidents" ON incidents
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- medical_incidents
CREATE POLICY "auth_insert_medical_incidents" ON medical_incidents
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_medical_incidents" ON medical_incidents
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_medical_incidents" ON medical_incidents
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- weather_alerts
CREATE POLICY "auth_insert_weather_alerts" ON weather_alerts
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_weather_alerts" ON weather_alerts
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_weather_alerts" ON weather_alerts
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- ops_log: sensitive (D-02) — authenticated only
CREATE POLICY "auth_insert_ops_log" ON ops_log
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_ops_log" ON ops_log
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_ops_log" ON ops_log
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- complexes
CREATE POLICY "auth_insert_complexes" ON complexes
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_complexes" ON complexes
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_complexes" ON complexes
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- operational_conflicts
CREATE POLICY "auth_insert_operational_conflicts" ON operational_conflicts
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_operational_conflicts" ON operational_conflicts
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_operational_conflicts" ON operational_conflicts
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- weather_readings
CREATE POLICY "auth_insert_weather_readings" ON weather_readings
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_weather_readings" ON weather_readings
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_weather_readings" ON weather_readings
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- lightning_events
CREATE POLICY "auth_insert_lightning_events" ON lightning_events
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_lightning_events" ON lightning_events
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_lightning_events" ON lightning_events
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- heat_events
CREATE POLICY "auth_insert_heat_events" ON heat_events
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_heat_events" ON heat_events
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_heat_events" ON heat_events
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- event_rules
CREATE POLICY "auth_insert_event_rules" ON event_rules
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_event_rules" ON event_rules
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_event_rules" ON event_rules
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- rule_changes
CREATE POLICY "auth_insert_rule_changes" ON rule_changes
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_rule_changes" ON rule_changes
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_rule_changes" ON rule_changes
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- schedule_snapshots
CREATE POLICY "auth_insert_schedule_snapshots" ON schedule_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_schedule_snapshots" ON schedule_snapshots
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_schedule_snapshots" ON schedule_snapshots
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- conflict_engine_runs
CREATE POLICY "auth_insert_conflict_engine_runs" ON conflict_engine_runs
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_conflict_engine_runs" ON conflict_engine_runs
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_conflict_engine_runs" ON conflict_engine_runs
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- ops_alerts: sensitive (D-02) — authenticated only
CREATE POLICY "auth_insert_ops_alerts" ON ops_alerts
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_ops_alerts" ON ops_alerts
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_ops_alerts" ON ops_alerts
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- shift_handoffs
CREATE POLICY "auth_insert_shift_handoffs" ON shift_handoffs
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_shift_handoffs" ON shift_handoffs
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_shift_handoffs" ON shift_handoffs
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- schedule_rules
CREATE POLICY "auth_insert_schedule_rules" ON schedule_rules
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_schedule_rules" ON schedule_rules
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_schedule_rules" ON schedule_rules
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- weekly_overrides
CREATE POLICY "auth_insert_weekly_overrides" ON weekly_overrides
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_weekly_overrides" ON weekly_overrides
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_weekly_overrides" ON weekly_overrides
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- schedule_audit_log
CREATE POLICY "auth_insert_schedule_audit_log" ON schedule_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_schedule_audit_log" ON schedule_audit_log
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_schedule_audit_log" ON schedule_audit_log
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- division_hierarchy
CREATE POLICY "auth_insert_division_hierarchy" ON division_hierarchy
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_division_hierarchy" ON division_hierarchy
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_division_hierarchy" ON division_hierarchy
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- eligibility_violations
CREATE POLICY "auth_insert_eligibility_violations" ON eligibility_violations
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_eligibility_violations" ON eligibility_violations
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_eligibility_violations" ON eligibility_violations
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- multi_game_approvals
CREATE POLICY "auth_insert_multi_game_approvals" ON multi_game_approvals
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_multi_game_approvals" ON multi_game_approvals
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_multi_game_approvals" ON multi_game_approvals
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- registration_questions
CREATE POLICY "auth_insert_registration_questions" ON registration_questions
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_registration_questions" ON registration_questions
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_registration_questions" ON registration_questions
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- season_game_days
CREATE POLICY "auth_insert_season_game_days" ON season_game_days
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_season_game_days" ON season_game_days
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_season_game_days" ON season_game_days
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- field_divisions
CREATE POLICY "auth_insert_field_divisions" ON field_divisions
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_field_divisions" ON field_divisions
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_field_divisions" ON field_divisions
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- event_admins
CREATE POLICY "auth_insert_event_admins" ON event_admins
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_event_admins" ON event_admins
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_event_admins" ON event_admins
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- player_qr_tokens
CREATE POLICY "auth_insert_player_qr_tokens" ON player_qr_tokens
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_player_qr_tokens" ON player_qr_tokens
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_player_qr_tokens" ON player_qr_tokens
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- qr_checkin_log
CREATE POLICY "auth_insert_qr_checkin_log" ON qr_checkin_log
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_qr_checkin_log" ON qr_checkin_log
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_qr_checkin_log" ON qr_checkin_log
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- portal_checkins
CREATE POLICY "auth_insert_portal_checkins" ON portal_checkins
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_portal_checkins" ON portal_checkins
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_portal_checkins" ON portal_checkins
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- registration_invites
CREATE POLICY "auth_insert_registration_invites" ON registration_invites
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_registration_invites" ON registration_invites
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_registration_invites" ON registration_invites
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- program_teams: direct event_id (in Group B)
CREATE POLICY "auth_insert_program_teams" ON program_teams
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_program_teams" ON program_teams
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_program_teams" ON program_teams
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- team_registrations: direct event_id (in Group B)
CREATE POLICY "auth_insert_team_registrations" ON team_registrations
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_team_registrations" ON team_registrations
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_team_registrations" ON team_registrations
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- division_timing
CREATE POLICY "auth_insert_division_timing" ON division_timing
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_division_timing" ON division_timing
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_division_timing" ON division_timing
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- players: event_id added by player_eligibility.sql
CREATE POLICY "auth_insert_players" ON players
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_players" ON players
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_players" ON players
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- field_blocks: event_id added by phase4_migration.sql
CREATE POLICY "auth_insert_field_blocks" ON field_blocks
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_field_blocks" ON field_blocks
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_field_blocks" ON field_blocks
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- ── GROUP C: Indirectly event-scoped tables — EXISTS join pattern ──────────

-- ref_assignments
CREATE POLICY "auth_insert_ref_assignments" ON ref_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = ref_assignments.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_update_ref_assignments" ON ref_assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = ref_assignments.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = ref_assignments.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_delete_ref_assignments" ON ref_assignments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = ref_assignments.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  );

-- vol_assignments
CREATE POLICY "auth_insert_vol_assignments" ON vol_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = vol_assignments.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_update_vol_assignments" ON vol_assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = vol_assignments.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = vol_assignments.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_delete_vol_assignments" ON vol_assignments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = vol_assignments.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  );

-- player_checkins
CREATE POLICY "auth_insert_player_checkins" ON player_checkins
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = player_checkins.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_update_player_checkins" ON player_checkins
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = player_checkins.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = player_checkins.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_delete_player_checkins" ON player_checkins
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM games g
      WHERE g.id = player_checkins.game_id
        AND g.event_id IN (SELECT user_event_ids())
    )
  );

-- referee_availability
CREATE POLICY "auth_insert_referee_availability" ON referee_availability
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM referees r
      WHERE r.id = referee_availability.referee_id
        AND r.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_update_referee_availability" ON referee_availability
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM referees r
      WHERE r.id = referee_availability.referee_id
        AND r.event_id IN (SELECT user_event_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM referees r
      WHERE r.id = referee_availability.referee_id
        AND r.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_delete_referee_availability" ON referee_availability
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM referees r
      WHERE r.id = referee_availability.referee_id
        AND r.event_id IN (SELECT user_event_ids())
    )
  );

-- registration_answers
CREATE POLICY "auth_insert_registration_answers" ON registration_answers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_registrations tr
      WHERE tr.id = registration_answers.team_reg_id
        AND tr.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_update_registration_answers" ON registration_answers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_registrations tr
      WHERE tr.id = registration_answers.team_reg_id
        AND tr.event_id IN (SELECT user_event_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_registrations tr
      WHERE tr.id = registration_answers.team_reg_id
        AND tr.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_delete_registration_answers" ON registration_answers
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_registrations tr
      WHERE tr.id = registration_answers.team_reg_id
        AND tr.event_id IN (SELECT user_event_ids())
    )
  );

-- ── GROUP E: Event-agnostic tables ─────────────────────────────────────────

-- programs: INSERT open to authenticated; UPDATE/DELETE scoped to program leaders
CREATE POLICY "auth_insert_programs" ON programs
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_update_programs" ON programs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM program_leaders pl
      WHERE pl.program_id = programs.id
        AND pl.user_id = auth.uid()
    )
  )
  WITH CHECK (true);

CREATE POLICY "auth_delete_programs" ON programs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM program_leaders pl
      WHERE pl.program_id = programs.id
        AND pl.user_id = auth.uid()
    )
  );

-- program_leaders: INSERT/UPDATE/DELETE open to authenticated (app-layer enforced)
CREATE POLICY "auth_insert_program_leaders" ON program_leaders
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_update_program_leaders" ON program_leaders
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "auth_delete_program_leaders" ON program_leaders
  FOR DELETE TO authenticated
  USING (true);

-- seasons: INSERT/UPDATE/DELETE open to authenticated (admin enforcement via app layer)
CREATE POLICY "auth_insert_seasons" ON seasons
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_update_seasons" ON seasons
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "auth_delete_seasons" ON seasons
  FOR DELETE TO authenticated
  USING (true);

-- ==========================================================
-- LAYER 4: Anon SELECT policies (public tables only — D-08/D-09)
-- Open, no event filter, no sensitive columns exposed
-- ==========================================================

-- events: anon can see all events (public metadata)
CREATE POLICY "anon_select_events" ON events
  FOR SELECT TO anon
  USING (true);

-- event_dates: public schedule dates
CREATE POLICY "anon_select_event_dates" ON event_dates
  FOR SELECT TO anon
  USING (true);

-- fields: public field names/locations
CREATE POLICY "anon_select_fields" ON fields
  FOR SELECT TO anon
  USING (true);

-- teams: public team names, division, association, color
CREATE POLICY "anon_select_teams" ON teams
  FOR SELECT TO anon
  USING (true);

-- games: public schedule and scores
CREATE POLICY "anon_select_games" ON games
  FOR SELECT TO anon
  USING (true);

-- registration_divisions: public division list for registration
CREATE POLICY "anon_select_registration_divisions" ON registration_divisions
  FOR SELECT TO anon
  USING (true);

-- ==========================================================
-- ROLLBACK BLOCK (commented out — run to revert to permissive)
-- Per D-07: safe fallback since Phase 3 auth guards protect API routes
-- ==========================================================

-- To rollback, uncomment and run the following block:

/*
-- Drop all auth policies
DROP POLICY IF EXISTS "auth_select_events" ON events;
DROP POLICY IF EXISTS "auth_insert_events" ON events;
DROP POLICY IF EXISTS "auth_update_events" ON events;
DROP POLICY IF EXISTS "auth_delete_events" ON events;
DROP POLICY IF EXISTS "anon_select_events" ON events;
CREATE POLICY "Allow all" ON events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_event_dates" ON event_dates;
DROP POLICY IF EXISTS "auth_insert_event_dates" ON event_dates;
DROP POLICY IF EXISTS "auth_update_event_dates" ON event_dates;
DROP POLICY IF EXISTS "auth_delete_event_dates" ON event_dates;
DROP POLICY IF EXISTS "anon_select_event_dates" ON event_dates;
CREATE POLICY "Allow all" ON event_dates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_fields" ON fields;
DROP POLICY IF EXISTS "auth_insert_fields" ON fields;
DROP POLICY IF EXISTS "auth_update_fields" ON fields;
DROP POLICY IF EXISTS "auth_delete_fields" ON fields;
DROP POLICY IF EXISTS "anon_select_fields" ON fields;
CREATE POLICY "Allow all" ON fields FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_teams" ON teams;
DROP POLICY IF EXISTS "auth_insert_teams" ON teams;
DROP POLICY IF EXISTS "auth_update_teams" ON teams;
DROP POLICY IF EXISTS "auth_delete_teams" ON teams;
DROP POLICY IF EXISTS "anon_select_teams" ON teams;
CREATE POLICY "Allow all" ON teams FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_players" ON players;
DROP POLICY IF EXISTS "auth_insert_players" ON players;
DROP POLICY IF EXISTS "auth_update_players" ON players;
DROP POLICY IF EXISTS "auth_delete_players" ON players;
CREATE POLICY "Allow all" ON players FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_games" ON games;
DROP POLICY IF EXISTS "auth_insert_games" ON games;
DROP POLICY IF EXISTS "auth_update_games" ON games;
DROP POLICY IF EXISTS "auth_delete_games" ON games;
DROP POLICY IF EXISTS "anon_select_games" ON games;
CREATE POLICY "Allow all" ON games FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_referees" ON referees;
DROP POLICY IF EXISTS "auth_insert_referees" ON referees;
DROP POLICY IF EXISTS "auth_update_referees" ON referees;
DROP POLICY IF EXISTS "auth_delete_referees" ON referees;
CREATE POLICY "Allow all" ON referees FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_ref_assignments" ON ref_assignments;
DROP POLICY IF EXISTS "auth_insert_ref_assignments" ON ref_assignments;
DROP POLICY IF EXISTS "auth_update_ref_assignments" ON ref_assignments;
DROP POLICY IF EXISTS "auth_delete_ref_assignments" ON ref_assignments;
CREATE POLICY "Allow all" ON ref_assignments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_volunteers" ON volunteers;
DROP POLICY IF EXISTS "auth_insert_volunteers" ON volunteers;
DROP POLICY IF EXISTS "auth_update_volunteers" ON volunteers;
DROP POLICY IF EXISTS "auth_delete_volunteers" ON volunteers;
CREATE POLICY "Allow all" ON volunteers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_vol_assignments" ON vol_assignments;
DROP POLICY IF EXISTS "auth_insert_vol_assignments" ON vol_assignments;
DROP POLICY IF EXISTS "auth_update_vol_assignments" ON vol_assignments;
DROP POLICY IF EXISTS "auth_delete_vol_assignments" ON vol_assignments;
CREATE POLICY "Allow all" ON vol_assignments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_player_checkins" ON player_checkins;
DROP POLICY IF EXISTS "auth_insert_player_checkins" ON player_checkins;
DROP POLICY IF EXISTS "auth_update_player_checkins" ON player_checkins;
DROP POLICY IF EXISTS "auth_delete_player_checkins" ON player_checkins;
CREATE POLICY "Allow all" ON player_checkins FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_incidents" ON incidents;
DROP POLICY IF EXISTS "auth_insert_incidents" ON incidents;
DROP POLICY IF EXISTS "auth_update_incidents" ON incidents;
DROP POLICY IF EXISTS "auth_delete_incidents" ON incidents;
CREATE POLICY "Allow all" ON incidents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_medical_incidents" ON medical_incidents;
DROP POLICY IF EXISTS "auth_insert_medical_incidents" ON medical_incidents;
DROP POLICY IF EXISTS "auth_update_medical_incidents" ON medical_incidents;
DROP POLICY IF EXISTS "auth_delete_medical_incidents" ON medical_incidents;
CREATE POLICY "Allow all" ON medical_incidents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_weather_alerts" ON weather_alerts;
DROP POLICY IF EXISTS "auth_insert_weather_alerts" ON weather_alerts;
DROP POLICY IF EXISTS "auth_update_weather_alerts" ON weather_alerts;
DROP POLICY IF EXISTS "auth_delete_weather_alerts" ON weather_alerts;
CREATE POLICY "Allow all" ON weather_alerts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_ops_log" ON ops_log;
DROP POLICY IF EXISTS "auth_insert_ops_log" ON ops_log;
DROP POLICY IF EXISTS "auth_update_ops_log" ON ops_log;
DROP POLICY IF EXISTS "auth_delete_ops_log" ON ops_log;
CREATE POLICY "Allow all" ON ops_log FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_complexes" ON complexes;
DROP POLICY IF EXISTS "auth_insert_complexes" ON complexes;
DROP POLICY IF EXISTS "auth_update_complexes" ON complexes;
DROP POLICY IF EXISTS "auth_delete_complexes" ON complexes;
CREATE POLICY "Allow all" ON complexes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_field_blocks" ON field_blocks;
DROP POLICY IF EXISTS "auth_insert_field_blocks" ON field_blocks;
DROP POLICY IF EXISTS "auth_update_field_blocks" ON field_blocks;
DROP POLICY IF EXISTS "auth_delete_field_blocks" ON field_blocks;
CREATE POLICY "Allow all" ON field_blocks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_seasons" ON seasons;
DROP POLICY IF EXISTS "auth_insert_seasons" ON seasons;
DROP POLICY IF EXISTS "auth_update_seasons" ON seasons;
DROP POLICY IF EXISTS "auth_delete_seasons" ON seasons;
CREATE POLICY "Allow all" ON seasons FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_referee_availability" ON referee_availability;
DROP POLICY IF EXISTS "auth_insert_referee_availability" ON referee_availability;
DROP POLICY IF EXISTS "auth_update_referee_availability" ON referee_availability;
DROP POLICY IF EXISTS "auth_delete_referee_availability" ON referee_availability;
CREATE POLICY "Allow all" ON referee_availability FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_operational_conflicts" ON operational_conflicts;
DROP POLICY IF EXISTS "auth_insert_operational_conflicts" ON operational_conflicts;
DROP POLICY IF EXISTS "auth_update_operational_conflicts" ON operational_conflicts;
DROP POLICY IF EXISTS "auth_delete_operational_conflicts" ON operational_conflicts;
CREATE POLICY "Allow all" ON operational_conflicts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_weather_readings" ON weather_readings;
DROP POLICY IF EXISTS "auth_insert_weather_readings" ON weather_readings;
DROP POLICY IF EXISTS "auth_update_weather_readings" ON weather_readings;
DROP POLICY IF EXISTS "auth_delete_weather_readings" ON weather_readings;
CREATE POLICY "Allow all" ON weather_readings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_lightning_events" ON lightning_events;
DROP POLICY IF EXISTS "auth_insert_lightning_events" ON lightning_events;
DROP POLICY IF EXISTS "auth_update_lightning_events" ON lightning_events;
DROP POLICY IF EXISTS "auth_delete_lightning_events" ON lightning_events;
CREATE POLICY "Allow all" ON lightning_events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_heat_events" ON heat_events;
DROP POLICY IF EXISTS "auth_insert_heat_events" ON heat_events;
DROP POLICY IF EXISTS "auth_update_heat_events" ON heat_events;
DROP POLICY IF EXISTS "auth_delete_heat_events" ON heat_events;
CREATE POLICY "Allow all" ON heat_events FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_event_rules" ON event_rules;
DROP POLICY IF EXISTS "auth_insert_event_rules" ON event_rules;
DROP POLICY IF EXISTS "auth_update_event_rules" ON event_rules;
DROP POLICY IF EXISTS "auth_delete_event_rules" ON event_rules;
CREATE POLICY "Allow all" ON event_rules FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_rule_changes" ON rule_changes;
DROP POLICY IF EXISTS "auth_insert_rule_changes" ON rule_changes;
DROP POLICY IF EXISTS "auth_update_rule_changes" ON rule_changes;
DROP POLICY IF EXISTS "auth_delete_rule_changes" ON rule_changes;
CREATE POLICY "Allow all" ON rule_changes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_schedule_snapshots" ON schedule_snapshots;
DROP POLICY IF EXISTS "auth_insert_schedule_snapshots" ON schedule_snapshots;
DROP POLICY IF EXISTS "auth_update_schedule_snapshots" ON schedule_snapshots;
DROP POLICY IF EXISTS "auth_delete_schedule_snapshots" ON schedule_snapshots;
CREATE POLICY "Allow all" ON schedule_snapshots FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_conflict_engine_runs" ON conflict_engine_runs;
DROP POLICY IF EXISTS "auth_insert_conflict_engine_runs" ON conflict_engine_runs;
DROP POLICY IF EXISTS "auth_update_conflict_engine_runs" ON conflict_engine_runs;
DROP POLICY IF EXISTS "auth_delete_conflict_engine_runs" ON conflict_engine_runs;
CREATE POLICY "Allow all" ON conflict_engine_runs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_ops_alerts" ON ops_alerts;
DROP POLICY IF EXISTS "auth_insert_ops_alerts" ON ops_alerts;
DROP POLICY IF EXISTS "auth_update_ops_alerts" ON ops_alerts;
DROP POLICY IF EXISTS "auth_delete_ops_alerts" ON ops_alerts;
CREATE POLICY "Allow all" ON ops_alerts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_shift_handoffs" ON shift_handoffs;
DROP POLICY IF EXISTS "auth_insert_shift_handoffs" ON shift_handoffs;
DROP POLICY IF EXISTS "auth_update_shift_handoffs" ON shift_handoffs;
DROP POLICY IF EXISTS "auth_delete_shift_handoffs" ON shift_handoffs;
CREATE POLICY "Allow all" ON shift_handoffs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_schedule_rules" ON schedule_rules;
DROP POLICY IF EXISTS "auth_insert_schedule_rules" ON schedule_rules;
DROP POLICY IF EXISTS "auth_update_schedule_rules" ON schedule_rules;
DROP POLICY IF EXISTS "auth_delete_schedule_rules" ON schedule_rules;
CREATE POLICY "schedule_rules_all" ON schedule_rules FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_weekly_overrides" ON weekly_overrides;
DROP POLICY IF EXISTS "auth_insert_weekly_overrides" ON weekly_overrides;
DROP POLICY IF EXISTS "auth_update_weekly_overrides" ON weekly_overrides;
DROP POLICY IF EXISTS "auth_delete_weekly_overrides" ON weekly_overrides;
CREATE POLICY "weekly_overrides_all" ON weekly_overrides FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_schedule_audit_log" ON schedule_audit_log;
DROP POLICY IF EXISTS "auth_insert_schedule_audit_log" ON schedule_audit_log;
DROP POLICY IF EXISTS "auth_update_schedule_audit_log" ON schedule_audit_log;
DROP POLICY IF EXISTS "auth_delete_schedule_audit_log" ON schedule_audit_log;
CREATE POLICY "schedule_audit_log_all" ON schedule_audit_log FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_division_hierarchy" ON division_hierarchy;
DROP POLICY IF EXISTS "auth_insert_division_hierarchy" ON division_hierarchy;
DROP POLICY IF EXISTS "auth_update_division_hierarchy" ON division_hierarchy;
DROP POLICY IF EXISTS "auth_delete_division_hierarchy" ON division_hierarchy;
CREATE POLICY "Allow all" ON division_hierarchy FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_eligibility_violations" ON eligibility_violations;
DROP POLICY IF EXISTS "auth_insert_eligibility_violations" ON eligibility_violations;
DROP POLICY IF EXISTS "auth_update_eligibility_violations" ON eligibility_violations;
DROP POLICY IF EXISTS "auth_delete_eligibility_violations" ON eligibility_violations;
CREATE POLICY "Allow all" ON eligibility_violations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_multi_game_approvals" ON multi_game_approvals;
DROP POLICY IF EXISTS "auth_insert_multi_game_approvals" ON multi_game_approvals;
DROP POLICY IF EXISTS "auth_update_multi_game_approvals" ON multi_game_approvals;
DROP POLICY IF EXISTS "auth_delete_multi_game_approvals" ON multi_game_approvals;
CREATE POLICY "Allow all" ON multi_game_approvals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_registration_divisions" ON registration_divisions;
DROP POLICY IF EXISTS "auth_insert_registration_divisions" ON registration_divisions;
DROP POLICY IF EXISTS "auth_update_registration_divisions" ON registration_divisions;
DROP POLICY IF EXISTS "auth_delete_registration_divisions" ON registration_divisions;
DROP POLICY IF EXISTS "anon_select_registration_divisions" ON registration_divisions;
CREATE POLICY "Allow all" ON registration_divisions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_registration_questions" ON registration_questions;
DROP POLICY IF EXISTS "auth_insert_registration_questions" ON registration_questions;
DROP POLICY IF EXISTS "auth_update_registration_questions" ON registration_questions;
DROP POLICY IF EXISTS "auth_delete_registration_questions" ON registration_questions;
CREATE POLICY "Allow all" ON registration_questions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_registration_answers" ON registration_answers;
DROP POLICY IF EXISTS "auth_insert_registration_answers" ON registration_answers;
DROP POLICY IF EXISTS "auth_update_registration_answers" ON registration_answers;
DROP POLICY IF EXISTS "auth_delete_registration_answers" ON registration_answers;
CREATE POLICY "Allow all" ON registration_answers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_registration_invites" ON registration_invites;
DROP POLICY IF EXISTS "auth_insert_registration_invites" ON registration_invites;
DROP POLICY IF EXISTS "auth_update_registration_invites" ON registration_invites;
DROP POLICY IF EXISTS "auth_delete_registration_invites" ON registration_invites;
CREATE POLICY "Allow all on registration_invites" ON registration_invites FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_season_game_days" ON season_game_days;
DROP POLICY IF EXISTS "auth_insert_season_game_days" ON season_game_days;
DROP POLICY IF EXISTS "auth_update_season_game_days" ON season_game_days;
DROP POLICY IF EXISTS "auth_delete_season_game_days" ON season_game_days;
CREATE POLICY "Allow all on season_game_days" ON season_game_days FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_field_divisions" ON field_divisions;
DROP POLICY IF EXISTS "auth_insert_field_divisions" ON field_divisions;
DROP POLICY IF EXISTS "auth_update_field_divisions" ON field_divisions;
DROP POLICY IF EXISTS "auth_delete_field_divisions" ON field_divisions;
CREATE POLICY "Allow all on field_divisions" ON field_divisions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_event_admins" ON event_admins;
DROP POLICY IF EXISTS "auth_insert_event_admins" ON event_admins;
DROP POLICY IF EXISTS "auth_update_event_admins" ON event_admins;
DROP POLICY IF EXISTS "auth_delete_event_admins" ON event_admins;
CREATE POLICY "Allow all" ON event_admins FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_programs" ON programs;
DROP POLICY IF EXISTS "auth_insert_programs" ON programs;
DROP POLICY IF EXISTS "auth_update_programs" ON programs;
DROP POLICY IF EXISTS "auth_delete_programs" ON programs;
CREATE POLICY "Allow all" ON programs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_program_leaders" ON program_leaders;
DROP POLICY IF EXISTS "auth_insert_program_leaders" ON program_leaders;
DROP POLICY IF EXISTS "auth_update_program_leaders" ON program_leaders;
DROP POLICY IF EXISTS "auth_delete_program_leaders" ON program_leaders;
CREATE POLICY "Allow all" ON program_leaders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_program_teams" ON program_teams;
DROP POLICY IF EXISTS "auth_insert_program_teams" ON program_teams;
DROP POLICY IF EXISTS "auth_update_program_teams" ON program_teams;
DROP POLICY IF EXISTS "auth_delete_program_teams" ON program_teams;
CREATE POLICY "Allow all" ON program_teams FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_team_registrations" ON team_registrations;
DROP POLICY IF EXISTS "auth_insert_team_registrations" ON team_registrations;
DROP POLICY IF EXISTS "auth_update_team_registrations" ON team_registrations;
DROP POLICY IF EXISTS "auth_delete_team_registrations" ON team_registrations;
CREATE POLICY "Allow all" ON team_registrations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_player_qr_tokens" ON player_qr_tokens;
DROP POLICY IF EXISTS "auth_insert_player_qr_tokens" ON player_qr_tokens;
DROP POLICY IF EXISTS "auth_update_player_qr_tokens" ON player_qr_tokens;
DROP POLICY IF EXISTS "auth_delete_player_qr_tokens" ON player_qr_tokens;
CREATE POLICY "Allow all" ON player_qr_tokens FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_qr_checkin_log" ON qr_checkin_log;
DROP POLICY IF EXISTS "auth_insert_qr_checkin_log" ON qr_checkin_log;
DROP POLICY IF EXISTS "auth_update_qr_checkin_log" ON qr_checkin_log;
DROP POLICY IF EXISTS "auth_delete_qr_checkin_log" ON qr_checkin_log;
CREATE POLICY "Allow all" ON qr_checkin_log FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_portal_checkins" ON portal_checkins;
DROP POLICY IF EXISTS "auth_insert_portal_checkins" ON portal_checkins;
DROP POLICY IF EXISTS "auth_update_portal_checkins" ON portal_checkins;
DROP POLICY IF EXISTS "auth_delete_portal_checkins" ON portal_checkins;
CREATE POLICY "Allow all" ON portal_checkins FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_division_timing" ON division_timing;
DROP POLICY IF EXISTS "auth_insert_division_timing" ON division_timing;
DROP POLICY IF EXISTS "auth_update_division_timing" ON division_timing;
DROP POLICY IF EXISTS "auth_delete_division_timing" ON division_timing;
CREATE POLICY "Allow all on division_timing" ON division_timing FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_seasons" ON seasons;
DROP POLICY IF EXISTS "auth_insert_seasons" ON seasons;
DROP POLICY IF EXISTS "auth_update_seasons" ON seasons;
DROP POLICY IF EXISTS "auth_delete_seasons" ON seasons;
CREATE POLICY "Allow all" ON seasons FOR ALL USING (true) WITH CHECK (true);
*/
