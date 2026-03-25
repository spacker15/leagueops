-- ==========================================================
-- RLS Migration (Corrected): Phase 4 — SEC-01
-- Fixes: removes non-existent tables (weather_readings,
--        lightning_events, heat_events), adds missing tables
--        from later phases (coaches, notifications, etc.)
-- Apply to Supabase branch first, smoke test, then promote
-- ==========================================================
-- SKIPPED tables (already have proper policies or are special):
--   user_roles, sports, bracket_rounds, bracket_matchups,
--   field_availability
-- ==========================================================

-- LAYER 0: user_event_ids() helper function already exists
-- (from previous migration attempt — no need to recreate)

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

-- --- coaches tables (added in later phases) ---
DROP POLICY IF EXISTS "Allow all" ON coaches;
DROP POLICY IF EXISTS "Allow all" ON coach_conflicts;
DROP POLICY IF EXISTS "Allow all" ON coach_invites;
DROP POLICY IF EXISTS "Allow all" ON coach_teams;

-- --- notification tables (added in later phases) ---
DROP POLICY IF EXISTS "Allow all" ON notification_log;
DROP POLICY IF EXISTS "Allow all" ON notification_preferences;
DROP POLICY IF EXISTS "Allow all" ON notification_queue;
DROP POLICY IF EXISTS "Allow all" ON push_subscriptions;

-- --- schedule change requests (added in later phases) ---
DROP POLICY IF EXISTS "Allow all" ON schedule_change_requests;
DROP POLICY IF EXISTS "Allow all" ON schedule_change_request_games;
DROP POLICY IF EXISTS "Allow all" ON schedule_rule_overrides;

