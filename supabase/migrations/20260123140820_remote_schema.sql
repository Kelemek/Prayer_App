-- Prayer App database schema (single consolidated migration).
-- Combines former baseline `20260123140820_remote_schema.sql` and all follow-up migrations.
-- For fresh installs: `supabase db push` or apply this file once.

drop extension if exists "pg_net";


  create table "public"."account_approval_requests" (
    "id" uuid not null default gen_random_uuid(),
    "email" text not null,
    "first_name" text not null,
    "last_name" text not null,
    "approval_status" text default 'pending'::text,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone default timezone('utc'::text, now()),
    "affiliation_reason" text
      );


alter table "public"."account_approval_requests" enable row level security;


  create table "public"."admin_settings" (
    "id" integer not null default 1,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "reminder_interval_days" integer default 7,
    "require_email_verification" boolean default false,
    "verification_code_length" integer default 6,
    "verification_code_expiry_minutes" integer default 15,
    "app_title" text default 'Church Prayer Manager'::text,
    "app_subtitle" text default 'Keeping our community connected in prayer'::text,
    "enable_auto_archive" boolean default false,
    "days_before_archive" integer default 7,
    "enable_reminders" boolean default false,
    "use_logo" boolean not null default false,
    "light_mode_logo_blob" text,
    "dark_mode_logo_blob" text,
    "deletions_allowed" text default 'everyone'::text,
    "updates_allowed" text default 'everyone'::text,
    "inactivity_timeout_minutes" integer default 30,
    "max_session_duration_minutes" integer default 480,
    "db_heartbeat_interval_minutes" integer default 1,
    "require_site_login" boolean not null default false,
    "github_token" text,
    "github_repo_owner" text default ''::text,
    "github_repo_name" text default ''::text,
    "enabled" boolean default false
      );


alter table "public"."admin_settings" enable row level security;


  create table "public"."analytics" (
    "id" uuid not null default gen_random_uuid(),
    "event_type" text not null,
    "event_data" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default timezone('utc'::text, now())
      );


alter table "public"."analytics" enable row level security;


  create table "public"."approval_codes" (
    "id" uuid not null default gen_random_uuid(),
    "code" character varying(255) not null,
    "admin_email" character varying(255) not null,
    "approval_type" character varying(50) not null,
    "approval_id" uuid not null,
    "created_at" timestamp with time zone default now(),
    "expires_at" timestamp with time zone not null,
    "used_at" timestamp with time zone
      );


alter table "public"."approval_codes" enable row level security;


  create table "public"."backup_logs" (
    "id" uuid not null default gen_random_uuid(),
    "backup_date" timestamp with time zone not null,
    "status" text not null,
    "tables_backed_up" jsonb,
    "total_records" integer,
    "error_message" text,
    "duration_seconds" integer,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."backup_logs" enable row level security;


  create table "public"."deletion_requests" (
    "id" uuid not null default gen_random_uuid(),
    "prayer_id" uuid not null,
    "reason" text,
    "requested_by" character varying(255) not null,
    "approval_status" character varying(20) not null default 'pending'::character varying,
    "reviewed_by" uuid,
    "reviewed_at" timestamp with time zone,
    "denial_reason" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "requested_email" text not null
      );


alter table "public"."deletion_requests" enable row level security;


  create table "public"."email_queue" (
    "id" uuid not null default gen_random_uuid(),
    "recipient" text not null,
    "template_key" text not null,
    "template_variables" jsonb not null default '{}'::jsonb,
    "status" text not null default 'pending'::text,
    "attempts" integer not null default 0,
    "last_error" text,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone default CURRENT_TIMESTAMP
      );


alter table "public"."email_queue" enable row level security;


  create table "public"."email_subscribers" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "email" text not null,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone default timezone('utc'::text, now()),
    "is_admin" boolean default false,
    "receive_admin_emails" boolean default true,
    "is_blocked" boolean not null default false,
    "in_planning_center" boolean,
    "planning_center_checked_at" timestamp with time zone,
    "last_activity_date" timestamp with time zone,
    "badge_functionality_enabled" boolean not null default false,
    "default_prayer_view" character varying(20) not null default 'current'::character varying
      );


alter table "public"."email_subscribers" enable row level security;


  create table "public"."email_templates" (
    "id" uuid not null default gen_random_uuid(),
    "template_key" character varying(255) not null,
    "name" character varying(255) not null,
    "subject" character varying(255) not null,
    "html_body" text not null,
    "text_body" text not null,
    "description" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."email_templates" enable row level security;


  create table "public"."personal_prayer_updates" (
    "id" uuid not null default gen_random_uuid(),
    "personal_prayer_id" uuid not null,
    "content" text not null,
    "author" text not null,
    "author_email" text not null,
    "mark_as_answered" boolean default false,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone default CURRENT_TIMESTAMP
      );


alter table "public"."personal_prayer_updates" enable row level security;


  create table "public"."personal_prayers" (
    "id" uuid not null default gen_random_uuid(),
    "user_email" text not null,
    "title" text not null,
    "description" text not null,
    "prayer_for" text not null,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "category" text,
    "display_order" integer not null default 0
      );


alter table "public"."personal_prayers" enable row level security;


  create table "public"."prayer_prompts" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "type" text not null,
    "description" text not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."prayer_prompts" enable row level security;


  create table "public"."prayer_types" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "display_order" integer not null default 0,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."prayer_types" enable row level security;


  create table "public"."prayer_updates" (
    "id" uuid not null default gen_random_uuid(),
    "prayer_id" uuid not null,
    "content" text not null,
    "author" text not null,
    "created_at" timestamp with time zone default now(),
    "approval_status" character varying(20) default 'pending'::character varying,
    "approved_at" timestamp with time zone,
    "denial_reason" text,
    "author_email" text not null,
    "is_anonymous" boolean default false,
    "is_seed_data" boolean default false,
    "updated_at" timestamp with time zone not null default now(),
    "denied_at" timestamp with time zone,
    "mark_as_answered" boolean default false
      );


alter table "public"."prayer_updates" enable row level security;


  create table "public"."prayers" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "description" text,
    "status" text not null default 'current'::text,
    "requester" text not null,
    "date_requested" timestamp with time zone default now(),
    "date_answered" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "approval_status" character varying(20) default 'pending'::character varying,
    "approved_at" timestamp with time zone,
    "denial_reason" text,
    "email" character varying(255) not null,
    "is_anonymous" boolean default false,
    "prayer_for" character varying(255) not null default 'General Prayer'::character varying,
    "last_reminder_sent" timestamp with time zone,
    "is_seed_data" boolean default false,
    "denied_at" timestamp with time zone
      );


alter table "public"."prayers" enable row level security;


  create table "public"."status_change_requests" (
    "id" uuid not null default gen_random_uuid(),
    "prayer_id" uuid not null,
    "requested_status" character varying(20) not null,
    "reason" text,
    "requested_by" character varying(255) not null,
    "approval_status" character varying(20) not null default 'pending'::character varying,
    "reviewed_by" character varying(255),
    "reviewed_at" timestamp with time zone,
    "denial_reason" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "requested_email" text
      );


alter table "public"."status_change_requests" enable row level security;


  create table "public"."update_deletion_requests" (
    "id" uuid not null default gen_random_uuid(),
    "update_id" uuid not null,
    "reason" text,
    "requested_by" text not null,
    "approval_status" text not null default 'pending'::text,
    "reviewed_by" uuid,
    "reviewed_at" timestamp with time zone,
    "denial_reason" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "requested_email" text
      );


