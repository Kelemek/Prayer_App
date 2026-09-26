# Setup & Deployment Guide

Complete guide to setting up, configuring, and deploying the Prayer App.

## Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Email Configuration](#email-configuration)
5. [Deployment](#deployment)
6. [Post-Deployment](#post-deployment)

---

## Local Development Setup

### Prerequisites

- Node.js 18+ and npm 9+
- Git
- Supabase account (free tier available)
- [Resend](https://resend.com) account (for transactional and bulk email)

### Installation

```bash
# Clone repository
git clone https://github.com/your-org/Prayer_App.git
cd Prayer_App

# Install dependencies
npm install

# Start development server
npm run dev

# Navigate to http://localhost:5173
```

### Database Migrations

Migrations are run automatically. To manually migrate:

```bash
# Using Supabase CLI
supabase db push

# Or through Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Run supabase/migrations/20260123140820_remote_schema.sql (single consolidated migration)
```

### PWA Icons & Favicon

The app uses a PWA (Progressive Web App) with custom icons. To regenerate icons:

1. **Prepare source image**
   - Save your image as `public/icon-source.png`
   - Should be square and at least 1024px × 1024px

2. **Install sharp** (if not already installed):
   ```bash
   npm install --save-dev sharp
   ```

3. **Generate icons**
   ```bash
   npm run generate-icons
   ```

This creates the following files:
- `public/icons/icon-192.png` - PWA home screen icon
- `public/icons/icon-512.png` - PWA splash screen icon
- `public/icons/maskable-icon-512.png` - Maskable PWA icon
- `public/apple-touch-icon.png` - iOS home screen icon
- `public/favicon-32.png` - Standard favicon
- `public/favicon-16.png` - Alternative favicon

The PWA manifest (`public/manifest.json`) and `src/index.html` reference these files automatically.

---

## Environment Configuration

### Create `.env.local`

```bash
# Supabase (Dashboard → Settings → API Keys)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# Public app URL (platform apex — links in emails and production builds)
# VITE_APP_URL=https://prayer.romans8.net

# Host-based tenancy (production / staging)
# VITE_PLATFORM_HOSTS=prayer.romans8.net,www.prayer.romans8.net,prayerapp-nu.vercel.app,prayerapp.romans8.net
# VITE_COOKIE_PARENT_DOMAIN=.prayer.romans8.net
# VITE_TENANT_HOST_SUFFIX=prayer.romans8.net

# PostHog (optional — product analytics, session replay, error tracking)
# VITE_POSTHOG_KEY=phc_...
# VITE_POSTHOG_HOST=https://us.i.posthog.com
# VITE_POSTHOG_UI_HOST=https://us.posthog.com
```

**Analytics:** Tenant admins use **Site Analytics** in the admin portal (first-party Supabase `page_view` data). **PostHog** is for platform operators only (product analytics, replay, exceptions). Leave `VITE_POSTHOG_KEY` empty to disable PostHog. Vercel Analytics / Speed Insights are not used.

**PostHog consent (geo-gated):** Vercel sets a first-party cookie via `GET /api/geo` (`prayerapp.analytics_geo`, from `x-vercel-ip-country`). Visitors in the **EU, UK, or EEA (IS/LI/NO)** get the consent banner and default **opt-out** until Accept (`prayerapp.analytics_consent` in localStorage). All other regions load with analytics and session recording on (no banner). VPN/proxy may report a different country. Capacitor native apps call `https://prayerapp.romans8.net/api/geo` (or `VITE_APP_URL` when set). Local `ng serve` has no geo API—fail-open unless you set the cookie manually for EU testing. Session recording in the PostHog project UI is separate ops; the app still gates recording behind Accept in consent regions.

**Hostname strategy:** Platform hosts (`prayer.romans8.net`, `www`, preview aliases) do **not** force a tenant. Church tenants load at `{slug}.{VITE_TENANT_HOST_SUFFIX}` (e.g. `cross-pointe.prayer.romans8.net`). `VITE_COOKIE_PARENT_DOMAIN` shares Supabase auth across those subdomains. Local dev leaves suffix/cookie empty (in-place tenant switcher on `localhost`).

### Supabase secret key (server-side)

Use the **Secret** API key from **Dashboard → Settings → API Keys** (usually `sb_secret_...`). That is what Supabase recommends instead of the legacy **service_role** JWT; both still work with `@supabase/supabase-js`, but **prefer Secret** for new setup and rotation.

| Where | Environment / Vault name | What to paste |
|--------|---------------------------|----------------|
| Local scripts, GitHub Actions | `SUPABASE_SECRET_KEY` | Secret key |
| Hosted Edge Functions (Dashboard → Edge Function secrets) | `SUPABASE_SERVICE_ROLE_KEY` | **Same** Secret key (Supabase keeps this variable name on the platform) |
| Vault for `pg_cron` → Edge (see below) | `service_role_key` | **Same** Secret key (name is historical) |

Do not put the Secret key in any `VITE_*` variable or client bundles.

### GitHub Secrets

For GitHub Actions to work, add these secrets (still required for workflows that invoke Supabase, e.g. backup/restore):

```
SUPABASE_URL
SUPABASE_SECRET_KEY   # Dashboard Secret key (sb_secret_...), not the publishable key
RESEND_API_KEY
MAIL_SENDER_ADDRESS
MAIL_FROM_NAME (optional; defaults to Prayer Ministry)
GITHUB_PAT (for workflow dispatch)
VAPID_PUBLIC_KEY (for push notifications, if enabled)
VAPID_PRIVATE_KEY
```

---

## Database Setup

### Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Save connection string and API keys
4. Copy to `.env.local`

### Run Migrations

```bash
# Option 1: Via Supabase CLI
npm install -g supabase
supabase db push

# Option 2: Via Supabase Dashboard
# SQL Editor > Run migrations manually
```

### User reminder jobs (Vault + pg_cron + dispatcher)

Migration [`supabase/migrations/20260914183751_dispatch_user_reminders.sql`](../supabase/migrations/20260914183751_dispatch_user_reminders.sql) registers a single job **`invoke-dispatch-user-reminders`** (`*/15 * * * *` UTC) that POSTs to **`dispatch-user-reminders`**, which invokes reminder Edge Functions **sequentially** (prayer hourly → memorization hourly → prayer-item) so PostgREST is not stamped by parallel crons. Hourly phases run only on the **UTC :00** tick; per-prayer item reminders run every 15 minutes.

Older jobs (`invoke-user-hourly-prayer-reminders`, `invoke-user-hourly-memorization-reminders`, `invoke-user-prayer-item-reminders`) are unscheduled by that migration. Historical context: [`20260123140820_remote_schema.sql`](../supabase/migrations/20260123140820_remote_schema.sql) originally registered hourly prayer reminders via **`pg_net`** + **`pg_cron`**.

**1. Create Vault secrets** (Supabase Dashboard → **Project Settings** → **Vault**, or SQL Editor). Required names:

| Secret name | Value |
|---------------|--------|
| `project_url` | Your project API URL, e.g. `https://YOUR_PROJECT_REF.supabase.co` (no trailing slash) |
| `service_role_key` | **Secret** key (`sb_secret_...`) from **Settings → API Keys** — same value as `SUPABASE_SECRET_KEY`. (Legacy `service_role` JWT still works if you have not migrated; prefer Secret.) Vault name is historical. |

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('YOUR_SUPABASE_SECRET_KEY', 'service_role_key');
```

If these already exist from another setup, do not duplicate them—only the names must match.

**2. Extensions**: If `supabase db push` fails on `CREATE EXTENSION`, enable **pg_net** and **pg_cron** in the Dashboard (**Database → Extensions**) and re-run the migration or apply the SQL from the migration file manually.

**3. Verify manually** (after secrets exist):

```sql
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1)
    || '/functions/v1/dispatch-user-reminders',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 360000
);

-- After a few seconds, inspect the HTTP result (status should be 200 if the function succeeded):
select id, status_code, content, error_msg
from net._http_response
order by created desc
limit 5;
```

Confirm logs in **Supabase → Edge Functions → dispatch-user-reminders → Logs** (and phase functions as needed). Cron check:

```sql
select jobname, schedule from cron.job
where jobname like 'invoke-%reminder%' or jobname = 'invoke-dispatch-user-reminders';
```

To test a single phase without the dispatcher, invoke that function from the Dashboard (e.g. `send-user-hourly-prayer-reminders`). To force hourly phases off the :00 tick, POST `{"forceHourly": true}` to `dispatch-user-reminders`.

### Community prayer reminders (`send-prayer-reminders`)

The consolidated migration (section *Former file: 20260317120000_schedule_send_prayer_reminders_cron.sql*) registers a **daily** job (`invoke-send-prayer-reminders`, **`0 10 * * *` UTC**) that POSTs to the Edge Function **`send-prayer-reminders`** (reminder emails + auto-archive per `tenant_settings`). Uses the **same Vault secrets** as above (`project_url`, `service_role_key`).

**Verify manually** (after secrets exist):

```sql
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1)
    || '/functions/v1/send-prayer-reminders',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 300000
);

