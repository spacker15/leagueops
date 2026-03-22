-- ============================================================
-- LeagueOps — Payments & Registration Fees
-- ============================================================

-- Fee configuration per event/division
CREATE TABLE IF NOT EXISTS registration_fees (
  id          BIGSERIAL PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  division    TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'USD',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, division)
);

-- Per-team payment record (one per team per event)
CREATE TABLE IF NOT EXISTS team_payments (
  id               BIGSERIAL PRIMARY KEY,
  event_id         BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_id          BIGINT REFERENCES teams(id) ON DELETE SET NULL,
  team_name        TEXT NOT NULL,
  division         TEXT NOT NULL,
  amount_due       NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid      NUMERIC(10,2) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','partial','paid','waived','refunded')),
  notes            TEXT,
  recorded_by      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual payment entries (audit trail — multiple payments per team_payment)
CREATE TABLE IF NOT EXISTS payment_entries (
  id               BIGSERIAL PRIMARY KEY,
  team_payment_id  BIGINT NOT NULL REFERENCES team_payments(id) ON DELETE CASCADE,
  amount           NUMERIC(10,2) NOT NULL,
  payment_method   TEXT NOT NULL DEFAULT 'check'
                     CHECK (payment_method IN ('check','cash','bank_transfer','waived','other')),
  reference_number TEXT,
  paid_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes            TEXT,
  recorded_by      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on team_payments
CREATE OR REPLACE FUNCTION update_team_payments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_payments_updated_at ON team_payments;
CREATE TRIGGER trg_team_payments_updated_at
  BEFORE UPDATE ON team_payments
  FOR EACH ROW EXECUTE FUNCTION update_team_payments_updated_at();

-- RLS
ALTER TABLE registration_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_entries    ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read; service role manages writes
CREATE POLICY "auth read registration_fees"  ON registration_fees  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read team_payments"       ON team_payments       FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read payment_entries"     ON payment_entries     FOR SELECT TO authenticated USING (true);

CREATE POLICY "service all registration_fees" ON registration_fees  FOR ALL TO service_role USING (true);
CREATE POLICY "service all team_payments"      ON team_payments      FOR ALL TO service_role USING (true);
CREATE POLICY "service all payment_entries"    ON payment_entries    FOR ALL TO service_role USING (true);
