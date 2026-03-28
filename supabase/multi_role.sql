-- Migration: Allow multiple roles per user per event
-- Issue: #8 - Users should be able to have multiple roles simultaneously
-- (e.g., a person can be both a Referee and a Coach)
--
-- Changes the unique constraint from (user_id, event_id) to (user_id, event_id, role)
-- so a user can hold different roles for the same event.

ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_event_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_event_role_idx ON user_roles(user_id, event_id, role);