select id, status_code, content, error_msg
from net._http_response
order by created desc
limit 5;
```

Check **Edge Functions → send-prayer-reminders → Logs**. Confirm schedule: `select * from cron.job where jobname = 'invoke-send-prayer-reminders';`

### Device token cleanup (`cleanup-device-tokens`)

The consolidated migration (section *Former file: 20260318120000_schedule_cleanup_device_tokens_cron.sql*) registers a **daily** job (`invoke-cleanup-device-tokens`, **`0 3 * * *` UTC**) that POSTs to the Edge Function **`cleanup-device-tokens`** (stale `device_tokens` and old `push_notification_log` rows). Uses the **same Vault secrets** (`project_url`, `service_role_key`).

**Verify manually** (after secrets exist):

```sql
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url' limit 1)
    || '/functions/v1/cleanup-device-tokens',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 120000
);

select id, status_code, content, error_msg
from net._http_response
order by created desc
limit 5;
```

Confirm schedule: `select * from cron.job where jobname = 'invoke-cleanup-device-tokens';`

### Database Tables

Key tables created by migrations:

- `prayers` - Prayer requests
- `prayer_updates` - Prayer status updates
- `prayer_deletion_requests` - Deletion requests
- `tenant_memberships` - Per-church membership, email/push prefs, unsubscribe token
- `email_queue` - Email processing queue
- `admin_users` - Admin access list
- `tenant_settings` - Per-church configuration (branding, prayer policies, reminders, outbound mail identity)
- `admin_settings` - Platform-only singleton (app test account + optional `min_web_build` / `min_native_version`); super-admin writes only. Legacy GitHub PAT columns are dropped by `20260913160000_restrict_github_feedback_columns.sql`. In-app feedback uses Edge Function `submit-feedback` + `NOTION_TOKEN`. Force-upgrade ops: [client-version-gate.md](client-version-gate.md).
- `email_templates` - Email HTML templates
- `tenant_integrations` - Per-church integration flags (Planning Center metadata only; secrets are not stored here)

### Planning Center (optional, Church plan)

Apply migration `supabase/migrations/20260920120000_planning_center_vault.sql` before enabling the feature.

1. **Church admin** — Admin → Settings → **Integrations**: paste the church’s Planning Center OAuth **App ID** and **Secret** (write-only), test, then enable.
2. **Storage** — Credentials live in Supabase **Vault** as `pco_<tenant_uuid>` (JSON). Only Edge Functions call service-role RPCs (`pco_vault_put` / `pco_vault_get` / `pco_vault_delete`). Do **not** put PCO secrets in `tenant_settings`, `VITE_*` env vars, or client code.
3. **Edge Functions** — Deploy `planning-center-credentials`, `planning-center-lookup`, and `planning-center-lists` (`./scripts/deploy-functions.sh` or per-function deploy). JWT required; church `plan_tier` must be `churches`.
4. **Wipe** — `wipe_church_tenant` deletes the Vault secret `pco_<tenant_id>` before removing the tenant row.

---

## Email Configuration

### Resend setup

1. **Account and domain**
   - Sign up at [Resend](https://resend.com) and add your sending domain.
   - Add the DNS records Resend provides until the domain shows as verified.

2. **API key**
   - Create an API key in the Resend dashboard.
   - Store it as **`RESEND_API_KEY`** in **Supabase** → Project Settings → Edge Functions → Secrets (required for `send-email` and `trigger-email-processor`).

3. **From address**
   - Set **`MAIL_SENDER_ADDRESS`** to a sender address on your verified domain (e.g. `noreply@yourdomain.com`). This is the **platform fallback** From address.
   - Optionally set **`MAIL_FROM_NAME`** (display name; defaults to `Prayer Ministry` if omitted).
   - Each church can override display name and the local-part (`crosspointe@yourdomain.com`) plus an optional Reply-To in **Admin → Email → Sending identity**. Overrides must stay on the same verified domain as `MAIL_SENDER_ADDRESS`. Custom sending domains / per-tenant Resend keys are not in this pass.
   - Leave a tenant’s fields blank to keep sending as `MAIL_FROM_NAME` / `MAIL_SENDER_ADDRESS`.

4. **Deploy**
   - After changing secrets, redeploy **`send-email`** and **`trigger-email-processor`** Edge Functions so they pick up `RESEND_API_KEY` and mail env vars.

5. **HTTPS unsubscribe (one-click)**
   - Run migrations so `tenant_memberships` has `unsubscribe_token` and `email_templates` footers include `{{unsubscribe_url}}` where applicable.
   - Deploy the **`email-unsubscribe`** Edge Function (`./scripts/deploy-functions.sh email-unsubscribe` or `all`). It uses **`verify_jwt: false`**; the secret is the per-row `unsubscribe_token`.
   - Set **`APP_URL`** on the **`send-email`** function (same host as your web app) so **`send_to_all_subscribers`** can substitute readable unsubscribe links in bulk HTML. If unset, the footer uses the Supabase function URL.
   - Optionally set **`APP_URL`** on **`email-unsubscribe`** for consistent copy in the standalone HTML response.
   - **Latency:** Pretty links (`/unsubscribe?token=…`) load the SPA first, then **POST** to the Edge function (the browser may send a CORS preflight first). The first Edge request after idle can add a **cold-start** delay. For the fastest click-to-done from email only, point footer links at `…/functions/v1/email-unsubscribe?token=…` (skips the SPA hop and shows the function’s HTML page).

### Email Templates

Templates are stored in Supabase `email_templates` table:

- `prayer_submitted` - Confirmation when prayer submitted
- `prayer_approved` - Notification when admin approves prayer
- `prayer_denied` - Notification when admin denies prayer
- `prayer_answered` - Notification when prayer marked answered
- `update_approved` - Notification for approved updates
- `subscriber_welcome` - Welcome to email list
- `account_approval_request`, `account_approved`, `account_denied` — church access-request notifications (seeded by `20260927120000_tenant_access_requests.sql` where missing). Admin approval emails use the tenant subdomain login link.
- Edge Function **`tenant-access`** — authenticated `check_pco`, `join_pco`, and `request` actions for non-members. Requires user JWT. Secrets: `APP_URL` (platform origin), `TENANT_HOST_SUFFIX` (e.g. `prayer.romans8.net`), plus the usual `SUPABASE_*` keys. Deploy with `supabase functions deploy tenant-access --no-verify-jwt` **before** promoting a client build that calls it.

### Supabase Auth login OTP (Magic Link template)

Site login uses **`auth.signInWithOtp`** (not `send-verification-code`). Customize the message in **Supabase Dashboard → Authentication → Email Templates → Magic Link**.

- **Subject:** `Your verification code`
- **Body:** copy from [`supabase/templates/auth-magic-link.html`](../supabase/templates/auth-magic-link.html) (green header `#10b981`, matches Cross Pointe `verification_code` styling). Use Supabase variable **`{{ .Token }}`** for the OTP — not `{{code}}`.
- **OTP length must be 6:** Dashboard → **Authentication** → **Sign In / Providers** → **Email** → set **Email OTP length** to **6**. The login UI and `verifyAdminLoginCode` only accept six digits; a shorter Auth setting (e.g. 4) will send codes that fail verification. This is separate from tenant `verification_code_expiry_minutes` / `send-verification-code`.
- Expiry: **Email OTP expiration** on the same Email provider panel (your template can say “expires in 1 hour” if that matches the setting).
- Optional: add `<p><a href="{{ .ConfirmationURL }}">Or sign in with this link</a></p>` under the code if you want a magic link; the app normally expects the user to enter the code.

