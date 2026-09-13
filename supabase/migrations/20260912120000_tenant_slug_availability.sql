-- Public slug availability check for church setup (bypasses tenant RLS; no tenant data leaked).

create or replace function public.is_tenant_slug_available(p_slug text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
begin
  v_slug := lower(regexp_replace(trim(p_slug), '\s+', '-', 'g'));
  v_slug := regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
  if v_slug = '' then
    return false;
  end if;

  begin
    perform public.assert_tenant_slug_allowed(v_slug);
  exception
    when others then
      return false;
  end;

  return not exists (
    select 1
    from public.tenants t
    where t.slug = v_slug
  );
end;
$$;

grant execute on function public.is_tenant_slug_available(text) to authenticated, service_role;

comment on function public.is_tenant_slug_available(text) is
  'Returns true when the normalized slug is allowed and not used by an existing tenant.';
