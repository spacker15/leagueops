-- Add email to volunteers (refs already have it)
ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS email TEXT;

-- Registration invite links sent to refs/volunteers
CREATE TABLE IF NOT EXISTS registration_invites (
  id          BIGSERIAL PRIMARY KEY,
  event_id    BIGINT REFERENCES events(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('referee', 'volunteer')),
  token       TEXT UNIQUE NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
