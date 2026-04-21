-- ============================================================
-- Replace games for the 2026-05-02 jamboree
-- ============================================================
-- Usage:
--   1) Set :event_id in the psql \set line below, OR replace the
--      placeholder in the three spots marked  << EVENT_ID >>
--   2) Review the PREVIEW section output before committing
--   3) Run the whole file; transaction rolls back on any error
--
-- Assumptions (verify before running):
--   - Team name/division convention in DB matches the tokens in
--     the VALUES list (e.g., name='Riptide Black', division='12U').
--     If division is stored as 'U12'/'U14', the match still works —
--     it normalizes both sides by stripping 'U' and upper-casing.
--   - Fields are identified by their `number` column ('1','5','6').
--     If your fields use name='Field 1' instead, swap the join to
--     `f.name = src.field_name`.
--   - 3 matchups without a division prefix are assumed 14U based on
--     neighboring rows — flagged with `-- ASSUMED 14U` below.
-- ============================================================

\set event_id 1  -- <<< EDIT: set to the correct event_id

BEGIN;

-- ── Preview: current state ──────────────────────────────────
SELECT id, date, label
FROM event_dates
WHERE event_id = :event_id AND date = '2026-05-02';

SELECT g.id, g.scheduled_time, g.division, f.number AS field,
       ht.name AS home, at.name AS away
FROM games g
JOIN fields f ON f.id = g.field_id
JOIN teams ht ON ht.id = g.home_team_id
JOIN teams at ON at.id = g.away_team_id
JOIN event_dates ed ON ed.id = g.event_date_id
WHERE g.event_id = :event_id AND ed.date = '2026-05-02'
ORDER BY g.scheduled_time, f.number;

-- ── Delete existing May 2 games ─────────────────────────────
DELETE FROM games
WHERE event_id = :event_id
  AND event_date_id = (
    SELECT id FROM event_dates
    WHERE event_id = :event_id AND date = '2026-05-02'
  );

-- ── Insert new May 2 games ──────────────────────────────────
WITH src(scheduled_time, field_num, home_name, away_name, division) AS (
  VALUES
    -- 9:00 AM
    ('09:00', '1', 'Riptide White',      'Bold City Eagles', '14U'),
    ('09:00', '5', 'Creeks Green',       'Jax Lax',          '14U'),
    ('09:00', '6', 'Riptide Blue',       'Hammerhead',       '14U'),
    -- 10:00 AM
    ('10:00', '1', 'Riptide White',      'Creeks Blue',      '14U'),
    ('10:00', '5', 'Riptide Black',      'Fleming Island',   '14U'),
    ('10:00', '6', 'Bold City Eagles',   'Jax Lax',          '14U'),  -- ASSUMED 14U
    -- 11:00 AM
    ('11:00', '1', 'Riptide Gray',       'Hammerhead',       '12U'),
    ('11:00', '5', 'Fleming Island',     'Jax Lax',          '14U'),  -- ASSUMED 14U
    ('11:00', '6', 'Creeks Green',       'Hammerhead',       '14U'),  -- ASSUMED 14U
    -- 12:00 PM
    ('12:00', '1', 'Riptide Navy',       'Bold City Eagles', '12U'),
    ('12:00', '5', 'Riptide White',      'Creeks Blue',      '12U'),
    ('12:00', '6', 'Riptide Blue',       'Fleming Island',   '14U'),
    -- 1:00 PM
    ('13:00', '1', 'Riptide Black',      'Creeks Green',     '12U'),
    ('13:00', '5', 'Riptide Black',      'Creeks Blue',      '14U'),
    ('13:00', '6', 'Riptide Gray',       'Jax Lax',          '12U'),
    -- 2:00 PM
    ('14:00', '1', 'Riptide Blue',       'Hammerhead',       '12U'),
    ('14:00', '5', 'Riptide White',      'Fleming Island',   '12U'),
    ('14:00', '6', 'Riptide Black',      'Creeks Blue',      '12U'),
    -- 3:00 PM
    ('15:00', '1', 'Riptide Blue',       'Bold City Eagles', '12U'),
    ('15:00', '5', 'Riptide Navy',       'Creeks Green',     '12U')
    -- Field 6 at 3:00 PM — no game (—)
),
norm AS (
  SELECT
    scheduled_time, field_num, home_name, away_name, division,
    UPPER(REPLACE(division, 'U', '')) AS div_key
  FROM src
),
resolved AS (
  SELECT
    n.scheduled_time,
    n.division,
    ed.id  AS event_date_id,
    f.id   AS field_id,
    ht.id  AS home_team_id,
    at.id  AS away_team_id,
    n.home_name, n.away_name, n.field_num
  FROM norm n
  JOIN event_dates ed
    ON ed.event_id = :event_id AND ed.date = '2026-05-02'
  JOIN fields f
    ON f.event_id = :event_id AND f.number = n.field_num
  JOIN teams ht
    ON ht.event_id = :event_id
   AND ht.name = n.home_name
   AND UPPER(REPLACE(ht.division, 'U', '')) = n.div_key
  JOIN teams at
    ON at.event_id = :event_id
   AND at.name = n.away_name
   AND UPPER(REPLACE(at.division, 'U', '')) = n.div_key
)
INSERT INTO games (
  event_id, event_date_id, field_id,
  home_team_id, away_team_id, division, scheduled_time, status
)
SELECT :event_id, event_date_id, field_id,
       home_team_id, away_team_id, division, scheduled_time, 'Scheduled'
FROM resolved;

-- ── Safety check: did every source row resolve? ─────────────
-- If this is > 0, some team/field name did NOT match and was silently
-- dropped. Roll back and fix names before committing.
DO $$
DECLARE
  expected INT := 20;  -- count of rows in VALUES above (not counting Field 6 @ 3 PM)
  actual INT;
BEGIN
  SELECT COUNT(*) INTO actual
  FROM games g
  JOIN event_dates ed ON ed.id = g.event_date_id
  WHERE g.event_id = :event_id AND ed.date = '2026-05-02';
  IF actual <> expected THEN
    RAISE EXCEPTION 'Expected % games inserted, got % — aborting. Check team/field name matches.', expected, actual;
  END IF;
END $$;

-- ── Post-insert preview ─────────────────────────────────────
SELECT g.scheduled_time, f.number AS field, g.division,
       ht.name AS home, at.name AS away
FROM games g
JOIN fields f ON f.id = g.field_id
JOIN teams ht ON ht.id = g.home_team_id
JOIN teams at ON at.id = g.away_team_id
JOIN event_dates ed ON ed.id = g.event_date_id
WHERE g.event_id = :event_id AND ed.date = '2026-05-02'
ORDER BY g.scheduled_time, f.number;

COMMIT;  -- change to ROLLBACK; if anything looks wrong above
