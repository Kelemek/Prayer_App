---
name: verify-prayer-app
description: Drive the Prayer App Angular web UI (localhost ng serve, not Capacitor) to prove a change before promoting to https://prayerapp.romans8.net. Use when verifying login, church join/setup, prayer list/request, Stripe billing, or in-app feedback.
---

# Verify Prayer App

Agent-facing control skill for **Prayer_App** (Kelemek/Prayer_App). The user-facing surface is the **Angular 21 standalone web app**. Capacitor iOS/Android and Vercel production are out of band: do not treat a native build or `https://prayerapp.romans8.net` as this skill's instance.

Read `features/README.md` before driving. Prove the mapped feature you were asked to verify. A convenient public page is not a substitute for a mapped authenticated path.

## Interview facts (do not rediscover)

- **Start command (source of truth):** `package.json` → `npm start` → `ng serve`. Ready when `http://127.0.0.1:4200/info` returns the Angular index. Default port **4200**.
- **Stale docs:** `docs/SETUP.md` still says `npm run dev` and port **5173**. That script does not exist. Ignore it.
- **Env:** local `ng serve` compiles `src/environments/environment.ts` (already has a Supabase URL + publishable key). `.env.example` `VITE_*` vars are for `scripts/write-prod-environment.mjs` / production builds, not required to boot locally. `.env.local` is optional.
- **Auth:** `/`, `/admin`, `/presentation`, `/church-setup`, `/join/:token` use `siteAuthGuard`. Unauthenticated visits redirect to `/login?returnUrl=...`. Public: `/info`, `/login`, `/privacy`, `/terms`, `/support`, `/unsubscribe`.
- **Login:** email + OTP. Platform **test account** (Admin → Test Account) skips email and uses a fixed 6-digit code. New emails can hit **Complete Registration** / admin approval.
- **Backend:** hosted Supabase. Two local ports share the same remote data unless `environment.ts` points at different projects. Never mutate production. Never apply migrations to production.
- **No in-repo E2E harness.** Drive with Playwright (`bin/drive`) or the same selectors through a browser. Unit tests are Vitest (`npx vitest --run`). `npm test` is watch mode — do not use it for Doctor.

## Launch

Use the helper. It writes a pid file and refuses a second process on the same run id / port.

```bash
cd /path/to/Prayer_App
export PRAYER_APP_VERIFY_RUN_ID="${PRAYER_APP_VERIFY_RUN_ID:-verify1}"
export PRAYER_APP_VERIFY_HOST=127.0.0.1
export PRAYER_APP_VERIFY_PORT=4200
.cursor/skills/verify-prayer-app/bin/launch
```

Ready when the script prints `Ready. Angular is serving http://127.0.0.1:4200` and `curl -fsS http://127.0.0.1:4200/info` succeeds.

Equivalent raw command (only if you must):

```bash
npx ng serve --host 127.0.0.1 --port 4200
```

Wait for the compile to finish, then `curl -fsS http://127.0.0.1:4200/info`.

**Teardown** is `bin/cleanup` for the same `PRAYER_APP_VERIFY_RUN_ID`. Never `pkill ng` / `pkill node`.

**Second instance:** set `PRAYER_APP_VERIFY_PORT=4300` and a new `PRAYER_APP_VERIFY_RUN_ID`. Ports isolate the UI only. Both instances talk to the same Supabase project in `environment.ts`. Do not run two mutating Drives against the same tenant.

**Refuse** `PRAYER_APP_VERIFY_BASE_URL` on `prayerapp.romans8.net` or `prayer.romans8.net`. Those helpers exit 2.

## Doctor

Run this first whenever launch, port, or auth looks off.

```bash
# Checkout only (deps, env.ts, not production)
.cursor/skills/verify-prayer-app/bin/doctor

# After launch
PRAYER_APP_VERIFY_RUN_ID=verify1 .cursor/skills/verify-prayer-app/bin/doctor --instance

# Optional unit gate (slow)
.cursor/skills/verify-prayer-app/bin/doctor --unit
```

A READY instance has:

- Node 18+ and `node_modules/@angular/cli`
- `environment.ts` `supabaseUrl` not a placeholder
- `BASE_URL` not a production host
- `--instance`: recorded pid alive, `/info` and `/login` HTTP 200, port listening
- Authenticated Drive also needs `PRAYER_APP_VERIFY_EMAIL` + `PRAYER_APP_VERIFY_OTP` (test-account code). Doctor notes when those are missing; it does not fail.