alter table "public"."update_deletion_requests" enable row level security;


  create table "public"."verification_codes" (
    "id" uuid not null default gen_random_uuid(),
    "email" text not null,
    "code" text not null,
    "action_type" text not null,
    "action_data" jsonb not null,
    "expires_at" timestamp with time zone not null,
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."verification_codes" enable row level security;

CREATE UNIQUE INDEX account_approval_requests_email_key ON public.account_approval_requests USING btree (email);

CREATE UNIQUE INDEX account_approval_requests_pkey ON public.account_approval_requests USING btree (id);

CREATE UNIQUE INDEX admin_settings_pkey ON public.admin_settings USING btree (id);

CREATE UNIQUE INDEX analytics_pkey ON public.analytics USING btree (id);

CREATE UNIQUE INDEX approval_codes_code_key ON public.approval_codes USING btree (code);

CREATE UNIQUE INDEX approval_codes_pkey ON public.approval_codes USING btree (id);

CREATE UNIQUE INDEX backup_logs_pkey ON public.backup_logs USING btree (id);

CREATE UNIQUE INDEX deletion_requests_pkey ON public.deletion_requests USING btree (id);

CREATE UNIQUE INDEX email_queue_pkey ON public.email_queue USING btree (id);

CREATE UNIQUE INDEX email_subscribers_email_key ON public.email_subscribers USING btree (email);

CREATE UNIQUE INDEX email_subscribers_pkey ON public.email_subscribers USING btree (id);

CREATE UNIQUE INDEX email_templates_pkey ON public.email_templates USING btree (id);

CREATE UNIQUE INDEX email_templates_template_key_key ON public.email_templates USING btree (template_key);

CREATE INDEX idx_account_approval_requests_created_at ON public.account_approval_requests USING btree (created_at DESC);

CREATE INDEX idx_account_approval_requests_email ON public.account_approval_requests USING btree (email);

CREATE INDEX idx_account_approval_requests_reason ON public.account_approval_requests USING btree (affiliation_reason);

CREATE INDEX idx_account_approval_requests_status ON public.account_approval_requests USING btree (approval_status);

CREATE INDEX idx_admin_settings_permissions ON public.admin_settings USING btree (deletions_allowed, updates_allowed);

CREATE INDEX idx_analytics_created_at ON public.analytics USING btree (created_at);

CREATE INDEX idx_analytics_event_type ON public.analytics USING btree (event_type);

CREATE INDEX idx_approval_codes_admin_email ON public.approval_codes USING btree (admin_email);

CREATE INDEX idx_approval_codes_code ON public.approval_codes USING btree (code);

CREATE INDEX idx_approval_codes_expires_at ON public.approval_codes USING btree (expires_at);

CREATE INDEX idx_backup_logs_backup_date ON public.backup_logs USING btree (backup_date DESC);

CREATE INDEX idx_deletion_requests_approval_status ON public.deletion_requests USING btree (approval_status);

CREATE INDEX idx_deletion_requests_created_at ON public.deletion_requests USING btree (created_at);

CREATE INDEX idx_deletion_requests_prayer_id ON public.deletion_requests USING btree (prayer_id);

CREATE INDEX idx_deletion_requests_requested_email ON public.deletion_requests USING btree (requested_email);

CREATE INDEX idx_email_queue_recipient ON public.email_queue USING btree (recipient);

CREATE INDEX idx_email_queue_status ON public.email_queue USING btree (status, created_at);

CREATE INDEX idx_email_subscribers_active ON public.email_subscribers USING btree (is_active);

CREATE INDEX idx_email_subscribers_admin ON public.email_subscribers USING btree (is_admin) WHERE (is_admin = true);

CREATE INDEX idx_email_subscribers_blocked ON public.email_subscribers USING btree (email) WHERE (is_blocked = true);

CREATE INDEX idx_email_subscribers_email ON public.email_subscribers USING btree (email);

CREATE INDEX idx_email_subscribers_is_admin ON public.email_subscribers USING btree (is_admin);

CREATE INDEX idx_email_subscribers_planning_center ON public.email_subscribers USING btree (email, in_planning_center);

CREATE INDEX idx_email_subscribers_receive_admin_emails ON public.email_subscribers USING btree (receive_admin_emails) WHERE ((is_admin = true) AND (receive_admin_emails = true));

CREATE INDEX idx_personal_prayer_updates_created_at ON public.personal_prayer_updates USING btree (created_at DESC);

CREATE INDEX idx_personal_prayer_updates_personal_prayer_id ON public.personal_prayer_updates USING btree (personal_prayer_id);

CREATE INDEX idx_personal_prayers_category ON public.personal_prayers USING btree (category);

CREATE INDEX idx_personal_prayers_created_at ON public.personal_prayers USING btree (created_at DESC);

CREATE INDEX idx_personal_prayers_display_order ON public.personal_prayers USING btree (user_email, display_order DESC);

CREATE INDEX idx_personal_prayers_user_email ON public.personal_prayers USING btree (user_email);

CREATE INDEX idx_personal_prayers_user_email_category ON public.personal_prayers USING btree (user_email, category);

CREATE INDEX idx_prayer_prompts_created_at ON public.prayer_prompts USING btree (created_at DESC);

CREATE INDEX idx_prayer_prompts_type ON public.prayer_prompts USING btree (type);

CREATE INDEX idx_prayer_types_active_order ON public.prayer_types USING btree (is_active, display_order);

CREATE INDEX idx_prayer_updates_approval_status ON public.prayer_updates USING btree (approval_status);

CREATE INDEX idx_prayer_updates_approved_at ON public.prayer_updates USING btree (approved_at);

CREATE INDEX idx_prayer_updates_author_email ON public.prayer_updates USING btree (author_email);

CREATE INDEX idx_prayer_updates_created_at ON public.prayer_updates USING btree (created_at DESC);

CREATE INDEX idx_prayer_updates_is_anonymous ON public.prayer_updates USING btree (is_anonymous);

CREATE INDEX idx_prayer_updates_is_seed_data ON public.prayer_updates USING btree (is_seed_data) WHERE (is_seed_data = true);

CREATE INDEX idx_prayer_updates_pending_created ON public.prayer_updates USING btree (approval_status, created_at DESC) WHERE ((approval_status)::text = 'pending'::text);

CREATE INDEX idx_prayer_updates_prayer_approval ON public.prayer_updates USING btree (prayer_id, approval_status);

CREATE INDEX idx_prayer_updates_prayer_id ON public.prayer_updates USING btree (prayer_id);

CREATE INDEX idx_prayers_anonymous_status ON public.prayers USING btree (is_anonymous, approval_status) WHERE (is_anonymous = true);

CREATE INDEX idx_prayers_approval_created ON public.prayers USING btree (approval_status, created_at DESC);

CREATE INDEX idx_prayers_approval_status ON public.prayers USING btree (approval_status);

CREATE INDEX idx_prayers_approved_at ON public.prayers USING btree (approved_at);

CREATE INDEX idx_prayers_created_at ON public.prayers USING btree (created_at DESC);

CREATE INDEX idx_prayers_email ON public.prayers USING btree (email);

CREATE INDEX idx_prayers_is_anonymous ON public.prayers USING btree (is_anonymous);

CREATE INDEX idx_prayers_is_seed_data ON public.prayers USING btree (is_seed_data) WHERE (is_seed_data = true);

CREATE INDEX idx_prayers_pending_created ON public.prayers USING btree (approval_status, created_at DESC) WHERE ((approval_status)::text = 'pending'::text);

CREATE INDEX idx_prayers_prayer_for ON public.prayers USING btree (prayer_for);

CREATE INDEX idx_prayers_status ON public.prayers USING btree (status);

CREATE INDEX idx_status_change_approval_created ON public.status_change_requests USING btree (approval_status, created_at DESC);

CREATE INDEX idx_status_change_requests_approval_status ON public.status_change_requests USING btree (approval_status);

CREATE INDEX idx_status_change_requests_created_at ON public.status_change_requests USING btree (created_at DESC);

CREATE INDEX idx_status_change_requests_prayer_id ON public.status_change_requests USING btree (prayer_id);

CREATE INDEX idx_status_change_requests_requested_email ON public.status_change_requests USING btree (requested_email);

CREATE INDEX idx_update_deletion_approval_created ON public.update_deletion_requests USING btree (approval_status, created_at DESC);

CREATE INDEX idx_update_deletion_requests_approval_status ON public.update_deletion_requests USING btree (approval_status);

CREATE INDEX idx_update_deletion_requests_created_at ON public.update_deletion_requests USING btree (created_at DESC);

CREATE INDEX idx_update_deletion_requests_requested_email ON public.update_deletion_requests USING btree (requested_email);

CREATE INDEX idx_update_deletion_requests_update_id ON public.update_deletion_requests USING btree (update_id);

CREATE INDEX idx_verification_codes_action_type ON public.verification_codes USING btree (action_type);

CREATE INDEX idx_verification_codes_code ON public.verification_codes USING btree (code);

CREATE INDEX idx_verification_codes_email ON public.verification_codes USING btree (email);

CREATE INDEX idx_verification_codes_expires ON public.verification_codes USING btree (expires_at) WHERE (used_at IS NULL);

CREATE INDEX idx_verification_codes_expires_at ON public.verification_codes USING btree (expires_at);

CREATE UNIQUE INDEX personal_prayer_updates_pkey ON public.personal_prayer_updates USING btree (id);

CREATE UNIQUE INDEX personal_prayers_pkey ON public.personal_prayers USING btree (id);

CREATE UNIQUE INDEX prayer_prompts_pkey ON public.prayer_prompts USING btree (id);

CREATE UNIQUE INDEX prayer_types_name_key ON public.prayer_types USING btree (name);

CREATE UNIQUE INDEX prayer_types_pkey ON public.prayer_types USING btree (id);

CREATE UNIQUE INDEX prayer_updates_pkey ON public.prayer_updates USING btree (id);

CREATE UNIQUE INDEX prayers_pkey ON public.prayers USING btree (id);

CREATE UNIQUE INDEX status_change_requests_pkey ON public.status_change_requests USING btree (id);

CREATE UNIQUE INDEX update_deletion_requests_pkey ON public.update_deletion_requests USING btree (id);

CREATE UNIQUE INDEX verification_codes_pkey ON public.verification_codes USING btree (id);

alter table "public"."account_approval_requests" add constraint "account_approval_requests_pkey" PRIMARY KEY using index "account_approval_requests_pkey";

alter table "public"."admin_settings" add constraint "admin_settings_pkey" PRIMARY KEY using index "admin_settings_pkey";

alter table "public"."analytics" add constraint "analytics_pkey" PRIMARY KEY using index "analytics_pkey";

alter table "public"."approval_codes" add constraint "approval_codes_pkey" PRIMARY KEY using index "approval_codes_pkey";

alter table "public"."backup_logs" add constraint "backup_logs_pkey" PRIMARY KEY using index "backup_logs_pkey";

alter table "public"."deletion_requests" add constraint "deletion_requests_pkey" PRIMARY KEY using index "deletion_requests_pkey";

alter table "public"."email_queue" add constraint "email_queue_pkey" PRIMARY KEY using index "email_queue_pkey";

alter table "public"."email_subscribers" add constraint "email_subscribers_pkey" PRIMARY KEY using index "email_subscribers_pkey";

alter table "public"."email_templates" add constraint "email_templates_pkey" PRIMARY KEY using index "email_templates_pkey";

alter table "public"."personal_prayer_updates" add constraint "personal_prayer_updates_pkey" PRIMARY KEY using index "personal_prayer_updates_pkey";

alter table "public"."personal_prayers" add constraint "personal_prayers_pkey" PRIMARY KEY using index "personal_prayers_pkey";

alter table "public"."prayer_prompts" add constraint "prayer_prompts_pkey" PRIMARY KEY using index "prayer_prompts_pkey";

alter table "public"."prayer_types" add constraint "prayer_types_pkey" PRIMARY KEY using index "prayer_types_pkey";

alter table "public"."prayer_updates" add constraint "prayer_updates_pkey" PRIMARY KEY using index "prayer_updates_pkey";

alter table "public"."prayers" add constraint "prayers_pkey" PRIMARY KEY using index "prayers_pkey";

alter table "public"."status_change_requests" add constraint "status_change_requests_pkey" PRIMARY KEY using index "status_change_requests_pkey";

alter table "public"."update_deletion_requests" add constraint "update_deletion_requests_pkey" PRIMARY KEY using index "update_deletion_requests_pkey";

alter table "public"."verification_codes" add constraint "verification_codes_pkey" PRIMARY KEY using index "verification_codes_pkey";

alter table "public"."account_approval_requests" add constraint "account_approval_requests_approval_status_check" CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text]))) not valid;

alter table "public"."account_approval_requests" validate constraint "account_approval_requests_approval_status_check";

alter table "public"."account_approval_requests" add constraint "account_approval_requests_email_key" UNIQUE using index "account_approval_requests_email_key";

alter table "public"."admin_settings" add constraint "admin_settings_deletions_allowed_check" CHECK ((deletions_allowed = ANY (ARRAY['everyone'::text, 'admin-only'::text, 'original-requestor'::text]))) not valid;

alter table "public"."admin_settings" validate constraint "admin_settings_deletions_allowed_check";

alter table "public"."admin_settings" add constraint "admin_settings_updates_allowed_check" CHECK ((updates_allowed = ANY (ARRAY['everyone'::text, 'admin-only'::text, 'original-requestor'::text]))) not valid;

alter table "public"."admin_settings" validate constraint "admin_settings_updates_allowed_check";

alter table "public"."admin_settings" add constraint "admin_settings_verification_code_expiry_minutes_check" CHECK (((verification_code_expiry_minutes >= 5) AND (verification_code_expiry_minutes <= 60))) not valid;

alter table "public"."admin_settings" validate constraint "admin_settings_verification_code_expiry_minutes_check";

alter table "public"."admin_settings" add constraint "admin_settings_verification_code_length_check" CHECK ((verification_code_length = ANY (ARRAY[4, 6, 8]))) not valid;

alter table "public"."admin_settings" validate constraint "admin_settings_verification_code_length_check";

alter table "public"."admin_settings" add constraint "db_heartbeat_interval_min" CHECK ((db_heartbeat_interval_minutes >= 1)) not valid;

alter table "public"."admin_settings" validate constraint "db_heartbeat_interval_min";

alter table "public"."admin_settings" add constraint "inactivity_timeout_min" CHECK ((inactivity_timeout_minutes >= 5)) not valid;

alter table "public"."admin_settings" validate constraint "inactivity_timeout_min";

alter table "public"."admin_settings" add constraint "max_session_duration_min" CHECK ((max_session_duration_minutes >= 30)) not valid;

alter table "public"."admin_settings" validate constraint "max_session_duration_min";

alter table "public"."admin_settings" add constraint "single_row" CHECK ((id = 1)) not valid;

alter table "public"."admin_settings" validate constraint "single_row";

alter table "public"."approval_codes" add constraint "approval_codes_admin_email_fkey" FOREIGN KEY (admin_email) REFERENCES public.email_subscribers(email) ON DELETE CASCADE not valid;

alter table "public"."approval_codes" validate constraint "approval_codes_admin_email_fkey";

alter table "public"."approval_codes" add constraint "approval_codes_approval_type_check" CHECK (((approval_type)::text = ANY ((ARRAY['prayer'::character varying, 'update'::character varying, 'deletion'::character varying, 'status_change'::character varying, 'preference-change'::character varying])::text[]))) not valid;

alter table "public"."approval_codes" validate constraint "approval_codes_approval_type_check";

alter table "public"."approval_codes" add constraint "approval_codes_code_key" UNIQUE using index "approval_codes_code_key";

alter table "public"."backup_logs" add constraint "backup_logs_status_check" CHECK ((status = ANY (ARRAY['success'::text, 'failed'::text, 'in_progress'::text]))) not valid;

alter table "public"."backup_logs" validate constraint "backup_logs_status_check";

alter table "public"."deletion_requests" add constraint "deletion_requests_approval_status_check" CHECK (((approval_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'denied'::character varying])::text[]))) not valid;

alter table "public"."deletion_requests" validate constraint "deletion_requests_approval_status_check";

alter table "public"."deletion_requests" add constraint "deletion_requests_prayer_id_fkey" FOREIGN KEY (prayer_id) REFERENCES public.prayers(id) ON DELETE CASCADE not valid;

alter table "public"."deletion_requests" validate constraint "deletion_requests_prayer_id_fkey";

alter table "public"."deletion_requests" add constraint "deletion_requests_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) not valid;

alter table "public"."deletion_requests" validate constraint "deletion_requests_reviewed_by_fkey";

alter table "public"."email_queue" add constraint "email_queue_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text]))) not valid;

alter table "public"."email_queue" validate constraint "email_queue_status_check";

alter table "public"."email_subscribers" add constraint "default_prayer_view_check" CHECK (((default_prayer_view)::text = ANY ((ARRAY['current'::character varying, 'personal'::character varying])::text[]))) not valid;

alter table "public"."email_subscribers" validate constraint "default_prayer_view_check";

alter table "public"."email_subscribers" add constraint "email_subscribers_email_key" UNIQUE using index "email_subscribers_email_key";

alter table "public"."email_templates" add constraint "email_templates_template_key_key" UNIQUE using index "email_templates_template_key_key";

alter table "public"."personal_prayer_updates" add constraint "personal_prayer_updates_personal_prayer_id_fkey" FOREIGN KEY (personal_prayer_id) REFERENCES public.personal_prayers(id) ON DELETE CASCADE not valid;

alter table "public"."personal_prayer_updates" validate constraint "personal_prayer_updates_personal_prayer_id_fkey";

alter table "public"."prayer_types" add constraint "prayer_types_name_key" UNIQUE using index "prayer_types_name_key";

alter table "public"."prayer_updates" add constraint "prayer_updates_approval_status_check" CHECK (((approval_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'denied'::character varying])::text[]))) not valid;

