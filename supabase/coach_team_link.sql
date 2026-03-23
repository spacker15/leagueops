-- Add team_id to user_roles so coaches can be linked to their team
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS team_id BIGINT REFERENCES teams(id) ON DELETE SET NULL;
