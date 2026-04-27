-- ============================================================
-- Update 12U (5/6 Grade) + 14U (7/8 Grade) schedules for 2026-05-02
-- ============================================================
-- Targeted: only deletes/inserts 5/6 Grade and 7/8 Grade games.
-- 10U (3/4 Grade) and 8U (1/2 Grade) games are untouched.
--
-- Usage:
--   1) Set :event_id below to the correct event_id
--   2) Review PREVIEW output
--   3) Run the file; transaction rolls back on any error
--
-- Assumptions (verify against live DB):
--   - Divisions are stored as the literal strings '5/6 Grade'
--     and '7/8 Grade'. If they differ, edit the literals tagged
--     DIV_STR below.
--   - Fields are identified by their `number` column ('1','5','6').
--   - Team names are not unique across divisions — joins filter
--     on division as well.
--
-- Field/time check: this schedule has NO field/time double-bookings.
-- ============================================================

\set event_id 1  -- <<< EDIT: set to the correct event_id

BEGIN;

-- ── Preview: current 12U + 14U state on 2026-05-02 ──────────
SELECT g.id, g.scheduled_time, g.division, f.number AS field,
       ht.name AS home, at.name AS away
FROM games g
JOIN fields f      ON f.id  = g.field_id
JOIN teams ht      ON ht.id = g.home_team_id
JOIN teams at      ON at.id = g.away_team_id
JOIN event_dates ed ON ed.id = g.event_date_id
WHERE g.event_id = :event_id
  AND ed.date    = '2026-05-02'
  AND g.division IN ('5/6 Grade', '7/8 Grade')   -- DIV_STR
ORDER BY g.scheduled_time, f.number;

-- ── Delete existing 12U + 14U games on May 2 ────────────────
DELETE FROM games
WHERE event_id = :event_id
  AND division IN ('5/6 Grade', '7/8 Grade')     -- DIV_STR
  AND event_date_id = (
    SELECT id FROM event_dates
    WHERE event_id = :event_id AND date = '2026-05-02'
  );

-- ── Insert new games ────────────────────────────────────────
WITH src(scheduled_time, field_num, home_name, away_name, division) AS (
  VALUES
    -- ── 12U (5/6 Grade) ─────────────────────────────────────
    ('09:00', '1', 'Riptide Blue',       'Bold City Eagles', '5/6 Grade'),
    ('10:00', '1', 'Riptide Gray',       'Jax Lax',          '5/6 Grade'),
    ('10:00', '5', 'Riptide Navy',       'Bold City Eagles', '5/6 Grade'),
    ('11:00', '1', 'Riptide White',      'Fleming Island',   '5/6 Grade'),
    ('11:00', '5', 'Riptide Blue',       'Hammerhead',       '5/6 Grade'),
    ('12:00', '1', 'Riptide Navy',       'Creeks Blue',      '5/6 Grade'),
    ('12:00', '5', 'Riptide Gray',       'Creeks Green',     '5/6 Grade'),
    ('13:00', '1', 'Hammerhead',         'Jax Lax',          '5/6 Grade'),
    ('14:00', '1', 'Riptide Black',      'Creeks Blue',      '5/6 Grade'),
    ('14:00', '5', 'Riptide White',      'Creeks Green',     '5/6 Grade'),
    ('15:00', '1', 'Riptide Black',      'Fleming Island',   '5/6 Grade'),
    -- ── 14U (7/8 Grade) ─────────────────────────────────────
    ('09:00', '5', 'Riptide White',      'Creeks Blue',      '7/8 Grade'),
    ('09:00', '6', 'Riptide Black',      'Creeks Green',     '7/8 Grade'),
    ('10:00', '6', 'Jax Lax',            'Riptide Black',    '7/8 Grade'),
    ('11:00', '6', 'Creeks Blue',        'Bold City Eagles', '7/8 Grade'),
    ('12:00', '6', 'Creeks Green',       'Jax Lax',          '7/8 Grade'),
    ('13:00', '5', 'Hammerhead',         'Riptide White',    '7/8 Grade'),
    ('13:00', '6', 'Fleming Island',     'Riptide Blue',     '7/8 Grade'),
    ('14:00', '6', 'Bold City Eagles',   'Riptide Blue',     '7/8 Grade'),
    ('15:00', '5', 'Fleming Island',     'Hammerhead',       '7/8 Grade')
),
resolved AS (
  SELECT
    s.scheduled_time,
    s.division,
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
   AND ht.division = s.division
  JOIN teams at
    ON at.event_id = :event_id
   AND at.name     = s.away_name
   AND at.division = s.division
)
INSERT INTO games (
  event_id, event_date_id, field_id,
  home_team_id, away_team_id, division, scheduled_time, status
)
SELECT :event_id, event_date_id, field_id,
       home_team_id, away_team_id, division, scheduled_time, 'Scheduled'
FROM resolved;

-- ── Safety check: did every source row resolve? ─────────────
-- 11 × 12U + 9 × 14U = 20 expected
DO $$
DECLARE
  expected INT := 20;
  actual   INT;
BEGIN
  SELECT COUNT(*) INTO actual
  FROM games g
  JOIN event_dates ed ON ed.id = g.event_date_id
  WHERE g.event_id = :event_id
    AND ed.date    = '2026-05-02'
    AND g.division IN ('5/6 Grade', '7/8 Grade');
  IF actual <> expected THEN
    RAISE EXCEPTION
      'Expected % games inserted, got % — aborting. Check team/field name + division string.',
      expected, actual;
  END IF;
END $$;

-- ── Post-insert preview ─────────────────────────────────────
SELECT g.scheduled_time, f.number AS field, g.division,
       ht.name AS home, at.name AS away
FROM games g
JOIN fields f      ON f.id  = g.field_id
JOIN teams ht      ON ht.id = g.home_team_id
JOIN teams at      ON at.id = g.away_team_id
JOIN event_dates ed ON ed.id = g.event_date_id
WHERE g.event_id = :event_id
  AND ed.date    = '2026-05-02'
  AND g.division IN ('5/6 Grade', '7/8 Grade')
ORDER BY g.scheduled_time, f.number;

COMMIT;  -- change to ROLLBACK; if anything looks wrong above