-- Also drop any previously-created auth policies (idempotency for re-runs)
-- events
DROP POLICY IF EXISTS "auth_select_events" ON events;
DROP POLICY IF EXISTS "auth_insert_events" ON events;
DROP POLICY IF EXISTS "auth_update_events" ON events;
DROP POLICY IF EXISTS "auth_delete_events" ON events;
DROP POLICY IF EXISTS "anon_select_events" ON events;
-- event_dates
DROP POLICY IF EXISTS "auth_select_event_dates" ON event_dates;
DROP POLICY IF EXISTS "auth_insert_event_dates" ON event_dates;
DROP POLICY IF EXISTS "auth_update_event_dates" ON event_dates;
DROP POLICY IF EXISTS "auth_delete_event_dates" ON event_dates;
DROP POLICY IF EXISTS "anon_select_event_dates" ON event_dates;
-- fields
DROP POLICY IF EXISTS "auth_select_fields" ON fields;
DROP POLICY IF EXISTS "auth_insert_fields" ON fields;
DROP POLICY IF EXISTS "auth_update_fields" ON fields;
DROP POLICY IF EXISTS "auth_delete_fields" ON fields;
DROP POLICY IF EXISTS "anon_select_fields" ON fields;
-- teams
DROP POLICY IF EXISTS "auth_select_teams" ON teams;
DROP POLICY IF EXISTS "auth_insert_teams" ON teams;
DROP POLICY IF EXISTS "auth_update_teams" ON teams;
DROP POLICY IF EXISTS "auth_delete_teams" ON teams;
DROP POLICY IF EXISTS "anon_select_teams" ON teams;
-- players
DROP POLICY IF EXISTS "auth_select_players" ON players;
DROP POLICY IF EXISTS "auth_insert_players" ON players;
DROP POLICY IF EXISTS "auth_update_players" ON players;
DROP POLICY IF EXISTS "auth_delete_players" ON players;
-- games
DROP POLICY IF EXISTS "auth_select_games" ON games;
DROP POLICY IF EXISTS "auth_insert_games" ON games;
DROP POLICY IF EXISTS "auth_update_games" ON games;
DROP POLICY IF EXISTS "auth_delete_games" ON games;
DROP POLICY IF EXISTS "anon_select_games" ON games;
-- referees
DROP POLICY IF EXISTS "auth_select_referees" ON referees;
DROP POLICY IF EXISTS "auth_insert_referees" ON referees;
DROP POLICY IF EXISTS "auth_update_referees" ON referees;
DROP POLICY IF EXISTS "auth_delete_referees" ON referees;
-- ref_assignments
DROP POLICY IF EXISTS "auth_select_ref_assignments" ON ref_assignments;
DROP POLICY IF EXISTS "auth_insert_ref_assignments" ON ref_assignments;
DROP POLICY IF EXISTS "auth_update_ref_assignments" ON ref_assignments;
DROP POLICY IF EXISTS "auth_delete_ref_assignments" ON ref_assignments;
-- volunteers
DROP POLICY IF EXISTS "auth_select_volunteers" ON volunteers;
DROP POLICY IF EXISTS "auth_insert_volunteers" ON volunteers;
DROP POLICY IF EXISTS "auth_update_volunteers" ON volunteers;
DROP POLICY IF EXISTS "auth_delete_volunteers" ON volunteers;
-- vol_assignments
DROP POLICY IF EXISTS "auth_select_vol_assignments" ON vol_assignments;
DROP POLICY IF EXISTS "auth_insert_vol_assignments" ON vol_assignments;
DROP POLICY IF EXISTS "auth_update_vol_assignments" ON vol_assignments;
DROP POLICY IF EXISTS "auth_delete_vol_assignments" ON vol_assignments;
-- player_checkins
DROP POLICY IF EXISTS "auth_select_player_checkins" ON player_checkins;
DROP POLICY IF EXISTS "auth_insert_player_checkins" ON player_checkins;
DROP POLICY IF EXISTS "auth_update_player_checkins" ON player_checkins;
DROP POLICY IF EXISTS "auth_delete_player_checkins" ON player_checkins;
-- incidents
DROP POLICY IF EXISTS "auth_select_incidents" ON incidents;
DROP POLICY IF EXISTS "auth_insert_incidents" ON incidents;
DROP POLICY IF EXISTS "auth_update_incidents" ON incidents;
DROP POLICY IF EXISTS "auth_delete_incidents" ON incidents;
-- medical_incidents
DROP POLICY IF EXISTS "auth_select_medical_incidents" ON medical_incidents;
DROP POLICY IF EXISTS "auth_insert_medical_incidents" ON medical_incidents;
DROP POLICY IF EXISTS "auth_update_medical_incidents" ON medical_incidents;
DROP POLICY IF EXISTS "auth_delete_medical_incidents" ON medical_incidents;
-- weather_alerts
DROP POLICY IF EXISTS "auth_select_weather_alerts" ON weather_alerts;
DROP POLICY IF EXISTS "auth_insert_weather_alerts" ON weather_alerts;
DROP POLICY IF EXISTS "auth_update_weather_alerts" ON weather_alerts;
DROP POLICY IF EXISTS "auth_delete_weather_alerts" ON weather_alerts;
-- ops_log
DROP POLICY IF EXISTS "auth_select_ops_log" ON ops_log;
DROP POLICY IF EXISTS "auth_insert_ops_log" ON ops_log;
DROP POLICY IF EXISTS "auth_update_ops_log" ON ops_log;
DROP POLICY IF EXISTS "auth_delete_ops_log" ON ops_log;
-- complexes
DROP POLICY IF EXISTS "auth_select_complexes" ON complexes;
DROP POLICY IF EXISTS "auth_insert_complexes" ON complexes;
DROP POLICY IF EXISTS "auth_update_complexes" ON complexes;
DROP POLICY IF EXISTS "auth_delete_complexes" ON complexes;
-- field_blocks
DROP POLICY IF EXISTS "auth_select_field_blocks" ON field_blocks;
DROP POLICY IF EXISTS "auth_insert_field_blocks" ON field_blocks;
DROP POLICY IF EXISTS "auth_update_field_blocks" ON field_blocks;
DROP POLICY IF EXISTS "auth_delete_field_blocks" ON field_blocks;
-- seasons
DROP POLICY IF EXISTS "auth_select_seasons" ON seasons;
DROP POLICY IF EXISTS "auth_insert_seasons" ON seasons;
DROP POLICY IF EXISTS "auth_update_seasons" ON seasons;
DROP POLICY IF EXISTS "auth_delete_seasons" ON seasons;
-- referee_availability
DROP POLICY IF EXISTS "auth_select_referee_availability" ON referee_availability;
DROP POLICY IF EXISTS "auth_insert_referee_availability" ON referee_availability;
DROP POLICY IF EXISTS "auth_update_referee_availability" ON referee_availability;
DROP POLICY IF EXISTS "auth_delete_referee_availability" ON referee_availability;
-- operational_conflicts
DROP POLICY IF EXISTS "auth_select_operational_conflicts" ON operational_conflicts;
DROP POLICY IF EXISTS "auth_insert_operational_conflicts" ON operational_conflicts;
DROP POLICY IF EXISTS "auth_update_operational_conflicts" ON operational_conflicts;
DROP POLICY IF EXISTS "auth_delete_operational_conflicts" ON operational_conflicts;
-- event_rules
DROP POLICY IF EXISTS "auth_select_event_rules" ON event_rules;
DROP POLICY IF EXISTS "auth_insert_event_rules" ON event_rules;
DROP POLICY IF EXISTS "auth_update_event_rules" ON event_rules;
DROP POLICY IF EXISTS "auth_delete_event_rules" ON event_rules;
-- rule_changes
DROP POLICY IF EXISTS "auth_select_rule_changes" ON rule_changes;
DROP POLICY IF EXISTS "auth_insert_rule_changes" ON rule_changes;
DROP POLICY IF EXISTS "auth_update_rule_changes" ON rule_changes;
DROP POLICY IF EXISTS "auth_delete_rule_changes" ON rule_changes;
-- schedule_snapshots
DROP POLICY IF EXISTS "auth_select_schedule_snapshots" ON schedule_snapshots;
DROP POLICY IF EXISTS "auth_insert_schedule_snapshots" ON schedule_snapshots;
DROP POLICY IF EXISTS "auth_update_schedule_snapshots" ON schedule_snapshots;
DROP POLICY IF EXISTS "auth_delete_schedule_snapshots" ON schedule_snapshots;
-- conflict_engine_runs
DROP POLICY IF EXISTS "auth_select_conflict_engine_runs" ON conflict_engine_runs;
DROP POLICY IF EXISTS "auth_insert_conflict_engine_runs" ON conflict_engine_runs;
DROP POLICY IF EXISTS "auth_update_conflict_engine_runs" ON conflict_engine_runs;
DROP POLICY IF EXISTS "auth_delete_conflict_engine_runs" ON conflict_engine_runs;
-- ops_alerts
DROP POLICY IF EXISTS "auth_select_ops_alerts" ON ops_alerts;
DROP POLICY IF EXISTS "auth_insert_ops_alerts" ON ops_alerts;
DROP POLICY IF EXISTS "auth_update_ops_alerts" ON ops_alerts;
DROP POLICY IF EXISTS "auth_delete_ops_alerts" ON ops_alerts;
-- shift_handoffs
DROP POLICY IF EXISTS "auth_select_shift_handoffs" ON shift_handoffs;
DROP POLICY IF EXISTS "auth_insert_shift_handoffs" ON shift_handoffs;
DROP POLICY IF EXISTS "auth_update_shift_handoffs" ON shift_handoffs;
DROP POLICY IF EXISTS "auth_delete_shift_handoffs" ON shift_handoffs;
-- schedule_rules
DROP POLICY IF EXISTS "auth_select_schedule_rules" ON schedule_rules;
DROP POLICY IF EXISTS "auth_insert_schedule_rules" ON schedule_rules;
DROP POLICY IF EXISTS "auth_update_schedule_rules" ON schedule_rules;
DROP POLICY IF EXISTS "auth_delete_schedule_rules" ON schedule_rules;
-- weekly_overrides
DROP POLICY IF EXISTS "auth_select_weekly_overrides" ON weekly_overrides;
DROP POLICY IF EXISTS "auth_insert_weekly_overrides" ON weekly_overrides;
DROP POLICY IF EXISTS "auth_update_weekly_overrides" ON weekly_overrides;
DROP POLICY IF EXISTS "auth_delete_weekly_overrides" ON weekly_overrides;
-- schedule_audit_log
DROP POLICY IF EXISTS "auth_select_schedule_audit_log" ON schedule_audit_log;
DROP POLICY IF EXISTS "auth_insert_schedule_audit_log" ON schedule_audit_log;
DROP POLICY IF EXISTS "auth_update_schedule_audit_log" ON schedule_audit_log;
DROP POLICY IF EXISTS "auth_delete_schedule_audit_log" ON schedule_audit_log;
-- division_hierarchy
DROP POLICY IF EXISTS "auth_select_division_hierarchy" ON division_hierarchy;
DROP POLICY IF EXISTS "auth_insert_division_hierarchy" ON division_hierarchy;
DROP POLICY IF EXISTS "auth_update_division_hierarchy" ON division_hierarchy;
DROP POLICY IF EXISTS "auth_delete_division_hierarchy" ON division_hierarchy;
-- eligibility_violations
DROP POLICY IF EXISTS "auth_select_eligibility_violations" ON eligibility_violations;
DROP POLICY IF EXISTS "auth_insert_eligibility_violations" ON eligibility_violations;
DROP POLICY IF EXISTS "auth_update_eligibility_violations" ON eligibility_violations;
DROP POLICY IF EXISTS "auth_delete_eligibility_violations" ON eligibility_violations;
-- multi_game_approvals
DROP POLICY IF EXISTS "auth_select_multi_game_approvals" ON multi_game_approvals;
DROP POLICY IF EXISTS "auth_insert_multi_game_approvals" ON multi_game_approvals;
DROP POLICY IF EXISTS "auth_update_multi_game_approvals" ON multi_game_approvals;
DROP POLICY IF EXISTS "auth_delete_multi_game_approvals" ON multi_game_approvals;
-- registration_divisions
DROP POLICY IF EXISTS "auth_select_registration_divisions" ON registration_divisions;
DROP POLICY IF EXISTS "auth_insert_registration_divisions" ON registration_divisions;
DROP POLICY IF EXISTS "auth_update_registration_divisions" ON registration_divisions;
DROP POLICY IF EXISTS "auth_delete_registration_divisions" ON registration_divisions;
DROP POLICY IF EXISTS "anon_select_registration_divisions" ON registration_divisions;
-- registration_questions
DROP POLICY IF EXISTS "auth_select_registration_questions" ON registration_questions;
DROP POLICY IF EXISTS "auth_insert_registration_questions" ON registration_questions;
DROP POLICY IF EXISTS "auth_update_registration_questions" ON registration_questions;
DROP POLICY IF EXISTS "auth_delete_registration_questions" ON registration_questions;
-- registration_answers
DROP POLICY IF EXISTS "auth_select_registration_answers" ON registration_answers;
DROP POLICY IF EXISTS "auth_insert_registration_answers" ON registration_answers;
DROP POLICY IF EXISTS "auth_update_registration_answers" ON registration_answers;
DROP POLICY IF EXISTS "auth_delete_registration_answers" ON registration_answers;
-- registration_invites
DROP POLICY IF EXISTS "auth_select_registration_invites" ON registration_invites;
DROP POLICY IF EXISTS "auth_insert_registration_invites" ON registration_invites;
DROP POLICY IF EXISTS "auth_update_registration_invites" ON registration_invites;
DROP POLICY IF EXISTS "auth_delete_registration_invites" ON registration_invites;
-- season_game_days
DROP POLICY IF EXISTS "auth_select_season_game_days" ON season_game_days;
DROP POLICY IF EXISTS "auth_insert_season_game_days" ON season_game_days;
DROP POLICY IF EXISTS "auth_update_season_game_days" ON season_game_days;
DROP POLICY IF EXISTS "auth_delete_season_game_days" ON season_game_days;
-- field_divisions
DROP POLICY IF EXISTS "auth_select_field_divisions" ON field_divisions;
DROP POLICY IF EXISTS "auth_insert_field_divisions" ON field_divisions;
DROP POLICY IF EXISTS "auth_update_field_divisions" ON field_divisions;
DROP POLICY IF EXISTS "auth_delete_field_divisions" ON field_divisions;
-- event_admins
DROP POLICY IF EXISTS "auth_select_event_admins" ON event_admins;
DROP POLICY IF EXISTS "auth_insert_event_admins" ON event_admins;
DROP POLICY IF EXISTS "auth_update_event_admins" ON event_admins;
DROP POLICY IF EXISTS "auth_delete_event_admins" ON event_admins;
-- programs
DROP POLICY IF EXISTS "auth_select_programs" ON programs;
DROP POLICY IF EXISTS "auth_insert_programs" ON programs;
DROP POLICY IF EXISTS "auth_update_programs" ON programs;
DROP POLICY IF EXISTS "auth_delete_programs" ON programs;
-- program_leaders
DROP POLICY IF EXISTS "auth_select_program_leaders" ON program_leaders;
DROP POLICY IF EXISTS "auth_insert_program_leaders" ON program_leaders;
DROP POLICY IF EXISTS "auth_update_program_leaders" ON program_leaders;
DROP POLICY IF EXISTS "auth_delete_program_leaders" ON program_leaders;
-- program_teams
DROP POLICY IF EXISTS "auth_select_program_teams" ON program_teams;
DROP POLICY IF EXISTS "auth_insert_program_teams" ON program_teams;
DROP POLICY IF EXISTS "auth_update_program_teams" ON program_teams;
DROP POLICY IF EXISTS "auth_delete_program_teams" ON program_teams;
-- team_registrations
DROP POLICY IF EXISTS "auth_select_team_registrations" ON team_registrations;
DROP POLICY IF EXISTS "auth_insert_team_registrations" ON team_registrations;
DROP POLICY IF EXISTS "auth_update_team_registrations" ON team_registrations;
DROP POLICY IF EXISTS "auth_delete_team_registrations" ON team_registrations;
-- player_qr_tokens
DROP POLICY IF EXISTS "auth_select_player_qr_tokens" ON player_qr_tokens;
DROP POLICY IF EXISTS "auth_insert_player_qr_tokens" ON player_qr_tokens;
DROP POLICY IF EXISTS "auth_update_player_qr_tokens" ON player_qr_tokens;
DROP POLICY IF EXISTS "auth_delete_player_qr_tokens" ON player_qr_tokens;
-- qr_checkin_log
DROP POLICY IF EXISTS "auth_select_qr_checkin_log" ON qr_checkin_log;
DROP POLICY IF EXISTS "auth_insert_qr_checkin_log" ON qr_checkin_log;
DROP POLICY IF EXISTS "auth_update_qr_checkin_log" ON qr_checkin_log;
DROP POLICY IF EXISTS "auth_delete_qr_checkin_log" ON qr_checkin_log;
-- portal_checkins
DROP POLICY IF EXISTS "auth_select_portal_checkins" ON portal_checkins;
DROP POLICY IF EXISTS "auth_insert_portal_checkins" ON portal_checkins;
DROP POLICY IF EXISTS "auth_update_portal_checkins" ON portal_checkins;
DROP POLICY IF EXISTS "auth_delete_portal_checkins" ON portal_checkins;
-- division_timing
DROP POLICY IF EXISTS "auth_select_division_timing" ON division_timing;
DROP POLICY IF EXISTS "auth_insert_division_timing" ON division_timing;
DROP POLICY IF EXISTS "auth_update_division_timing" ON division_timing;
DROP POLICY IF EXISTS "auth_delete_division_timing" ON division_timing;
-- coaches
DROP POLICY IF EXISTS "auth_select_coaches" ON coaches;
DROP POLICY IF EXISTS "auth_insert_coaches" ON coaches;
DROP POLICY IF EXISTS "auth_update_coaches" ON coaches;
DROP POLICY IF EXISTS "auth_delete_coaches" ON coaches;
-- coach_conflicts
DROP POLICY IF EXISTS "auth_select_coach_conflicts" ON coach_conflicts;
DROP POLICY IF EXISTS "auth_insert_coach_conflicts" ON coach_conflicts;
DROP POLICY IF EXISTS "auth_update_coach_conflicts" ON coach_conflicts;
DROP POLICY IF EXISTS "auth_delete_coach_conflicts" ON coach_conflicts;
-- coach_invites
DROP POLICY IF EXISTS "auth_select_coach_invites" ON coach_invites;
DROP POLICY IF EXISTS "auth_insert_coach_invites" ON coach_invites;
DROP POLICY IF EXISTS "auth_update_coach_invites" ON coach_invites;
DROP POLICY IF EXISTS "auth_delete_coach_invites" ON coach_invites;
-- coach_teams
DROP POLICY IF EXISTS "auth_select_coach_teams" ON coach_teams;
DROP POLICY IF EXISTS "auth_insert_coach_teams" ON coach_teams;
DROP POLICY IF EXISTS "auth_update_coach_teams" ON coach_teams;
DROP POLICY IF EXISTS "auth_delete_coach_teams" ON coach_teams;
-- notification_log
DROP POLICY IF EXISTS "auth_select_notification_log" ON notification_log;
DROP POLICY IF EXISTS "auth_insert_notification_log" ON notification_log;
DROP POLICY IF EXISTS "auth_update_notification_log" ON notification_log;
DROP POLICY IF EXISTS "auth_delete_notification_log" ON notification_log;
-- notification_preferences
DROP POLICY IF EXISTS "auth_select_notification_preferences" ON notification_preferences;
DROP POLICY IF EXISTS "auth_insert_notification_preferences" ON notification_preferences;
DROP POLICY IF EXISTS "auth_update_notification_preferences" ON notification_preferences;
DROP POLICY IF EXISTS "auth_delete_notification_preferences" ON notification_preferences;
-- notification_queue
DROP POLICY IF EXISTS "auth_select_notification_queue" ON notification_queue;
DROP POLICY IF EXISTS "auth_insert_notification_queue" ON notification_queue;
DROP POLICY IF EXISTS "auth_update_notification_queue" ON notification_queue;
DROP POLICY IF EXISTS "auth_delete_notification_queue" ON notification_queue;
-- push_subscriptions
DROP POLICY IF EXISTS "auth_select_push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "auth_insert_push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "auth_update_push_subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "auth_delete_push_subscriptions" ON push_subscriptions;
-- schedule_change_requests
DROP POLICY IF EXISTS "auth_select_schedule_change_requests" ON schedule_change_requests;
DROP POLICY IF EXISTS "auth_insert_schedule_change_requests" ON schedule_change_requests;
DROP POLICY IF EXISTS "auth_update_schedule_change_requests" ON schedule_change_requests;
DROP POLICY IF EXISTS "auth_delete_schedule_change_requests" ON schedule_change_requests;
-- schedule_change_request_games
DROP POLICY IF EXISTS "auth_select_schedule_change_request_games" ON schedule_change_request_games;
DROP POLICY IF EXISTS "auth_insert_schedule_change_request_games" ON schedule_change_request_games;
DROP POLICY IF EXISTS "auth_update_schedule_change_request_games" ON schedule_change_request_games;
DROP POLICY IF EXISTS "auth_delete_schedule_change_request_games" ON schedule_change_request_games;
-- schedule_rule_overrides
DROP POLICY IF EXISTS "auth_select_schedule_rule_overrides" ON schedule_rule_overrides;
DROP POLICY IF EXISTS "auth_insert_schedule_rule_overrides" ON schedule_rule_overrides;
DROP POLICY IF EXISTS "auth_update_schedule_rule_overrides" ON schedule_rule_overrides;
DROP POLICY IF EXISTS "auth_delete_schedule_rule_overrides" ON schedule_rule_overrides;

