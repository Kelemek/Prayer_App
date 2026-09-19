-- Platform test-account login-alert toggle.
-- Default true preserves current "email tenant admins on tester sign-in" behavior.

alter table public.admin_settings
  add column if not exists test_account_login_notify boolean not null default true;

comment on column public.admin_settings.test_account_login_notify is
  'When true, verify-code and test-account-auth email tenant admins who receive_admin_emails after the platform test account signs in. Default true. Does not change the fixed tester login code or skip-verification-email path.';
