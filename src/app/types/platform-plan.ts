import type { MemorizationPracticeMode } from './memorization';

export type PlatformPlanTier = 'free' | 'pro' | 'churches';

export type UserIndividualPlanTier = 'free' | 'pro';

export interface UserGroupLimits {
  individual_plan_tier: UserIndividualPlanTier;
  is_church_member: boolean;
  max_groups_owned: number;
  max_members_per_group: number;
  groups_owned: number;
  can_create_group: boolean;
}

export interface UserMemorizationPracticeModes {
  individual_plan_tier: UserIndividualPlanTier;
  is_church_member: boolean;
  practice_modes: MemorizationPracticeMode[];
}

export interface PlatformPlanLimitRow {
  plan_tier: PlatformPlanTier;
  max_groups_owned: number;
  max_members_per_group: number;
  updated_at?: string;
  updated_by_email?: string | null;
}

export interface PlatformPlanPracticeModeRow {
  plan_tier: PlatformPlanTier;
  practice_mode: MemorizationPracticeMode;
  enabled: boolean;
  updated_at?: string;
  updated_by_email?: string | null;
}

export interface PlatformPlanSettings {
  limits: PlatformPlanLimitRow[];
  practice_modes: PlatformPlanPracticeModeRow[];
}