Prayer / MFA flows that call **`send-verification-code`** still use tenant `email_templates` (`verification_code`) or the indigo fallback in that Edge Function.

### Email Queue Processing

Pending rows in `email_queue` are drained by the **`trigger-email-processor`** Edge Function (invoked from the app after enqueue). It sends via Resend **`POST /emails/batch`**: up to **100** messages per request, **one recipient per message** (no BCC), with a short pause between batch requests. Honor **`RESEND_API_KEY`** and **`MAIL_SENDER_ADDRESS`** on Edge Function secrets; redeploy `trigger-email-processor` after changing them.

---

## In-app feedback (Notion)

Authenticated users submit feedback from Settings (and Admin → Tools). The browser calls Edge Function **`submit-feedback`** with the user JWT. The function stores contact info in Postgres **`feedback_submissions`** (service role only), then creates a Notion task with **Submission ID** only (no email or name on the Notion page). Resolve email for ops or Grok via RPC **`get_feedback_submission_contact(submission_id)`** (service role). Tokens never live in `admin_settings` or the Angular client. If `NOTION_TOKEN` is unset, the function reports `{ configured: false }` (never the secret) and the app hides the feedback UI entirely — that is how the feature is turned off.

**Notion database:** Add a **Submission ID** (rich text) property to Biz Feedback. You can remove or stop using **Email** and **User name** on new tasks. Apply migration `20260914120000_feedback_submissions_minimal.sql` before deploy.

