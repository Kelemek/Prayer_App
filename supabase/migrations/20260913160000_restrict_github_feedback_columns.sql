-- Remove GitHub PAT / repo fields from the Data API and from leftover tenant copies.
-- In-app feedback now goes to Notion via Edge Function submit-feedback
-- (NOTION_TOKEN is an Edge secret, not admin_settings).
-- Do not apply this migration unless Mark asks.
-- Apply after the Angular cutover is deployed so old clients are not still
-- selecting github_token.
--
-- Rotate/revoke any GitHub PAT that lived in admin_settings (assume leaked).
-- Keep test_account_*.

alter table public.admin_settings
  drop column if exists github_token,
  drop column if exists github_repo_owner,
  drop column if exists github_repo_name,
  drop column if exists enabled;

comment on table public.admin_settings is
  'Platform-global singleton (id=1). Super-admin writes only. In-app feedback uses Edge secret NOTION_TOKEN (submit-feedback). Kept: test_account_email, test_account_code_4/6/8, church billing knobs, id, created_at, updated_at. Church config lives on tenant_settings.';

-- Leftover per-tenant PAT copies from 20260404190000 (unused after platform-global GitHub).
alter table public.tenant_settings
  drop column if exists github_token,
  drop column if exists github_repo_owner,
  drop column if exists github_repo_name,
  drop column if exists github_feedback_enabled;
