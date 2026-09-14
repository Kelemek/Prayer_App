# Account erasure (Settings delete)

Engineering path for self-serve account deletion. Not legal advice.

## App flow

1. User chooses **keep prayers** or **wipe prayers** in Settings.
2. Angular calls Edge Function **`delete-account`** with JWT (`mode`: `keep_prayers` | `wipe_prayers`).
3. Edge calls RPC **`erase_user_account`** (service role only), then best-effort Stripe/PostHog, then **`auth.admin.deleteUser`**.
4. Client logs out on success only (`PostHog reset` via `AdminAuthService.logout()`).

## Database (migration `20260914090000_erase_user_account.sql`)

**Always deleted:** all `tenant_memberships` (every tenant), `device_tokens`, `push_notification_log`, `verification_codes`, `billing_signup_leads`, `user_subscriptions`, `account_approval_requests`, `tenant_invites`, `email_queue` (recipient), `global_roles`, memorization/reminder tables, `prompt_prayed_for_counts`, `badge_read_receipts`, personal categories/colors, delete-request rows for requester email, group membership (with owner promotion / empty-group delete), user-keyed `analytics` JSON.

**keep_prayers:** anonymize `prayers`, `prayer_updates`, `personal_prayers` (+ updates), `group_prayers`, `group_prayer_updates` (placeholder email `deleted-user@invalid`, name `Deleted user`).

**wipe_prayers:** delete authored rows in those tables.

**Never deleted:** church `tenants`, church Stripe customers, other users’ data. `tenants.created_by_email` anonymized when it matches.

## Third-party ops checklist

| System | Automated in Edge | Manual if needed |
|--------|-------------------|------------------|
| **Stripe** | Deletes **Pro/personal** `stripe_customer_id` from `user_subscriptions` / pro `billing_signup_leads` only (never church tenant customers). Requires `STRIPE_SECRET_KEY`. | Orphan Checkout sessions or customers in Stripe Dashboard. |
| **PostHog** | Person delete when `POSTHOG_PERSONAL_API_KEY` + `POSTHOG_PROJECT_ID` are set on the function. | Otherwise delete person in PostHog UI; client always `reset()` on logout. |
| **Resend** | No durable contact list in-app. | No action. |
| **Notion Feedback** | Not auto-deleted (noisy). | Filter Biz Feedback DB by **Email** and archive/delete rows. |
| **GitHub Issues** | Not auto-deleted. | Historical issues may still contain email/name. |

## Manual test plan (throwaway user)

1. Create a test user with a prayer on a tenant; optional Pro subscription.
2. **Keep prayers:** Settings → delete account but keep prayers. Confirm: Auth user gone, all memberships gone, prayer row remains with anonymized email/name, Network shows `delete-account` only.
3. **Wipe prayers:** New user with prayers → delete all prayers. Confirm authored prayers/updates removed across tenants.
4. Confirm cannot log in as erased user.