Manual equivalent:

```bash
node -v
test -d node_modules/@angular/cli
curl -fsS http://127.0.0.1:4200/info | grep -E 'app-root|Prayer'
curl -fsS http://127.0.0.1:4200/login >/dev/null
npx vitest --run
```

`npm run lint` is `ng lint`. `angular.json` has no lint architect target; treat lint as informational unless you are specifically verifying lint config.

There is no `typecheck` script. Closest compile check: `npx ng build --configuration development` (slow; writes `dist/`). Do not use production `npm run build` for Doctor — it runs `write-prod-environment.mjs` and can empty `environment.prod.ts` without `VITE_*`.

## Drive

Prefer Playwright through the helper. Selectors below are from this repo, not examples.

```bash
# Public UI + HTTP (no secrets). Proves /info and /login render.
PRAYER_APP_VERIFY_RUN_ID=verify1 .cursor/skills/verify-prayer-app/bin/drive public

# Completes OTP login. Requires PRAYER_APP_VERIFY_EMAIL + PRAYER_APP_VERIFY_OTP.
PRAYER_APP_VERIFY_RUN_ID=verify1 .cursor/skills/verify-prayer-app/bin/drive login

# Ad-hoc screenshot of a route
PRAYER_APP_VERIFY_RUN_ID=verify1 .cursor/skills/verify-prayer-app/bin/drive snapshot --route /support --name support
```

If Playwright is not installed, `drive public` still records HTTP 200s for `/info`, `/login`, `/privacy`, `/terms`, `/support` and writes `browser-skipped.txt`. Install for a full UI proof:

```bash
npm install --no-save playwright
npx playwright install chromium
```

Do not add Playwright to the app `package.json`.

### Stable handles

| User control | Handle |
|---|---|
| Public landing | route `/info`, heading `Prayer Community`, button/link copy `Web Site` |
| Login heading | `Prayer Community` |
| Email | `getByLabel('Email Address')` or `#email` |
| Send OTP | `getByRole('button', { name: 'Send Verification Code' })` |
| OTP field | `#mfa-code-input` (auto-submits when complete) |
| Learn more | link `Learn more about this app` → `/info` |
| Home (authed) | `/` after login; header `Request` `#tour-btn-new-prayer-request-desktop` (viewport ≥ sm) or `#tour-btn-new-prayer-request-mobile` |
| Settings | `#tour-btn-settings-desktop` / `#tour-btn-settings-mobile`, heading `Settings` |
| Search | `#tour-btn-search-desktop`, `aria-controls="home-search-panel"` |
| Church tab | `#tour-filter-public` name `Church` |
| Personal tab | `#tour-filter-personal` |
| Groups tab | `#tour-filter-groups` (only if the user can access groups) |
| Memorize tab | `#tour-filter-memorize` |
| New prayer dialog | role `dialog`, heading `New Prayer Request` |
| Prayer For | `#prayer_for` / `getByLabel('Prayer For')` |
| Details | `getByLabel('Prayer Request Details')` |
| Visibility | `Select personal prayer - private, no approval needed` / `Select church prayer - requires admin approval` |
| Submit prayer | `getByRole('button', { name: 'Submit prayer request' })` |
| Prayer card title | heading `Prayer for <name>` |
| Join church | `/join/:token` heading `Join …` or `Join church`; or home `See Church features or join` → `Join a church` |
| Church setup | `/church-setup` heading `Church setup` |
| Feedback | Settings → `#tour-settings-feedback-section`, radios `Suggestion` / `Feature Request` / `Bug Report`, `#feedbackTitle`, `#feedbackDescription`, button `Send Feedback` |
| Pro billing | Settings heading `Billing`, button `Billing & invoices` (only if the user has a Pro customer) |
| Church checkout | `/church-setup` button `Continue to payment` (web only) |

Use **desktop width ≥ 640px** so the `#tour-btn-*-desktop` header is visible. Mobile uses the `*-mobile` ids and the `Request` / `Pray` short labels.

Playwright one-liners (after launch):

```js
await page.goto('http://127.0.0.1:4200/login');
await page.getByLabel('Email Address').fill(process.env.PRAYER_APP_VERIFY_EMAIL);
await page.getByRole('button', { name: 'Send Verification Code' }).click();
await page.locator('#mfa-code-input').fill(process.env.PRAYER_APP_VERIFY_OTP);
```

