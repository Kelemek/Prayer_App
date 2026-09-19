# Billing and Stripe

Billing and Stripe lets a signed-in user start Church or Pro checkout on the web and, when they already have a Stripe customer, open the customer portal for invoices and payment methods.

## Sub-features

- `billing-church-cta` shows `Continue to payment` on unpaid `/church-setup`.
- `billing-church-admin` shows Admin `Complete Church checkout` or `Billing & invoices` for a church tenant.
- `billing-pro-settings` shows Settings `Billing` / `Billing & invoices` when the user has Pro portal access.
- `billing-pro-quota` shows Groups `See Pro` or `Upgrade to add more groups` near a quota.
- `billing-return` surfaces toasts for `?pro_checkout=success|cancel` and `?church_checkout=success|cancel`.
- `billing-stop-before-charge` confirms Checkout or portal URL without paying.

## How to get to it (user POV)

- `/church-setup` → `Continue to payment` (web).
- Home Groups banner `See Pro` / `See Church`.
- Home church onboarding `See Church features`.
- Settings → `Billing` → `Billing & invoices`.
- Admin portal banner `Billing & invoices` or `Complete Church checkout`.
- Return URLs `/` with `pro_checkout` or `/church-setup` / `/admin` with `church_checkout`.

## Driving it with Playwright

Preconditions:

- Signed in (see [Sign in](./auth-login.md)).
- `bin/doctor --instance` is READY.
- Stripe **test** mode on the prayer-test project if you click Checkout. Skip the click if `STRIPE_SECRET_KEY` / price ids are not known to be test keys.
- Do not open the portal or Checkout against production.

- **Unpaid church.** Open `/church-setup`. Run `page.goto(base + '/church-setup')`. Button `Continue to payment` is visible on web.
- **Checkout attempt (test only).** Choose `Continue to payment`. Run `page.getByRole('button', { name: 'Continue to payment' }).click()`. Either the browser navigates to `checkout.stripe.com` or a toast `Could not start checkout. Please try again.` appears. Capture the URL or toast. Do not type card details on a live price.
- **Cancel return.** Open `/church-setup?church_checkout=cancel`. Run `page.goto(base + '/church-setup?church_checkout=cancel')`. A toast `Church checkout was canceled.` appears.
- **Success return (setup).** Open `/church-setup?church_checkout=success` only if this user actually paid in test mode. Toast `Payment received. Name your church to finish setup.` is the unpaid→paid signal.
- **Pro portal.** Open Settings. Run `page.locator('#tour-btn-settings-desktop').click()`. If a `Billing` heading is present, choose `Billing & invoices`. Run `page.getByRole('button', { name: 'Billing & invoices' }).click()`. A Stripe Customer Portal tab/window opens, or toast `Could not open billing portal. Please try again.`
- **Quota CTA.** On Groups, if `data-testid="groups-near-quota-banner"` is shown, `See Pro` or `See Church` is visible. Clicking `See Pro` starts Pro checkout the same way as Settings — apply the stop-before-charge rule.
- **Proof.** Screenshot `/church-setup` with `Continue to payment`, or Settings with `Billing`. Record the Stripe host if navigation happened. HTTP-only stand-in: do not invent Checkout sessions; report SKIP when secrets are missing.

## Gotchas

- Settings `Billing` is hidden unless `hasProBillingPortal()` is true. Absence is not a regression for a free test user.
- Admin church banner needs a church-plan tenant and `canManage`. A personal-only user will not see it.
- Edge Functions `stripe-church-checkout`, `stripe-pro-checkout`, `stripe-billing-portal`, `stripe-webhook` need `STRIPE_*` secrets. A 500/toast is an environment gap, not proof that the button is missing.
- Native apps email a setup link instead of in-app Checkout. This skill is web-only.
- Never send `STRIPE_SECRET_KEY` through the Angular app. Client proof is the button + destination URL only.
