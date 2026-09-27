#!/usr/bin/env bash
# Recreate local Postgres (127.0.0.1:54322) with all repo migrations through 20260927140000.
# No hosted Supabase access. Requires Docker (sudo).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"
MIG_DIR="$REPO_ROOT/supabase/migrations"
PG_HOST=127.0.0.1
PG_PORT=54322
export PGPASSWORD=postgres

echo "[recreate] Removing old container prayer_pg_rls if present"
sudo docker rm -f prayer_pg_rls 2>/dev/null || true

echo "[recreate] Starting Supabase Postgres 17 image"
sudo docker run -d --name prayer_pg_rls \
  -e POSTGRES_PASSWORD=postgres \
  -p "${PG_PORT}:5432" \
  public.ecr.aws/supabase/postgres:17.6.1.171

for _ in $(seq 1 30); do
  if sudo docker exec prayer_pg_rls pg_isready -U postgres -q 2>/dev/null; then
    break
  fi
  sleep 2
done

echo "[recreate] auth.jwt / auth.uid stubs for migration policies"
sudo docker exec prayer_pg_rls psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c "
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS \$\$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
\$\$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS \$\$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
\$\$;
"

echo "[recreate] Applying migrations via supabase CLI"
cd "$REPO_ROOT"
DB_URL="postgresql://postgres:postgres@${PG_HOST}:${PG_PORT}/postgres"
if ! npx supabase migration up --db-url "$DB_URL" 2>/tmp/rls-migrate-up.log; then
  echo "[recreate] migration up hit duplicate version; applying remaining SQL manually"
fi

# Remaining migrations if CLI stopped at duplicate 20260925120000
for f in \
  20260925120000_test_account_login_notify.sql \
  20260926120000_tighten_anon_public_rls.sql \
  20260926140000_claim_tenant_invite_rpc.sql \
  20260926203000_claim_tenant_invite_display_name.sql \
  20260926210000_claim_invite_drop_prior_accepted.sql \
  20260927120000_tenant_access_requests.sql \
  20260927121000_deprecate_tenant_invites.sql \
  20260927130000_close_signed_in_personal_rls.sql \
  20260927140000_rls_full_sweep.sql; do
  path="$MIG_DIR/$f"
  if [[ -f "$path" ]]; then
    psql -h "$PG_HOST" -p "$PG_PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -f "$path" >/dev/null
  fi
done

echo "[recreate] Seeding acceptance fixtures (tenant A/B, roles, sample prayers)"
psql -h "$PG_HOST" -p "$PG_PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SEED'
INSERT INTO public.tenants (id, name, slug, plan_tier, plan_status, created_by_email)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Church A', 'church-a', 'churches', 'active', 'admin-a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Church B', 'church-b', 'churches', 'active', 'admin-b@example.com')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  plan_tier = EXCLUDED.plan_tier,
  plan_status = EXCLUDED.plan_status;

INSERT INTO public.tenant_memberships (tenant_id, user_email, role, is_active, is_blocked)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin-a@example.com', 'tenant_admin', true, false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'member-a1@example.com', 'member', true, false),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'member-a2@example.com', 'member', true, false),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin-b@example.com', 'tenant_admin', true, false),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member-b@example.com', 'member', true, false)
ON CONFLICT DO NOTHING;

INSERT INTO public.global_roles (user_email, role)
VALUES ('super@example.com', 'super_admin')
ON CONFLICT DO NOTHING;

INSERT INTO public.tenant_settings (tenant_id, updated_at)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now())
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO public.prayers (
  id, tenant_id, title, status, requester, email, prayer_for, approval_status
)
VALUES
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Prayer A', 'current', 'x', 'member-a1@example.com', 'x', 'approved'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Prayer B', 'current', 'x', 'member-b@example.com', 'x', 'approved'
  )
ON CONFLICT (id) DO NOTHING;
SEED

echo "[recreate] Done. Database ready at ${PG_HOST}:${PG_PORT}"
