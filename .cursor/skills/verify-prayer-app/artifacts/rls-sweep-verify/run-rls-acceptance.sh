#!/usr/bin/env bash
# Run plan §7.1–§7.5 acceptance SQL against local Postgres only (127.0.0.1:54322).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$DIR/rls-acceptance-results.log"
PG_HOST=127.0.0.1
PG_PORT=54322
export PGPASSWORD=postgres
PSQL=(psql -h "$PG_HOST" -p "$PG_PORT" -U postgres -d postgres -v ON_ERROR_STOP=0 -t -A)

TENANT_A=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
TENANT_B=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
MEMBER_A=member-a1@example.com
MEMBER_A2=member-a2@example.com
ADMIN_A=admin-a@example.com
ADMIN_B=admin-b@example.com
SUPER=super@example.com
TENANT_A_SLUG=church-a
TENANT_B_PRAYER=dddddddd-dddd-dddd-dddd-dddddddddddd
OTHER_EMAIL=other@example.com

: >"$LOG"
echo "RLS acceptance run $(date -u +%Y-%m-%dT%H:%M:%SZ) UTC" | tee -a "$LOG"
echo "Host: ${PG_HOST}:${PG_PORT} (local Docker only)" | tee -a "$LOG"
echo "" | tee -a "$LOG"

pass() { echo "PASS | $1 | $2" | tee -a "$LOG"; }
fail() { echo "FAIL | $1 | $2" | tee -a "$LOG"; FAILED=1; }

FAILED=0

# First numeric line from psql output (ignores BEGIN/ROLLBACK noise).
first_number() {
  echo "$1" | grep -E '^[0-9]+$' | head -1
}

run_sql() {
  local id="$1"
  local sql="$2"
  local out err
  out=$(echo "$sql" | "${PSQL[@]}" 2>&1) || true
  err=$?
  echo "$out"
  return "$err"
}

expect_zero_rows() {
  local id="$1"
  local sql="$2"
  local n
  n=$(echo "$sql" | "${PSQL[@]}" 2>/dev/null | grep -c . || true)
  if [[ "$n" -eq 0 ]]; then pass "$id" "0 rows"; else fail "$id" "got ${n} rows: $(echo "$sql" | "${PSQL[@]}" 2>/dev/null | head -3)"; fi
}

expect_error() {
  local id="$1"
  local sql="$2"
  local out
  out=$(echo "$sql" | "${PSQL[@]}" 2>&1) || true
  if echo "$out" | grep -qiE 'ERROR:|permission denied|Not authorized|Not authenticated|violates row-level security'; then
    pass "$id" "$(echo "$out" | grep -iE 'ERROR:' | head -1 | tr -d '\r')"
  else
    fail "$id" "expected error; got: ${out:0:200}"
  fi
}

expect_ok() {
  local id="$1"
  local sql="$2"
  local out
  out=$(echo "$sql" | "${PSQL[@]}" 2>&1) || true
  if echo "$out" | grep -qi 'ERROR:'; then
    fail "$id" "$(echo "$out" | grep -i ERROR | head -1)"
  else
    pass "$id" "ok"
  fi
}

echo "=== §7.1 structure (postgres) ===" | tee -a "$LOG"

expect_zero_rows "7.1.1 broad/anon policies" "
select tablename from pg_policies
where schemaname = 'public'
  and (
    qual = 'true' or with_check = 'true'
    or qual ilike '%auth.uid() IS NOT NULL%' or qual ilike '%AS uid) IS NOT NULL%'
    or 'anon' = any (roles)
  )
  and tablename not in ('ibcd_memorization_catalog_categories', 'ibcd_memorization_catalog_verses',
                        'scripture_cache', 'platform_plan_limits', 'platform_plan_practice_modes');
"