alter table "public"."prayer_updates" validate constraint "prayer_updates_approval_status_check";

alter table "public"."prayer_updates" add constraint "prayer_updates_prayer_id_fkey" FOREIGN KEY (prayer_id) REFERENCES public.prayers(id) ON DELETE CASCADE not valid;

alter table "public"."prayer_updates" validate constraint "prayer_updates_prayer_id_fkey";

alter table "public"."prayers" add constraint "prayers_approval_status_check" CHECK (((approval_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'denied'::character varying])::text[]))) not valid;

alter table "public"."prayers" validate constraint "prayers_approval_status_check";

alter table "public"."prayers" add constraint "prayers_status_check" CHECK ((status = ANY (ARRAY['current'::text, 'answered'::text, 'archived'::text]))) not valid;

alter table "public"."prayers" validate constraint "prayers_status_check";

alter table "public"."status_change_requests" add constraint "status_change_requests_approval_status_check" CHECK (((approval_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'denied'::character varying])::text[]))) not valid;

alter table "public"."status_change_requests" validate constraint "status_change_requests_approval_status_check";

alter table "public"."status_change_requests" add constraint "status_change_requests_prayer_id_fkey" FOREIGN KEY (prayer_id) REFERENCES public.prayers(id) ON DELETE CASCADE not valid;

alter table "public"."status_change_requests" validate constraint "status_change_requests_prayer_id_fkey";

alter table "public"."status_change_requests" add constraint "status_change_requests_requested_status_check" CHECK (((requested_status)::text = ANY ((ARRAY['current'::character varying, 'answered'::character varying, 'ongoing'::character varying, 'closed'::character varying])::text[]))) not valid;

alter table "public"."status_change_requests" validate constraint "status_change_requests_requested_status_check";

alter table "public"."update_deletion_requests" add constraint "update_deletion_requests_approval_status_check" CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'denied'::text]))) not valid;

alter table "public"."update_deletion_requests" validate constraint "update_deletion_requests_approval_status_check";

alter table "public"."update_deletion_requests" add constraint "update_deletion_requests_reviewed_by_fkey" FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) not valid;

alter table "public"."update_deletion_requests" validate constraint "update_deletion_requests_reviewed_by_fkey";

alter table "public"."update_deletion_requests" add constraint "update_deletion_requests_update_id_fkey" FOREIGN KEY (update_id) REFERENCES public.prayer_updates(id) ON DELETE CASCADE not valid;

alter table "public"."update_deletion_requests" validate constraint "update_deletion_requests_update_id_fkey";

alter table "public"."verification_codes" add constraint "verification_codes_action_type_check" CHECK ((action_type = ANY (ARRAY['prayer_submission'::text, 'prayer_update'::text, 'deletion_request'::text, 'update_deletion_request'::text, 'status_change_request'::text, 'preference_change'::text, 'admin_login'::text]))) not valid;

alter table "public"."verification_codes" validate constraint "verification_codes_action_type_check";

set check_function_bodies = off;

create or replace view "public"."backup_tables" as  SELECT tablename AS table_name,
    schemaname AS schema_name
   FROM pg_tables
  WHERE ((schemaname = 'public'::name) AND (tablename !~~ 'pg_%'::text) AND (tablename !~~ 'sql_%'::text) AND (tablename IN ( SELECT tables.table_name
           FROM information_schema.tables
          WHERE (((tables.table_schema)::name = 'public'::name) AND ((tables.table_type)::text = 'BASE TABLE'::text)))))
  ORDER BY tablename;


