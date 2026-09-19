# Account data export (Settings)

Engineering path for self-serve, machine-readable export. Not legal advice.

## App flow

1. Signed-in user opens Settings → **Download my data**.
2. Angular calls RPC **`export_user_account()`** with the user JWT (no arguments).
3. The function binds to **`auth.uid()`** and **`current_user_email()`** only. A caller cannot request another user’s package.
4. The browser downloads `prayer-app-data-export-YYYY-MM-DD.json`.

Printable personal prayers (Settings → Print → Personal) are **not** a substitute.

## Inventory

Coverage matches **`erase_user_account`** / [account-erasure.md](account-erasure.md) for user-keyed rows:

| Section | Contents |
|---------|----------|
| **account** | Auth user id, email, created/last-sign-in timestamps |
| **memberships** | Every `tenant_memberships` row for that user (all churches), plus tenant name/slug |
| **preferences** | Per-tenant notification / view / encouragement prefs, personal categories, reminder slots |
| **prayers** | Authored church / personal / group prayers and updates |
| **groups** | The user’s group memberships and groups they created (not other members) |
| **memorization** | Memorized items and recite usage |
| **billing** | Pro `user_subscriptions` and `billing_signup_leads` (invite/checkout **tokens omitted**) |
| **other** | Roles, invites, feedback, deletion requests, device metadata, analytics, outbound mail metadata, churches they created |

**Omitted secrets:** verification codes, push device tokens, invite/lead tokens, unsubscribe tokens.

**Never included:** other users’ prayers or memberships, church Stripe customers, other group members.

## Scoping

- No `p_user_id` / email arguments.
- Granted to **`authenticated`** (and `service_role` for ops). Revoked from `anon` / `public`.
- Multi-church members get memberships and authored rows across every tenant they belong to.

## Deploy

Apply migration **`20260923120000_export_user_account.sql`**. No Edge Function.

## Manual check

1. Sign in as a throwaway user who belongs to two churches and has a personal prayer plus a church prayer.
2. Settings → Download my data. Confirm the JSON `scope.email` matches the session and `memberships` lists both churches.
3. Confirm another user’s email does not appear under `user_email` / `author_email` / `email` fields (except `invited_by_email` on an invite they received).
