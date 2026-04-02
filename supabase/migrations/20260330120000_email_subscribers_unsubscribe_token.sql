-- Per-subscriber opaque token for HTTPS + one-click unsubscribe (see email-unsubscribe Edge Function).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.email_subscribers
ADD COLUMN IF NOT EXISTS unsubscribe_token text;

UPDATE public.email_subscribers
SET unsubscribe_token = encode(gen_random_bytes(32), 'hex')
WHERE unsubscribe_token IS NULL;

ALTER TABLE public.email_subscribers
ALTER COLUMN unsubscribe_token SET DEFAULT encode(gen_random_bytes(32), 'hex'),
ALTER COLUMN unsubscribe_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_subscribers_unsubscribe_token_key
ON public.email_subscribers (unsubscribe_token);

COMMENT ON COLUMN public.email_subscribers.unsubscribe_token IS
  'Secret token for one-click unsubscribe links; do not expose except in personalized email URLs.';