CREATE OR REPLACE FUNCTION public.cleanup_expired_approval_codes()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM approval_codes
  WHERE expires_at < NOW()  -- Delete expired codes immediately
  OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '1 hour');  -- Delete used codes after 1 hour
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_expired_verification_codes()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM verification_codes
  WHERE expires_at < NOW()  -- Delete expired codes immediately
  OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '1 hour');  -- Delete used codes after 1 hour
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_account_approval_request(p_email text, p_first_name text, p_last_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO account_approval_requests (email, first_name, last_name, approval_status)
  VALUES (p_email, p_first_name, p_last_name, 'pending')
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_account_approval_request(p_email text, p_first_name text, p_last_name text, p_affiliation_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO account_approval_requests (email, first_name, last_name, affiliation_reason, approval_status)
  VALUES (p_email, p_first_name, p_last_name, p_affiliation_reason, 'pending')
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin(user_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN user_email IN ('admin@prayerapp.com', 'admin@example.com');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reorder_personal_prayer_categories(p_user_email text, p_ordered_categories text[])
 RETURNS TABLE(success boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_category TEXT;
  v_new_prefix INTEGER;
  v_new_display_order INTEGER;
  v_last_three_digits INTEGER;
  v_position INTEGER;
  v_updated_count INTEGER := 0;
BEGIN
  -- Validate input
  IF p_user_email IS NULL OR p_user_email = '' THEN
    RETURN QUERY SELECT FALSE, 'User email is required';
    RETURN;
  END IF;

  IF p_ordered_categories IS NULL OR array_length(p_ordered_categories, 1) IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Category array is required';
    RETURN;
  END IF;

  -- Process each category in the new order
  -- Position 0 gets prefix = array_length, position 1 gets array_length - 1, etc.
  -- This maintains DESC sort order (higher prefix = appears first)
  FOR v_position IN 0..(array_length(p_ordered_categories, 1) - 1) LOOP
    v_category := p_ordered_categories[v_position + 1];  -- PostgreSQL arrays are 1-indexed
    
    -- Skip null categories
    IF v_category IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Calculate new prefix based on position
    -- Position 0 → highest prefix, position N-1 → lowest prefix
    v_new_prefix := array_length(p_ordered_categories, 1) - v_position;
    
    -- Update all prayers in this category to use the new prefix
    -- Preserve last 3 digits to maintain order within the category
    UPDATE personal_prayers
    SET display_order = (v_new_prefix * 1000) + (display_order % 1000)
    WHERE user_email = p_user_email
      AND category = v_category;
    
    v_updated_count := v_updated_count + 1;
  END LOOP;

  -- Return success
  RETURN QUERY SELECT TRUE, format('Successfully reordered %s categories', v_updated_count);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reorder_personal_prayers(p_user_email text, p_ordered_prayer_ids text[], p_category text DEFAULT NULL::text)
 RETURNS TABLE(success boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_prayer_id TEXT;
  v_position INTEGER;
  v_category TEXT;
  v_range_min INTEGER;
  v_range_max INTEGER;
  v_new_display_order INTEGER;
  v_updated_count INTEGER := 0;
  v_prayer_count INTEGER;
BEGIN
  -- Validate input
  IF p_user_email IS NULL OR p_user_email = '' THEN
    RETURN QUERY SELECT FALSE, 'User email is required';
    RETURN;
  END IF;

  IF p_ordered_prayer_ids IS NULL OR array_length(p_ordered_prayer_ids, 1) IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Prayer ID array is required';
    RETURN;
  END IF;

  -- Get the category - prefer the provided category parameter
  -- If not provided, look up the category of the first prayer
  IF p_category IS NOT NULL THEN
    v_category := p_category;
  ELSE
    SELECT category INTO v_category
    FROM personal_prayers
    WHERE id = p_ordered_prayer_ids[1]::uuid
      AND user_email = p_user_email
    LIMIT 1;
  END IF;

  -- Determine the display_order range for this category
  -- Categories use prefix * 1000, so range is prefix*1000 to (prefix+1)*1000-1
  SELECT 
    COALESCE(MIN(display_order) / 1000 * 1000, 1000) AS range_min,
    COALESCE(MIN(display_order) / 1000 * 1000 + 999, 1999) AS range_max
  INTO v_range_min, v_range_max
  FROM personal_prayers
  WHERE user_email = p_user_email
    AND (v_category IS NULL OR category = v_category);

  -- Update each prayer with its new position
  -- Position 0 in array (top of UI) needs highest display_order for DESC sort
  -- But we want to compact from bottom of range to leave room for new prayers at top
  -- Example: 4 prayers in range 2000-2999 → assign 2003, 2002, 2001, 2000
  v_prayer_count := array_length(p_ordered_prayer_ids, 1);
  
  FOR v_position IN 0..(v_prayer_count - 1) LOOP
    v_prayer_id := p_ordered_prayer_ids[v_position + 1];  -- PostgreSQL arrays are 1-indexed
    
    IF v_prayer_id IS NULL OR v_prayer_id = '' THEN
      CONTINUE;
    END IF;
    
    -- Calculate display_order: compact from bottom of range
    -- Position 0 (top of UI) gets range_min + (count - 1), which is highest in the compact set
    -- This leaves room at the top (range_max) for adding new prayers
    v_new_display_order := v_range_min + (v_prayer_count - 1 - v_position);
    
    -- Update the prayer's display_order
    UPDATE personal_prayers
    SET display_order = v_new_display_order
    WHERE id = v_prayer_id::uuid
      AND user_email = p_user_email;
    
    v_updated_count := v_updated_count + 1;
  END LOOP;

  -- Return success
  RETURN QUERY SELECT TRUE, format('Successfully reordered %s prayers', v_updated_count);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.swap_personal_prayer_categories(p_user_email text, p_category_a text, p_category_b text)
 RETURNS TABLE(success boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_prefix_a INTEGER;
  v_prefix_b INTEGER;
  v_count_a INTEGER;
  v_count_b INTEGER;
BEGIN
  -- Get the prefixes and counts for both categories
  SELECT 
    FLOOR(MIN(display_order) / 1000)::INTEGER,
    COUNT(*)
  INTO v_prefix_a, v_count_a
  FROM personal_prayers
  WHERE user_email = p_user_email 
    AND category = p_category_a;

  SELECT 
    FLOOR(MIN(display_order) / 1000)::INTEGER,
    COUNT(*)
  INTO v_prefix_b, v_count_b
  FROM personal_prayers
  WHERE user_email = p_user_email 
    AND category = p_category_b;

  -- Validate that both categories exist
  IF v_prefix_a IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Category A not found: ' || p_category_a;
    RETURN;
  END IF;

  IF v_prefix_b IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Category B not found: ' || p_category_b;
    RETURN;
  END IF;

  -- Step 1: Move category A to temp (prefix 999)
  UPDATE personal_prayers
  SET display_order = 999000 + (display_order % 1000)
  WHERE user_email = p_user_email 
    AND category = p_category_a;

  -- Step 2: Move category B to A's prefix
  UPDATE personal_prayers
  SET display_order = (v_prefix_a * 1000) + (display_order % 1000)
  WHERE user_email = p_user_email 
    AND category = p_category_b;

  -- Step 3: Move category A from temp to B's prefix
  UPDATE personal_prayers
  SET display_order = (v_prefix_b * 1000) + (display_order % 1000)
  WHERE user_email = p_user_email 
    AND category = p_category_a;

  RETURN QUERY SELECT TRUE, 
    'Successfully swapped ' || v_count_a || ' prayers in ' || p_category_a || 
    ' with ' || v_count_b || ' prayers in ' || p_category_b;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_account_approval_requests_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_admin_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_email_subscribers_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_email_templates_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_pending_preference_changes_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_prayer_types_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_preferences_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."account_approval_requests" to "anon";

grant insert on table "public"."account_approval_requests" to "anon";

grant references on table "public"."account_approval_requests" to "anon";

grant select on table "public"."account_approval_requests" to "anon";

grant trigger on table "public"."account_approval_requests" to "anon";

grant truncate on table "public"."account_approval_requests" to "anon";

grant update on table "public"."account_approval_requests" to "anon";

grant delete on table "public"."account_approval_requests" to "authenticated";

grant insert on table "public"."account_approval_requests" to "authenticated";

grant references on table "public"."account_approval_requests" to "authenticated";

grant select on table "public"."account_approval_requests" to "authenticated";

grant trigger on table "public"."account_approval_requests" to "authenticated";

grant truncate on table "public"."account_approval_requests" to "authenticated";

grant update on table "public"."account_approval_requests" to "authenticated";

grant delete on table "public"."account_approval_requests" to "service_role";

grant insert on table "public"."account_approval_requests" to "service_role";

grant references on table "public"."account_approval_requests" to "service_role";

grant select on table "public"."account_approval_requests" to "service_role";

grant trigger on table "public"."account_approval_requests" to "service_role";

grant truncate on table "public"."account_approval_requests" to "service_role";

grant update on table "public"."account_approval_requests" to "service_role";

grant delete on table "public"."admin_settings" to "anon";

grant insert on table "public"."admin_settings" to "anon";

grant references on table "public"."admin_settings" to "anon";

grant select on table "public"."admin_settings" to "anon";

grant trigger on table "public"."admin_settings" to "anon";

grant truncate on table "public"."admin_settings" to "anon";

grant update on table "public"."admin_settings" to "anon";

grant delete on table "public"."admin_settings" to "authenticated";

grant insert on table "public"."admin_settings" to "authenticated";

grant references on table "public"."admin_settings" to "authenticated";

grant select on table "public"."admin_settings" to "authenticated";

grant trigger on table "public"."admin_settings" to "authenticated";

grant truncate on table "public"."admin_settings" to "authenticated";

grant update on table "public"."admin_settings" to "authenticated";

grant delete on table "public"."admin_settings" to "service_role";

grant insert on table "public"."admin_settings" to "service_role";

grant references on table "public"."admin_settings" to "service_role";

grant select on table "public"."admin_settings" to "service_role";

grant trigger on table "public"."admin_settings" to "service_role";

grant truncate on table "public"."admin_settings" to "service_role";

grant update on table "public"."admin_settings" to "service_role";

grant delete on table "public"."analytics" to "anon";

grant insert on table "public"."analytics" to "anon";

grant references on table "public"."analytics" to "anon";

grant select on table "public"."analytics" to "anon";

grant trigger on table "public"."analytics" to "anon";

grant truncate on table "public"."analytics" to "anon";

grant update on table "public"."analytics" to "anon";

grant delete on table "public"."analytics" to "authenticated";

grant insert on table "public"."analytics" to "authenticated";

grant references on table "public"."analytics" to "authenticated";

grant select on table "public"."analytics" to "authenticated";

grant trigger on table "public"."analytics" to "authenticated";

grant truncate on table "public"."analytics" to "authenticated";

grant update on table "public"."analytics" to "authenticated";

grant delete on table "public"."analytics" to "service_role";

grant insert on table "public"."analytics" to "service_role";

grant references on table "public"."analytics" to "service_role";

grant select on table "public"."analytics" to "service_role";

grant trigger on table "public"."analytics" to "service_role";

grant truncate on table "public"."analytics" to "service_role";

grant update on table "public"."analytics" to "service_role";

grant delete on table "public"."approval_codes" to "anon";

grant insert on table "public"."approval_codes" to "anon";

grant references on table "public"."approval_codes" to "anon";

grant select on table "public"."approval_codes" to "anon";

grant trigger on table "public"."approval_codes" to "anon";

grant truncate on table "public"."approval_codes" to "anon";

grant update on table "public"."approval_codes" to "anon";

grant delete on table "public"."approval_codes" to "authenticated";

grant insert on table "public"."approval_codes" to "authenticated";

grant references on table "public"."approval_codes" to "authenticated";

grant select on table "public"."approval_codes" to "authenticated";

grant trigger on table "public"."approval_codes" to "authenticated";

grant truncate on table "public"."approval_codes" to "authenticated";

grant update on table "public"."approval_codes" to "authenticated";

grant delete on table "public"."approval_codes" to "service_role";

grant insert on table "public"."approval_codes" to "service_role";

grant references on table "public"."approval_codes" to "service_role";

grant select on table "public"."approval_codes" to "service_role";

grant trigger on table "public"."approval_codes" to "service_role";

grant truncate on table "public"."approval_codes" to "service_role";

grant update on table "public"."approval_codes" to "service_role";

grant delete on table "public"."backup_logs" to "anon";

grant insert on table "public"."backup_logs" to "anon";

grant references on table "public"."backup_logs" to "anon";

grant select on table "public"."backup_logs" to "anon";

grant trigger on table "public"."backup_logs" to "anon";

grant truncate on table "public"."backup_logs" to "anon";

grant update on table "public"."backup_logs" to "anon";

grant delete on table "public"."backup_logs" to "authenticated";

grant insert on table "public"."backup_logs" to "authenticated";

grant references on table "public"."backup_logs" to "authenticated";

grant select on table "public"."backup_logs" to "authenticated";

grant trigger on table "public"."backup_logs" to "authenticated";

grant truncate on table "public"."backup_logs" to "authenticated";

grant update on table "public"."backup_logs" to "authenticated";

grant delete on table "public"."backup_logs" to "service_role";

grant insert on table "public"."backup_logs" to "service_role";

grant references on table "public"."backup_logs" to "service_role";

grant select on table "public"."backup_logs" to "service_role";

grant trigger on table "public"."backup_logs" to "service_role";

grant truncate on table "public"."backup_logs" to "service_role";

grant update on table "public"."backup_logs" to "service_role";

grant delete on table "public"."deletion_requests" to "anon";

grant insert on table "public"."deletion_requests" to "anon";

grant references on table "public"."deletion_requests" to "anon";

grant select on table "public"."deletion_requests" to "anon";

grant trigger on table "public"."deletion_requests" to "anon";

grant truncate on table "public"."deletion_requests" to "anon";

grant update on table "public"."deletion_requests" to "anon";

grant delete on table "public"."deletion_requests" to "authenticated";

grant insert on table "public"."deletion_requests" to "authenticated";

grant references on table "public"."deletion_requests" to "authenticated";

grant select on table "public"."deletion_requests" to "authenticated";

grant trigger on table "public"."deletion_requests" to "authenticated";

grant truncate on table "public"."deletion_requests" to "authenticated";

grant update on table "public"."deletion_requests" to "authenticated";

grant delete on table "public"."deletion_requests" to "service_role";

grant insert on table "public"."deletion_requests" to "service_role";

grant references on table "public"."deletion_requests" to "service_role";

grant select on table "public"."deletion_requests" to "service_role";

grant trigger on table "public"."deletion_requests" to "service_role";

grant truncate on table "public"."deletion_requests" to "service_role";

grant update on table "public"."deletion_requests" to "service_role";

grant delete on table "public"."email_queue" to "anon";

grant insert on table "public"."email_queue" to "anon";

grant references on table "public"."email_queue" to "anon";

grant select on table "public"."email_queue" to "anon";

grant trigger on table "public"."email_queue" to "anon";

grant truncate on table "public"."email_queue" to "anon";

grant update on table "public"."email_queue" to "anon";

grant delete on table "public"."email_queue" to "authenticated";

grant insert on table "public"."email_queue" to "authenticated";

grant references on table "public"."email_queue" to "authenticated";

grant select on table "public"."email_queue" to "authenticated";

grant trigger on table "public"."email_queue" to "authenticated";

grant truncate on table "public"."email_queue" to "authenticated";

grant update on table "public"."email_queue" to "authenticated";

grant delete on table "public"."email_queue" to "service_role";

grant insert on table "public"."email_queue" to "service_role";

grant references on table "public"."email_queue" to "service_role";

grant select on table "public"."email_queue" to "service_role";

grant trigger on table "public"."email_queue" to "service_role";

grant truncate on table "public"."email_queue" to "service_role";

grant update on table "public"."email_queue" to "service_role";

grant delete on table "public"."email_subscribers" to "anon";

grant insert on table "public"."email_subscribers" to "anon";

grant references on table "public"."email_subscribers" to "anon";

grant select on table "public"."email_subscribers" to "anon";

grant trigger on table "public"."email_subscribers" to "anon";

grant truncate on table "public"."email_subscribers" to "anon";

grant update on table "public"."email_subscribers" to "anon";

grant delete on table "public"."email_subscribers" to "authenticated";

grant insert on table "public"."email_subscribers" to "authenticated";

grant references on table "public"."email_subscribers" to "authenticated";

grant select on table "public"."email_subscribers" to "authenticated";

grant trigger on table "public"."email_subscribers" to "authenticated";

grant truncate on table "public"."email_subscribers" to "authenticated";

grant update on table "public"."email_subscribers" to "authenticated";

grant delete on table "public"."email_subscribers" to "service_role";

grant insert on table "public"."email_subscribers" to "service_role";

grant references on table "public"."email_subscribers" to "service_role";

grant select on table "public"."email_subscribers" to "service_role";

grant trigger on table "public"."email_subscribers" to "service_role";

grant truncate on table "public"."email_subscribers" to "service_role";

grant update on table "public"."email_subscribers" to "service_role";

grant delete on table "public"."email_templates" to "anon";

grant insert on table "public"."email_templates" to "anon";

grant references on table "public"."email_templates" to "anon";

grant select on table "public"."email_templates" to "anon";

grant trigger on table "public"."email_templates" to "anon";

grant truncate on table "public"."email_templates" to "anon";

grant update on table "public"."email_templates" to "anon";

grant delete on table "public"."email_templates" to "authenticated";

grant insert on table "public"."email_templates" to "authenticated";

grant references on table "public"."email_templates" to "authenticated";

grant select on table "public"."email_templates" to "authenticated";

grant trigger on table "public"."email_templates" to "authenticated";

grant truncate on table "public"."email_templates" to "authenticated";

grant update on table "public"."email_templates" to "authenticated";

grant delete on table "public"."email_templates" to "service_role";

grant insert on table "public"."email_templates" to "service_role";

grant references on table "public"."email_templates" to "service_role";

grant select on table "public"."email_templates" to "service_role";

grant trigger on table "public"."email_templates" to "service_role";

grant truncate on table "public"."email_templates" to "service_role";

grant update on table "public"."email_templates" to "service_role";

grant delete on table "public"."personal_prayer_updates" to "anon";

grant insert on table "public"."personal_prayer_updates" to "anon";

grant references on table "public"."personal_prayer_updates" to "anon";

grant select on table "public"."personal_prayer_updates" to "anon";

grant trigger on table "public"."personal_prayer_updates" to "anon";

grant truncate on table "public"."personal_prayer_updates" to "anon";

grant update on table "public"."personal_prayer_updates" to "anon";

grant delete on table "public"."personal_prayer_updates" to "authenticated";

grant insert on table "public"."personal_prayer_updates" to "authenticated";

grant references on table "public"."personal_prayer_updates" to "authenticated";

grant select on table "public"."personal_prayer_updates" to "authenticated";

grant trigger on table "public"."personal_prayer_updates" to "authenticated";

grant truncate on table "public"."personal_prayer_updates" to "authenticated";

grant update on table "public"."personal_prayer_updates" to "authenticated";

grant delete on table "public"."personal_prayer_updates" to "service_role";

grant insert on table "public"."personal_prayer_updates" to "service_role";

grant references on table "public"."personal_prayer_updates" to "service_role";

grant select on table "public"."personal_prayer_updates" to "service_role";

grant trigger on table "public"."personal_prayer_updates" to "service_role";

grant truncate on table "public"."personal_prayer_updates" to "service_role";

grant update on table "public"."personal_prayer_updates" to "service_role";

grant delete on table "public"."personal_prayers" to "anon";

grant insert on table "public"."personal_prayers" to "anon";

grant references on table "public"."personal_prayers" to "anon";

grant select on table "public"."personal_prayers" to "anon";

grant trigger on table "public"."personal_prayers" to "anon";

grant truncate on table "public"."personal_prayers" to "anon";

grant update on table "public"."personal_prayers" to "anon";

grant delete on table "public"."personal_prayers" to "authenticated";

grant insert on table "public"."personal_prayers" to "authenticated";

grant references on table "public"."personal_prayers" to "authenticated";

grant select on table "public"."personal_prayers" to "authenticated";

grant trigger on table "public"."personal_prayers" to "authenticated";

grant truncate on table "public"."personal_prayers" to "authenticated";

grant update on table "public"."personal_prayers" to "authenticated";

grant delete on table "public"."personal_prayers" to "service_role";

grant insert on table "public"."personal_prayers" to "service_role";

grant references on table "public"."personal_prayers" to "service_role";

grant select on table "public"."personal_prayers" to "service_role";

grant trigger on table "public"."personal_prayers" to "service_role";

grant truncate on table "public"."personal_prayers" to "service_role";

grant update on table "public"."personal_prayers" to "service_role";

grant delete on table "public"."prayer_prompts" to "anon";

grant insert on table "public"."prayer_prompts" to "anon";

grant references on table "public"."prayer_prompts" to "anon";

grant select on table "public"."prayer_prompts" to "anon";

grant trigger on table "public"."prayer_prompts" to "anon";

grant truncate on table "public"."prayer_prompts" to "anon";

grant update on table "public"."prayer_prompts" to "anon";

grant delete on table "public"."prayer_prompts" to "authenticated";

grant insert on table "public"."prayer_prompts" to "authenticated";

grant references on table "public"."prayer_prompts" to "authenticated";

grant select on table "public"."prayer_prompts" to "authenticated";

grant trigger on table "public"."prayer_prompts" to "authenticated";

grant truncate on table "public"."prayer_prompts" to "authenticated";

grant update on table "public"."prayer_prompts" to "authenticated";

grant delete on table "public"."prayer_prompts" to "service_role";

grant insert on table "public"."prayer_prompts" to "service_role";

grant references on table "public"."prayer_prompts" to "service_role";

grant select on table "public"."prayer_prompts" to "service_role";

grant trigger on table "public"."prayer_prompts" to "service_role";

grant truncate on table "public"."prayer_prompts" to "service_role";

grant update on table "public"."prayer_prompts" to "service_role";

grant delete on table "public"."prayer_types" to "anon";

grant insert on table "public"."prayer_types" to "anon";

grant references on table "public"."prayer_types" to "anon";

grant select on table "public"."prayer_types" to "anon";

grant trigger on table "public"."prayer_types" to "anon";

grant truncate on table "public"."prayer_types" to "anon";

grant update on table "public"."prayer_types" to "anon";

grant delete on table "public"."prayer_types" to "authenticated";

grant insert on table "public"."prayer_types" to "authenticated";

grant references on table "public"."prayer_types" to "authenticated";

grant select on table "public"."prayer_types" to "authenticated";

grant trigger on table "public"."prayer_types" to "authenticated";

grant truncate on table "public"."prayer_types" to "authenticated";

grant update on table "public"."prayer_types" to "authenticated";

grant delete on table "public"."prayer_types" to "service_role";

grant insert on table "public"."prayer_types" to "service_role";

grant references on table "public"."prayer_types" to "service_role";

grant select on table "public"."prayer_types" to "service_role";

grant trigger on table "public"."prayer_types" to "service_role";

grant truncate on table "public"."prayer_types" to "service_role";

grant update on table "public"."prayer_types" to "service_role";

grant delete on table "public"."prayer_updates" to "anon";

grant insert on table "public"."prayer_updates" to "anon";

grant references on table "public"."prayer_updates" to "anon";

grant select on table "public"."prayer_updates" to "anon";

grant trigger on table "public"."prayer_updates" to "anon";

grant truncate on table "public"."prayer_updates" to "anon";

grant update on table "public"."prayer_updates" to "anon";

grant delete on table "public"."prayer_updates" to "authenticated";

grant insert on table "public"."prayer_updates" to "authenticated";

grant references on table "public"."prayer_updates" to "authenticated";

grant select on table "public"."prayer_updates" to "authenticated";

grant trigger on table "public"."prayer_updates" to "authenticated";

grant truncate on table "public"."prayer_updates" to "authenticated";

grant update on table "public"."prayer_updates" to "authenticated";

grant delete on table "public"."prayer_updates" to "service_role";

grant insert on table "public"."prayer_updates" to "service_role";

grant references on table "public"."prayer_updates" to "service_role";

grant select on table "public"."prayer_updates" to "service_role";

grant trigger on table "public"."prayer_updates" to "service_role";

grant truncate on table "public"."prayer_updates" to "service_role";

grant update on table "public"."prayer_updates" to "service_role";

grant delete on table "public"."prayers" to "anon";

grant insert on table "public"."prayers" to "anon";

grant references on table "public"."prayers" to "anon";

grant select on table "public"."prayers" to "anon";

grant trigger on table "public"."prayers" to "anon";

grant truncate on table "public"."prayers" to "anon";

grant update on table "public"."prayers" to "anon";

grant delete on table "public"."prayers" to "authenticated";

grant insert on table "public"."prayers" to "authenticated";

grant references on table "public"."prayers" to "authenticated";

grant select on table "public"."prayers" to "authenticated";

grant trigger on table "public"."prayers" to "authenticated";

grant truncate on table "public"."prayers" to "authenticated";

grant update on table "public"."prayers" to "authenticated";

grant delete on table "public"."prayers" to "service_role";

grant insert on table "public"."prayers" to "service_role";

grant references on table "public"."prayers" to "service_role";

grant select on table "public"."prayers" to "service_role";

grant trigger on table "public"."prayers" to "service_role";

grant truncate on table "public"."prayers" to "service_role";

grant update on table "public"."prayers" to "service_role";

grant delete on table "public"."status_change_requests" to "anon";

grant insert on table "public"."status_change_requests" to "anon";

grant references on table "public"."status_change_requests" to "anon";

grant select on table "public"."status_change_requests" to "anon";

grant trigger on table "public"."status_change_requests" to "anon";

grant truncate on table "public"."status_change_requests" to "anon";

grant update on table "public"."status_change_requests" to "anon";

grant delete on table "public"."status_change_requests" to "authenticated";

grant insert on table "public"."status_change_requests" to "authenticated";

grant references on table "public"."status_change_requests" to "authenticated";

grant select on table "public"."status_change_requests" to "authenticated";

grant trigger on table "public"."status_change_requests" to "authenticated";

grant truncate on table "public"."status_change_requests" to "authenticated";

grant update on table "public"."status_change_requests" to "authenticated";

grant delete on table "public"."status_change_requests" to "service_role";

grant insert on table "public"."status_change_requests" to "service_role";

grant references on table "public"."status_change_requests" to "service_role";

grant select on table "public"."status_change_requests" to "service_role";

grant trigger on table "public"."status_change_requests" to "service_role";

grant truncate on table "public"."status_change_requests" to "service_role";

grant update on table "public"."status_change_requests" to "service_role";

grant delete on table "public"."update_deletion_requests" to "anon";

grant insert on table "public"."update_deletion_requests" to "anon";

grant references on table "public"."update_deletion_requests" to "anon";

grant select on table "public"."update_deletion_requests" to "anon";

grant trigger on table "public"."update_deletion_requests" to "anon";

grant truncate on table "public"."update_deletion_requests" to "anon";

grant update on table "public"."update_deletion_requests" to "anon";

grant delete on table "public"."update_deletion_requests" to "authenticated";

grant insert on table "public"."update_deletion_requests" to "authenticated";

grant references on table "public"."update_deletion_requests" to "authenticated";

grant select on table "public"."update_deletion_requests" to "authenticated";

grant trigger on table "public"."update_deletion_requests" to "authenticated";

grant truncate on table "public"."update_deletion_requests" to "authenticated";

grant update on table "public"."update_deletion_requests" to "authenticated";

grant delete on table "public"."update_deletion_requests" to "service_role";

grant insert on table "public"."update_deletion_requests" to "service_role";

grant references on table "public"."update_deletion_requests" to "service_role";

grant select on table "public"."update_deletion_requests" to "service_role";

grant trigger on table "public"."update_deletion_requests" to "service_role";

grant truncate on table "public"."update_deletion_requests" to "service_role";

grant update on table "public"."update_deletion_requests" to "service_role";

grant delete on table "public"."verification_codes" to "anon";

grant insert on table "public"."verification_codes" to "anon";

grant references on table "public"."verification_codes" to "anon";

grant select on table "public"."verification_codes" to "anon";

grant trigger on table "public"."verification_codes" to "anon";

grant truncate on table "public"."verification_codes" to "anon";

grant update on table "public"."verification_codes" to "anon";

grant delete on table "public"."verification_codes" to "authenticated";

grant insert on table "public"."verification_codes" to "authenticated";

grant references on table "public"."verification_codes" to "authenticated";

grant select on table "public"."verification_codes" to "authenticated";

grant trigger on table "public"."verification_codes" to "authenticated";

grant truncate on table "public"."verification_codes" to "authenticated";

grant update on table "public"."verification_codes" to "authenticated";

grant delete on table "public"."verification_codes" to "service_role";

grant insert on table "public"."verification_codes" to "service_role";

grant references on table "public"."verification_codes" to "service_role";

grant select on table "public"."verification_codes" to "service_role";

grant trigger on table "public"."verification_codes" to "service_role";

grant truncate on table "public"."verification_codes" to "service_role";

grant update on table "public"."verification_codes" to "service_role";


  create policy "Allow delete account approval requests"
  on "public"."account_approval_requests"
  as permissive
  for delete
  to public
using (true);



  create policy "Allow read account approval requests"
  on "public"."account_approval_requests"
  as permissive
  for select
  to public
using (true);



  create policy "Allow update account approval requests"
  on "public"."account_approval_requests"
  as permissive
  for update
  to public
using (true);



  create policy "Anon users can create account approval request"
  on "public"."account_approval_requests"
  as permissive
  for insert
  to anon
with check (true);



  create policy "Authenticated users can create account approval request"
  on "public"."account_approval_requests"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Read account approval requests"
  on "public"."account_approval_requests"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Allow all inserts on admin_settings"
  on "public"."admin_settings"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Allow all updates on admin_settings"
  on "public"."admin_settings"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Allow public reads on admin_settings"
  on "public"."admin_settings"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Authenticated users can insert admin settings"
  on "public"."admin_settings"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Authenticated users can read admin settings"
  on "public"."admin_settings"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Authenticated users can update admin settings"
  on "public"."admin_settings"
  as permissive
  for update
  to authenticated
using (true);



  create policy "authenticated_all_access"
  on "public"."admin_settings"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "public_read_access"
  on "public"."admin_settings"
  as permissive
  for select
  to anon
using (true);



  create policy "Allow anonymous inserts"
  on "public"."analytics"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Allow public reads"
  on "public"."analytics"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Authenticated users can create approval codes"
  on "public"."approval_codes"
  as permissive
  for insert
  to public
with check (true);



  create policy "Service role can manage approval codes"
  on "public"."approval_codes"
  as permissive
  for all
  to public
using ((( SELECT auth.uid() AS uid) IS NOT NULL));



  create policy "Users can view their own approval codes"
  on "public"."approval_codes"
  as permissive
  for select
  to public
using ((( SELECT auth.uid() AS uid) IS NOT NULL));



  create policy "Allow all deletes"
  on "public"."backup_logs"
  as permissive
  for delete
  to anon, authenticated
using (true);



  create policy "Allow all inserts"
  on "public"."backup_logs"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Allow all updates"
  on "public"."backup_logs"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Allow public reads"
  on "public"."backup_logs"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Anyone can read backup logs"
  on "public"."backup_logs"
  as permissive
  for select
  to public
using (true);



  create policy "Service role can insert backup logs"
  on "public"."backup_logs"
  as permissive
  for insert
  to public
with check (true);



  create policy "Admins can manage deletion_requests"
  on "public"."deletion_requests"
  as permissive
  for all
  to public
using (public.is_admin((auth.jwt() ->> 'email'::text)));



  create policy "Anyone can submit deletion requests"
  on "public"."deletion_requests"
  as permissive
  for insert
  to public
with check (true);



  create policy "Anyone can view deletion requests"
  on "public"."deletion_requests"
  as permissive
  for select
  to public
using (true);



  create policy "Only authenticated users can delete deletion requests"
  on "public"."deletion_requests"
  as permissive
  for delete
  to public
using ((( SELECT auth.uid() AS uid) IS NOT NULL));



  create policy "Only authenticated users can update deletion requests"
  on "public"."deletion_requests"
  as permissive
  for update
  to public
using ((( SELECT auth.uid() AS uid) IS NOT NULL));



  create policy "Anyone can enqueue emails"
  on "public"."email_queue"
  as permissive
  for insert
  to public
with check (true);



  create policy "Service role can process queue"
  on "public"."email_queue"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));



  create policy "Allow all deletes"
  on "public"."email_subscribers"
  as permissive
  for delete
  to anon, authenticated
using (true);



  create policy "Allow all updates"
  on "public"."email_subscribers"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Allow authenticated to delete email subscribers"
  on "public"."email_subscribers"
  as permissive
  for delete
  to authenticated
using (true);



  create policy "Allow authenticated to insert email subscribers"
  on "public"."email_subscribers"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Allow authenticated to select email subscribers"
  on "public"."email_subscribers"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Allow authenticated to update email subscribers"
  on "public"."email_subscribers"
  as permissive
  for update
  to authenticated
using (true)
with check (true);



  create policy "Allow public inserts"
  on "public"."email_subscribers"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Allow public reads"
  on "public"."email_subscribers"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Allow service role to delete email subscribers"
  on "public"."email_subscribers"
  as permissive
  for delete
  to service_role
using (true);



  create policy "Allow service role to insert email subscribers"
  on "public"."email_subscribers"
  as permissive
  for insert
  to service_role
with check (true);



  create policy "Allow service role to select email subscribers"
  on "public"."email_subscribers"
  as permissive
  for select
  to service_role
using (true);



  create policy "Allow service role to update email subscribers"
  on "public"."email_subscribers"
  as permissive
  for update
  to service_role
using (true)
with check (true);



  create policy "Anonymous users can check approval status"
  on "public"."email_subscribers"
  as permissive
  for select
  to anon
using (true);



  create policy "Allow all deletes"
  on "public"."email_templates"
  as permissive
  for delete
  to anon, authenticated
using (true);



  create policy "Allow all inserts"
  on "public"."email_templates"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Allow all to read templates"
  on "public"."email_templates"
  as permissive
  for select
  to public
using (true);



  create policy "Allow all updates"
  on "public"."email_templates"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Allow authenticated users to read templates"
  on "public"."email_templates"
  as permissive
  for select
  to public
using ((( SELECT auth.uid() AS uid) IS NOT NULL));



  create policy "Allow authenticated users to update templates"
  on "public"."email_templates"
  as permissive
  for update
  to public
using (((auth.role() = 'authenticated'::text) OR (auth.role() = 'service_role'::text)));



  create policy "Allow public reads"
  on "public"."email_templates"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Admins can see all personal prayer updates"
  on "public"."personal_prayer_updates"
  as permissive
  for select
  to public
using (((auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM public.email_subscribers
  WHERE ((email_subscribers.email = (auth.jwt() ->> 'email'::text)) AND (email_subscribers.is_admin = true) AND (email_subscribers.is_active = true))))));



  create policy "Allow all personal_prayer_updates access"
  on "public"."personal_prayer_updates"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Authenticated users can delete personal prayer updates"
  on "public"."personal_prayer_updates"
  as permissive
  for delete
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Authenticated users can insert personal prayer updates"
  on "public"."personal_prayer_updates"
  as permissive
  for insert
  to public
with check ((auth.uid() IS NOT NULL));



  create policy "Authenticated users can select personal prayer updates"
  on "public"."personal_prayer_updates"
  as permissive
  for select
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Authenticated users can update personal prayer updates"
  on "public"."personal_prayer_updates"
  as permissive
  for update
  to public
using ((auth.uid() IS NOT NULL))
with check ((auth.uid() IS NOT NULL));



  create policy "Users can delete their own personal prayer updates"
  on "public"."personal_prayer_updates"
  as permissive
  for delete
  to public
using (((auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM public.personal_prayers
  WHERE ((personal_prayers.id = personal_prayer_updates.personal_prayer_id) AND (lower(personal_prayers.user_email) = lower((auth.jwt() ->> 'email'::text))))))));



  create policy "Users can insert updates to their own personal prayers"
  on "public"."personal_prayer_updates"
  as permissive
  for insert
  to public
with check (((auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM public.personal_prayers
  WHERE ((personal_prayers.id = personal_prayer_updates.personal_prayer_id) AND (lower(personal_prayers.user_email) = lower((auth.jwt() ->> 'email'::text))))))));



  create policy "Users can see updates to their own personal prayers"
  on "public"."personal_prayer_updates"
  as permissive
  for select
  to public
using (((auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM public.personal_prayers
  WHERE ((personal_prayers.id = personal_prayer_updates.personal_prayer_id) AND (lower(personal_prayers.user_email) = lower((auth.jwt() ->> 'email'::text))))))));



  create policy "Users can update their own personal prayer updates"
  on "public"."personal_prayer_updates"
  as permissive
  for update
  to public
