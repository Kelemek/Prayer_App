import type { SupabaseService } from '../services/supabase.service';
import type { AuthIdentityService } from '../services/auth-identity.service';
import type { ConnectivityService } from '../services/connectivity.service';
import type { ToastService } from '../services/toast.service';
import type { UserSessionService } from '../services/user-session.service';
import type { EmailNotificationService } from '../services/email-notification.service';
import type { CacheService } from '../services/cache.service';
import type { PrayerRequest } from './prayer-types';

export interface PrayerGroupHostBridge {
  loadGroupPrayers(
    groupId: string | null,
    silentRefresh?: boolean
  ): Promise<PrayerRequest[]>;
  hydrateGroupPrayers(options: {
    force: boolean;
    focusGroupId?: string | null;
  }): Promise<void>;
}

export interface PrayerGroupOpsDeps {
  supabase: SupabaseService;
  authIdentity: AuthIdentityService;
  connectivity: ConnectivityService;
  toast: ToastService;
  userSession: UserSessionService;
  emailNotification: EmailNotificationService;
  cache: CacheService;
  refreshGroupBadgeCounts(): void;
}

export function prayerGroupErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: string }).message;
    if (message) {
      return message;
    }
  }
  return fallback;
}