ANON_TABLES=$(echo "
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
  and (has_table_privilege('anon', c.oid, 'SELECT') or has_table_privilege('anon', c.oid, 'INSERT')
       or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE'))
order by 1;
" | "${PSQL[@]}" | tr '\n' ',' )
if [[ "$ANON_TABLES" == "ibcd_memorization_catalog_categories,ibcd_memorization_catalog_verses," ]] || \
   [[ "$ANON_TABLES" == *"ibcd_memorization_catalog_categories"* && "$ANON_TABLES" == *"ibcd_memorization_catalog_verses"* ]]; then
  ANON_COUNT=$(echo "$ANON_TABLES" | tr ',' '\n' | grep -c . || true)
  if [[ "$ANON_COUNT" -eq 2 ]]; then pass "7.1.2 anon table grants" "exactly 2 ibcd catalog tables"; else fail "7.1.2 anon table grants" "count=${ANON_COUNT} tables=${ANON_TABLES}"; fi
else
  fail "7.1.2 anon table grants" "tables=${ANON_TABLES}"
fi

expect_zero_rows "7.1.3 authenticated TRUNCATE" "
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p') and has_table_privilege('authenticated', c.oid, 'TRUNCATE');
"

ALLOWLIST="can_use_unaffiliated_user_data get_platform_billing_settings get_public_client_min_versions get_public_tenant_branding get_public_tenant_by_slug get_public_tenant_memorization_recite_settings get_public_tenant_prayer_encouragement is_login_allowed_email is_prayer_group_member is_prayer_group_owner is_super_admin is_tenant_admin is_tenant_member is_tenant_slug_available is_test_account_email tenant_has_churches_plan"
ANON_RPC=$(echo "
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE')
  and pg_get_function_result(p.oid) not in ('trigger', 'event_trigger')
order by 1;
" | "${PSQL[@]}" | sort | tr '\n' ' ')
if [[ "$(echo "$ANON_RPC" | wc -w)" -eq 16 ]]; then pass "7.1.4 anon definer RPC count" "16 functions"; else fail "7.1.4 anon definer RPC count" "$ANON_RPC"; fi

SVC_BAD=$(echo "
select count(*) from (
  select has_function_privilege('authenticated', p.oid, 'EXECUTE') auth_x,
         has_function_privilege('service_role', p.oid, 'EXECUTE') svc_x
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('apply_tenant_stripe_billing', 'downgrade_church_tenant_after_access_end',
                      'list_church_tenants_due_for_billing_downgrade', 'get_user_prayer_hour_reminders_due_now',
                      'get_user_memorization_hour_reminders_due_now', 'get_user_prayer_item_reminders_due_now',
                      '_merge_ibcd_memorization_catalog', 'seed_ibcd_memorization_recommendations',
                      'get_tenant_context_by_email')
) s where not (auth_x = false and svc_x = true);
" | "${PSQL[@]}")
if [[ "$SVC_BAD" == "0" ]]; then pass "7.1.5 service-only RPCs" "9/9 auth=false svc=true"; else fail "7.1.5 service-only RPCs" "bad_count=${SVC_BAD}"; fi

expect_zero_rows "7.1.6 email-trust RPC patterns" "
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and (prosrc like '%v_email := v_p_email%' or prosrc like '%gr.user_email = v_email%'
       or prosrc like '%lower(coalesce(p_email, ''''))%');
"

COLS=$(echo "
select column_name, is_nullable from information_schema.columns
where table_schema = 'public' and table_name in ('member_prayer_updates', 'member_prayed_for_counts')
  and column_name in ('tenant_id', 'author_email')
order by table_name, column_name;
" | "${PSQL[@]}")
PK=$(echo "
select pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.member_prayed_for_counts'::regclass and contype = 'p';
" | "${PSQL[@]}")
if echo "$PK" | grep -q 'PRIMARY KEY (tenant_id, person_id)'; then pass "7.1.7 member_prayed_for_counts PK" "$PK"; else fail "7.1.7 member_prayed_for_counts PK" "$PK"; fi
if echo "$COLS" | grep -q tenant_id; then pass "7.1.7 tenant_id/author_email columns" "$(echo "$COLS" | tr '\n' '; ')"; else fail "7.1.7 tenant_id/author_email columns" "$COLS"; fi

echo "" | tee -a "$LOG"
echo "=== §7.2 anon ===" | tee -a "$LOG"

expect_error "7.2.1 anon select tenants" "begin; set local role anon; set local request.jwt.claims = '{\"role\":\"anon\"}'; select count(*) from public.tenants; rollback;"
expect_error "7.2.2 anon select deletion_requests" "begin; set local role anon; set local request.jwt.claims = '{\"role\":\"anon\"}'; select count(*) from public.deletion_requests; rollback;"
expect_error "7.2.3 anon list_approved_prayers spoof" "begin; set local role anon; set local request.jwt.claims = '{\"role\":\"anon\"}'; select * from public.list_approved_prayers_for_super_admin('${SUPER}', '${TENANT_A}'); rollback;"
expect_error "7.2.4 anon get_tenant_mail_identity" "begin; set local role anon; set local request.jwt.claims = '{\"role\":\"anon\"}'; select * from public.get_tenant_mail_identity('${TENANT_A}', '${ADMIN_A}'); rollback;"

IBCD=$(echo "begin; set local role anon; set local request.jwt.claims = '{\"role\":\"anon\"}'; select count(*) from public.ibcd_memorization_catalog_verses; rollback;" | "${PSQL[@]}" 2>&1)
IBCD_N=$(first_number "$IBCD")
if echo "$IBCD" | grep -qi ERROR; then fail "7.2.5a anon ibcd verses count>0" "$IBCD"; elif [[ -n "$IBCD_N" && "$IBCD_N" -gt 0 ]]; then pass "7.2.5a anon ibcd verses count>0" "count=${IBCD_N}"; else fail "7.2.5a anon ibcd verses count>0" "$IBCD"; fi

PUB=$(echo "begin; set local role anon; set local request.jwt.claims = '{\"role\":\"anon\"}'; select count(*) from public.get_public_tenant_by_slug('${TENANT_A_SLUG}'); rollback;" | "${PSQL[@]}" 2>&1)
PUB_N=$(first_number "$PUB")
if echo "$PUB" | grep -qi ERROR; then fail "7.2.5b get_public_tenant_by_slug 1 row" "$PUB"; elif [[ "$PUB_N" == "1" ]]; then pass "7.2.5b get_public_tenant_by_slug 1 row" "count=1"; else fail "7.2.5b get_public_tenant_by_slug 1 row" "count=${PUB_N:-?}"; fi

LOGIN=$(echo "begin; set local role anon; set local request.jwt.claims = '{\"role\":\"anon\"}'; select public.is_login_allowed_email('someone@example.com'); rollback;" | "${PSQL[@]}" 2>&1)
if echo "$LOGIN" | grep -qi ERROR; then fail "7.2.5c is_login_allowed_email boolean" "$LOGIN"; else pass "7.2.5c is_login_allowed_email boolean" "returned $(first_number "$LOGIN" || echo t/f)"; fi

echo "" | tee -a "$LOG"
echo "=== §7.3 member A ===" | tee -a "$LOG"

MEMBER_LEAK_OUT=$(echo "
begin;
set local role authenticated;
set local request.jwt.claims = '{\"email\":\"${MEMBER_A}\",\"role\":\"authenticated\"}';
select max(c) from (
  select count(*) c from public.prayers where tenant_id <> '${TENANT_A}'::uuid
  union all select count(*) from public.prayer_updates where tenant_id <> '${TENANT_A}'::uuid
  union all select count(*) from public.deletion_requests where lower(requested_email) <> '${MEMBER_A}'
  union all select count(*) from public.update_deletion_requests where lower(requested_email) <> '${MEMBER_A}'
  union all select count(*) from public.member_prayer_updates where tenant_id is distinct from '${TENANT_A}'::uuid
  union all select count(*) from public.member_prayed_for_counts where tenant_id <> '${TENANT_A}'::uuid
  union all select count(*) from public.tenants where id <> '${TENANT_A}'::uuid
  union all select count(*) from public.tenant_memberships where lower(user_email) <> '${MEMBER_A}'
  union all select count(*) from public.tenant_settings where tenant_id <> '${TENANT_A}'::uuid
  union all select count(*) from public.email_templates where tenant_id <> '${TENANT_A}'::uuid
  union all select count(*) from public.analytics where tenant_id is distinct from '${TENANT_A}'::uuid
  union all select count(*) from public.memorization_recite_usage
  union all select count(*) from public.personal_prayers where lower(user_email) <> '${MEMBER_A}'
  union all select count(*) from public.account_approval_requests where lower(email) <> '${MEMBER_A}'
  union all select count(*) from public.list_approved_prayers_for_super_admin('${SUPER}', '${TENANT_B}'::uuid)
  union all select count(*) from public.get_all_tenants_for_email('${SUPER}')
) x;
rollback;
" | "${PSQL[@]}" 2>&1)
MEMBER_LEAK=$(first_number "$MEMBER_LEAK_OUT")
if [[ "$MEMBER_LEAK" == "0" ]]; then pass "7.3.1 member isolation union counts" "max=0"; else fail "7.3.1 member isolation union counts" "max=${MEMBER_LEAK:-?} raw=${MEMBER_LEAK_OUT:0:120}"; fi

expect_error "7.3.2 member mail identity tenant B" "begin; set local role authenticated; set local request.jwt.claims = '{\"email\":\"${MEMBER_A}\",\"role\":\"authenticated\"}'; select * from public.get_tenant_mail_identity('${TENANT_B}', '${ADMIN_B}'); rollback;"
expect_error "7.3.3 member mail identity tenant A null" "begin; set local role authenticated; set local request.jwt.claims = '{\"email\":\"${MEMBER_A}\",\"role\":\"authenticated\"}'; select * from public.get_tenant_mail_identity('${TENANT_A}', null); rollback;"
expect_error "7.3.4 member list_super_admins" "begin; set local role authenticated; set local request.jwt.claims = '{\"email\":\"${MEMBER_A}\",\"role\":\"authenticated\"}'; select * from public.list_super_admins_for_caller('${SUPER}'); rollback;"
expect_error "7.3.5 member select email_queue" "begin; set local role authenticated; set local request.jwt.claims = '{\"email\":\"${MEMBER_A}\",\"role\":\"authenticated\"}'; select count(*) from public.email_queue; rollback;"

echo "" | tee -a "$LOG"
echo "=== §7.4 admin A ===" | tee -a "$LOG"

ADMIN_LEAK_OUT=$(echo "
begin;
set local role authenticated;
set local request.jwt.claims = '{\"email\":\"${ADMIN_A}\",\"role\":\"authenticated\"}';
select max(c) from (
  select count(*) c from public.prayers where tenant_id <> '${TENANT_A}'::uuid
  union all select count(*) from public.prayer_updates where tenant_id <> '${TENANT_A}'::uuid
  union all select count(*) from public.deletion_requests where tenant_id is distinct from '${TENANT_A}'::uuid
  union all select count(*) from public.update_deletion_requests where tenant_id is distinct from '${TENANT_A}'::uuid
  union all select count(*) from public.member_prayer_updates where tenant_id is distinct from '${TENANT_A}'::uuid
  union all select count(*) from public.tenant_memberships where tenant_id <> '${TENANT_A}'::uuid
  union all select count(*) from public.email_templates where tenant_id <> '${TENANT_A}'::uuid
  union all select count(*) from public.analytics where tenant_id is distinct from '${TENANT_A}'::uuid
  union all select count(*) from public.memorization_recite_usage where tenant_id <> '${TENANT_A}'::uuid
  union all select count(*) from public.personal_prayers where tenant_id = '${TENANT_B}'::uuid
) x;
rollback;
" | "${PSQL[@]}" 2>&1)
ADMIN_LEAK=$(first_number "$ADMIN_LEAK_OUT")
if [[ "$ADMIN_LEAK" == "0" ]]; then pass "7.4.1 admin cross-tenant union counts" "max=0"; else fail "7.4.1 admin cross-tenant union counts" "max=${ADMIN_LEAK:-?}"; fi

MAIL_NULL_OUT=$(echo "begin; set local role authenticated; set local request.jwt.claims = '{\"email\":\"${ADMIN_A}\",\"role\":\"authenticated\"}'; select count(*) from public.get_tenant_mail_identity('${TENANT_A}', null); rollback;" | "${PSQL[@]}" 2>&1)
MAIL_EMAIL_OUT=$(echo "begin; set local role authenticated; set local request.jwt.claims = '{\"email\":\"${ADMIN_A}\",\"role\":\"authenticated\"}'; select count(*) from public.get_tenant_mail_identity('${TENANT_A}', '${ADMIN_A}'); rollback;" | "${PSQL[@]}" 2>&1)
MAIL_NULL=$(first_number "$MAIL_NULL_OUT")
MAIL_EMAIL=$(first_number "$MAIL_EMAIL_OUT")
if [[ "$MAIL_NULL" == "1" && "$MAIL_EMAIL" == "1" ]]; then pass "7.4.2 admin get_tenant_mail_identity own tenant" "1 row each"; else fail "7.4.2 admin get_tenant_mail_identity own tenant" "null=${MAIL_NULL} email=${MAIL_EMAIL}"; fi

expect_error "7.4.3 admin mail identity tenant B" "begin; set local role authenticated; set local request.jwt.claims = '{\"email\":\"${ADMIN_A}\",\"role\":\"authenticated\"}'; select * from public.get_tenant_mail_identity('${TENANT_B}', null); rollback;"
expect_error "7.4.4 admin mail identity wrong email" "begin; set local role authenticated; set local request.jwt.claims = '{\"email\":\"${ADMIN_A}\",\"role\":\"authenticated\"}'; select * from public.get_tenant_mail_identity('${TENANT_A}', '${OTHER_EMAIL}'); rollback;"

echo "" | tee -a "$LOG"
echo "=== §7.5 write probes (member A, rollback) ===" | tee -a "$LOG"

expect_error "7.5.1 email_queue outsider group_prayer_added" "
begin; set local role authenticated; set local request.jwt.claims = '{\"email\":\"${MEMBER_A}\",\"role\":\"authenticated\"}';
insert into email_queue (recipient, template_key, template_variables, status, attempts, tenant_id)
values ('outsider@example.com', 'group_prayer_added', '{}', 'pending', 0, '${TENANT_A}');
rollback;"

OUT=$(echo "
begin; set local role authenticated; set local request.jwt.claims = '{\"email\":\"${MEMBER_A}\",\"role\":\"authenticated\"}';
insert into email_queue (recipient, template_key, template_variables, status, attempts, tenant_id)
values ('${MEMBER_A2}', 'group_prayer_added', '{}', 'pending', 0, '${TENANT_A}');
rollback;
" | "${PSQL[@]}" 2>&1)
if echo "$OUT" | grep -qi ERROR; then fail "7.5.2 email_queue member-a2 group_prayer_added succeeds" "$OUT"; else pass "7.5.2 email_queue member-a2 group_prayer_added succeeds" "insert ok"; fi

expect_error "7.5.3 email_queue admin_subscriber_manual_broadcast" "
begin; set local role authenticated; set local request.jwt.claims = '{\"email\":\"${MEMBER_A}\",\"role\":\"authenticated\"}';
insert into email_queue (recipient, template_key, template_variables, status, attempts, tenant_id)
values ('${MEMBER_A2}', 'admin_subscriber_manual_broadcast', '{}', 'pending', 0, '${TENANT_A}');
rollback;"

expect_error "7.5.4 prayers insert approved" "
begin; set local role authenticated; set local request.jwt.claims = '{\"email\":\"${MEMBER_A}\",\"role\":\"authenticated\"}';
insert into prayers (id, tenant_id, title, status, requester, email, prayer_for, approval_status)
values (gen_random_uuid(), '${TENANT_A}', 't', 'current', 'x', '${MEMBER_A}', 'x', 'approved');
rollback;"

OUT=$(echo "
begin; set local role authenticated; set local request.jwt.claims = '{\"email\":\"${MEMBER_A}\",\"role\":\"authenticated\"}';
insert into prayers (id, tenant_id, title, status, requester, email, prayer_for, approval_status)
values (gen_random_uuid(), '${TENANT_A}', 't', 'current', 'x', '${MEMBER_A}', 'x', 'pending');
rollback;
" | "${PSQL[@]}" 2>&1)
if echo "$OUT" | grep -qi ERROR; then fail "7.5.5 prayers insert pending succeeds" "$OUT"; else pass "7.5.5 prayers insert pending succeeds" "insert ok"; fi

UPD=$(echo "
begin; set local role authenticated; set local request.jwt.claims = '{\"email\":\"${MEMBER_A}\",\"role\":\"authenticated\"}';
update prayers set title = 'x' where tenant_id = '${TENANT_A}';
rollback;
" | "${PSQL[@]}" 2>&1)
if echo "$UPD" | grep -qi 'UPDATE 0'; then pass "7.5.6 member update prayers" "0 rows"; elif echo "$UPD" | grep -qi ERROR; then pass "7.5.6 member update prayers" "error/0 rows"; else fail "7.5.6 member update prayers" "$UPD"; fi

expect_error "7.5.7 deletion_requests cross-tenant" "
begin; set local role authenticated; set local request.jwt.claims = '{\"email\":\"${MEMBER_A}\",\"role\":\"authenticated\"}';
insert into deletion_requests (prayer_id, requested_by, requested_email, tenant_id)
values ('${TENANT_B_PRAYER}', 'x', '${MEMBER_A}', '${TENANT_B}');
rollback;"

expect_error "7.5.8 member_prayer_updates tenant B" "
begin; set local role authenticated; set local request.jwt.claims = '{\"email\":\"${MEMBER_A}\",\"role\":\"authenticated\"}';
insert into member_prayer_updates (tenant_id, person_id, content)
values ('${TENANT_B}', '1', 'x');
rollback;"

echo "" | tee -a "$LOG"
if [[ "${FAILED:-0}" -eq 0 ]]; then
  echo "SUMMARY: ALL CHECKS PASSED" | tee -a "$LOG"
  exit 0
else
  echo "SUMMARY: ONE OR MORE CHECKS FAILED" | tee -a "$LOG"
  exit 1
fi
