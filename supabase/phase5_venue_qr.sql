-- Phase 5: Add venue columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_address  TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_lat      FLOAT8;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_lng      FLOAT8;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_place_id TEXT;
