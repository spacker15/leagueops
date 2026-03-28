-- Phase 7: Notification Infrastructure migration

-- ============================================================
-- NOTIFICATION_QUEUE
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_queue (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  scope TEXT NOT NULL,
  scope_id BIGINT,
  payload JSONB NOT NULL,
  dedup_key TEXT GENERATED ALWAYS AS (
    alert_type || '::' || scope || '::' || COALESCE(scope_id::TEXT, 'null') || '::' || event_id::TEXT
  ) STORED,
  notification_sent_at TIMESTAMPTZ,
  retry_count INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'suppressed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_queue_dedup ON notification_queue (dedup_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_queue_event ON notification_queue (event_id);
CREATE INDEX IF NOT EXISTS idx_notif_queue_status ON notification_queue (status);

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
-- No permissive policies — service role only writes/reads

-- ============================================================
-- NOTIFICATION_PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  email_on BOOLEAN NOT NULL DEFAULT TRUE,
  push_on BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, alert_type)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- NOTIFICATION_LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_log (
  id BIGSERIAL PRIMARY KEY,
  queue_id BIGINT NOT NULL REFERENCES notification_queue(id) ON DELETE CASCADE,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push')),
  status TEXT NOT NULL CHECK (status IN ('delivered', 'failed', 'suppressed')),
  error_message TEXT,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  title TEXT,
  summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_notif_log_user ON notification_log (user_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_event ON notification_log (event_id);
CREATE INDEX IF NOT EXISTS idx_notif_log_unread ON notification_log (user_id) WHERE read_at IS NULL;

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notification log"
  ON notification_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- PUSH_SUBSCRIPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
