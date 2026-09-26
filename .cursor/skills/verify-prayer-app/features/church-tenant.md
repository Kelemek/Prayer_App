# Church join and setup

Church join and setup lets a signed-in user **request access** to a church, start pay-first Church checkout, or name the church after payment.

## Sub-features

- `church-demo` shows the Church tab empty state `See Church features or join` for a user without a church.
- `church-join-modal` opens the chooser and the **church web address / short name** field (not invite tokens).
- `church-request-access` drives `/request-access` on a church host or `?church=<slug>` on the platform host.
- `church-setup-pay` shows `/church-setup` with `Continue to payment` before a tenant exists.
- `church-setup-name` shows Church name + web address + `Create church` after `paid_pending_setup`.
- `church-setup-pending-banner` shows `You're paid — finish church setup on the web` on home when setup is still pending.

## How to get to it (user POV)

- Home → Church tab → `See Church features or join` → `Join a church` → enter `{slug}.prayer.romans8.net` or a bare slug.
- On a church subdomain while signed in but not a member: redirected to `/request-access`.
- Legacy `/join/<token>` URLs redirect to `/request-access` on church hosts.
- Navigate to `/church-setup` (guarded). After Stripe success the query is `?church_checkout=success`.

## Driving it with Playwright

Preconditions:

- Signed in (see [Sign in](./auth-login.md)).
- `bin/doctor --instance` is READY.
- **Hosted migrations** for `20260927120000_*` and `20260927121000_*` must be applied on the Supabase project in `environment.ts` before end-to-end request/approve flows work. Without them, only static UI (login shell, modal copy, redirects) can be verified.

- **Church tab.** From home, choose `Church`. Run `page.locator('#tour-filter-public').click()`.
- **Join modal.** Choose `See Church features or join` → `Join a church`. Expect label `Church web address or short name` (not `Invite token`).
- **Request access page.** On localhost: `page.goto(base + '/request-access?church=<slug>')` after sign-in. On church subdomain (when DNS allows): visit `/request-access` directly.
- **Admin queue.** As a church admin, open `/admin` → Accounts. Pending requests show name, email, date, and affiliation after migrations + a submitted request.

## Gotchas

- `/request-access` requires authentication (`siteAuthGuard`).
- `tenant-access` Edge Function must be deployed for PCO auto-join and request notifications.
- Do not use production churches for mutating access-request tests unless explicitly on prayer-test.
