# Prayer list and request

Prayer list and request lets a signed-in user browse Church / Groups / Personal / Memorize, open a new request, save a personal or church prayer, and see it on the matching list.

## Sub-features

- `prayer-tabs` switches Church, Personal, Groups (when allowed), and Memorize.
- `prayer-open-form` opens the `New Prayer Request` dialog from header `Request`.
- `prayer-personal-save` saves a personal prayer without admin approval.
- `prayer-church-save` submits a church prayer and shows the pending-approval success copy.
- `prayer-list-card` shows a card heading `Prayer for <name>` after save.
- `prayer-cancel` closes the dialog with `Close prayer form dialog` without creating a row.

## How to get to it (user POV)

- Home `/` after sign-in (default list).
- Header `Request` (desktop `#tour-btn-new-prayer-request-desktop`, mobile `#tour-btn-new-prayer-request-mobile`).
- Filter tabs `#tour-filter-public`, `#tour-filter-personal`, `#tour-filter-groups`, `#tour-filter-memorize`.

## Driving it with Playwright

Preconditions:

- Signed in (see [Sign in](./auth-login.md)).
- `bin/doctor --instance` is READY.
- Viewport ≥ 640px so the desktop `Request` button is shown.
- Use `prayer_for` = `verify-prayer-app <run-id>`. Prefer **personal** visibility so the item appears without an admin approve.
- Do not submit church prayers to a production congregation.

- **Home list.** After login, land on `/`. Run `page.waitForURL(u => !u.pathname.endsWith('/login'))`. Header `Request` and tab `Church` are visible.
- **Personal tab.** Choose `Personal`. Run `page.locator('#tour-filter-personal').click()`. The Personal tab is selected.
- **Open form.** Choose `Request`. Run `page.locator('#tour-btn-new-prayer-request-desktop').click()`. A dialog named with heading `New Prayer Request` appears. Focus is available on `Prayer For`.
- **Fill personal.** Type the unique name and details, then choose personal visibility. Run `page.getByLabel('Prayer For').fill('verify-prayer-app ' + runId)`, `page.getByLabel('Prayer Request Details').fill('Verification personal prayer')`, and `page.getByRole('button', { name: 'Select personal prayer - private, no approval needed' }).click()`.
- **Submit personal.** Choose `Submit Prayer Request`. Run `page.getByRole('button', { name: 'Submit prayer request' }).click()`. Button text becomes `Submitting...` then `Submitted`, or the dialog closes. A personal card heading `Prayer for verify-prayer-app <run-id>` is on the Personal list.
- **Church path (optional).** Reopen the form, choose `Select church prayer - requires admin approval`, submit. Status `Prayer request submitted successfully!` and copy `Your request is pending admin approval` appear. The church list will **not** show it until an admin approves.
- **Cancel.** Open the form, fill `Discard me`, choose `Close prayer form dialog`. Run `page.getByRole('button', { name: 'Close prayer form dialog' }).click()`. No card `Prayer for Discard me` appears.
- **Proof.** Screenshot Personal tab with the unique heading visible (`prayer-personal.png`) and keep the text dump. Re-open Personal after visiting Church to prove the row persisted.

## Gotchas

- Rich text may be on. `getByLabel('Prayer Request Details')` still works; do not require a raw `textarea#description`.
- Church prayers need admin approval. A missing church card after submit is expected, not a product bug.
- Groups tab is hidden without group access. Do not fail `prayer-tabs` if `#tour-filter-groups` is absent.
- Header `Request` on small viewports is `#tour-btn-new-prayer-request-mobile`. Resize or use that id.
- `npm run test` watch mode is not a list proof. Closest unit stand-in: `npx vitest --run src/app/components/prayer-form/prayer-form.component.spec.ts src/app/pages/home/home.component.spec.ts`.
- The memorize keyboard bridge (`data-testid="memorize-keyboard-bridge"`) is hidden. Do not tab into it.
- Native app icon badges (Capacitor iOS/Android) mirror the in-app Current + Answered + Prompts counts, summed across every church membership. Web Drive cannot prove the home-screen number. Opening the app must not clear it; clearing happens only when those badged prayer surfaces are marked read.