-- ==========================================================
-- Enable RLS on all tables
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
ALTER TABLE coaches                ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_conflicts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_invites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_teams            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue     ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_change_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_change_request_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_rule_overrides       ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- LAYER 2: Authenticated SELECT policies
-- ==========================================================

-- ── GROUP A: Public tables — event-scoped for authenticated users ──────────

-- events: the event_id IS the `id` column
-- Owner fallback: lets creator SELECT immediately after INSERT (before user_roles row exists)
CREATE POLICY "auth_select_events" ON events
  FOR SELECT TO authenticated
  USING (id IN (SELECT user_event_ids()) OR owner_id = auth.uid());

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

CREATE POLICY "auth_select_players" ON players
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

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

CREATE POLICY "auth_select_ops_log" ON ops_log
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_complexes" ON complexes
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_field_blocks" ON field_blocks
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_select_operational_conflicts" ON operational_conflicts
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

-- coaches: direct event_id
CREATE POLICY "auth_select_coaches" ON coaches
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- coach_conflicts: direct event_id
CREATE POLICY "auth_select_coach_conflicts" ON coach_conflicts
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- coach_invites: direct event_id
CREATE POLICY "auth_select_coach_invites" ON coach_invites
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- schedule_change_requests: direct event_id
CREATE POLICY "auth_select_schedule_change_requests" ON schedule_change_requests
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- schedule_rule_overrides: direct event_id
CREATE POLICY "auth_select_schedule_rule_overrides" ON schedule_rule_overrides
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- notification_queue: direct event_id
CREATE POLICY "auth_select_notification_queue" ON notification_queue
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