### Edge Function secrets

Set on **Supabase → Edge Functions → Secrets**:

| Secret | Used by |
|--------|---------|
| `NOTION_TOKEN` | `submit-feedback` (required). Internal integration token with insert access to Biz Feedback. |
| `NOTION_FEEDBACK_DATA_SOURCE_ID` | Optional. Defaults to `ad60c0ea-da0e-4a36-be18-b395c7bcb564` (Prayer App Biz Feedback). Do not point this at Cross Pointe or Gospel Site issue databases. |

Deploy with JWT verification on (default):

```bash
./scripts/deploy-functions.sh submit-feedback
```

Apply `supabase/migrations/20260913160000_restrict_github_feedback_columns.sql` when ready (drops legacy `github_*` / `enabled` from `admin_settings` and leftover `tenant_settings` copies). Deploy the Angular cutover and `submit-feedback` first. After cutover, **rotate/revoke** any GitHub PAT that lived in `admin_settings`.

---

## Account data export (`export_user_account`)

Settings **Download my data** calls RPC **`export_user_account()`** (JWT / authenticated role). Apply migration **`20260923120000_export_user_account.sql`**. No Edge Function. See [account-export.md](account-export.md).

## Account erasure (`delete-account`)

Settings **Delete account** calls Edge Function **`delete-account`** (JWT required). Apply migration **`20260914090000_erase_user_account.sql`** before deploy.

