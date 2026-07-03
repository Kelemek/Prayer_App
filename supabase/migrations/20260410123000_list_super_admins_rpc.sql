-- List all super admins for UI; RLS only allows self-read unless JWT-backed is_super_admin() works.
-- MFA sessions have no JWT email in Postgres, so use the same email-trust pattern as get_tenant_context_by_email.

create or replace function public.list_super_admins_for_caller(p_actor_email text)
returns table (user_email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := lower(trim(coalesce(p_actor_email, '')));
begin
  if normalized = '' then
    return;
  end if;

  if not exists (
    select 1
    from public.global_roles gr
    where gr.user_email = normalized
      and gr.role = 'super_admin'::public.global_role
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select gr.user_email
  from public.global_roles gr
  where gr.role = 'super_admin'::public.global_role
  order by gr.user_email asc;
end;
$$;

grant execute on function public.list_super_admins_for_caller(text) to anon, authenticated;