-- schedule_change_request_games: event scope via schedule_change_requests
CREATE POLICY "auth_select_schedule_change_request_games" ON schedule_change_request_games
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM schedule_change_requests scr
      WHERE scr.id = schedule_change_request_games.request_id
        AND scr.event_id IN (SELECT user_event_ids())
    )
  );

-- qr_checkin_log: event scope via player_qr_tokens
CREATE POLICY "auth_select_qr_checkin_log" ON qr_checkin_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM player_qr_tokens pqt
      WHERE pqt.id = qr_checkin_log.token_id
        AND pqt.event_id IN (SELECT user_event_ids())
    )
  );

-- portal_checkins: event scope via player_qr_tokens
CREATE POLICY "auth_select_portal_checkins" ON portal_checkins
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM player_qr_tokens pqt
      WHERE pqt.id = portal_checkins.token_id
        AND pqt.event_id IN (SELECT user_event_ids())
    )
  );

-- coach_teams: event scope via coaches
CREATE POLICY "auth_select_coach_teams" ON coach_teams
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.id = coach_teams.coach_id
        AND c.event_id IN (SELECT user_event_ids())
    )
  );

-- ── GROUP D: User-scoped tables — user_id = auth.uid() ───────────────────

-- push_subscriptions: user-scoped
CREATE POLICY "auth_select_push_subscriptions" ON push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- notification_preferences: user-scoped
CREATE POLICY "auth_select_notification_preferences" ON notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- notification_log: user-scoped
CREATE POLICY "auth_select_notification_log" ON notification_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── GROUP E: Event-agnostic tables — no event_id ─────────────────────────

