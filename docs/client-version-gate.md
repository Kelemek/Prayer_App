# Client version gate (force upgrade)

Use this only for **breaking** deploys (removed Edge Functions, auth/schema that old shells cannot call). Do **not** raise the floor on every release.

## Source of truth

Platform singleton `admin_settings` (`id = 1`):

| Column | Compared to | Typical value |
| --- | --- | --- |
| `min_web_build` | Web JS `APP_BUNDLE_VERSION` (`src/lib/app-analytics-context.ts`) | semver or build, e.g. `1.1` |
| `min_native_version` | Same bundled `APP_BUNDLE_VERSION` on Capacitor `com.churchprayer.app` | semver or build, e.g. `1.1` |

Clients read **`get_public_client_min_versions()`** (anon + authenticated). `NULL` or blank means **no floor** — current users stay in the app. Fetch errors fail open.

## How to bump the floor

1. Ship the breaking web/native build with `APP_BUNDLE_VERSION` **raised** in that same release (so new clients pass the gate).
2. After that build is live, set only the surface that broke:

```sql
-- Web-only breaking change
update public.admin_settings
set min_web_build = '1.1', updated_at = now()
where id = 1;

-- Native-only breaking change (store build that includes the new JS)
update public.admin_settings
set min_native_version = '1.1', updated_at = now()
where id = 1;
```

3. To roll back a mistaken floor:

```sql
update public.admin_settings
set min_web_build = null, min_native_version = null, updated_at = now()
where id = 1;
```

Super-admins can also `update public.admin_settings` through the SQL editor. There is no in-app admin form on purpose — raising the floor is rare.

## What users see

- **Web:** full-screen **Update required** with the same body as native and one **Refresh this page** button (`window.location.reload()`). The boot path may auto-reload a stale web shell once per tab via `maybeAutoReloadWebOnce`. There is no Hard refresh or service-worker unregister control.
- **Native:** same title and body with **Update the app**, which opens the App Store search or Play listing for `com.churchprayer.app`. No dismiss or "remind me later".

PostHog event (when capture is allowed): `client_upgrade_required` with `surface`, `platform`, `client_version`, `min_version`.

## Local verify

Defaults must not show the gate. Preview the wall without touching the database (non-production only):

`http://127.0.0.1:4200/info?force_upgrade=1`

Do not set `min_web_build` on the shared paid/dev project while other people are using it.