using (((auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM public.personal_prayers
  WHERE ((personal_prayers.id = personal_prayer_updates.personal_prayer_id) AND (lower(personal_prayers.user_email) = lower((auth.jwt() ->> 'email'::text))))))))
with check (((auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM public.personal_prayers
  WHERE ((personal_prayers.id = personal_prayer_updates.personal_prayer_id) AND (lower(personal_prayers.user_email) = lower((auth.jwt() ->> 'email'::text))))))));



  create policy "Admins can see all personal prayers"
  on "public"."personal_prayers"
  as permissive
  for select
  to public
using (((auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM public.email_subscribers
  WHERE ((email_subscribers.email = (auth.jwt() ->> 'email'::text)) AND (email_subscribers.is_admin = true) AND (email_subscribers.is_active = true))))));



  create policy "Allow all personal_prayers access"
  on "public"."personal_prayers"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Authenticated users can delete personal prayers"
  on "public"."personal_prayers"
  as permissive
  for delete
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Authenticated users can insert personal prayers"
  on "public"."personal_prayers"
  as permissive
  for insert
  to public
with check ((auth.uid() IS NOT NULL));



  create policy "Authenticated users can select personal prayers"
  on "public"."personal_prayers"
  as permissive
  for select
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Authenticated users can update personal prayers"
  on "public"."personal_prayers"
  as permissive
  for update
  to public
