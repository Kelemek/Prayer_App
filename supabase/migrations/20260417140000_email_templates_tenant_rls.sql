-- Tenant-scoped email_templates: seed helper + tighten RLS for admin UI.

create or replace function public.ensure_tenant_email_templates(
  p_tenant_id uuid,
  p_email text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_from_auth text;
  v_p_email text := lower(trim(coalesce(p_email, '')));
  def_id uuid;
begin
  if p_tenant_id is null then
    raise exception 'p_tenant_id is required';
  end if;

  select lower(trim(u.email)) into v_from_auth
  from auth.users u
  where u.id = auth.uid();

  if v_p_email != ''
     and (public.is_tenant_admin(p_tenant_id, v_p_email) or public.is_super_admin(v_p_email)) then
    v_email := v_p_email;
  elsif v_from_auth is not null and v_from_auth != '' then
    v_email := v_from_auth;
  elsif v_p_email != '' then
    v_email := v_p_email;
  else
    v_email := nullif(trim(lower(coalesce(auth.jwt() ->> 'email', ''))), '');
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Not authenticated';
  end if;

  if not (public.is_tenant_admin(p_tenant_id, v_email) or public.is_super_admin(v_email)) then
    raise exception 'Not authorized for tenant';
  end if;

  select id into def_id from public.tenants where slug = 'default-tenant' limit 1;
  if def_id is null then
    return;
  end if;

  insert into public.email_templates (
    tenant_id,
    template_key,
    name,
    subject,
    html_body,
    text_body,
    description,
    created_at,
    updated_at
  )
  select
    p_tenant_id,
    src.template_key,
    src.name,
    src.subject,
    src.html_body,
    src.text_body,
    src.description,
    src.created_at,
    src.updated_at
  from public.email_templates src
  where src.tenant_id = def_id
    and not exists (
      select 1
      from public.email_templates existing
      where existing.tenant_id = p_tenant_id
        and existing.template_key = src.template_key
    );
end;
$$;

grant execute on function public.ensure_tenant_email_templates(uuid, text) to anon, authenticated;

-- Replace permissive email_templates policies with tenant-admin scoped access.
drop policy if exists "Allow all deletes" on public.email_templates;
drop policy if exists "Allow all inserts" on public.email_templates;
drop policy if exists "Allow all to read templates" on public.email_templates;
drop policy if exists "Allow all updates" on public.email_templates;
drop policy if exists "Allow authenticated users to read templates" on public.email_templates;
drop policy if exists "Allow authenticated users to update templates" on public.email_templates;
drop policy if exists "Allow public reads" on public.email_templates;

create policy email_templates_tenant_read on public.email_templates
  for select to authenticated
  using (
    public.is_tenant_admin(tenant_id)
    or public.is_super_admin()
  );

create policy email_templates_tenant_update on public.email_templates
  for update to authenticated
  using (
    public.is_tenant_admin(tenant_id)
    or public.is_super_admin()
  )
  with check (
    public.is_tenant_admin(tenant_id)
    or public.is_super_admin()
  );

-- Inserts are handled by ensure_tenant_email_templates / seed trigger (security definer).
-- Anonymous users do not manage templates via the client.
