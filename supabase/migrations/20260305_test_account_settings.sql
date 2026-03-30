-- Add test account settings to admin_settings for app testing (no email sent; configurable codes per MFA length)
ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS test_account_email text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS test_account_code_4 text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS test_account_code_6 text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS test_account_code_8 text DEFAULT NULL;

COMMENT ON COLUMN public.admin_settings.test_account_email IS 'Email of the account used for Apple/Android app testing; when set, no verification email is sent and codes come from test_account_code_4/6/8';
COMMENT ON COLUMN public.admin_settings.test_account_code_4 IS 'Fixed MFA code for test account when verification_code_length is 4';
COMMENT ON COLUMN public.admin_settings.test_account_code_6 IS 'Fixed MFA code for test account when verification_code_length is 6';
COMMENT ON COLUMN public.admin_settings.test_account_code_8 IS 'Fixed MFA code for test account when verification_code_length is 8';