using ((auth.uid() IS NOT NULL))
with check ((auth.uid() IS NOT NULL));



  create policy "Users can delete their own personal prayers"
  on "public"."personal_prayers"
  as permissive
  for delete
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Users can insert their own personal prayers"
  on "public"."personal_prayers"
  as permissive
  for insert
  to public
with check ((auth.role() = 'authenticated'::text));



  create policy "Users can see their own personal prayers"
  on "public"."personal_prayers"
  as permissive
  for select
  to public
using (((auth.role() = 'authenticated'::text) AND (lower(user_email) = lower((auth.jwt() ->> 'email'::text)))));



  create policy "Users can update their own personal prayers"
  on "public"."personal_prayers"
  as permissive
  for update
  to public
using ((auth.role() = 'authenticated'::text))
with check ((auth.role() = 'authenticated'::text));



  create policy "Allow all deletes"
  on "public"."prayer_prompts"
  as permissive
  for delete
  to anon, authenticated
using (true);



  create policy "Allow all inserts"
  on "public"."prayer_prompts"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Allow all updates"
  on "public"."prayer_prompts"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Allow public reads"
  on "public"."prayer_prompts"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Anyone can manage prompts"
  on "public"."prayer_prompts"
  as permissive
  for all
  to anon, authenticated
using (true)
with check (true);



  create policy "Anyone can read prayer prompts"
  on "public"."prayer_prompts"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Allow all deletes"
  on "public"."prayer_types"
  as permissive
  for delete
  to anon, authenticated
using (true);



  create policy "Allow all inserts"
  on "public"."prayer_types"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Allow all updates"
  on "public"."prayer_types"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Allow public reads"
  on "public"."prayer_types"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Anyone can manage prayer types"
  on "public"."prayer_types"
  as permissive
  for all
  to public
using (true);



  create policy "Anyone can read prayer types"
  on "public"."prayer_types"
  as permissive
  for select
  to public
using (true);



  create policy "Admins can manage prayer_updates"
  on "public"."prayer_updates"
  as permissive
  for all
  to public
using (public.is_admin((auth.jwt() ->> 'email'::text)));



  create policy "Allow all operations on prayer_updates"
  on "public"."prayer_updates"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Enable admin read access for all prayer updates"
  on "public"."prayer_updates"
  as permissive
  for select
  to public
using ((( SELECT auth.uid() AS uid) IS NOT NULL));



  create policy "Enable admin update access for prayer updates"
  on "public"."prayer_updates"
  as permissive
  for update
  to public
using ((( SELECT auth.uid() AS uid) IS NOT NULL));



  create policy "Enable read access for approved updates"
  on "public"."prayer_updates"
  as permissive
  for select
  to public
using (((approval_status)::text = 'approved'::text));



  create policy "Admins can modify all prayers"
  on "public"."prayers"
  as permissive
  for all
  to public
using (public.is_admin((auth.jwt() ->> 'email'::text)));



  create policy "Admins can view all prayers"
  on "public"."prayers"
  as permissive
  for select
  to public
using (public.is_admin((auth.jwt() ->> 'email'::text)));



  create policy "Allow all operations on prayers"
  on "public"."prayers"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Enable admin read access for all prayers"
  on "public"."prayers"
  as permissive
  for select
  to public
using ((( SELECT auth.uid() AS uid) IS NOT NULL));



  create policy "Enable admin update access for prayers"
  on "public"."prayers"
  as permissive
  for update
  to public
using ((( SELECT auth.uid() AS uid) IS NOT NULL));



  create policy "Enable read access for approved prayers"
  on "public"."prayers"
  as permissive
  for select
  to public
using (((approval_status)::text = 'approved'::text));



  create policy "Users can view approved prayers"
  on "public"."prayers"
  as permissive
  for select
  to public
using ((status = 'approved'::text));



  create policy "Admins can manage status_change_requests"
  on "public"."status_change_requests"
  as permissive
  for all
  to public
using (public.is_admin((auth.jwt() ->> 'email'::text)));



  create policy "Allow admin updates to status change requests"
  on "public"."status_change_requests"
  as permissive
  for update
  to public
using (true)
with check (true);



  create policy "Anyone can submit status change requests"
  on "public"."status_change_requests"
  as permissive
  for insert
  to public
with check (true);



  create policy "Anyone can view status change requests"
  on "public"."status_change_requests"
  as permissive
  for select
  to public
using (true);



  create policy "Allow all operations on update_deletion_requests"
  on "public"."update_deletion_requests"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Anyone can insert verification codes"
  on "public"."verification_codes"
  as permissive
  for insert
  to public
with check (true);



  create policy "Anyone can read verification codes"
  on "public"."verification_codes"
  as permissive
  for select
  to public
using (true);



  create policy "Anyone can update verification codes"
  on "public"."verification_codes"
  as permissive
  for update
  to public
using (true);


CREATE TRIGGER account_approval_requests_updated_at BEFORE UPDATE ON public.account_approval_requests FOR EACH ROW EXECUTE FUNCTION public.update_account_approval_requests_updated_at();

CREATE TRIGGER admin_settings_updated_at BEFORE UPDATE ON public.admin_settings FOR EACH ROW EXECUTE FUNCTION public.update_admin_settings_updated_at();

CREATE TRIGGER email_subscribers_updated_at BEFORE UPDATE ON public.email_subscribers FOR EACH ROW EXECUTE FUNCTION public.update_email_subscribers_updated_at();

CREATE TRIGGER email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_email_templates_updated_at();

CREATE TRIGGER update_prayer_prompts_updated_at BEFORE UPDATE ON public.prayer_prompts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prayer_types_timestamp BEFORE UPDATE ON public.prayer_types FOR EACH ROW EXECUTE FUNCTION public.update_prayer_types_updated_at();

CREATE TRIGGER update_prayer_updates_updated_at BEFORE UPDATE ON public.prayer_updates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prayers_updated_at BEFORE UPDATE ON public.prayers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_update_deletion_requests_updated_at BEFORE UPDATE ON public.update_deletion_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions on backup_tables view
grant select on table "public"."backup_tables" to "anon";
grant select on table "public"."backup_tables" to "authenticated";
grant select on table "public"."backup_tables" to "service_role";



-- =====================================================================
-- Former file: 20260125_add_planning_center_list_id.sql
-- =====================================================================

-- Add planning_center_list_id column to email_subscribers table
ALTER TABLE "public"."email_subscribers"
ADD COLUMN "planning_center_list_id" text;

-- Add comment for documentation
COMMENT ON COLUMN "public"."email_subscribers"."planning_center_list_id" IS 'Planning Center list ID that this user is mapped to for filtering prayers by list members';


-- =====================================================================
-- Former file: 20260126_consolidated_member_updates.sql
-- =====================================================================

-- Consolidated member_prayer_updates table setup
-- Includes: table creation, RLS policies, trigger, and column additions

-- Create member_prayer_updates table for updates on Planning Center member cards
CREATE TABLE IF NOT EXISTS "public"."member_prayer_updates" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id text NOT NULL,
  content text NOT NULL,
  is_answered BOOLEAN DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE "public"."member_prayer_updates" ENABLE ROW LEVEL SECURITY;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_member_prayer_updates_person_id ON "public"."member_prayer_updates"(person_id);
CREATE INDEX IF NOT EXISTS idx_member_prayer_updates_created_at ON "public"."member_prayer_updates"(created_at);

-- Add table comment
COMMENT ON TABLE "public"."member_prayer_updates" IS 'Stores updates/comments for Planning Center member prayer cards';
COMMENT ON COLUMN "public"."member_prayer_updates"."person_id" IS 'Unique Planning Center person ID - persists even if name changes';
COMMENT ON COLUMN "public"."member_prayer_updates"."is_answered" IS 'Whether this prayer update has been answered';

-- Create RLS policies (permissive - security handled at application level)
CREATE POLICY "Allow all select on member_prayer_updates" 
ON "public"."member_prayer_updates" 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all insert on member_prayer_updates" 
ON "public"."member_prayer_updates" 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow all update on member_prayer_updates" 
ON "public"."member_prayer_updates" 
FOR UPDATE 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all delete on member_prayer_updates" 
ON "public"."member_prayer_updates" 
FOR DELETE 
USING (true);

-- Grant roles access to the table
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."member_prayer_updates" TO "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."member_prayer_updates" TO "authenticated";

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_member_prayer_updates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER member_prayer_updates_update_timestamp
BEFORE UPDATE ON "public"."member_prayer_updates"
FOR EACH ROW
EXECUTE FUNCTION update_member_prayer_updates_timestamp();


