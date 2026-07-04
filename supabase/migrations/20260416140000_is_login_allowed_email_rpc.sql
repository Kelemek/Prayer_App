-- Gate site login OTP: only approved, active tenant members (or super admins) may receive OTP.
-- Used before signInWithOtp(shouldCreateUser: true) so auth.users rows are created on first login.

create or replace function public.is_login_allowed_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    nullif(lower(trim(coalesce(p_email, ''))), '') is not null
    and (
      exists (
        select 1
        from public.global_roles gr
        where gr.user_email = lower(trim(p_email))
          and gr.role = 'super_admin'
      )
      or exists (
        select 1
        from public.tenant_memberships tm
        where tm.user_email = lower(trim(p_email))
          and coalesce(tm.is_active, true) = true
          and coalesce(tm.is_blocked, false) = false
      )
    )
    and not exists (
      select 1
      from public.account_approval_requests aar
      where lower(aar.email) = lower(trim(p_email))
        and aar.approval_status = 'pending'
    );
$$;

grant execute on function public.is_login_allowed_email(text) to anon, authenticated, service_role;
