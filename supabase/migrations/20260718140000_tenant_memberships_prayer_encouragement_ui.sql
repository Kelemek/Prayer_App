-- Per-user viewer preferences for prayer encouragement UI on cards.
alter table public.tenant_memberships
  add column if not exists show_pray_for_button boolean not null default true,
  add column if not exists show_praying_count boolean not null default true;

comment on column public.tenant_memberships.show_pray_for_button is
  'When false, this user does not see Pray For / Prayed For controls on community prayer cards.';

comment on column public.tenant_memberships.show_praying_count is
  'When false, this user does not see the N Praying count chip on prayer cards.';