```bash
./scripts/deploy-functions.sh delete-account
```

| Secret | Used by |
|--------|---------|
| `STRIPE_SECRET_KEY` | Optional. Best-effort delete of **Pro/personal** Stripe customers only (never church tenant customers). |
| `POSTHOG_PERSONAL_API_KEY` | Optional. PostHog person delete API. |
| `POSTHOG_PROJECT_ID` | Optional. Project id for person delete (e.g. `438838`). |

See [account-erasure.md](account-erasure.md) for DB table inventory, anonymize vs wipe modes, **Retention / hygiene**, and manual ops (Notion Feedback, GitHub Issues, Stripe leftovers).

---

## Church tenant wipe (`wipe-church-tenant`)

Admin **Delete church** calls Edge Function **`wipe-church-tenant`** (JWT required). Apply migration **`20260918120000_wipe_church_tenant.sql`** before deploy.

```bash
./scripts/deploy-functions.sh wipe-church-tenant
```

| Secret | Used by |
|--------|---------|
| `STRIPE_SECRET_KEY` | Optional. Cancel/delete **church** Stripe customer only (never Pro). |

See [church-tenant-wipe.md](church-tenant-wipe.md) for matrix vs member erase, DB detach rules, and Stripe test-mode manual checks.

---

## Stripe (Church + Pro billing)

