# Help and tutorials

A signed-in user opens Help from the header, reads topics that match the current UI (Your first week first), and can start either the full guided tour or a single Show me tour that walks the real screen. The public `/support` page points people at Help and Send Feedback, and church admins can invite members from Admin Settings Security.

## Sub-features

- `help-modal` opens `Help & Guidance` from the header ? button with searchable topics.
- `help-guided-tour` starts the full walkthrough from `Take the guided tour` (Welcome popover first).
- `help-section-tour` shows `Show me` on tour-capable topics (Creating Prayers, Memorize) and starts that tour.
- `help-first-week` lists `Your first week` as the first topic with member, join, admin, and roles steps.
- `help-support` renders `/support` with Help, Send Feedback, and admin paths; no placeholder email.
- `help-church-invite` shows `Invite members` on Admin Settings Security and creates a join link.

## How to get to it (user POV)

- Home → header ? button (`title="Help & Guidance"` on desktop, `title="Help"` on mobile).
- Help → `Take the guided tour` next to the title.
- Help → expand `Creating Prayers` or `Memorize` → `Show me`.
- `/support` (public, no sign-in) → `Start in the app` and `Church admins`.
- Admin (Settings footer) → `Settings` tile → `Security` tab → `Invite members`.

## Driving it with Playwright

Preconditions:

- `bin/doctor --instance` is READY.
- `/support` needs no secrets. Everything else needs a signed-in session (see [Sign in](./auth-login.md)).
- `help-church-invite` also needs the test account to be a church admin of the active tenant. If the Admin button is missing from the Settings footer, record the skip and stop.
- Desktop viewport ≥ 640px.
- Do not send a real invite. Use `verify-prayer-app+<run-id>@example.invalid` so the email bounces and nobody joins.

- **Public support.** Go to `/support` signed out. Run `page.goto(base + '/support')`. Heading `Support` and H2s `Start in the app`, `Members`, `Church admins`, `Privacy and terms` are visible. Text contains `Send Feedback` and `Invite members`. Text does not contain `example.com`. Links `/info`, `/privacy`, `/terms` exist. Save `help-support.txt` and `help-support.png`.
- **Open Help.** Sign in, then choose the header ? button. Run `page.getByTitle('Help & Guidance').click()`. Dialog `Help & Guidance` (`#help-modal-title`) is visible with search box `Search help topics`.
- **First topic.** Read the list. Run `page.getByRole('heading', { level: 3 }).first()`. Text is `Your first week`. Expand it with `page.getByRole('button', { name: /Your first week/ }).click()`. Subheadings `For members`, `Join a church`, `For church admins`, `Roles` are visible. No `Show me` inside this topic.
- **Search.** Type `memor` into `Search help topics`. Run `page.getByLabel('Search help topics').fill('memor')`. `Memorize` and `Memorization reminders` remain; `Creating Prayers` is gone. Clear the box and the full list returns.
- **Show me.** Expand `Creating Prayers`. Run `page.getByRole('button', { name: /Creating Prayers/ }).click()` then `page.getByRole('button', { name: 'Show me' }).click()`. The Help dialog closes and a `.driver-popover` appears anchored on the header `Request` button (`#tour-btn-new-prayer-request-desktop`) with a `Open form →` next button. Save `help-section-tour.png`. Close with Escape.
- **Memorize tour.** Reopen Help, expand `Memorize`, choose `Show me`. The popover anchors on `#tour-filter-memorize`. Close with Escape.
- **Guided tour.** Reopen Help and choose `Take the guided tour`. Run `page.locator('#help-modal-guided-tour').click()`. Help closes and a `.driver-popover` titled `Welcome` appears. Save `help-guided-tour.png`. Close with Escape and record that you did not walk every step.
- **Invite members.** Open Settings → `Admin` → `Settings` tile → `Security`. Run `page.getByRole('button', { name: 'Security' }).click()` then `page.locator('#church-member-invite-trigger').click()`. Copy says the link works only for that address and expires after 7 days. `Create invite` is disabled until an email is typed.
- **Create a bounce-only invite.** Type the run email and choose `Create invite`. Run `page.getByLabel('Email address').fill('verify-prayer-app+' + runId + '@example.invalid')` and `page.getByRole('button', { name: 'Create invite' }).click()`. A status box shows either `Invite emailed to ...` or `but the email could not be sent`, and `[data-testid="church-member-invite-link"]` has an `href` containing `/join/`. Save `help-church-invite.png`. Unit stand-ins: `npx vitest --run src/app/components/help-modal src/app/services/help-content.service.spec.ts src/app/components/church-member-invite src/app/pages/support`.

## Gotchas

- Tours run on the real Home screen. `Show me` is hidden for topics with no tour (Your first week, Groups, Memorization reminders). A missing button there is correct, not a bug.
- Section and guided tours wait about 300 ms after Help closes before the popover appears. Use `page.locator('.driver-popover').waitFor()`.
- The Memorize tour needs the Memorize tab button in the DOM. If the tenant hides it, the tour returns without a popover; record the skip.
- Do not walk the full guided tour across Presentation mode; it navigates away and stores a resume queue in `sessionStorage`. Escape on `Welcome` is enough proof.
- `Invite members` writes a `tenant_invites` row and calls the email function. The `@example.invalid` address keeps it inert; still name the run in the address so it can be found.
- Super admins also see the card. Proving it as a super admin does not prove the church-admin path; the `Admin` footer button must come from the tenant role, not the platform role.
- `/support` is a public route. Do not treat the SPA shell there as a signed-in home.