-- =====================================================================
-- Former file: 20260128214421_drop_approval_codes_table.sql
-- =====================================================================

-- Drop the approval_codes table and related objects
-- This table was used for one-time admin approval links but is no longer needed
-- Admin notifications now link directly to /admin portal requiring standard login

-- Drop the cleanup function first
DROP FUNCTION IF EXISTS cleanup_expired_approval_codes();

-- Drop the table (CASCADE will drop all dependent objects including indexes and constraints)
DROP TABLE IF EXISTS approval_codes CASCADE;


-- =====================================================================
-- Former file: 20260128214944_restrict_backup_tables_view.sql
-- =====================================================================

-- Restrict access to backup_tables view
-- This view lists all tables in the database and should only be accessible to service_role

-- Revoke public access
REVOKE ALL ON TABLE "public"."backup_tables" FROM "anon";
REVOKE ALL ON TABLE "public"."backup_tables" FROM "authenticated";

-- Only service_role should have access
GRANT SELECT ON TABLE "public"."backup_tables" TO "service_role";


-- =====================================================================
-- Former file: 20260201_drop_status_change_requests.sql
-- =====================================================================

-- Drop status_change_requests table
-- This table was created to handle prayer status change approval requests but the feature was never fully implemented.
-- The admin UI never displays or handles these requests, so removing the table to simplify the schema.

-- Drop the table and its associated indexes
drop table if exists public.status_change_requests;


-- =====================================================================
-- Former file: 20260203_add_branding_last_modified.sql
-- =====================================================================

-- Add last_modified column to admin_settings for branding cache optimization
ALTER TABLE "public"."admin_settings" ADD COLUMN "branding_last_modified" timestamp with time zone DEFAULT now();

-- Create a function to automatically update branding_last_modified when branding fields change
CREATE OR REPLACE FUNCTION update_branding_last_modified()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update branding_last_modified if branding-related fields actually changed
  IF (
    OLD.use_logo IS DISTINCT FROM NEW.use_logo OR
    OLD.light_mode_logo_blob IS DISTINCT FROM NEW.light_mode_logo_blob OR
    OLD.dark_mode_logo_blob IS DISTINCT FROM NEW.dark_mode_logo_blob OR
    OLD.app_title IS DISTINCT FROM NEW.app_title OR
    OLD.app_subtitle IS DISTINCT FROM NEW.app_subtitle
  ) THEN
    NEW.branding_last_modified = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update branding_last_modified on admin_settings changes
DROP TRIGGER IF EXISTS admin_settings_branding_modified_trigger ON "public"."admin_settings";

CREATE TRIGGER admin_settings_branding_modified_trigger
BEFORE UPDATE ON "public"."admin_settings"
FOR EACH ROW
EXECUTE FUNCTION update_branding_last_modified();


-- =====================================================================
-- Former file: 20260204_add_email_queue_processing_lock.sql
-- =====================================================================

-- Add processing_started_at column to email_queue for concurrent execution safety
-- This allows multiple instances of the email processor to safely work without duplicates

ALTER TABLE "public"."email_queue" ADD COLUMN "processing_started_at" timestamp with time zone;

-- Add index on status for faster queries
CREATE INDEX IF NOT EXISTS email_queue_status_idx ON "public"."email_queue"(status);

-- Add comment explaining the processing workflow
COMMENT ON COLUMN "public"."email_queue"."processing_started_at" IS 'Timestamp when email processing started. Used to prevent duplicate processing if multiple instances run concurrently. Workflow: pending -> processing -> success/failed';


-- =====================================================================
-- Former file: 20260204_fix_email_queue_status_constraint.sql
-- =====================================================================

-- Fix email_queue status check constraint to include 'processing' status
-- This is needed for the concurrent execution safety feature

-- Drop the old constraint
ALTER TABLE "public"."email_queue" DROP CONSTRAINT IF EXISTS "email_queue_status_check";

-- Add new constraint with 'processing' status included
ALTER TABLE "public"."email_queue" ADD CONSTRAINT "email_queue_status_check" CHECK (status IN ('pending', 'processing', 'failed'));


-- =====================================================================
-- Former file: 20260208_add_is_shared_personal_prayer.sql
-- =====================================================================

-- Add is_shared_personal_prayer column to prayers table
-- This column indicates when a prayer originated from a user's personal prayer share
-- When true: the prayer and its updates are treated as a single approval unit

ALTER TABLE "public"."prayers"
ADD COLUMN "is_shared_personal_prayer" boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN "public"."prayers"."is_shared_personal_prayer" IS 'Indicates if this prayer was shared from a user''s personal prayer. When true, prayer and updates are approved as a single unit.';


-- =====================================================================
-- Former file: 20260218_capacitor_device_tokens_and_push_log.sql
-- =====================================================================

-- Capacitor push notifications: device_tokens, push_notification_log, grants, and RLS.
-- Single migration for easier production rollout. Edge Function uses service_role (bypasses RLS).

