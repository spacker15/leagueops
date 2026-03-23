-- ==========================================================
-- RLS ROLLBACK: Revert Phase 4 migration (04-rls-database-security)
-- Use ONLY if RLS migration causes production issues
-- Safe because Phase 3 auth guards protect API routes at app layer
-- ==========================================================
-- This script:
-- Step 1: Drops ALL policies created by rls_migration.sql
-- Step 2: Drops the user_event_ids() helper function
-- Step 3: Recreates the original permissive policies (exact original names)
-- ==========================================================

-- ==========================================================
-- STEP 1: Drop all new policies created by rls_migration.sql
-- ==========================================================

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

-- weather_readings
DROP POLICY IF EXISTS "auth_select_weather_readings" ON weather_readings;
DROP POLICY IF EXISTS "auth_insert_weather_readings" ON weather_readings;
DROP POLICY IF EXISTS "auth_update_weather_readings" ON weather_readings;
DROP POLICY IF EXISTS "auth_delete_weather_readings" ON weather_readings;

-- lightning_events
DROP POLICY IF EXISTS "auth_select_lightning_events" ON lightning_events;
DROP POLICY IF EXISTS "auth_insert_lightning_events" ON lightning_events;
DROP POLICY IF EXISTS "auth_update_lightning_events" ON lightning_events;
DROP POLICY IF EXISTS "auth_delete_lightning_events" ON lightning_events;

-- heat_events
DROP POLICY IF EXISTS "auth_select_heat_events" ON heat_events;
DROP POLICY IF EXISTS "auth_insert_heat_events" ON heat_events;
DROP POLICY IF EXISTS "auth_update_heat_events" ON heat_events;
DROP POLICY IF EXISTS "auth_delete_heat_events" ON heat_events;

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

-- ==========================================================
-- STEP 2: Drop helper function
-- ==========================================================

DROP FUNCTION IF EXISTS user_event_ids();

-- ==========================================================
-- STEP 3: Restore original permissive policies
-- Uses EXACT original policy names from source SQL files
-- ==========================================================

-- schema.sql tables — all used "Allow all"
CREATE POLICY "Allow all" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON event_dates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON fields FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON referees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON ref_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON volunteers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON vol_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON player_checkins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON incidents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON medical_incidents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON weather_alerts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON ops_log FOR ALL USING (true) WITH CHECK (true);

-- phase1_migration.sql tables
CREATE POLICY "Allow all" ON complexes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON field_blocks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON seasons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON referee_availability FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON operational_conflicts FOR ALL USING (true) WITH CHECK (true);

-- phase3_migration.sql tables
CREATE POLICY "Allow all" ON weather_readings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON lightning_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON heat_events FOR ALL USING (true) WITH CHECK (true);

-- phase3b_rules.sql tables
CREATE POLICY "Allow all" ON event_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON rule_changes FOR ALL USING (true) WITH CHECK (true);

-- phase4_migration.sql tables
CREATE POLICY "Allow all" ON schedule_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON conflict_engine_runs FOR ALL USING (true) WITH CHECK (true);

-- phase5_command_center.sql tables
CREATE POLICY "Allow all" ON ops_alerts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON shift_handoffs FOR ALL USING (true) WITH CHECK (true);

-- schedule_rules_system.sql tables (non-standard policy names — must match originals)
CREATE POLICY "schedule_rules_all" ON schedule_rules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "weekly_overrides_all" ON weekly_overrides FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "schedule_audit_log_all" ON schedule_audit_log FOR ALL USING (true) WITH CHECK (true);

-- player_eligibility.sql tables
CREATE POLICY "Allow all" ON division_hierarchy FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON eligibility_violations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON multi_game_approvals FOR ALL USING (true) WITH CHECK (true);

-- registration_config.sql tables
CREATE POLICY "Allow all" ON registration_divisions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON registration_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON registration_answers FOR ALL USING (true) WITH CHECK (true);

-- registration_invites.sql (non-standard policy name)
CREATE POLICY "Allow all on registration_invites" ON registration_invites FOR ALL USING (true) WITH CHECK (true);

-- season_game_days.sql (non-standard policy name)
CREATE POLICY "Allow all on season_game_days" ON season_game_days FOR ALL USING (true) WITH CHECK (true);

-- division_color_field_divisions.sql (non-standard policy name)
CREATE POLICY "Allow all on field_divisions" ON field_divisions FOR ALL USING (true) WITH CHECK (true);

-- multi_event.sql tables
CREATE POLICY "Allow all" ON event_admins FOR ALL USING (true) WITH CHECK (true);

-- program_registration.sql tables
CREATE POLICY "Allow all" ON programs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON program_leaders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON program_teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON team_registrations FOR ALL USING (true) WITH CHECK (true);

-- auth_migration.sql tables
CREATE POLICY "Allow all" ON player_qr_tokens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON qr_checkin_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON portal_checkins FOR ALL USING (true) WITH CHECK (true);

-- division_timing.sql (non-standard policy name)
CREATE POLICY "Allow all on division_timing" ON division_timing FOR ALL USING (true) WITH CHECK (true);
