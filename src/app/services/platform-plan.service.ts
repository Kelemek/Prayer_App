import { Injectable } from '@angular/core';
import type {
  PlatformPlanSettings,
  PlatformPlanTier,
} from '../types/platform-plan';
import type { MemorizationPracticeMode } from '../types/memorization';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class PlatformPlanService {
  constructor(private supabase: SupabaseService) {}

  async loadSettings(): Promise<PlatformPlanSettings | null> {
    const { data, error } = await this.supabase.client.rpc('list_platform_plan_settings');
    if (error) {
      console.error('[PlatformPlan] list_platform_plan_settings failed:', error);
      return null;
    }
    return data as PlatformPlanSettings;
  }

  async saveGroupLimits(
    planTier: PlatformPlanTier,
    maxGroupsOwned: number,
    maxMembersPerGroup: number
  ): Promise<boolean> {
    const { error } = await this.supabase.client.rpc('update_platform_plan_limits', {
      p_plan_tier: planTier,
      p_max_groups_owned: maxGroupsOwned,
      p_max_members_per_group: maxMembersPerGroup,
    });
    if (error) {
      console.error('[PlatformPlan] update_platform_plan_limits failed:', error);
      return false;
    }
    return true;
  }

  async savePracticeModes(
    planTier: PlatformPlanTier,
    modes: Partial<Record<MemorizationPracticeMode, boolean>>
  ): Promise<boolean> {
    const { error } = await this.supabase.client.rpc('update_platform_plan_practice_modes', {
      p_plan_tier: planTier,
      p_modes: modes,
    });
    if (error) {
      console.error('[PlatformPlan] update_platform_plan_practice_modes failed:', error);
      return false;
    }
    return true;
  }
}
