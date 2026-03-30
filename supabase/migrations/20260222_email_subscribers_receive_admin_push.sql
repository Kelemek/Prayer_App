-- Add admin push notification preference to email_subscribers.
-- Only applies when is_admin is true; default false so admins opt in or are opted in when added.
ALTER TABLE public.email_subscribers
  ADD COLUMN IF NOT EXISTS receive_admin_push boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.email_subscribers.receive_admin_push IS 'Whether the admin wants to receive admin alert push notifications (Capacitor app). Only applies when is_admin is true.';
