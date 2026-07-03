-- Public prayer INSERT: allow when the new row's submitter email matches tenant_memberships,
-- without relying on auth.jwt() email (MFA / anon clients have no JWT email, so
-- is_tenant_member(tenant_id) is always false).
--
-- INSERT ... RETURNING still requires SELECT on the new row; the app avoids RETURNING by
-- sending a client-generated UUID (see PrayerService.addPrayer).

drop policy if exists tenant_insert_prayers_membership_by_row_email on public.prayers;

create policy tenant_insert_prayers_membership_by_row_email
  on public.prayers
  for insert
  to public
  with check (
    tenant_id is not null
    and public.tenant_plan(tenant_id) in ('groups', 'churches')
    and (
      exists (
        select 1
        from public.tenant_memberships tm
        where tm.tenant_id = prayers.tenant_id
          and tm.user_email = lower(trim(prayers.email::text))
      )
      or exists (
        select 1
        from public.global_roles gr
        where gr.user_email = lower(trim(prayers.email::text))
          and gr.role = 'super_admin'
      )
    )
  );
