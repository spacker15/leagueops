-- Migration: add public_hide_scores to events table
-- Controlled by the "Hide Scores on Public Site" toggle in Event Settings.
-- When true, the public results site hides all game scores from the schedule,
-- results, and live views.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS public_hide_scores BOOLEAN NOT NULL DEFAULT FALSE;
