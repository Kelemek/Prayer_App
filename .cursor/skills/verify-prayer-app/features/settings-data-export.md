# Settings data export

A signed-in user can open Settings and download a JSON package of their own account, authored prayers, preferences, and church memberships. Printable personal prayers are a different control and are not this export.

## Sub-features

- `export-open` shows **Download my data** near the bottom of Settings (above delete account).
- `export-download` starts a JSON file download named `prayer-app-data-export-YYYY-MM-DD.json`.
- `export-busy` shows `Preparing download…` while the RPC runs and disables the button.
- `export-error` surfaces a Settings error when the RPC fails.
- `export-print-distinct` keeps Print → Personal as a printable list, not a full data export.

## How to get to it (user POV)

- Home → Settings (`#tour-btn-settings-desktop` or `#tour-btn-settings-mobile`) → scroll to `#tour-settings-download-data-section`.
- Help topic App Settings (`help_settings`) item **Download my data**.
- Privacy (`/privacy`) section **Your Choices and Rights** mentions Settings → Download my data.

## Driving it with Playwright

Preconditions:

- Signed in (see [Sign in](./auth-login.md)).
- `bin/doctor --instance` is READY.
- Migration `export_user_account` is applied on the Supabase project in `environment.ts`.
- Desktop viewport ≥ 640px.

- **Open Settings.** Choose Settings. Run `page.locator('#tour-btn-settings-desktop').click()`. Heading `Settings` is visible.
- **Find export.** Scroll to the download control. Run `page.locator('#tour-settings-download-data').scrollIntoViewIfNeeded()`. Button name `Download my data` is visible. Copy explains account, prayers, preferences, and memberships.
- **Download.** Choose `Download my data`. Run `const downloadPromise = page.waitForEvent('download'); await page.locator('#tour-settings-download-data').click(); const download = await downloadPromise;`. Suggested filename matches `prayer-app-data-export-*.json`.
- **Proof.** Save the downloaded JSON (or a text dump of `schema_version`, `scope.email`, and `memberships.length`) as `settings-data-export.txt`. Screenshot Settings with the button visible (`settings-data-export.png`). Unit stand-in: `npx vitest --run src/app/lib/user-settings-export-run.spec.ts`.
- **Print is not export.** Settings Print → Prayers → Personal still prints an HTML list. Do not treat a printed HTML list as this feature.

## Gotchas

- The RPC has **no arguments**. A forged user id cannot be sent from the client.
- Theme and text size are device-local and are not in the JSON.
- Verification codes and raw push tokens are omitted on purpose.
- Multi-church members should see every membership they belong to, not only the active tenant.
- Do not drive this against `https://prayerapp.romans8.net`.