-- 1. Tables
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email VARCHAR(255) NOT NULL,
  token VARCHAR(1000) NOT NULL UNIQUE,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_email) REFERENCES public.email_subscribers(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_email ON public.device_tokens(user_email);
CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON public.device_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_device_tokens_last_seen ON public.device_tokens(last_seen_at);

COMMENT ON TABLE public.device_tokens IS 'Stores device tokens for push notification delivery to native apps (iOS/Android)';
COMMENT ON COLUMN public.device_tokens.token IS 'Unique device token from Firebase (Android) or APNs (iOS)';
COMMENT ON COLUMN public.device_tokens.platform IS 'Platform of the device: ios, android, or web';
COMMENT ON COLUMN public.device_tokens.last_seen_at IS 'Last time this device checked in or received a notification';

CREATE TABLE IF NOT EXISTS public.push_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token_id UUID NOT NULL REFERENCES public.device_tokens(id) ON DELETE CASCADE,
  title VARCHAR(255),
  body TEXT,
  data JSONB,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  delivery_status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  user_email VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_log_device_token ON public.push_notification_log(device_token_id);
CREATE INDEX IF NOT EXISTS idx_push_log_sent_at ON public.push_notification_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_push_log_user_email ON public.push_notification_log(user_email);
CREATE INDEX IF NOT EXISTS idx_push_log_status ON public.push_notification_log(delivery_status);

COMMENT ON TABLE public.push_notification_log IS 'Log of push notifications sent via Firebase/APNs for monitoring and debugging';
COMMENT ON COLUMN public.push_notification_log.delivery_status IS 'Status of notification delivery: pending, sent, or failed';

-- 2. Grants (Edge Function uses service_role; anon/authenticated need table access for RLS policies)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.device_tokens TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_notification_log TO anon, authenticated, service_role;

-- 3. RLS and policies (authenticated users see only their own rows; service_role bypasses RLS)
-- Safe to re-run: tables/indexes/grants are IF NOT EXISTS or idempotent; policies are dropped then recreated.
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_tokens_select_own" ON public.device_tokens;
CREATE POLICY "device_tokens_select_own"
  ON public.device_tokens FOR SELECT TO authenticated
  USING (lower(user_email) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "device_tokens_insert_own" ON public.device_tokens;
CREATE POLICY "device_tokens_insert_own"
  ON public.device_tokens FOR INSERT TO authenticated
  WITH CHECK (lower(user_email) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "device_tokens_update_own" ON public.device_tokens;
CREATE POLICY "device_tokens_update_own"
  ON public.device_tokens FOR UPDATE TO authenticated
  USING (lower(user_email) = lower(auth.jwt() ->> 'email'))
  WITH CHECK (lower(user_email) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "device_tokens_delete_own" ON public.device_tokens;
CREATE POLICY "device_tokens_delete_own"
  ON public.device_tokens FOR DELETE TO authenticated
  USING (lower(user_email) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "push_notification_log_select_own" ON public.push_notification_log;
CREATE POLICY "push_notification_log_select_own"
  ON public.push_notification_log FOR SELECT TO authenticated
  USING (lower(user_email) = lower(auth.jwt() ->> 'email'));


-- =====================================================================
-- Former file: 20260219_device_tokens_anon_policies.sql
-- =====================================================================

-- Allow anon to SELECT, INSERT, UPDATE, DELETE on device_tokens so the app can register
-- devices without a Supabase Auth session (e.g. MFA-only login). FK still requires
-- user_email to exist in email_subscribers. Keeps original pre-RLS behavior for registration.
-- Safe to re-run: policies are dropped then recreated.

DROP POLICY IF EXISTS "device_tokens_anon_all" ON public.device_tokens;
CREATE POLICY "device_tokens_anon_all"
  ON public.device_tokens FOR ALL TO anon
  USING (true)
  WITH CHECK (true);


-- =====================================================================
-- Former file: 20260220_email_subscribers_receive_push.sql
-- =====================================================================

-- Add push notification preference to email_subscribers.
-- Default true preserves existing behavior (all current subscribers receive push until they opt out).
ALTER TABLE public.email_subscribers
  ADD COLUMN IF NOT EXISTS receive_push boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.email_subscribers.receive_push IS 'Whether the subscriber wants to receive push notifications (Capacitor app).';


-- =====================================================================
-- Former file: 20260221_admin_not_tied_to_is_active.sql
-- =====================================================================

-- Decouple admin access from is_active. Admin is determined by is_admin only.
-- is_active now controls only email subscriptions; admins can turn off email and still access admin.

DROP POLICY IF EXISTS "Admins can see all personal prayer updates" ON public.personal_prayer_updates;
CREATE POLICY "Admins can see all personal prayer updates"
  ON public.personal_prayer_updates
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (
    (auth.role() = 'authenticated')
    AND (EXISTS (
      SELECT 1 FROM public.email_subscribers
      WHERE email_subscribers.email = (auth.jwt() ->> 'email')
        AND email_subscribers.is_admin = true
    ))
  );

DROP POLICY IF EXISTS "Admins can see all personal prayers" ON public.personal_prayers;
CREATE POLICY "Admins can see all personal prayers"
  ON public.personal_prayers
  AS PERMISSIVE
  FOR SELECT
  TO public
  USING (
    (auth.role() = 'authenticated')
    AND (EXISTS (
      SELECT 1 FROM public.email_subscribers
      WHERE email_subscribers.email = (auth.jwt() ->> 'email')
        AND email_subscribers.is_admin = true
    ))
  );


-- =====================================================================
-- Former file: 20260222_email_subscribers_receive_admin_push.sql
-- =====================================================================

-- Add admin push notification preference to email_subscribers.
-- Only applies when is_admin is true; default false so admins opt in or are opted in when added.
ALTER TABLE public.email_subscribers
  ADD COLUMN IF NOT EXISTS receive_admin_push boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.email_subscribers.receive_admin_push IS 'Whether the admin wants to receive admin alert push notifications (Capacitor app). Only applies when is_admin is true.';


-- =====================================================================
-- Former file: 20260223_receive_push_default_false.sql
-- =====================================================================

-- receive_push should be true only when the user has installed the app and has a device_token.
-- Default to false for new subscribers; set to true only when a device token is registered (app code).
ALTER TABLE public.email_subscribers
  ALTER COLUMN receive_push SET DEFAULT false;

-- Backfill: set receive_push = false for subscribers who have no device token.
UPDATE public.email_subscribers es
SET receive_push = false
WHERE es.receive_push = true
  AND NOT EXISTS (
    SELECT 1 FROM public.device_tokens dt
    WHERE dt.user_email = es.email
  );

COMMENT ON COLUMN public.email_subscribers.receive_push IS 'Whether the subscriber wants to receive push notifications (Capacitor app). Set true only when a device token is registered.';


-- =====================================================================
-- Former file: 20260224_prayer_encouragement.sql
-- =====================================================================

-- Prayer Encouragement: prayed_for count on prayers and admin toggle

-- Add prayed_for_count to prayers (incremented when users click "Pray For")
ALTER TABLE public.prayers
  ADD COLUMN IF NOT EXISTS prayed_for_count integer NOT NULL DEFAULT 0;

-- Add prayer_encouragement_enabled to admin_settings (single row id=1)
ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS prayer_encouragement_enabled boolean NOT NULL DEFAULT false;

-- RPC so any user (including anon) can increment without direct UPDATE on prayers
CREATE OR REPLACE FUNCTION public.increment_prayed_for_count(prayer_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE prayers
  SET prayed_for_count = COALESCE(prayed_for_count, 0) + 1
  WHERE id = prayer_id
  RETURNING prayed_for_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

-- Allow anon and authenticated to call the RPC
GRANT EXECUTE ON FUNCTION public.increment_prayed_for_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_prayed_for_count(uuid) TO authenticated;


-- =====================================================================
-- Former file: 20260225_prayer_encouragement_cooldown_hours.sql
-- =====================================================================

-- Prayer Encouragement: configurable cooldown hours (how long before user can click Pray For again on same prayer)

ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS prayer_encouragement_cooldown_hours integer NOT NULL DEFAULT 4;

-- Constrain to 1–168 hours (1 hour to 1 week)
ALTER TABLE public.admin_settings
  DROP CONSTRAINT IF EXISTS prayer_encouragement_cooldown_hours_range;

ALTER TABLE public.admin_settings
  ADD CONSTRAINT prayer_encouragement_cooldown_hours_range
  CHECK (prayer_encouragement_cooldown_hours >= 1 AND prayer_encouragement_cooldown_hours <= 168);


-- =====================================================================
-- Former file: 20260226_prayers_updated_at_skip_prayed_for.sql
-- =====================================================================

-- Don't advance prayers.updated_at when only prayed_for_count changes,
-- so reminder logic (based on last activity) isn't pushed out by "Pray For" clicks.

CREATE OR REPLACE FUNCTION public.update_prayers_updated_at_skip_prayed_for()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- If the only change is prayed_for_count, keep the existing updated_at
  IF (OLD.prayed_for_count IS DISTINCT FROM NEW.prayed_for_count)
     AND (OLD.id IS NOT DISTINCT FROM NEW.id)
     AND (OLD.title IS NOT DISTINCT FROM NEW.title)
     AND (OLD.description IS NOT DISTINCT FROM NEW.description)
     AND (OLD.status IS NOT DISTINCT FROM NEW.status)
     AND (OLD.requester IS NOT DISTINCT FROM NEW.requester)
     AND (OLD.date_requested IS NOT DISTINCT FROM NEW.date_requested)
     AND (OLD.date_answered IS NOT DISTINCT FROM NEW.date_answered)
     AND (OLD.created_at IS NOT DISTINCT FROM NEW.created_at)
     AND (OLD.approval_status IS NOT DISTINCT FROM NEW.approval_status)
     AND (OLD.approved_at IS NOT DISTINCT FROM NEW.approved_at)
     AND (OLD.denial_reason IS NOT DISTINCT FROM NEW.denial_reason)
     AND (OLD.email IS NOT DISTINCT FROM NEW.email)
     AND (OLD.is_anonymous IS NOT DISTINCT FROM NEW.is_anonymous)
     AND (OLD.prayer_for IS NOT DISTINCT FROM NEW.prayer_for)
     AND (OLD.last_reminder_sent IS NOT DISTINCT FROM NEW.last_reminder_sent)
     AND (OLD.is_seed_data IS NOT DISTINCT FROM NEW.is_seed_data)
     AND (OLD.denied_at IS NOT DISTINCT FROM NEW.denied_at)
  THEN
    NEW.updated_at = OLD.updated_at;
  ELSE
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_prayers_updated_at ON public.prayers;
CREATE TRIGGER update_prayers_updated_at
  BEFORE UPDATE ON public.prayers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_prayers_updated_at_skip_prayed_for();


-- =====================================================================
-- Former file: 20260305_test_account_settings.sql
-- =====================================================================

-- Add test account settings to admin_settings for app testing (no email sent; configurable codes per MFA length)
ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS test_account_email text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS test_account_code_4 text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS test_account_code_6 text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS test_account_code_8 text DEFAULT NULL;

COMMENT ON COLUMN public.admin_settings.test_account_email IS 'Email of the account used for Apple/Android app testing; when set, no verification email is sent and codes come from test_account_code_4/6/8';
COMMENT ON COLUMN public.admin_settings.test_account_code_4 IS 'Fixed MFA code for test account when verification_code_length is 4';
COMMENT ON COLUMN public.admin_settings.test_account_code_6 IS 'Fixed MFA code for test account when verification_code_length is 6';
COMMENT ON COLUMN public.admin_settings.test_account_code_8 IS 'Fixed MFA code for test account when verification_code_length is 8';


-- =====================================================================
-- Former file: 20260315120000_user_prayer_hour_reminders.sql
-- =====================================================================

-- Per-user hourly prayer reminders (self nudges), anon access for MFA clients, and default email template.
-- Queried by Edge Function send-user-hourly-prayer-reminders (SQL-side hour match).

CREATE TABLE IF NOT EXISTS public.user_prayer_hour_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL,
  iana_timezone text NOT NULL,
  local_hour smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_prayer_hour_reminders_local_hour_check CHECK (
    local_hour >= 0 AND local_hour <= 23
  ),
  CONSTRAINT user_prayer_hour_reminders_user_email_fkey
    FOREIGN KEY (user_email) REFERENCES public.email_subscribers (email) ON DELETE CASCADE,
  CONSTRAINT user_prayer_hour_reminders_unique_slot UNIQUE (user_email, iana_timezone, local_hour)
);

CREATE INDEX IF NOT EXISTS idx_user_prayer_hour_reminders_user_email
  ON public.user_prayer_hour_reminders (user_email);

COMMENT ON TABLE public.user_prayer_hour_reminders IS
  'User-chosen local clock hours (per IANA timezone) for hourly prayer self-reminders; matched in SQL for minimal egress.';

ALTER TABLE public.user_prayer_hour_reminders ENABLE ROW LEVEL SECURITY;

-- Authenticated users: own rows only (match JWT email case-insensitively)
-- DROP first so re-runs after a partial migration do not fail (42710 policy already exists).
DROP POLICY IF EXISTS "user_prayer_hour_reminders_select_own" ON public.user_prayer_hour_reminders;
CREATE POLICY "user_prayer_hour_reminders_select_own"
  ON public.user_prayer_hour_reminders FOR SELECT TO authenticated
  USING (lower(user_email) = lower((auth.jwt() ->> 'email')));

DROP POLICY IF EXISTS "user_prayer_hour_reminders_insert_own" ON public.user_prayer_hour_reminders;
CREATE POLICY "user_prayer_hour_reminders_insert_own"
  ON public.user_prayer_hour_reminders FOR INSERT TO authenticated
  WITH CHECK (lower(user_email) = lower((auth.jwt() ->> 'email')));

DROP POLICY IF EXISTS "user_prayer_hour_reminders_delete_own" ON public.user_prayer_hour_reminders;
CREATE POLICY "user_prayer_hour_reminders_delete_own"
  ON public.user_prayer_hour_reminders FOR DELETE TO authenticated
  USING (lower(user_email) = lower((auth.jwt() ->> 'email')));

GRANT SELECT, INSERT, DELETE ON TABLE public.user_prayer_hour_reminders TO authenticated;
GRANT ALL ON TABLE public.user_prayer_hour_reminders TO service_role;

-- MFA / localStorage auth: browser uses anon key without Supabase JWT (same pattern as device_tokens).
-- Do not use TO public — that applies to every role and ORs with JWT policies, bypassing ownership for
-- authenticated sessions. Scope open access to role anon only. Anon has no auth.jwt() email for row checks.
GRANT SELECT, INSERT, DELETE ON TABLE public.user_prayer_hour_reminders TO anon;

DROP POLICY IF EXISTS "Allow all user_prayer_hour_reminders access" ON public.user_prayer_hour_reminders;
DROP POLICY IF EXISTS "anon_user_prayer_hour_reminders_mfa_access" ON public.user_prayer_hour_reminders;

CREATE POLICY "anon_user_prayer_hour_reminders_mfa_access"
  ON public.user_prayer_hour_reminders
  AS PERMISSIVE
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "anon_user_prayer_hour_reminders_mfa_access" ON public.user_prayer_hour_reminders IS
  'MFA/localStorage clients use the anon API key (no user JWT). Scoped to role anon so authenticated users use JWT policies above.';

-- Returns only rows whose local wall hour in iana_timezone equals local_hour right now (server UTC "now").
CREATE OR REPLACE FUNCTION public.get_user_prayer_hour_reminders_due_now()
RETURNS SETOF public.user_prayer_hour_reminders
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.*
  FROM public.user_prayer_hour_reminders r
  WHERE EXTRACT(HOUR FROM (NOW() AT TIME ZONE r.iana_timezone))::integer = r.local_hour;
$$;

REVOKE ALL ON FUNCTION public.get_user_prayer_hour_reminders_due_now() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_prayer_hour_reminders_due_now() TO service_role;

-- Email template: {{appLink}} from Edge Function secret APP_URL (match environment.appUrl in prod).
INSERT INTO public.email_templates (template_key, name, subject, html_body, text_body, description)
VALUES (
  'user_hourly_prayer_reminder',
  'User hourly prayer reminder',
  'Time to pray',
  $html$<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#3b82f6,#2563eb);padding:20px 24px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">Time to pray</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 20px;">
              <p style="margin:0 0 20px;color:#1f2937;font-size:16px;line-height:1.5;">Take a moment to pray.</p>
              <div style="text-align:center;margin:8px 0 24px;">
                <a href="{{appLink}}" style="background:#2563eb;color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;font-size:15px;">Open prayer app</a>
              </div>
              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">You can turn off these reminders anytime in <strong style="color:#4b5563;">Settings</strong> → <strong style="color:#4b5563;">Prayer reminders</strong> in the app.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$html$,
  E'Time to pray\n\nTake a moment to pray.\n\nOpen the app:\n{{appLink}}\n\nTo stop these reminders: Settings → Prayer reminders in the app.\n',
  'Hourly self-nudge from user settings. Uses {{appLink}} (Edge APP_URL / environment.appUrl).'
)
ON CONFLICT (template_key) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  html_body = EXCLUDED.html_body,
  text_body = EXCLUDED.text_body,
  description = EXCLUDED.description,
  updated_at = now();

-- =====================================================================
-- Former file: 20260316130000_schedule_user_hourly_prayer_reminders_cron.sql
-- =====================================================================

-- Hourly invocation of Edge Function send-user-hourly-prayer-reminders via pg_cron + pg_net.
-- Replaces GitHub Action .github/workflows/send-user-hourly-prayer-reminders.yml (removed from repo).
--
-- PREREQUISITE (run in Supabase SQL Editor if these Vault secrets do not exist yet):
--   select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
--   select vault.create_secret('YOUR_SUPABASE_SECRET_KEY', 'service_role_key');
-- Use the same secret API key as GitHub secret SUPABASE_SECRET_KEY / Dashboard Settings → API Keys.
-- See docs/SETUP.md (Supabase Vault + user hourly prayer reminders cron).

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotent: remove previous job when migration is re-applied
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT j.jobid INTO jid
  FROM cron.job j
  WHERE j.jobname = 'invoke-user-hourly-prayer-reminders';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'invoke-user-hourly-prayer-reminders',
  '0 * * * *', -- every hour at minute 0 (UTC)
  $$
  SELECT net.http_post(
    url := (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.name = 'project_url' LIMIT 1)
      || '/functions/v1/send-user-hourly-prayer-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer ' || (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);


-- =====================================================================
-- Former file: 20260317120000_schedule_send_prayer_reminders_cron.sql
-- =====================================================================

-- Daily invocation of Edge Function send-prayer-reminders (community reminder emails + auto-archive) via pg_cron + pg_net.
-- Replaces GitHub Action .github/workflows/send-prayer-reminders.yml (removed from repo).
--
-- Uses the same Vault secrets as user hourly reminders: project_url, service_role_key.
-- See docs/SETUP.md (User hourly prayer reminders + Community prayer reminders).
--
-- timeout_milliseconds: batch work can exceed 2 minutes; increase if net._http_response shows timeouts
-- or align with your Supabase Edge Function max duration.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT j.jobid INTO jid
  FROM cron.job j
  WHERE j.jobname = 'invoke-send-prayer-reminders';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'invoke-send-prayer-reminders',
  '0 10 * * *', -- daily 10:00 UTC (same as former GitHub workflow)
  $$
  SELECT net.http_post(
    url := (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.name = 'project_url' LIMIT 1)
      || '/functions/v1/send-prayer-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer ' || (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);


-- =====================================================================
-- Former file: 20260318120000_schedule_cleanup_device_tokens_cron.sql
-- =====================================================================

-- Daily invocation of Edge Function cleanup-device-tokens via pg_cron + pg_net.
-- Replaces GitHub Action .github/workflows/cleanup-device-tokens.yml (removed from repo).
--
-- Same Vault secrets as other scheduled Edge invokes: project_url, service_role_key.
-- See docs/SETUP.md (Device token cleanup).

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT j.jobid INTO jid
  FROM cron.job j
  WHERE j.jobname = 'invoke-cleanup-device-tokens';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'invoke-cleanup-device-tokens',
  '0 3 * * *', -- daily 03:00 UTC (same as former GitHub workflow)
  $$
  SELECT net.http_post(
    url := (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.name = 'project_url' LIMIT 1)
      || '/functions/v1/cleanup-device-tokens',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization',
      'Bearer ' || (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
