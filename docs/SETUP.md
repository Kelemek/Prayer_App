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

For GitHub Actions to work, add these secrets (still required for workflows that invoke Supabase, e.g. `process-email-queue`, backup/restore):

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

### User hourly prayer reminders (Vault + pg_cron)

The consolidated migration [`supabase/migrations/20260123140820_remote_schema.sql`](../supabase/migrations/20260123140820_remote_schema.sql) (section *Former file: 20260316130000_schedule_user_hourly_prayer_reminders_cron.sql*) enables **`pg_net`** and **`pg_cron`** and registers an hourly job (`invoke-user-hourly-prayer-reminders`, `0 * * * *` UTC) that POSTs to the Edge Function `send-user-hourly-prayer-reminders` using secrets from **Supabase Vault** (same behavior as the former GitHub Action).

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
    || '/functions/v1/send-user-hourly-prayer-reminders',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1)
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 120000
);

-- After a few seconds, inspect the HTTP result (status should be 200 if the function succeeded):
select id, status_code, content, error_msg
from net._http_response
order by created desc
limit 5;
```

Confirm the Edge Function logs in **Supabase → Edge Functions → send-user-hourly-prayer-reminders → Logs**. Optionally `select * from cron.job where jobname = 'invoke-user-hourly-prayer-reminders';` to confirm the schedule.

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
- `email_subscribers` - Email opt-in/out
- `email_queue` - Email processing queue
- `admin_users` - Admin access list
- `tenant_settings` - Per-church configuration (branding, prayer policies, reminders, outbound mail identity)
- `admin_settings` - Platform-only singleton (app test account); super-admin writes only. Legacy GitHub PAT columns are dropped by `20260913160000_restrict_github_feedback_columns.sql`. In-app feedback uses Edge Function `submit-feedback` + `NOTION_TOKEN`.
- `email_templates` - Email HTML templates

---

## Email Configuration

### Resend setup

1. **Account and domain**
   - Sign up at [Resend](https://resend.com) and add your sending domain.
   - Add the DNS records Resend provides until the domain shows as verified.

2. **API key**
   - Create an API key in the Resend dashboard.
   - Store it as **`RESEND_API_KEY`** in:
     - **Supabase** → Project Settings → Edge Functions → Secrets (required for the `send-email` function)
     - **GitHub** repository secrets (required for the `process-email-queue` workflow)

3. **From address**
   - Set **`MAIL_SENDER_ADDRESS`** to a sender address on your verified domain (e.g. `noreply@yourdomain.com`). This is the **platform fallback** From address.
   - Optionally set **`MAIL_FROM_NAME`** (display name; defaults to `Prayer Ministry` if omitted).
   - Each church can override display name and the local-part (`crosspointe@yourdomain.com`) plus an optional Reply-To in **Admin → Email → Sending identity**. Overrides must stay on the same verified domain as `MAIL_SENDER_ADDRESS`. Custom sending domains / per-tenant Resend keys are not in this pass.
   - Leave a tenant’s fields blank to keep sending as `MAIL_FROM_NAME` / `MAIL_SENDER_ADDRESS`.

4. **Deploy**
   - After changing secrets, redeploy the `send-email` Edge Function so it picks up `RESEND_API_KEY`.

5. **HTTPS unsubscribe (one-click)**
   - Run migrations so `email_subscribers` has `unsubscribe_token` and `email_templates` footers include `{{unsubscribe_url}}` where applicable.
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
- `tenant_invite` - Transactional member invite with `/join/:token` link (Admin → Tenant Manager). Seeded by `20260910220000_tenant_invite_email.sql` (apply that migration before relying on the DB template; the app falls back to inline copy if the row is missing). Uses per-tenant Sending identity when `tenantId` is passed to `send-email`.

### Email Queue Processing

Email queue is processed by GitHub Actions workflow:

```yaml
# .github/workflows/process-email-queue.yml
# Runs every 5 minutes
# Processes up to 20 emails per run
# Uses Resend; pacing helps stay within plan rate limits
```

---

## In-app feedback (Notion)

Authenticated users submit feedback from Settings (and Admin → Tools). The browser calls Edge Function **`submit-feedback`** with the user JWT. The function writes a row to the Prayer App Biz **Feedback** Notion database. Tokens never live in `admin_settings` or the Angular client. If `NOTION_TOKEN` is unset, the function reports `{ configured: false }` (never the secret) and the app hides the feedback UI entirely — that is how the feature is turned off.

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

## Stripe (Church + Pro billing)

Web-only Stripe Checkout and Customer Portal. Native apps do not show buy/manage UI in-app; church admins may open the system browser for billing. Church and Pro acquisition on native is **tour → email a web link**; web tours start Checkout. Church tenants are created only after payment, on `/church-setup`.

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

1. Check email queue: `SELECT * FROM email_queue WHERE status = 'failed'`
2. Check logs: GitHub Actions > process-email-queue workflow
3. Verify **Resend** (`RESEND_API_KEY`) and **`MAIL_SENDER_ADDRESS`** in Supabase Edge secrets and GitHub Actions secrets
4. Check email templates exist in database

---

## Next Steps

- Read [FEATURES.md](FEATURES.md) to learn all features
- Read [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
- Read [DEVELOPMENT.md](DEVELOPMENT.md) if you'll be coding