### API-only checks (no UI / no secrets)

Use these when Chromium or OTP is unavailable. They do **not** replace a mapped UI Drive.

- `GET ${BASE_URL}/info` and `GET ${BASE_URL}/login` → 200 + HTML containing `app-root`.
- `npx vitest --run` (or targeted `npx vitest --run src/app/pages/login/login.component.spec.ts`).
- Feedback configured probe (needs publishable key + network; does not write Notion): invoke Edge Function `submit-feedback` with `{ "configuredCheck": true }`. `{ configured: false }` means the feedback UI is hidden.
- Do **not** call `stripe-church-checkout` / `stripe-pro-checkout` / `stripe-billing-portal` from CI without Mark's Stripe test secrets and a disposable auth JWT. Do **not** POST `submit-feedback` without an explicit verify title.

## Evidence

Proof artifacts go to `.cursor/skills/verify-prayer-app/artifacts/<run-id>/` (also printed by launch/doctor). Cleanup does **not** delete this directory.

Standards:

- Exercise the real user path (login form, header `Request`, Settings). Do not set session via internal test setters or inject a fake JWT into localStorage unless the feature file says the UI is unreachable.
- Capture the **action** and the **resulting state**. A final home screenshot without the OTP step is not login proof.
- Verify side effects: personal prayer heading `Prayer for …` still present after closing the dialog and switching Personal → Church → Personal; feedback success `Thank you for your feedback!`; church setup success navigates home on a new tenant.
- Mocks are allowed only at production boundaries already isolated (Stripe Checkout hosted page, Resend email). Prefer the test-account OTP so no mailbox is required. Do not complete a live Stripe charge.
- Record feature id + entry point in the artifact names (`login.png`, `home-after-login.png`, `info.txt`).
- UI proof: screenshot with `Prayer Community` / app chrome visible, plus a text dump or ARIA-equivalent (`*.txt`).
- HTTP proof: `public-http.json` status codes.
- Unit proof: `vitest --run` exit code 0 and the spec file names.

## Cleanup

```bash
PRAYER_APP_VERIFY_RUN_ID=verify1 .cursor/skills/verify-prayer-app/bin/cleanup
```

Stops only the pid in `/tmp/prayer-app-verify-<run-id>/ng-serve.pid`. Leaves `artifacts/<run-id>/` in place. After cleanup, confirm those files still exist.

Do not delete seeded church data, Stripe customers, or Notion feedback rows from production. Personal prayers created during a Drive should use a unique `prayer_for` of `verify-prayer-app <run-id>` so they are recognizable. Do not wipe tenants.

## Helpers

All scripts are executable. From the repo root:

| Script | Invocation |
|---|---|
| Launch | `.cursor/skills/verify-prayer-app/bin/launch` |
| Doctor | `.cursor/skills/verify-prayer-app/bin/doctor` · `--instance` · `--unit` |
| Drive | `.cursor/skills/verify-prayer-app/bin/drive public` · `login` · `snapshot --route /info --name info` |
| Cleanup | `.cursor/skills/verify-prayer-app/bin/cleanup` |

Shared defaults live in `.cursor/skills/verify-prayer-app/bin/lib.sh` (`PRAYER_APP_VERIFY_HOST`, `PORT`, `RUN_ID`, `BASE_URL`). `bin/drive` is a wrapper around `bin/drive.mjs`.

## Secrets this skill will not invent

Set these on Mark's machine (or a secret store) before authenticated / billing Drive:

| Variable | Needed for |
|---|---|
| `PRAYER_APP_VERIFY_EMAIL` | OTP login, prayer submit, settings, church join, feedback |
| `PRAYER_APP_VERIFY_OTP` | Completing login (platform test-account 6-digit code) |
| `PRAYER_APP_VERIFY_JOIN_TOKEN` | `/join/:token` claim (optional; a live unused invite) |
| Stripe test keys on the **prayer-test** Edge Functions | `Continue to payment` actually opening Checkout |
| `NOTION_TOKEN` on `submit-feedback` | Feedback form visible + submit success |

Without those, still run Launch + Doctor + `drive public` + `npx vitest --run`.

## Maintenance

When routes, labels, or billing change, update the matching file under `features/` with `/maintain-verification-skill`.