-- programs: org-level, no event_id — all authenticated users can see all programs
CREATE POLICY "auth_select_programs" ON programs
  FOR SELECT TO authenticated
  USING (true);

-- program_leaders: user-program links — all authenticated users can see
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
-- Allow any authenticated user to create events (role assigned after insert)
CREATE POLICY "auth_insert_events" ON events
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_update_events" ON events
  FOR UPDATE TO authenticated
  USING (id IN (SELECT user_event_ids()) OR owner_id = auth.uid())
  WITH CHECK (id IN (SELECT user_event_ids()) OR owner_id = auth.uid());

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

-- ── GROUP B: Authenticated event-scoped tables — direct event_id ──────────

-- players
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

-- ops_log
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

-- field_blocks
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

-- ops_alerts
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

-- program_teams
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

-- team_registrations
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

-- coaches: direct event_id
CREATE POLICY "auth_insert_coaches" ON coaches
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_coaches" ON coaches
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_coaches" ON coaches
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- coach_conflicts: direct event_id
CREATE POLICY "auth_insert_coach_conflicts" ON coach_conflicts
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_coach_conflicts" ON coach_conflicts
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_coach_conflicts" ON coach_conflicts
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- coach_invites: direct event_id
CREATE POLICY "auth_insert_coach_invites" ON coach_invites
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_coach_invites" ON coach_invites
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_coach_invites" ON coach_invites
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- schedule_change_requests: direct event_id
CREATE POLICY "auth_insert_schedule_change_requests" ON schedule_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_schedule_change_requests" ON schedule_change_requests
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_schedule_change_requests" ON schedule_change_requests
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- schedule_rule_overrides: direct event_id
CREATE POLICY "auth_insert_schedule_rule_overrides" ON schedule_rule_overrides
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_schedule_rule_overrides" ON schedule_rule_overrides
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_schedule_rule_overrides" ON schedule_rule_overrides
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- notification_queue: direct event_id
CREATE POLICY "auth_insert_notification_queue" ON notification_queue
  FOR INSERT TO authenticated
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_update_notification_queue" ON notification_queue
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT user_event_ids()))
  WITH CHECK (event_id IN (SELECT user_event_ids()));

