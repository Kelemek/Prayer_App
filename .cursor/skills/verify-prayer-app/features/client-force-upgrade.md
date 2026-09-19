# Client force upgrade

On boot the web app reads platform min versions. When those floors are unset, the normal UI loads. When the running bundle is below the web floor (or `?force_upgrade=1` on a non-production host), the whole app is replaced by a blocking “Update required” screen with one refresh action.

## Sub-features

- `upgrade-absent` leaves `/info` and `/login` usable when mins are unset.
- `upgrade-preview` shows the blocking wall from `?force_upgrade=1` on local/non-production only.
- `upgrade-refresh` offers one `Refresh this page` button on web.
- `upgrade-no-dismiss` has no close, skip, or “later” control.

## How to get to it (user POV)

- Open `/info` or `/login` after a normal boot (gate should be absent).
- Open `/info?force_upgrade=1` on a local verify instance to preview the wall.

## Driving it with Playwright

Preconditions:

- Prayer App is healthy at `http://127.0.0.1:4200`.
- `bin/doctor --instance` is READY.
- Browser width ≥ 640px.
- Do **not** `update admin_settings.min_web_build` on the shared paid/dev project.

- **Default boot.** Go to `/info`. Run `page.goto(base + '/info')`. Heading includes `Prayer Community` and `force-upgrade-gate` is absent.
- **Login still open.** Go to `/login`. Run `page.goto(base + '/login')`. The email textbox labelled `Email Address` is visible.
- **Preview wall.** Go to the local preview. Run `page.goto(base + '/info?force_upgrade=1')`. Heading `Update required` and `[data-testid="force-upgrade-gate"]` are visible. Body text is `This version of Prayer App is no longer supported. Please update from the App Store or Google Play to keep using the app.` Button `Refresh this page` is visible. `Hard refresh` is absent. There is no close control.
- **Proof.** Save `artifacts/<run-id>/upgrade-absent.png` (`/info` without the query) and `upgrade-preview.png` (`?force_upgrade=1`). Text dumps should include `Prayer Community` vs `Update required`.

## Gotchas

- Raising `min_web_build` on the shared Supabase project strands every local `ng serve` pointed at that project. Use `?force_upgrade=1` only.
- `?force_upgrade=1` is ignored in production builds.
- Native store CTAs are Capacitor-only. This skill drives the Angular web app, not `com.churchprayer.app`.
- HTTP 200 on `/info` is the SPA shell. The gate exists only after client render.
