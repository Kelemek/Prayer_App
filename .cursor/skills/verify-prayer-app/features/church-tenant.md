# Church join and setup

Church join and setup lets a signed-in user accept an invite, paste an invite token, or start pay-first Church checkout and name the church after payment.

## Sub-features

- `church-demo` shows the Church tab empty state `See Church features or join` for a user without a church.
- `church-join-modal` opens the chooser and the invite-token field.
- `church-join-link` claims `/join/:token` when the signed-in email matches the invite.
- `church-setup-pay` shows `/church-setup` with `Continue to payment` before a tenant exists.
- `church-setup-name` shows Church name + web address + `Create church` after `paid_pending_setup`.
- `church-setup-pending-banner` shows `You're paid — finish church setup on the web` on home when setup is still pending.

## How to get to it (user POV)

- Home → Church tab (`#tour-filter-public`) → `See Church features or join` → `Join a church`.
- Open an invite URL `/join/<token>` (redirects to login if signed out, then back with `returnUrl`).
- Navigate to `/church-setup` (guarded). After Stripe success the query is `?church_checkout=success`.
- Home banner `Open setup` / `Copy link` when paid but unnamed.

## Driving it with Playwright

Preconditions:

- Signed in (see [Sign in](./auth-login.md)).
- `bin/doctor --instance` is READY.
- For `church-join-link`: `PRAYER_APP_VERIFY_JOIN_TOKEN` is an unused invite for the same email. Skip if unset.
- For `church-setup-name`: the user already has `paid_pending_setup`. Do not create a live church on production.
- Do not click through Stripe Checkout unless the project is prayer-test and Stripe is in test mode.

- **Church tab.** From home, choose `Church`. Run `page.locator('#tour-filter-public').click()`. The Church tab is selected.
- **Demo CTA.** If the empty church preview is shown, choose `See Church features or join`. Run `page.getByRole('button', { name: 'See Church features or join' }).click()`. A dialog heading for church onboarding appears with `See Church features` and `Join a church`.
- **Join token field.** Choose `Join a church`. Run `page.getByRole('button', { name: 'Join a church' }).click()`. A textbox labelled `Invite token` appears. Cancel with `Back` unless you have a disposable token.
- **Claim invite.** Open `/join/<token>`. Run `page.goto(base + '/join/' + token)`. Heading is `Join <church>` or `Join church`. When ready, the primary button is `Join <church>` or `Claim invite`. After a successful claim a toast `Invite claimed successfully` appears and the URL is `/`.
- **Mismatch.** If the page says the invite is for another email, choose `Sign in as <invitee>`. Do not claim as the wrong user.
- **Setup unpaid.** Open `/church-setup`. Run `page.goto(base + '/church-setup')`. Heading `Church setup`. Unpaid web copy includes `Subscribe on the web to create your church` and button `Continue to payment`.
- **Stop at Stripe.** If proving checkout wiring only, click `Continue to payment` and assert navigation to a `checkout.stripe.com` URL or a toast `Could not start checkout`. Do not enter a card on production.
- **Name church.** On `paid_pending_setup`, fill `Church name` and `Church web address`. Run `page.getByLabel('Church name').fill('Verify Church ' + runId)` and `page.getByLabel('Church web address').fill('verify-church-' + runId)`. Wait until `This web address is available.` then choose `Create church`.
- **Proof.** Screenshot the chooser or `/church-setup` heading plus the unique CTA you used. Record whether Stripe or join was skipped and why.

## Gotchas

- `/church-setup` and `/join/:token` redirect to login when anonymous. Complete [Sign in](./auth-login.md) first.
- Pay-first means no tenant exists until payment is confirmed. `Create church` is not shown on the unpaid screen.
- Slug checks debounce. Do not submit while `Checking availability…` is showing.
- Native (Capacitor) hides `Continue to payment` and shows `Email me a link to set up`. This skill drives the web app only.
- Claiming a real unused invite mutates membership. Use a prayer-test invite, not a production church.
- `church_checkout=success` on `/admin` is the legacy incomplete-tenant path. The current pay-first success path is `/church-setup?church_checkout=success`.
