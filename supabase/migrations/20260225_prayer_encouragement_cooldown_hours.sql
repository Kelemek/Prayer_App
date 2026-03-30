-- Prayer Encouragement: configurable cooldown hours (how long before user can click Pray For again on same prayer)

ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS prayer_encouragement_cooldown_hours integer NOT NULL DEFAULT 4;

-- Constrain to 1–168 hours (1 hour to 1 week)
ALTER TABLE public.admin_settings
  DROP CONSTRAINT IF EXISTS prayer_encouragement_cooldown_hours_range;

ALTER TABLE public.admin_settings
  ADD CONSTRAINT prayer_encouragement_cooldown_hours_range
  CHECK (prayer_encouragement_cooldown_hours >= 1 AND prayer_encouragement_cooldown_hours <= 168);
