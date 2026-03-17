-- Add 'coach' to user_roles role constraint (7th AppRole)
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('admin', 'league_admin', 'referee', 'volunteer', 'player', 'program_leader', 'coach'));
