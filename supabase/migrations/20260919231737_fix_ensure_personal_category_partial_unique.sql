-- ensure_personal_category ON CONFLICT must match the partial unique index
-- created when tenant_id became nullable (church wipe / unaffiliated rows).

create or replace function public.ensure_personal_category(
  p_name text,
  p_tenant_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_email text := public.current_user_email();
  v_name text := trim(coalesce(p_name, ''));
  v_id uuid;
  v_display_order integer;
begin
  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;
  if p_tenant_id is null then
    raise exception 'tenant_id is required';
  end if;
  if v_name = '' then
    raise exception 'Category name is required';
  end if;
  if char_length(v_name) > 50 then
    v_name := left(v_name, 50);
  end if;
  if not public.is_tenant_member(p_tenant_id) and not public.is_super_admin() then
    raise exception 'Not a member of this organization';
  end if;

  select c.id
    into v_id
  from public.personal_categories c
  where c.tenant_id = p_tenant_id
    and lower(c.user_email) = lower(v_email)
    and lower(c.name) = lower(v_name)
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  select coalesce(max(c.display_order), -1) + 1
    into v_display_order
  from public.personal_categories c
  where c.tenant_id = p_tenant_id
    and lower(c.user_email) = lower(v_email);

  insert into public.personal_categories (
    tenant_id, user_email, name, display_order
  ) values (
    p_tenant_id, lower(v_email), v_name, v_display_order
  )
  on conflict (tenant_id, lower(user_email), lower(name))
    where tenant_id is not null
  do update
    set name = public.personal_categories.name
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.ensure_personal_category(text, uuid) is
  'Get-or-create a personal category for the current user in a tenant. ON CONFLICT matches personal_categories_tenant_user_name_uidx (partial, tenant_id is not null).';
