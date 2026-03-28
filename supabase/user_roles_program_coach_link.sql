-- Add program_id and coach_id columns to user_roles
-- for linking program_leader and coach roles to their records

ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS program_id BIGINT REFERENCES programs(id) ON DELETE SET NULL;

ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS coach_id   BIGINT REFERENCES coaches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_roles_program ON user_roles(program_id) WHERE program_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_coach   ON user_roles(coach_id)   WHERE coach_id IS NOT NULL;
