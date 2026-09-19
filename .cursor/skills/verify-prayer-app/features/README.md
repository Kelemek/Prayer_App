# Prayer App verification map

This directory is the maintained source for verifying the user-facing behavior of Prayer App (Angular web). Read the index before driving, then use the matching feature file as the recipe.

## Baseline preconditions

- Node ^22.22.3 on PATH (`nvm use 22.22.3`). Node 22.14.0 cannot start Angular 22.
- Launch with `.cursor/skills/verify-prayer-app/bin/launch` so the instance is at `http://127.0.0.1:4200` (or the `PRAYER_APP_VERIFY_PORT` you chose).
- Run `.cursor/skills/verify-prayer-app/bin/doctor --instance` and require READY, a non-production host, and the recorded pid.
- Use a disposable `PRAYER_APP_VERIFY_RUN_ID`. Put evidence in `.cursor/skills/verify-prayer-app/artifacts/<run-id>/`.
- Public routes (`/info`, `/login`) need no secrets. Home, church, prayer submit, billing, and feedback need `PRAYER_APP_VERIFY_EMAIL` + `PRAYER_APP_VERIFY_OTP` (platform test account).
- Never drive `https://prayerapp.romans8.net` or `https://prayer.romans8.net` for mutations.
- Never drive an ng serve this run did not start (shared port / unknown pid).
- Two ports share one Supabase project. Do not run two mutating Drives at once.

## Driving conventions

- Start every recipe from the baseline unless its preconditions say otherwise.
- Prefer roles, labels, and the `tour-*` / `id` handles in the skill body over CSS position.
- Treat every command as literal. Keep quoted names unchanged.
- Run browser actions through Playwright (`bin/drive` or the same locators in a page).
- Use a desktop viewport (≥ 640px) unless the recipe is the mobile header.
- Restore nothing in production. Mark created prayers as `verify-prayer-app <run-id>`. Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes a text dump (`*.txt`) and a screenshot with Prayer App chrome visible.
- HTTP proof includes URL, status, and a note that the SPA shell is not the logged-in home.
- Mutation proof includes a second user-facing view (reopen the list, reopen Settings).
- Record the feature ID and entry point with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition (usually missing OTP or Stripe/Notion secrets).
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with Playwright` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Sign in](./auth-login.md) covers the public login form, OTP / app-tester code, registration gate, and `/info`.
- [Church join and setup](./church-tenant.md) covers invite claim, in-app join token, and pay-first church setup.
- [Prayer list and request](./prayer-list-request.md) covers home tabs, new request, personal vs church visibility, and list persistence.
- [Billing and Stripe](./billing-stripe.md) covers Church checkout, Pro upgrade, and billing portal — stop before a live charge unless Stripe test mode is confirmed.
- [Send feedback](./feedback.md) covers Settings feedback and the configured-check skip.
- [Client force upgrade](./client-force-upgrade.md) covers the boot min-version wall (absent by default; local `?force_upgrade=1` preview).
