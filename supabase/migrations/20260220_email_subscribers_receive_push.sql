-- Add push notification preference to email_subscribers.
-- Default true preserves existing behavior (all current subscribers receive push until they opt out).
ALTER TABLE public.email_subscribers
  ADD COLUMN IF NOT EXISTS receive_push boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.email_subscribers.receive_push IS 'Whether the subscriber wants to receive push notifications (Capacitor app).';
