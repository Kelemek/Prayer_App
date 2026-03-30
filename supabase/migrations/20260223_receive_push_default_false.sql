-- receive_push should be true only when the user has installed the app and has a device_token.
-- Default to false for new subscribers; set to true only when a device token is registered (app code).
ALTER TABLE public.email_subscribers
  ALTER COLUMN receive_push SET DEFAULT false;

-- Backfill: set receive_push = false for subscribers who have no device token.
UPDATE public.email_subscribers es
SET receive_push = false
WHERE es.receive_push = true
  AND NOT EXISTS (
    SELECT 1 FROM public.device_tokens dt
    WHERE dt.user_email = es.email
  );

COMMENT ON COLUMN public.email_subscribers.receive_push IS 'Whether the subscriber wants to receive push notifications (Capacitor app). Set true only when a device token is registered.';
