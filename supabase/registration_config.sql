-- ============================================================
-- LeagueOps — Registration Configuration
-- Run AFTER program_registration.sql
-- ============================================================

-- ============================================================
-- 1. REGISTRATION DIVISIONS
-- Admin-configurable list of available divisions
-- ============================================================
CREATE TABLE IF NOT EXISTS registration_divisions (
  id         BIGSERIAL PRIMARY KEY,
  event_id   BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,           -- '14U Boys', '12U Girls', etc.
  age_group  TEXT,                    -- '14U', '12U', etc.
  gender     TEXT,                    -- 'Boys', 'Girls', 'Co-Ed'
  sort_order INT DEFAULT 0,
  is_active  BOOLEAN DEFAULT TRUE,
  max_teams  INT,                     -- NULL = unlimited
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, name)
);

ALTER TABLE registration_divisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON registration_divisions FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 2. REGISTRATION QUESTIONS
-- Admin-configurable custom questions on the registration form
-- ============================================================
CREATE TABLE IF NOT EXISTS registration_questions (
  id           BIGSERIAL PRIMARY KEY,
  event_id     BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  section      TEXT NOT NULL DEFAULT 'team'
    CHECK (section IN ('program', 'team', 'coach')),  -- which step it appears on
  question_key TEXT NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'text'
    CHECK (question_type IN ('text', 'textarea', 'select', 'checkbox', 'number', 'phone', 'email')),
  placeholder  TEXT,
  options      TEXT[],               -- for 'select' type
  is_required  BOOLEAN DEFAULT FALSE,
  is_active    BOOLEAN DEFAULT TRUE,
  sort_order   INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, question_key)
);

ALTER TABLE registration_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON registration_questions FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 3. REGISTRATION QUESTION ANSWERS
-- Stores answers to custom questions per team registration
-- ============================================================
CREATE TABLE IF NOT EXISTS registration_answers (
  id              BIGSERIAL PRIMARY KEY,
  team_reg_id     BIGINT NOT NULL REFERENCES team_registrations(id) ON DELETE CASCADE,
  question_id     BIGINT NOT NULL REFERENCES registration_questions(id) ON DELETE CASCADE,
  answer          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_reg_id, question_id)
);

ALTER TABLE registration_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON registration_answers FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 4. SEED DEFAULT DIVISIONS FOR EVENT 1
-- ============================================================
INSERT INTO registration_divisions (event_id, name, age_group, gender, sort_order, is_active) VALUES
  (1, '8U Boys',  '8U',  'Boys',  1,  true),
  (1, '10U Boys', '10U', 'Boys',  2,  true),
  (1, '12U Boys', '12U', 'Boys',  3,  true),
  (1, '14U Boys', '14U', 'Boys',  4,  true),
  (1, '16U Boys', '16U', 'Boys',  5,  true),
  (1, '18U Boys', '18U', 'Boys',  6,  true),
  (1, '8U Girls', '8U',  'Girls', 7,  true),
  (1, '10U Girls','10U', 'Girls', 8,  true),
  (1, '12U Girls','12U', 'Girls', 9,  true),
  (1, '14U Girls','14U', 'Girls', 10, true),
  (1, '16U Girls','16U', 'Girls', 11, true),
  (1, '18U Girls','18U', 'Girls', 12, true)
ON CONFLICT (event_id, name) DO NOTHING;

-- ============================================================
-- 5. SEED DEFAULT CUSTOM QUESTIONS FOR EVENT 1
-- ============================================================
INSERT INTO registration_questions (event_id, section, question_key, question_text, question_type, placeholder, is_required, sort_order) VALUES
  (1, 'program', 'usa_lacrosse_member', 'Is your program a USA Lacrosse member?', 'select', NULL, true, 1),
  (1, 'program', 'years_in_operation',  'How many years has your program been operating?', 'number', 'e.g. 5', false, 2),
  (1, 'team',    'jersey_color',        'Primary jersey color', 'text', 'e.g. Navy Blue', false, 1),
  (1, 'team',    'alternate_color',     'Alternate jersey color', 'text', 'e.g. White', false, 2),
  (1, 'team',    'home_field',          'Home practice field / facility', 'text', 'e.g. Veterans Park Field 2', false, 3),
  (1, 'coach',   'coaching_cert',       'Coaching certification level', 'select', NULL, false, 1),
  (1, 'coach',   'years_coaching',      'Years of coaching experience', 'number', 'e.g. 3', false, 2)
ON CONFLICT (event_id, question_key) DO NOTHING;

-- Set select options
UPDATE registration_questions 
SET options = ARRAY['Yes - Current member', 'Yes - Expired', 'No', 'Applying']
WHERE question_key = 'usa_lacrosse_member' AND event_id = 1;

UPDATE registration_questions
SET options = ARRAY['None', 'Foundations of Coaching', 'Level 1', 'Level 2', 'Level 3']
WHERE question_key = 'coaching_cert' AND event_id = 1;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT * FROM registration_divisions WHERE event_id = 1 ORDER BY sort_order;
-- SELECT * FROM registration_questions WHERE event_id = 1 ORDER BY section, sort_order;
