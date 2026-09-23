import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { AdminAuthService } from './admin-auth.service';
import { AuthIdentityService } from './auth-identity.service';
import { TenantContextService } from './tenant-context.service';
import { first } from 'rxjs/operators';
import type { UserPrayerHourReminderSlot } from '../types/user-prayer-hour-reminder';
import type { UserHourReminderSlot } from '../types/user-hour-reminder';
import type { PrayerItemReminder } from '../types/prayer-item-reminder';
import {
  parseHomeDefaultPrayerView,
  type HomeDefaultPrayerView,
} from '../lib/home-default-view-preference';

export const PRAYER_COOLDOWN_MIN_HOURS = 1;
export const PRAYER_COOLDOWN_MAX_HOURS = 168;
export const DEFAULT_PERSONAL_PRAYER_COOLDOWN_HOURS = 4;

export function splitPersonName(fullName: string | null | undefined): {
  first: string | null;
  last: string | null;
} {
  const trimmed = fullName?.trim() ?? '';
  if (!trimmed) {
    return { first: null, last: null };
  }
  const parts = trimmed.split(/\s+/);
  return {
    first: parts[0] || null,
    last: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

export function clampPrayerCooldownHours(
  hours: number | string | null | undefined
): number {
  const numeric =
    typeof hours === 'number'
      ? hours
      : typeof hours === 'string' && hours.trim() !== ''
        ? Number(hours)
        : Number.NaN;
  if (!Number.isFinite(numeric)) {
    return DEFAULT_PERSONAL_PRAYER_COOLDOWN_HOURS;
  }
  return Math.min(
    PRAYER_COOLDOWN_MAX_HOURS,
    Math.max(PRAYER_COOLDOWN_MIN_HOURS, Math.round(numeric))
  );
}

const MEMBERSHIP_SESSION_COLUMNS =
  'user_email, name, is_active, receive_admin_emails, receive_push, badge_functionality_enabled, default_prayer_view, memorization_strict_mode, show_pray_for_button, show_praying_count, personal_prayer_cooldown_hours';

interface MembershipSessionRow {
  user_email?: string;
  name?: string;
  is_active?: boolean;
  receive_admin_emails?: boolean;
  receive_push?: boolean;
  badge_functionality_enabled?: boolean;
  default_prayer_view?: string;
  memorization_strict_mode?: boolean;
  show_pray_for_button?: boolean;
  show_praying_count?: boolean;
  personal_prayer_cooldown_hours?: number;
}

export interface UserSessionData {
  email: string;
  fullName: string;
  isActive: boolean;
  receiveNotifications?: boolean;
  receiveAdminEmails?: boolean;
  receivePush?: boolean;
  badgeFunctionalityEnabled?: boolean;
  showPrayForButton?: boolean;
  showPrayingCount?: boolean;
  defaultPrayerView?: HomeDefaultPrayerView;
  memorizationStrictMode?: boolean;
  /** Hours before Pray For is available again on the same personal prayer (1–168). */
  personalPrayerCooldownHours?: number;
  /** Cached hourly self-reminder slots; undefined = never fetched this session. */
  prayerHourReminders?: UserPrayerHourReminderSlot[];
  prayerHourRemindersFetchedAt?: number;
  memorizationHourReminders?: UserHourReminderSlot[];
  memorizationHourRemindersFetchedAt?: number;
  prayerItemReminders?: PrayerItemReminder[];
  prayerItemRemindersFetchedAt?: number;
}

/**
 * UserSessionService - Caches user information from the database during the session
 * 
 * Eliminates repeated database queries for user email and name by loading once
 * and storing in memory. Automatically cleared on logout.
 */
@Injectable({
  providedIn: 'root'
})
export class UserSessionService {
  private userSessionSubject = new BehaviorSubject<UserSessionData | null>(null);
  public userSession$ = this.userSessionSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();

  private hasInitializedSubject = new BehaviorSubject<boolean>(false);
  private hasInitialized$ = this.hasInitializedSubject.asObservable();
  readonly sessionInitialized$ = this.hasInitializedSubject
    .asObservable()
    .pipe(distinctUntilChanged());

  private hasBeenAuthenticated = false; // Track if user was ever authenticated

  constructor(
    private supabase: SupabaseService,
    private adminAuth: AdminAuthService,
    private authIdentity: AuthIdentityService,
    private tenantContext: TenantContextService
  ) {
    // Restore cached session immediately if available
    const cachedUserSession = localStorage.getItem('userSession');
    if (cachedUserSession) {
      try {
        const session = JSON.parse(cachedUserSession);
        if (session && session.email) {
          this.userSessionSubject.next(session);
        }
      } catch (err) {
        console.warn('[UserSession] Failed to parse cached session:', err);
      }
    }
    
    this.initializeSession();
  }

  /**
   * Initialize user session - loads from localStorage first, then syncs with database
   */
  private initializeSession(): void {
    this.adminAuth.isAuthenticated$.subscribe(async (isAuthenticated) => {
      if (isAuthenticated) {
        this.hasBeenAuthenticated = true; // Mark that we've been authenticated
        // Get current user email from multiple sources
        const { data: { session } } = await this.supabase.client.auth.getSession();
        const approvalEmail = localStorage.getItem('approvalAdminEmail');
        const email = session?.user?.email || approvalEmail || (await this.authIdentity.getEmail());

        if (email) {
          // Try to load from localStorage first for instant availability
          const cachedSession = this.loadFromCache(email);
          if (cachedSession) {
            this.userSessionSubject.next(cachedSession);
            this.hasInitializedSubject.next(true);
          }
          
          // Then load from database to refresh data
          await this.loadUserSession(email);
          this.hasInitializedSubject.next(true);
        } else {
          // No email found, mark as initialized with null session
          this.hasInitializedSubject.next(true);
        }
      } else if (this.hasBeenAuthenticated) {
        // Only clear session on actual logout (not on initial false state)
        this.userSessionSubject.next(null);
        this.clearCache();
        this.hasInitializedSubject.next(false);
      }
    });
  }

  /**
   * Load user information from database and cache in session + localStorage
   */
  async loadUserSession(email: string): Promise<void> {
    if (!email || !email.trim()) {
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    this.isLoadingSubject.next(true);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const result = await Promise.race([
        this.fetchMembershipRow(normalizedEmail),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error('User session query timeout')),
            5000
          );
        }),
      ]);

      if (result.error) {
        console.error('Error loading user session from database:', result.error);
        this.retainCachedSession(normalizedEmail);
        return;
      }

      if (result.data) {
        this.publishMembershipSession(normalizedEmail, result.data);
        return;
      }

      await this.publishUnaffiliatedSession(normalizedEmail);
    } catch (err) {
      console.error('Exception loading user session:', err);
      this.retainCachedSession(normalizedEmail);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      this.isLoadingSubject.next(false);
    }
  }

  private async fetchMembershipRow(email: string): Promise<{
    data: MembershipSessionRow | null;
    error: unknown;
  }> {
    const tenantId = this.tenantContext.getActiveTenant()?.id;
    let query = this.supabase.client
      .from('tenant_memberships')
      .select(MEMBERSHIP_SESSION_COLUMNS)
      .eq('user_email', email);
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    } else if (typeof query.limit === 'function') {
      query = query.limit(1);
    }
    const result = await query.maybeSingle();
    return {
      data: result.data,
      error: result.error,
    };
  }

  private publishMembershipSession(
    email: string,
    data: MembershipSessionRow
  ): void {
    const isActive = data.is_active ?? true;
    const sessionData: UserSessionData = {
      email: data.user_email || email,
      fullName: data.name || '',
      isActive,
      receiveNotifications: isActive,
      receiveAdminEmails: data.receive_admin_emails ?? false,
      receivePush: data.receive_push ?? false,
      badgeFunctionalityEnabled: data.badge_functionality_enabled ?? false,
      defaultPrayerView: parseHomeDefaultPrayerView(data.default_prayer_view),
      memorizationStrictMode: data.memorization_strict_mode ?? false,
      showPrayForButton: data.show_pray_for_button ?? true,
      showPrayingCount: data.show_praying_count ?? true,
      personalPrayerCooldownHours: clampPrayerCooldownHours(
        data.personal_prayer_cooldown_hours
      ),
    };
    this.userSessionSubject.next(sessionData);
    this.saveToCache(sessionData);
  }

  /** No membership row. Group or subscription display name only — not a failed load. */
  private async publishUnaffiliatedSession(email: string): Promise<void> {
    const groupName = await this.fetchPrayerGroupMemberName(email);
    const subscriptionName = await this.fetchUserSubscriptionDisplayName(email);
    const sessionData: UserSessionData = {
      email,
      fullName: groupName || subscriptionName,
      isActive: true,
      receiveNotifications: true,
      receiveAdminEmails: false,
      receivePush: false,
      badgeFunctionalityEnabled: false,
      defaultPrayerView: 'current',
      memorizationStrictMode: false,
      showPrayForButton: true,
      showPrayingCount: true,
      personalPrayerCooldownHours: DEFAULT_PERSONAL_PRAYER_COOLDOWN_HOURS,
    };
    this.userSessionSubject.next(sessionData);
    this.saveToCache(sessionData);
  }

  /**
   * Query error, timeout, or maybeSingle failure: keep a good cached row.
   * Do not replace it with an empty-name stub.
   */
  private retainCachedSession(email: string): void {
    const current = this.userSessionSubject.value;
    if (current && current.email.toLowerCase().trim() === email) {
      return;
    }
    const cached = this.loadFromCache(email);
    if (cached) {
      this.userSessionSubject.next(cached);
    }
  }

  private async fetchPrayerGroupMemberName(email: string): Promise<string> {
    try {
      let query: any = this.supabase.client
        .from('prayer_group_members')
        .select('name')
        .eq('user_email', email.toLowerCase().trim())
        .eq('is_active', true);
      if (typeof query.limit === 'function') {
        query = query.limit(1);
      }
      const result =
        typeof query.maybeSingle === 'function'
          ? await query.maybeSingle()
          : await query;
      const data = result?.data as
        | { name?: string | null }
        | Array<{ name?: string | null }>
        | null
        | undefined;
      const row = Array.isArray(data) ? data[0] : data;
      return row?.name?.trim() || '';
    } catch {
      return '';
    }
  }

  private async fetchUserSubscriptionDisplayName(email: string): Promise<string> {
    try {
      const { data } = await this.supabase.client
        .from('user_subscriptions')
        .select('display_name')
        .eq('user_email', email.toLowerCase().trim())
        .maybeSingle();
      return data?.display_name?.trim() || '';
    } catch {
      return '';
    }
  }

  /**
   * Get current user session data
   */
  getCurrentSession(): UserSessionData | null {
    return this.userSessionSubject.value;
  }

  isSessionInitialized(): boolean {
    return this.hasInitializedSubject.value;
  }

  /**
   * Get user email - returns null if not loaded
   */
  getUserEmail(): string | null {
    const session = this.userSessionSubject.value;
    return session?.email || null;
  }

  /**
   * Get user full name - returns null if not loaded
   */
  getUserFullName(): string | null {
    const session = this.userSessionSubject.value;
    return session?.fullName || null;
  }

  /**
   * First token of the membership display name.
   */
  getUserFirstName(): string | null {
    return splitPersonName(this.getUserFullName()).first;
  }

  /**
   * Remainder of the membership display name after the first token.
   */
  getUserLastName(): string | null {
    return splitPersonName(this.getUserFullName()).last;
  }

  /**
   * Get notification preferences
   */
  getNotificationPreferences(): { receiveNotifications: boolean; receiveAdminEmails: boolean } | null {
    const session = this.userSessionSubject.value;
    return session ? {
      receiveNotifications: session.receiveNotifications ?? true,
      receiveAdminEmails: session.receiveAdminEmails ?? false
    } : null;
  }

  /**
   * Check if user receives notifications
   */
  isNotificationsEnabled(): boolean {
    const session = this.userSessionSubject.value;
    return session?.receiveNotifications ?? true;
  }

  /**
   * Check if user receives admin emails
   */
  isAdminEmailsEnabled(): boolean {
    const session = this.userSessionSubject.value;
    return session?.receiveAdminEmails ?? false;
  }

  /**
   * Check if badge functionality is enabled for the user
   */
  isBadgeFunctionalityEnabled(): boolean {
    const session = this.userSessionSubject.value;
    return session?.badgeFunctionalityEnabled ?? false;
  }

  /**
   * Get user's default prayer view preference
   */
  getDefaultPrayerView(): HomeDefaultPrayerView {
    const session = this.userSessionSubject.value;
    return session?.defaultPrayerView || 'current';
  }

  getShowPrayForButton$(): Observable<boolean> {
    return this.userSession$.pipe(
      map((s) => s?.showPrayForButton ?? true),
      distinctUntilChanged()
    );
  }

  getShowPrayingCount$(): Observable<boolean> {
    return this.userSession$.pipe(
      map((s) => s?.showPrayingCount ?? true),
      distinctUntilChanged()
    );
  }

  /**
   * Update user session data - useful after user modifies their profile
   */
  async updateUserSession(updates: Partial<UserSessionData>): Promise<void> {
    const currentSession = this.userSessionSubject.value;
    if (!currentSession) {
      return;
    }

    const updatedSession: UserSessionData = {
      ...currentSession,
      ...updates
    };

    this.userSessionSubject.next(updatedSession);
    this.saveToCache(updatedSession);
  }

  /**
   * Wait for user session to load - useful for components that need user data
   */
  async waitForSession(): Promise<UserSessionData | null> {
    // If session is already available, return immediately
    const currentSession = this.userSessionSubject.value;
    if (currentSession) {
      return currentSession;
    }

    // Wait for initialization to complete
    if (!this.hasInitializedSubject.value) {
      return this.waitForFlag(this.hasInitialized$, (hasInitialized) => hasInitialized);
    }

    // Already initialized, check if still loading
    if (this.isLoadingSubject.value) {
      return this.waitForFlag(this.isLoading$, (isLoading) => !isLoading);
    }

    // Not loading and initialization complete
    return this.userSessionSubject.value;
  }

  /**
   * Resolve when `isDone` is true, or after 10s. Always drops the subscription.
   */
  private waitForFlag(
    source$: Observable<boolean>,
    isDone: (value: boolean) => boolean
  ): Promise<UserSessionData | null> {
    return new Promise<UserSessionData | null>((resolve) => {
      let resolved = false;
      let subscription: { unsubscribe: () => void } | undefined;
      const timeout = setTimeout(() => {
        if (resolved) {
          return;
        }
        resolved = true;
        subscription?.unsubscribe();
        resolve(this.userSessionSubject.value);
      }, 10000);

      subscription = source$.subscribe((value) => {
        if (!isDone(value) || resolved) {
          return;
        }
        resolved = true;
        clearTimeout(timeout);
        subscription?.unsubscribe();
        resolve(this.userSessionSubject.value);
      });
    });
  }

  /**
   * Clear session - called on logout
   */
  clearSession(): void {
    this.userSessionSubject.next(null);
  }

  /**
   * Save session to localStorage for persistence across page reloads
   */
  private saveToCache(session: UserSessionData): void {
    try {
      localStorage.setItem('userSession', JSON.stringify(session));
    } catch (err) {
      console.warn('Failed to save session to cache:', err);
    }
  }

  /**
   * Load session from localStorage
   */
  private loadFromCache(email: string): UserSessionData | null {
    try {
      const cached = localStorage.getItem('userSession');
      if (cached) {
        const session = JSON.parse(cached);
        // Verify the cached session is for the current email to avoid stale data
        if (session && session.email === email) {
          return session;
        }
      }
    } catch (err) {
      console.warn('[UserSession] Failed to load session from cache:', err);
    }
    return null;
  }

  /**
   * Clear cached session from localStorage
   */
  private clearCache(): void {
    try {
      localStorage.removeItem('userSession');
    } catch (err) {
      console.warn('[UserSession] Failed to clear session cache:', err);
    }
  }

  /** Personal-prayer Pray For cooldown in hours (default 4). */
  getPersonalPrayerCooldownHours$(): Observable<number> {
    return this.userSession$.pipe(
      map((s) => clampPrayerCooldownHours(s?.personalPrayerCooldownHours)),
      distinctUntilChanged()
    );
  }

  getPersonalPrayerCooldownHours(): number {
    return clampPrayerCooldownHours(
      this.userSessionSubject.value?.personalPrayerCooldownHours
    );
  }
}