Web-only Stripe Checkout and Customer Portal. Native apps do not show buy/manage UI in-app; church admins and Pro subscribers may open the system browser for **Billing & invoices** (Stripe Customer Portal: invoices, payment method, cancel). Church and Pro acquisition on native is **tour → email a web link**; web tours start Checkout. Church tenants are created only after payment, on `/church-setup`.

**Quotas vs billing:** Group and member caps are **hard-enforced** in Postgres RPCs (`create_prayer_group`, `invite_prayer_group_member`). The app may show **soft warnings** near ~80% usage; those are client-only. Super-admin **Platform usage** (Tenant Manager) reads `list_platform_quota_usage_for_super_admin` from migration `20260919120000_platform_quota_usage.sql` — apply on prayer-test before verifying numbers. Pro portal calls `stripe-billing-portal` with JSON body `kind: "pro"`; deploy that function after changing it.

`stripe-church-checkout` is **dual-mode**: omit `tenant_id` for the pay-first user-scoped path (success/cancel `/church-setup?church_checkout=`). Pass `tenant_id` only for **legacy incomplete** church tenants (success/cancel `/admin?church_checkout=`).

### Edge Function secrets

Set on **Supabase → Edge Functions → Secrets** (test mode until you explicitly go live):

| Secret | Used by |
|--------|---------|
| `STRIPE_SECRET_KEY` | `stripe-church-checkout`, `stripe-pro-checkout`, `stripe-billing-portal`, `send-billing-signup-email` |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` |
| `STRIPE_CHURCH_PRICE_ID` | Church Checkout + signup email display |
| `STRIPE_PRO_PRICE_ID` | Pro Checkout + signup email display |
| `STRIPE_CHURCH_PRICE_DISPLAY` | Optional fallback if Stripe Price retrieve fails |
| `STRIPE_PRO_PRICE_DISPLAY` | Optional fallback if Stripe Price retrieve fails |
| `APP_URL` | Checkout/portal return URLs and signup email links (match `VITE_APP_URL`) |
| `STRIPE_PORTAL_CONFIGURATION_ID` | Optional Customer Portal configuration |

Do **not** put Stripe secrets in `VITE_*` or client bundles. There is a **single** Church Price ID and a **single** Pro Price ID (no month/year picker in app code).

### Deploy functions

```bash
./scripts/deploy-functions.sh stripe-church-checkout
./scripts/deploy-functions.sh stripe-pro-checkout
./scripts/deploy-functions.sh stripe-billing-portal
./scripts/deploy-functions.sh stripe-webhook
./scripts/deploy-functions.sh reconcile-church-billing
./scripts/deploy-functions.sh send-billing-signup-email
```

`stripe-webhook` and `reconcile-church-billing` use `--no-verify-jwt` (Stripe / pg_cron invoke with service role).

Email templates `church_signup_web` and `pro_signup_web` are seeded by `20260911120000_billing_signup_pay_first.sql` (commit in repo; apply when ready). Signup mail uses **platform From** (no `tenantId` on `send-email`).

### Stripe Dashboard (test)

1. **Webhook** endpoint: `https://<project>.supabase.co/functions/v1/stripe-webhook`
2. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` (optional: `invoice.paid`, `invoice.payment_failed`)
3. Enable **customer emails** for failed payments, upcoming invoices, and cancellations (complements in-app past_due mail from the app).

### Database migration

Apply `supabase/migrations/20260910180000_church_stripe_lifecycle.sql` before enabling Church billing in production. It adds tenant Stripe IDs, past_due grace (`admin_settings.church_past_due_grace_days`), webhook idempotency, and the hourly `invoke-reconcile-church-billing` cron job (requires Vault `project_url` + `service_role_key` like other cron jobs).

Apply `supabase/migrations/20260911120000_billing_signup_pay_first.sql` for pay-first Church/Pro leads (`billing_signup_leads`), `complete_church_setup_for_user`, and signup email templates. Commit that file in the repo; apply when ready.

### Church billing behavior

- **Past due:** Church features stay on for `church_past_due_grace_days` (super-admin editable in Tenant Manager). Then downgrade to `free`.
- **Cancel at period end:** Access until Stripe `current_period_end`, then downgrade (not the past_due grace clock).
- **PCI:** Stripe-hosted Checkout/Portal only; store customer/subscription IDs and plan status—never card data.

---

## Deployment

### Vercel Deployment

#### Step 1: Connect to Vercel

```bash
npm install -g vercel
vercel login
vercel link
```

#### Step 2: Configure Environment

1. Go to Vercel dashboard
2. Project settings > Environment Variables
3. Add frontend variables (Vite requires the `VITE_` prefix), e.g. `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

