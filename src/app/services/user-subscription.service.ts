import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import type {
  UserGroupLimits,
  UserMemorizationPracticeModes,
} from '../types/platform-plan';
import type { MemorizationPracticeMode } from '../types/memorization';
import { SupabaseService } from './supabase.service';
import { AuthIdentityService } from './auth-identity.service';

const DEFAULT_GROUP_LIMITS: UserGroupLimits = {
  individual_plan_tier: 'free',
  is_church_member: false,
  max_groups_owned: 1,
  max_members_per_group: 5,
  groups_owned: 0,
  can_create_group: true,
};

const DEFAULT_PRACTICE_MODES: MemorizationPracticeMode[] = [
  'type',
  'firstLetters',
  'word',
  'reorder',
];

@Injectable({
  providedIn: 'root',
})
export class UserSubscriptionService {
  private groupLimitsSubject = new BehaviorSubject<UserGroupLimits>(DEFAULT_GROUP_LIMITS);
  private practiceModesSubject = new BehaviorSubject<MemorizationPracticeMode[]>(
    DEFAULT_PRACTICE_MODES
  );
  private proBillingPortalSubject = new BehaviorSubject(false);

  readonly groupLimits$ = this.groupLimitsSubject.asObservable();
  readonly practiceModes$ = this.practiceModesSubject.asObservable();
  readonly hasProBillingPortal$ = this.proBillingPortalSubject.asObservable();

  constructor(
    private supabase: SupabaseService,
    private authIdentity: AuthIdentityService
  ) {}

  getGroupLimits(): UserGroupLimits {
    return this.groupLimitsSubject.value;
  }

  getPracticeModes(): MemorizationPracticeMode[] {
    return this.practiceModesSubject.value;
  }

  isPracticeModeAllowed(mode: MemorizationPracticeMode): boolean {
    return this.practiceModesSubject.value.includes(mode);
  }

  hasProBillingPortal(): boolean {
    return this.proBillingPortalSubject.value;
  }

  async refreshCapabilities(): Promise<void> {
    const email = await this.authIdentity.getEmail();
    if (!email) {
      this.groupLimitsSubject.next(DEFAULT_GROUP_LIMITS);
      this.practiceModesSubject.next(DEFAULT_PRACTICE_MODES);
      this.proBillingPortalSubject.next(false);
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const [limitsResult, modesResult, subResult] = await Promise.all([
      this.supabase.client.rpc('get_user_group_limits', { p_email: email }),
      this.supabase.client.rpc('get_user_memorization_practice_modes', { p_email: email }),
      this.supabase.client
        .from('user_subscriptions')
        .select('plan_tier, plan_status, stripe_customer_id')
        .eq('user_email', normalizedEmail)
        .maybeSingle(),
    ]);

    if (!limitsResult.error && limitsResult.data) {
      this.groupLimitsSubject.next(limitsResult.data as UserGroupLimits);
    } else if (limitsResult.error) {
      console.error('[UserSubscription] get_user_group_limits failed:', limitsResult.error);
    }

    if (!modesResult.error && modesResult.data) {
      const payload = modesResult.data as UserMemorizationPracticeModes;
      this.practiceModesSubject.next(payload.practice_modes ?? DEFAULT_PRACTICE_MODES);
    } else if (modesResult.error) {
      console.error(
        '[UserSubscription] get_user_memorization_practice_modes failed:',
        modesResult.error
      );
    }

    if (subResult.error) {
      console.error('[UserSubscription] user_subscriptions select failed:', subResult.error);
      this.proBillingPortalSubject.next(false);
    } else {
      const customerId = subResult.data?.stripe_customer_id;
      this.proBillingPortalSubject.next(
        typeof customerId === 'string' && customerId.trim().length > 0
      );
    }
  }

  async registerFreeUser(displayName: string): Promise<boolean> {
    const email = await this.authIdentity.getEmail();
    if (!email?.trim()) {
      return false;
    }
    const { error } = await this.supabase.client.rpc('upsert_user_subscription_free', {
      p_email: email.toLowerCase().trim(),
      p_display_name: displayName.trim() || null,
    });
    if (error) {
      console.error('[UserSubscription] upsert_user_subscription_free failed:', error);
      return false;
    }
    await this.refreshCapabilities();
    return true;
  }
}
