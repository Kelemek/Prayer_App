# Account erasure (Settings delete)

Engineering path for self-serve account deletion. Not legal advice.

## App flow

1. User chooses **keep prayers** or **wipe prayers** in Settings.
2. Angular calls Edge Function **`delete-account`** with JWT (`mode`: `keep_prayers` | `wipe_prayers`).
3. Edge calls RPC **`erase_user_account`** (service role only), then best-effort Stripe/PostHog, then **`auth.admin.deleteUser`**.
4. Client logs out on success only (`PostHog reset` via `AdminAuthService.logout()`).

## Database (migration `20260914090000_erase_user_account.sql`)

**Always deleted:** all `tenant_memberships` (every tenant), `device_tokens`, `push_notification_log`, `verification_codes`, `billing_signup_leads`, `user_subscriptions`, `account_approval_requests`, `tenant_invites`, `email_queue` (recipient), `global_roles`, `feedback_submissions`, memorization/reminder tables, `prompt_prayed_for_counts`, `badge_read_receipts`, personal categories/colors, delete-request rows for requester email, group membership (with owner promotion / empty-group delete), user-keyed `analytics` JSON.

**keep_prayers:** anonymize `prayers`, `prayer_updates`, `personal_prayers` (+ updates), `group_prayers`, `group_prayer_updates` (placeholder email `deleted-user@invalid`, name `Deleted user`).

**wipe_prayers:** delete authored rows in those tables.

**Never deleted:** church `tenants`, church Stripe customers, other users’ data. `tenants.created_by_email` anonymized when it matches.

Church operators can separately **wipe a church tenant** (admin path); that is not member erase. See [church-tenant-wipe.md](church-tenant-wipe.md) for the matrix vs cancel-only billing.

| Action | Auth | Personal prayers/groups | Church tenant | Pro Stripe | Church Stripe |
|--------|------|-------------------------|---------------|------------|---------------|
| Member delete-account | deleted | keep/wipe per mode | untouched | deleted | untouched |
| Church cancel (Stripe) | keep | keep | remains | n/a | cancel |
| Church wipe | keep | keep | deleted | keep if Pro | ended |

## Third-party ops checklist

| System | Automated in Edge | Manual if needed |
|--------|-------------------|------------------|
| **Stripe** | Deletes **Pro/personal** `stripe_customer_id` from `user_subscriptions` / pro `billing_signup_leads` only (never church tenant customers). Requires `STRIPE_SECRET_KEY`. | Orphan Checkout sessions or customers in Stripe Dashboard. |
| **PostHog** | Person delete when `POSTHOG_PERSONAL_API_KEY` + `POSTHOG_PROJECT_ID` are set on the function. | Otherwise delete person in PostHog UI; client always `reset()` on logout. |
| **Resend** | No durable contact list in-app. | No action. |
| **Notion Feedback** | No submitter email/name on Notion (Submission ID only). | No per-user Notion cleanup; erasure deletes `feedback_submissions` in Postgres. User-typed text in Description may still be PII. |
| **GitHub Issues** | Not auto-deleted. | Historical issues may still contain email/name. |

## Manual test plan (throwaway user)

1. Create a test user with a prayer on a tenant; optional Pro subscription.
2. **Keep prayers:** Settings → delete account but keep prayers. Confirm: Auth user gone, all memberships gone, prayer row remains with anonymized email/name, Network shows `delete-account` only.
3. **Wipe prayers:** New user with prayers → delete all prayers. Confirm authored prayers/updates removed across tenants.
4. Confirm cannot log in as erased user.

## Retention / hygiene

Not legal advice. This describes **actual** behavior for active accounts; account erase is documented above and in migration `20260914090000_erase_user_account.sql`.

| Data | While account active | On account erase |
|------|----------------------|------------------|
| **`verification_codes`** | Rows get `expires_at` **15 minutes** after creation (`send-verification-code`). RPC `cleanup_expired_verification_codes()` removes expired rows and used rows older than 1 hour; it runs **opportunistically** when `verify-code` succeeds — **no pg_cron** TTL job. Leftover rows remain until the next verify or erase. | Deleted for the user’s email. |
| **`email_queue`** | Processed by `trigger-email-processor` / queue workers. Rows are **deleted on successful send** and **deleted after max retries** (not kept as a durable `failed` archive). Pending or in-flight rows can remain until processed. **No separate purge cron.** | Rows where `recipient` matches the user are deleted. |
| **`analytics`** (user-keyed) | JSON rows where `event_data.email` or `event_data.user_email` matches the user are retained for product analytics. | Matching rows deleted. |
| **`device_tokens`** / **`push_notification_log`** | Daily **`cleanup-device-tokens`** cron (`0 3 * * *` UTC): stale tokens (`last_seen_at` > 30 days) and old log rows (`sent_at` > 7 days). See [SETUP.md](SETUP.md) (Device token cleanup). | Deleted with erase. |

**PostHog:** Person delete is best-effort from **`delete-account`** when `POSTHOG_PERSONAL_API_KEY` and `POSTHOG_PROJECT_ID` are set; the client always `reset()` on logout. Session replay retention on the Prayer App project (611843) is configured separately (see Notion: Privacy — PostHog deletion + retention). **Analytics consent** is first-party (`prayerapp.analytics_consent`); PostHog capture and replay stay off until the user accepts in the banner or Settings.
