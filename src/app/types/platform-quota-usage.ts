export interface PlatformQuotaUsageUserRow {
  email: string;
  individual_plan_tier: string;
  is_church_member: boolean;
  groups_owned: number;
  max_groups_owned: number;
  max_members_per_group: number;
  largest_group_members: number;
  recite_estimated_cost_usd: number;
  recite_whisper_audio_seconds: number;
}

export interface PlatformQuotaUsageTenantRow {
  id: string;
  name: string;
  slug: string;
  plan_tier: string;
  plan_status: string;
  groups_created_from_tenant: number;
  recite_attempt_count: number;
  recite_whisper_attempt_count: number;
  recite_billable_audio_seconds: number;
  recite_estimated_cost_usd: number;
}

export interface PlatformQuotaUsageSnapshot {
  users: PlatformQuotaUsageUserRow[];
  tenants: PlatformQuotaUsageTenantRow[];
}