CREATE POLICY "auth_delete_notification_queue" ON notification_queue
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT user_event_ids()));

-- ── GROUP C: Indirectly event-scoped tables — EXISTS join pattern (writes) ─

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

-- schedule_change_request_games: via schedule_change_requests
CREATE POLICY "auth_insert_schedule_change_request_games" ON schedule_change_request_games
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM schedule_change_requests scr
      WHERE scr.id = schedule_change_request_games.request_id
        AND scr.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_update_schedule_change_request_games" ON schedule_change_request_games
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM schedule_change_requests scr
      WHERE scr.id = schedule_change_request_games.request_id
        AND scr.event_id IN (SELECT user_event_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM schedule_change_requests scr
      WHERE scr.id = schedule_change_request_games.request_id
        AND scr.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_delete_schedule_change_request_games" ON schedule_change_request_games
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM schedule_change_requests scr
      WHERE scr.id = schedule_change_request_games.request_id
        AND scr.event_id IN (SELECT user_event_ids())
    )
  );

-- qr_checkin_log: via player_qr_tokens
CREATE POLICY "auth_insert_qr_checkin_log" ON qr_checkin_log
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM player_qr_tokens pqt
      WHERE pqt.id = qr_checkin_log.token_id
        AND pqt.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_update_qr_checkin_log" ON qr_checkin_log
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM player_qr_tokens pqt
      WHERE pqt.id = qr_checkin_log.token_id
        AND pqt.event_id IN (SELECT user_event_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM player_qr_tokens pqt
      WHERE pqt.id = qr_checkin_log.token_id
        AND pqt.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_delete_qr_checkin_log" ON qr_checkin_log
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM player_qr_tokens pqt
      WHERE pqt.id = qr_checkin_log.token_id
        AND pqt.event_id IN (SELECT user_event_ids())
    )
  );