Example:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_APP_URL=https://prayer.romans8.net
VITE_PLATFORM_HOSTS=prayer.romans8.net,www.prayer.romans8.net,prayerapp-nu.vercel.app
VITE_COOKIE_PARENT_DOMAIN=.prayer.romans8.net
VITE_TENANT_HOST_SUFFIX=prayer.romans8.net
VITE_POSTHOG_KEY=phc_...
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_POSTHOG_UI_HOST=https://us.posthog.com
# Email (Resend) uses Supabase Edge secrets and GitHub Actions, not Vercel env for send-email.
```

#### Step 3: Configure Build

```bash
# Build command
npm run build

# Output directory
dist
```

#### Step 4: Deploy

```bash
# Deploy to staging
vercel

# Deploy to production
vercel --prod
```

### GitHub Actions Automation

Push to `main` branch automatically deploys to Vercel via GitHub Actions.

---

## Post-Deployment

### Verify Installation

- [ ] App loads at your domain
- [ ] Can submit prayer request
- [ ] Admin can login and approve
- [ ] Email notifications send

### Configure Domain

1. Go to Vercel project settings
2. Domains > Add domain
3. Add the platform apex (`prayer.romans8.net`) and a **wildcard** (`*.prayer.romans8.net`) for church subdomains
4. Point DNS to Vercel (apex `A`/`CNAME` + wildcard `CNAME` to Vercel)
5. Existing `vercel.json` SPA rewrite handles all subdomains — no per-host rewrites needed

### Supabase Auth (hostname / redirects)

In **Authentication → URL configuration**:

- **Site URL:** `https://prayer.romans8.net` (platform apex)
- **Redirect URLs (allowlist):** include at least:
  - `http://localhost:4200/**`
  - `https://prayer.romans8.net/**`
  - `https://www.prayer.romans8.net/**`
  - `https://*.prayer.romans8.net/**`
  - `https://prayerapp-nu.vercel.app/**` (preview)

Auth sessions on `*.{suffix}` use cookie domain `VITE_COOKIE_PARENT_DOMAIN` (e.g. `.prayer.romans8.net`). Preview hosts on `*.vercel.app` stay on per-origin `localStorage` — list them in `VITE_PLATFORM_HOSTS` so they do not force a tenant slug.

### SSL Certificate

Vercel automatically provides free SSL. No additional setup needed.

### Monitoring

- **Vercel**: Analytics and Speed Insights in the project dashboard
- **Supabase**: Monitor database at project dashboard

### Backups

Supabase backs up daily. To restore:

1. Go to Supabase project
2. Database > Backups
3. Select backup and restore

---

## Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json .next dist
npm install
npm run build
```

### Email Not Sending

1. Check pending queue: `SELECT id, recipient, attempts, last_error, created_at FROM email_queue WHERE status = 'pending' ORDER BY created_at LIMIT 50;`
2. Check logs: Supabase Dashboard → Edge Functions → **`trigger-email-processor`**
3. Verify **Resend** (`RESEND_API_KEY`) and **`MAIL_SENDER_ADDRESS`** in Supabase Edge Function secrets
4. Check email templates exist in database

---

## Next Steps

- Read [FEATURES.md](FEATURES.md) to learn all features
- Read [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
- Read [DEVELOPMENT.md](DEVELOPMENT.md) if you'll be coding
