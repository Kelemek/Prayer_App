-- Restores the permissive RLS policy removed in 20260410210000_personal_prayers_tenant_id.sql.
--
-- Without it, inserts fail for users who authenticate via MFA (mfa_authenticated_email)
-- without a Supabase session JWT: PostgREST uses the anon role, so policies that require
-- auth.uid() or auth.role() = 'authenticated' never pass.
--
-- Tenant isolation for personal prayers is enforced in application code (tenant_id on rows).
-- Tightening RLS to membership checks would require a JWT email claim for all auth paths.

drop policy if exists "Allow all personal_prayers access" on public.personal_prayers;

create policy "Allow all personal_prayers access"
  on public.personal_prayers
  as permissive
  for all
  to public
  using (true)
  with check (true);
