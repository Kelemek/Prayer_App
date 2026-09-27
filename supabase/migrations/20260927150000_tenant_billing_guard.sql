-- Block authenticated (and anon) direct writes to tenant billing/plan columns on public.tenants.
-- Platform updates go through SECURITY DEFINER RPCs (create_tenant_for_user, apply_tenant_stripe_billing, …)
-- or service_role / postgres.

create or replace function public.tenants_billing_guard_bypass()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  -- Trust only the database role, not request.jwt.claims (spoofable in raw SQL sessions).
  select current_user in ('postgres', 'supabase_admin', 'service_role');
$$;

create or replace function public.tenants_billing_write_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.tenants_billing_guard_bypass() then
    return NEW;
  end if;

  if TG_OP = 'INSERT' then
    if NEW.plan_tier is distinct from 'free'::public.plan_tier
       and NEW.plan_tier is distinct from 'groups'::public.plan_tier then
      raise exception 'Tenant plan tier cannot be set directly';
    end if;

    if NEW.plan_status is distinct from 'active'::public.plan_status then
      raise exception 'Tenant plan status cannot be set directly';
    end if;

    if NEW.stripe_customer_id is not null
       or NEW.stripe_subscription_id is not null
       or NEW.stripe_current_period_end is not null
       or NEW.past_due_since is not null
       or NEW.grace_until is not null
       or NEW.billing_past_due_notified_at is not null
       or coalesce(NEW.stripe_cancel_at_period_end, false) is distinct from false then
      raise exception 'Tenant billing fields cannot be set directly';
    end if;

    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    if NEW.plan_tier is distinct from OLD.plan_tier
       or NEW.plan_status is distinct from OLD.plan_status
       or NEW.stripe_customer_id is distinct from OLD.stripe_customer_id
       or NEW.stripe_subscription_id is distinct from OLD.stripe_subscription_id
       or NEW.stripe_cancel_at_period_end is distinct from OLD.stripe_cancel_at_period_end
       or NEW.stripe_current_period_end is distinct from OLD.stripe_current_period_end
       or NEW.past_due_since is distinct from OLD.past_due_since
       or NEW.grace_until is distinct from OLD.grace_until
       or NEW.billing_past_due_notified_at is distinct from OLD.billing_past_due_notified_at then
      raise exception 'Tenant billing fields are managed by the platform';
    end if;

    return NEW;
  end if;

  return NEW;
end;
$$;

drop trigger if exists tenants_billing_write_guard on public.tenants;

create trigger tenants_billing_write_guard
  before insert or update on public.tenants
  for each row
  execute function public.tenants_billing_write_guard();

comment on function public.tenants_billing_write_guard() is
  'Rejects non-service-role writes to plan/billing columns on tenants; bypass for postgres and service_role JWT.';
