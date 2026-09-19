# Church tenant wipe (admin delete church)

Engineering path for church / tenant end-of-life. Not legal advice.

**Member self-serve erase** is separate: see [account-erasure.md](account-erasure.md). It removes the person and must never wipe the church or church Stripe.

## Product matrix

| Action | Auth users | Personal prayers / groups | Church tenant + church content | Pro Stripe | Church Stripe |
|--------|------------|---------------------------|----------------------------------|------------|---------------|
| Member delete-account | deleted | keep or wipe per mode | untouched | delete Pro customers | untouched |
| Church cancel (Stripe only) | keep | keep | tenant remains; features follow `tenantHasChurchFeatures` | n/a | cancel / period end |
| Church wipe (this path) | keep | keep | deleted | keep if Pro | cancel + delete customer |

Cancel subscription in the Customer Portal does **not** wipe the tenant. v1 wipe is a separate, explicit admin action (manual only; no auto-wipe on Stripe webhook).

## App flow

1. Church `tenant_admin` or platform `super_admin` opens Admin → Settings → Security → **Delete church** (or Tenant Manager for super-admin).
2. Confirms by typing the church **slug**.
3. Angular calls Edge Function **`wipe-church-tenant`** with JWT (`tenant_id`, `confirm_slug`).
4. Edge verifies authz, ends church Stripe (cancel active subscription if needed, then delete customer), calls RPC **`wipe_church_tenant`** (service role only).
5. Client refreshes tenant context, navigates home; members keep logins.

## Database (migration `20260918120000_wipe_church_tenant.sql`)

**Deleted with tenant (CASCADE):** memberships, invites, settings, church prayers/updates/prompts/types, email templates, church memorization catalog, custom domains, booklet pages, tenant-scoped reminders for community/prompt items, etc.

**Detached before delete (kept for users):** `personal_prayers`, `memorized_items`, `personal_categories`, personal `user_prayer_item_reminders`, `user_memorization_hour_reminders` → `tenant_id` set null where applicable.

**Never deleted:** `auth.users`, `user_subscriptions` (Pro), `global_roles`, prayer groups / group prayers, other tenants, `default-tenant`.

**Downgrade:** After memberships for this church are removed, each former member without active Pro and without another church membership (`user_is_church_member`) is on Free platform limits. No Auth delete.

Audit: `tenant_wipe_events` (no FK to `tenants`).

## Third-party ops

| System | Automated in Edge | Notes |
|--------|-------------------|--------|
| **Stripe** | Cancel church subscription if active; `DELETE` church `stripe_customer_id`. Requires `STRIPE_SECRET_KEY`. Never Pro customer IDs. | Use test mode for verification. |
| **PostHog** | Not automated on wipe | Org-level analytics may retain historical events. |

## Deploy

Apply migration **`20260918120000_wipe_church_tenant.sql`** before deploy.

```bash
./scripts/deploy-functions.sh wipe-church-tenant
```

| Secret | Used by |
|--------|---------|
| `STRIPE_SECRET_KEY` | Optional. Church customer end only. |

Also deploy an updated **`stripe-webhook`** if webhook no-op for missing tenant is not yet live.

## Manual test plan (Stripe test mode)

1. Create throwaway church + two members (one Pro, one Free) with personal prayers on that church context.
2. Wipe as `tenant_admin`. Confirm: church gone from admin; both users can log in; personal prayers remain; Free user on Free limits; Pro user still Pro; church Stripe customer gone in Dashboard (test mode).
3. Regression: member **delete-account** still does not delete church tenant or church Stripe.
