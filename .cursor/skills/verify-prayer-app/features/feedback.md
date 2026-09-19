# Send feedback

Send feedback lets a signed-in user open Settings, choose a feedback type, and send a suggestion, feature request, or bug report to the development team when the server has feedback configured.

## Sub-features

- `feedback-open` reveals the `Send Feedback` card in Settings when configured.
- `feedback-hidden` hides the card when `submit-feedback` reports `{ configured: false }`.
- `feedback-type` selects `Suggestion`, `Feature Request`, or `Bug Report`.
- `feedback-submit` sends title + description and shows `Thank you for your feedback!`.
- `feedback-error` shows `Error sending feedback` when the function fails.
- `feedback-admin` embeds the same form under Admin tools (optional second entry).

## How to get to it (user POV)

- Home → Settings (`#tour-btn-settings-desktop` or `#tour-btn-settings-mobile`) → scroll to `Send Feedback`.
- Help tour topic Feedback (`help_feedback`) focuses `#tour-settings-feedback-section`.
- Admin → tools → Send Feedback (same `app-feedback-form`).

## Driving it with Playwright

Preconditions:

- Signed in (see [Sign in](./auth-login.md)).
- `bin/doctor --instance` is READY.
- Feedback UI is present only if Edge Function `submit-feedback` has `NOTION_TOKEN`. If the card is missing, record `feedback-hidden` and stop — do not invent a submit.
- If you submit, use title `verify-prayer-app <run-id>` so the row is identifiable. Do not spam Notion.

- **Open Settings.** Choose Settings. Run `page.locator('#tour-btn-settings-desktop').click()`. Heading `Settings` is visible. Close control is `Close settings`.
- **Find form.** Scroll to `#tour-settings-feedback-section`. Run `page.locator('#tour-settings-feedback-section').scrollIntoViewIfNeeded()`. Heading `Send Feedback` and label `Feedback Type` are visible.
- **Skip if hidden.** If that section is absent, write `feedback-skipped.txt` with `configured: false or section not rendered` and stop.
- **Choose type.** Choose `Bug Report`. Run `page.getByRole('radio', { name: 'Bug Report' }).click()`. `aria-checked` is `true` on that radio.
- **Fill.** Type a unique title and description. Run `page.locator('#feedbackTitle').fill('verify-prayer-app ' + runId)` and `page.locator('#feedbackDescription').fill('Verification-only feedback; ignore.')`.
- **Send.** Choose `Send Feedback`. Run `page.getByRole('button', { name: 'Send Feedback' }).click()`. Button shows `Sending...`, then alert `Thank you for your feedback!` with `Your submission has been received and will be reviewed by our team.`
- **Proof.** Screenshot Settings with the success alert (`feedback-success.png`) and the matching text dump. A unit stand-in without Notion: `npx vitest --run src/app/components/feedback-form/feedback-form.component.spec.ts src/app/lib/feedback-notion-mapping.spec.ts`.

## Gotchas

- `isConfigured()` fails open to `true` on network errors, but a missing `NOTION_TOKEN` returns `{ configured: false }` and hides the form. Hidden form ≠ broken Settings.
- Submit writes Postgres `feedback_submissions` and a Notion Prayer App Biz Feedback row. Do not use this path to file real product bugs during a Drive unless asked.
- Title max 100, description max 1000. The submit button stays disabled while either field is blank.
- Admin tools feedback is the same component. Proving Settings is enough unless the change was admin-only.
- Do not call `submit-feedback` with a real user payload from curl in CI; the configured-check body `{ configuredCheck: true }` is the API-only probe.
