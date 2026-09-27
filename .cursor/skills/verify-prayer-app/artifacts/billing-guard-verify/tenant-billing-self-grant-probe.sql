-- Prove (or disprove) billing/plan self-grant on public.tenants as authenticated.
-- Run against local Postgres only (127.0.0.1:54322). Each block uses BEGIN … ROLLBACK.
-- Usage: psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=0 -f tenant-billing-self-grant-probe.sql

\echo '=== Path (a): insert tenant with churches plan + creator bootstrap ==='
begin;
set local role authenticated;
set local request.jwt.claims = '{"email":"newchurch@example.com","role":"authenticated"}';

insert into public.tenants (name, slug, plan_tier, plan_status, created_by_email)
values ('Probe Church', 'probe-church-billing', 'churches', 'active', 'newchurch@example.com');

insert into public.tenant_memberships (tenant_id, user_email, role, is_active, is_blocked)
select id, 'newchurch@example.com', 'tenant_admin', true, false
from public.tenants where slug = 'probe-church-billing';

select public.tenant_has_churches_plan(
  (select id from public.tenants where slug = 'probe-church-billing')
) as path_a_has_churches_plan;

rollback;

\echo '=== Path (c): insert tenant with groups plan + creator bootstrap ==='
begin;
set local role authenticated;
set local request.jwt.claims = '{"email":"newgroups@example.com","role":"authenticated"}';

insert into public.tenants (name, slug, plan_tier, plan_status, created_by_email)
values ('Probe Groups', 'probe-groups-billing', 'groups', 'active', 'newgroups@example.com');

insert into public.tenant_memberships (tenant_id, user_email, role, is_active, is_blocked)
select id, 'newgroups@example.com', 'tenant_admin', true, false
from public.tenants where slug = 'probe-groups-billing';

rollback;

\echo '=== Positive: direct free tier insert + creator bootstrap ==='
begin;
set local role authenticated;
set local request.jwt.claims = '{"email":"newfree@example.com","role":"authenticated"}';

insert into public.tenants (name, slug, plan_tier, plan_status, created_by_email)
values ('Probe Free', 'probe-free-billing', 'free', 'active', 'newfree@example.com')
returning id, plan_tier, plan_status;

insert into public.tenant_memberships (tenant_id, user_email, role, is_active, is_blocked)
select id, 'newfree@example.com', 'tenant_admin', true, false
from public.tenants where slug = 'probe-free-billing';

rollback;

\echo '=== Path (b): tenant admin updates billing columns on own tenant ==='
begin;
set local role authenticated;
set local request.jwt.claims = '{"email":"admin-a@example.com","role":"authenticated"}';

update public.tenants
set plan_tier = 'churches',
    plan_status = 'active',
    grace_until = now() + interval '365 days',
    stripe_customer_id = 'cus_probe_evil',
    stripe_subscription_id = 'sub_probe_evil'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select public.tenant_has_churches_plan('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid) as path_b_has_churches_plan;

rollback;

\echo '=== Positive: admin can rename tenant (non-billing columns) ==='
begin;
set local role authenticated;
set local request.jwt.claims = '{"email":"admin-a@example.com","role":"authenticated"}';

update public.tenants
set name = 'Church A Probe Rename'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
returning name;

rollback;

\echo '=== Positive: create_tenant_for_user (groups) ==='
begin;
set local role authenticated;
set local request.jwt.claims = '{"email":"rpcuser@example.com","role":"authenticated"}';

select id, slug, plan_tier, plan_status
from public.create_tenant_for_user('Rpc Org', 'rpc-org-probe', 'groups', 'active');

rollback;

\echo '=== Positive: apply_tenant_stripe_billing as postgres (service path) ==='
begin;

select plan_tier, plan_status, stripe_customer_id
from public.apply_tenant_stripe_billing(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  'churches'::public.plan_tier,
  'active'::public.plan_status,
  p_stripe_customer_id := 'cus_service_probe',
  p_stripe_subscription_id := 'sub_service_probe'
);

rollback;

\echo '=== Negative: JWT role spoof must not bypass guard ==='
begin;
set local role authenticated;
set local request.jwt.claims = '{"email":"spoof@example.com","role":"service_role"}';

update public.tenants
set stripe_customer_id = 'cus_spoof_probe'
where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

rollback;

\echo '=== Positive: SET ROLE service_role direct billing update ==='
begin;
set local role service_role;

update public.tenants
set stripe_customer_id = 'cus_role_probe'
where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
returning stripe_customer_id;

rollback;