-- portal_checkins: via player_qr_tokens
CREATE POLICY "auth_insert_portal_checkins" ON portal_checkins
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM player_qr_tokens pqt
      WHERE pqt.id = portal_checkins.token_id
        AND pqt.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_update_portal_checkins" ON portal_checkins
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM player_qr_tokens pqt
      WHERE pqt.id = portal_checkins.token_id
        AND pqt.event_id IN (SELECT user_event_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM player_qr_tokens pqt
      WHERE pqt.id = portal_checkins.token_id
        AND pqt.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_delete_portal_checkins" ON portal_checkins
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM player_qr_tokens pqt
      WHERE pqt.id = portal_checkins.token_id
        AND pqt.event_id IN (SELECT user_event_ids())
    )
  );

-- coach_teams: via coaches
CREATE POLICY "auth_insert_coach_teams" ON coach_teams
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.id = coach_teams.coach_id
        AND c.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_update_coach_teams" ON coach_teams
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.id = coach_teams.coach_id
        AND c.event_id IN (SELECT user_event_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.id = coach_teams.coach_id
        AND c.event_id IN (SELECT user_event_ids())
    )
  );

CREATE POLICY "auth_delete_coach_teams" ON coach_teams
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coaches c
      WHERE c.id = coach_teams.coach_id
        AND c.event_id IN (SELECT user_event_ids())
    )
  );

-- ── GROUP D: User-scoped tables — user_id = auth.uid() (writes) ──────────

-- push_subscriptions: user-scoped
CREATE POLICY "auth_insert_push_subscriptions" ON push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "auth_update_push_subscriptions" ON push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "auth_delete_push_subscriptions" ON push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- notification_preferences: user-scoped
CREATE POLICY "auth_insert_notification_preferences" ON notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "auth_update_notification_preferences" ON notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "auth_delete_notification_preferences" ON notification_preferences
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- notification_log: user-scoped
CREATE POLICY "auth_insert_notification_log" ON notification_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "auth_update_notification_log" ON notification_log
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "auth_delete_notification_log" ON notification_log
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── GROUP E: Event-agnostic tables (writes) ──────────────────────────────

-- programs: INSERT open to authenticated; UPDATE scoped to program leaders; DELETE scoped to program leaders
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
-- LAYER 4: Anon SELECT policies (public tables only)
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
