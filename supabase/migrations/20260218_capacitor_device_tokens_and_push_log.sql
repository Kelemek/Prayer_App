-- Capacitor push notifications: device_tokens, push_notification_log, grants, and RLS.
-- Single migration for easier production rollout. Edge Function uses service_role (bypasses RLS).

-- 1. Tables
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email VARCHAR(255) NOT NULL,
  token VARCHAR(1000) NOT NULL UNIQUE,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_email) REFERENCES public.email_subscribers(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_email ON public.device_tokens(user_email);
CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON public.device_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_device_tokens_last_seen ON public.device_tokens(last_seen_at);

COMMENT ON TABLE public.device_tokens IS 'Stores device tokens for push notification delivery to native apps (iOS/Android)';
COMMENT ON COLUMN public.device_tokens.token IS 'Unique device token from Firebase (Android) or APNs (iOS)';
COMMENT ON COLUMN public.device_tokens.platform IS 'Platform of the device: ios, android, or web';
COMMENT ON COLUMN public.device_tokens.last_seen_at IS 'Last time this device checked in or received a notification';

CREATE TABLE IF NOT EXISTS public.push_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token_id UUID NOT NULL REFERENCES public.device_tokens(id) ON DELETE CASCADE,
  title VARCHAR(255),
  body TEXT,
  data JSONB,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  delivery_status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  user_email VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_log_device_token ON public.push_notification_log(device_token_id);
CREATE INDEX IF NOT EXISTS idx_push_log_sent_at ON public.push_notification_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_push_log_user_email ON public.push_notification_log(user_email);
CREATE INDEX IF NOT EXISTS idx_push_log_status ON public.push_notification_log(delivery_status);

COMMENT ON TABLE public.push_notification_log IS 'Log of push notifications sent via Firebase/APNs for monitoring and debugging';
COMMENT ON COLUMN public.push_notification_log.delivery_status IS 'Status of notification delivery: pending, sent, or failed';

-- 2. Grants (Edge Function uses service_role; anon/authenticated need table access for RLS policies)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.device_tokens TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_notification_log TO anon, authenticated, service_role;

-- 3. RLS and policies (authenticated users see only their own rows; service_role bypasses RLS)
-- Safe to re-run: tables/indexes/grants are IF NOT EXISTS or idempotent; policies are dropped then recreated.
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_tokens_select_own" ON public.device_tokens;
CREATE POLICY "device_tokens_select_own"
  ON public.device_tokens FOR SELECT TO authenticated
  USING (lower(user_email) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "device_tokens_insert_own" ON public.device_tokens;
CREATE POLICY "device_tokens_insert_own"
  ON public.device_tokens FOR INSERT TO authenticated
  WITH CHECK (lower(user_email) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "device_tokens_update_own" ON public.device_tokens;
CREATE POLICY "device_tokens_update_own"
  ON public.device_tokens FOR UPDATE TO authenticated
  USING (lower(user_email) = lower(auth.jwt() ->> 'email'))
  WITH CHECK (lower(user_email) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "device_tokens_delete_own" ON public.device_tokens;
CREATE POLICY "device_tokens_delete_own"
  ON public.device_tokens FOR DELETE TO authenticated
  USING (lower(user_email) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "push_notification_log_select_own" ON public.push_notification_log;
CREATE POLICY "push_notification_log_select_own"
  ON public.push_notification_log FOR SELECT TO authenticated
  USING (lower(user_email) = lower(auth.jwt() ->> 'email'));
