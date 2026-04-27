-- ============================================================
-- Update 14U (7/8 Grade) schedule for 2026-05-02 jamboree
-- ============================================================
-- Targeted: only deletes/inserts 14U games for the date.
-- 12U / 10U / 8U games are untouched.
--
-- Usage:
--   1) Set :event_id below to the correct event_id
--   2) Review PREVIEW output
--   3) Run the file; transaction rolls back on any error
--
-- Assumptions (verify against live DB):
--   - 14U division is stored as the literal string '7/8 Grade'
--     (matches the badges in the schedule UI). If it's stored
--     differently (e.g. '14U' or 'U14'), edit the four literals
--     below tagged DIV_STR.
--   - Fields are identified by their `number` column ('5', '6').
--   - 14U team names have no division prefix (e.g. 'Riptide White',
--     not '14U Riptide White'). Team names are not unique across
--     divisions, so the join filters on division as well.
--
-- Known leftover conflicts (NOT resolved by this script):
--   The new 14U schedule places games on Field 5 at 10:00, 12:00,
--   and 14:00 — those slots already hold 12U games. Resolve by
--   moving the 12U games separately before/after running this.
-- ============================================================

\set event_id 1  -- <<< EDIT: set to the correct event_id

BEGIN;

-- ── Preview: current 14U state on 2026-05-02 ────────────────
SELECT g.id, g.scheduled_time, g.division, f.number AS field,
       ht.name AS home, at.name AS away
FROM games g
JOIN fields f      ON f.id  = g.field_id
JOIN teams ht      ON ht.id = g.home_team_id
JOIN teams at      ON at.id = g.away_team_id
JOIN event_dates ed ON ed.id = g.event_date_id
WHERE g.event_id = :event_id
  AND ed.date    = '2026-05-02'
  AND g.division = '7/8 Grade'           -- DIV_STR
ORDER BY g.scheduled_time, f.number;

-- ── Delete existing 14U games on May 2 ──────────────────────
DELETE FROM games
WHERE event_id = :event_id
  AND division = '7/8 Grade'             -- DIV_STR
  AND event_date_id = (
    SELECT id FROM event_dates
    WHERE event_id = :event_id AND date = '2026-05-02'
  );

-- ── Insert new 14U games ────────────────────────────────────
WITH src(scheduled_time, field_num, home_name, away_name) AS (
  VALUES
    -- 9:00 AM
    ('09:00', '5', 'Creeks Blue',        'Bold City Eagles'),
    ('09:00', '6', 'Riptide White',      'Creeks Green'),
    -- 10:00 AM
    ('10:00', '5', 'Bold City Eagles',   'Riptide Blue'),
    -- 11:00 AM
    ('11:00', '6', 'Creeks Green',       'Jax Lax'),
    -- 12:00 PM
    ('12:00', '5', 'Hammerhead',         'Riptide White'),
    ('12:00', '6', 'Riptide Black',      'Creeks Blue'),
    -- 1:00 PM
    ('13:00', '6', 'Fleming Island',     'Riptide Blue'),
    -- 2:00 PM
    ('14:00', '5', 'Jax Lax',            'Riptide Black'),
    -- 3:00 PM
    ('15:00', '6', 'Fleming Island',     'Hammerhead')
),
resolved AS (
  SELECT
    s.scheduled_time,
    ed.id AS event_date_id,
    f.id  AS field_id,
    ht.id AS home_team_id,
    at.id AS away_team_id
  FROM src s
  JOIN event_dates ed
    ON ed.event_id = :event_id AND ed.date = '2026-05-02'
  JOIN fields f
    ON f.event_id = :event_id AND f.number = s.field_num
  JOIN teams ht
    ON ht.event_id = :event_id
   AND ht.name     = s.home_name
   AND ht.division = '7/8 Grade'         -- DIV_STR
  JOIN teams at
    ON at.event_id = :event_id
   AND at.name     = s.away_name
   AND at.division = '7/8 Grade'         -- DIV_STR
)
INSERT INTO games (
  event_id, event_date_id, field_id,
  home_team_id, away_team_id, division, scheduled_time, status
)
SELECT :event_id, event_date_id, field_id,
       home_team_id, away_team_id, '7/8 Grade', scheduled_time, 'Scheduled'
FROM resolved;

-- ── Safety check: did every source row resolve? ─────────────
DO $$
DECLARE
  expected INT := 9;
  actual   INT;
BEGIN
  SELECT COUNT(*) INTO actual
  FROM games g
  JOIN event_dates ed ON ed.id = g.event_date_id
  WHERE g.event_id = :event_id
    AND ed.date    = '2026-05-02'
    AND g.division = '7/8 Grade';
  IF actual <> expected THEN
    RAISE EXCEPTION
      'Expected % 14U games inserted, got % — aborting. Check team/field name + division string.',
      expected, actual;
  END IF;
END $$;

-- ── Post-insert preview (14U only) ──────────────────────────
SELECT g.scheduled_time, f.number AS field, g.division,
       ht.name AS home, at.name AS away
FROM games g
JOIN fields f      ON f.id  = g.field_id
JOIN teams ht      ON ht.id = g.home_team_id
JOIN teams at      ON at.id = g.away_team_id
JOIN event_dates ed ON ed.id = g.event_date_id
WHERE g.event_id = :event_id
  AND ed.date    = '2026-05-02'
  AND g.division = '7/8 Grade'
ORDER BY g.scheduled_time, f.number;

COMMIT;  -- change to ROLLBACK; if anything looks wrong above
