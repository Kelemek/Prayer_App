# Client version gate (force upgrade)

Use this only for **breaking** deploys (removed Edge Functions, auth/schema that old shells cannot call). Do **not** raise the floor on every release.

## Source of truth

Platform singleton `admin_settings` (`id = 1`):

| Column | Compared to | Typical value |
| --- | --- | --- |
| `min_web_build` | Web JS `APP_BUNDLE_VERSION` (`src/lib/app-analytics-context.ts`) on **browser and native WebView** | semver or build, e.g. `1.1` |
| `min_native_version` | **Store binary** version from `@capacitor/app` `App.getInfo().version` (iOS `MARKETING_VERSION` / Android `versionName`) | e.g. `1.12` |

Clients read **`get_public_client_min_versions()`** (anon + authenticated). `NULL` or blank means **no floor** — current users stay in the app. Fetch errors fail open.

## How to bump the floor

1. Ship the breaking web/native build with `APP_BUNDLE_VERSION` **raised** in that same release (so new JS clients pass the JS gate).
2. For a breaking **native plugin or shell** change, ship a new store binary and raise `min_native_version` to match `App.getInfo().version`.
3. After that build is live, set only the surface that broke:

```sql
-- Web/JS breaking change (browser + native when on live site or bundled fallback)
update public.admin_settings
set min_web_build = '1.1', updated_at = now()
where id = 1;

-- Store binary breaking change (plugins, Capacitor config users cannot get via web deploy)
update public.admin_settings
set min_native_version = '1.12', updated_at = now()
where id = 1;
```

4. To roll back a mistaken floor:

```sql
update public.admin_settings
set min_web_build = null, min_native_version = null, updated_at = now()
where id = 1;
```

Super-admins can also `update public.admin_settings` through the SQL editor. There is no in-app admin form on purpose — raising the floor is rare.

## What users see

- **JS floor (`min_web_build`):** **Update required** with **Refresh this page**. Boot may auto-reload once per tab/session via `maybeAutoReloadWebOnce`. On native **bundled** origin while offline, copy asks the user to connect before refreshing.
- **Binary floor (`min_native_version`):** **Update required** with **Update the app** (App Store / Play). Takes precedence when both floors would block.

PostHog event (when capture is allowed): `client_upgrade_required` with `surface`, `upgrade_kind`, `platform`, `client_version`, `min_version`.

## Local verify

Defaults must not show the gate. Preview the wall without touching the database (non-production only):

`http://127.0.0.1:4200/info?force_upgrade=1`

Do not set `min_web_build` on the shared paid/dev project while other people are using it.
