create or replace function public.get_all_tenants_for_email(p_email text)
returns table (
  id uuid,
  name text,
  slug text,
  plan_tier public.plan_tier,
  plan_status public.plan_status
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.global_roles gr
    where gr.user_email = lower(coalesce(p_email, ''))
      and gr.role = 'super_admin'
  ) then
    return;
  end if;

  return query
  select t.id, t.name, t.slug, t.plan_tier, t.plan_status
  from public.tenants t
  order by t.name asc;
end;
$$;

grant execute on function public.get_all_tenants_for_email(text) to anon, authenticated, service_role;
