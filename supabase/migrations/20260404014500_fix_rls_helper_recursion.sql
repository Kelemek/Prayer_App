-- Prevent RLS recursion when helper functions read protected tables.
-- These helpers are used inside policies, so they must bypass policy evaluation.

create or replace function public.is_super_admin(email_to_check text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.global_roles gr
    where gr.user_email = lower(coalesce(email_to_check, public.current_user_email()))
      and gr.role = 'super_admin'
  );
$$;

create or replace function public.is_tenant_member(tenant_to_check uuid, email_to_check text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = tenant_to_check
      and tm.user_email = lower(coalesce(email_to_check, public.current_user_email()))
  ) or public.is_super_admin(email_to_check);
$$;

create or replace function public.is_tenant_admin(tenant_to_check uuid, email_to_check text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = tenant_to_check
      and tm.user_email = lower(coalesce(email_to_check, public.current_user_email()))
      and tm.role = 'tenant_admin'
  ) or public.is_super_admin(email_to_check);
$$;
