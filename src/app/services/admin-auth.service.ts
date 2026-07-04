import { Injectable, inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, Subscription, interval, timer } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { CacheService } from './cache.service';
import { PushNotificationService } from './push-notification.service';
import { PrayerEncouragementService } from './prayer-encouragement.service';
import { TenantContextService } from './tenant-context.service';
import { AuthIdentityService } from './auth-identity.service';
import type { User } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class AdminAuthService {
  private userSubject = new BehaviorSubject<User | null>(null);
  private isAdminSubject = new BehaviorSubject<boolean>(false);
  private hasAdminEmailSubject = new BehaviorSubject<boolean>(false);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private loadingSubject = new BehaviorSubject<boolean>(true);
  private requireSiteLoginSubject = new BehaviorSubject<boolean>(false);
  private adminSessionExpiredSubject = new BehaviorSubject<boolean>(false);
  private lastActivity = Date.now();
  private sessionStart: number | null = null;
  private adminSessionStart: number | null = null;
  private lastBlockedCheck = 0;

  public user$ = this.userSubject.asObservable();
  public isAdmin$ = this.isAdminSubject.asObservable();
  public hasAdminEmail$ = this.hasAdminEmailSubject.asObservable();
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public requireSiteLogin$ = this.requireSiteLoginSubject.asObservable();
  public adminSessionExpired$ = this.adminSessionExpiredSubject.asObservable();

  private router = inject(Router);
  private injector = inject(Injector);

  constructor(
    private supabase: SupabaseService,
    private cacheService: CacheService,
    private tenantContext: TenantContextService,
    private authIdentity: AuthIdentityService
  ) {
    this.tenantContext.activeTenant$
      .pipe(distinctUntilChanged((prev, curr) => prev?.id === curr?.id))
      .subscribe(() => {
        const currentUser = this.userSubject.value;
        if (!currentUser) {
          return;
        }
        this.checkAdminStatus(currentUser).catch((error) => {
          console.error('[AdminAuth] Error checking admin status on tenant change:', error);
          this.isAdminSubject.next(false);
          this.hasAdminEmailSubject.next(false);
        });
      });

    this.initializeAuth().catch(error => {
      console.error('[AdminAuth] initializeAuth failed:', error);
      this.loadingSubject.next(false);
    });
  }

  private async initializeAuth(): Promise<void> {
    try {
    // Check current session
    const { data: { session } } = await this.supabase.client.auth.getSession();
    
    if (session?.user) {
      this.userSubject.next(session.user);
      // Check admin status and wait for it to complete
      try {
        await this.checkAdminStatus(session.user);
      } catch (error) {
        console.error('[AdminAuth] Error checking admin status during init:', error);
        this.isAdminSubject.next(false);
        this.hasAdminEmailSubject.next(false);
      }
      // Set authenticated regardless of admin status check
      this.isAuthenticatedSubject.next(true);
      this.sessionStart = this.getPersistedSessionStart() || Date.now();
      this.persistSessionStart(this.sessionStart);
    }

    // Listen for auth state changes
    this.supabase.client.auth.onAuthStateChange(async (event, session) => {
      
      if (session?.user) {
        this.userSubject.next(session.user);
        // Check admin status but don't block on failure
        this.checkAdminStatus(session.user).catch(error => {
          console.error('[AdminAuth] Error checking admin status on state change:', error);
          this.isAdminSubject.next(false);
          this.hasAdminEmailSubject.next(false);
        });
        this.isAuthenticatedSubject.next(true);
        
        if (!this.sessionStart) {
          this.sessionStart = Date.now();
          this.persistSessionStart(this.sessionStart);
        }
      } else {
        const userEmail = this.userSubject.value?.email;

        this.userSubject.next(null);
        this.isAdminSubject.next(false);
        this.isAuthenticatedSubject.next(false);
        this.sessionStart = null;
        this.persistSessionStart(null);

        this.cacheService.invalidateCategory('personalTenant_');
        this.cacheService.invalidateCategory('prayers');
        this.cacheService.invalidateCategory('prompts');
        localStorage.removeItem('read_prayers_data');
        localStorage.removeItem('read_prompts_data');

        if (userEmail) {
          localStorage.removeItem(`last_activity_update_${userEmail}`);
        }
      }
    });

    // Track user activity
    this.trackUserActivity();

    // Refresh lightweight checks when the window regains focus so we don't block rendering
    window.addEventListener('focus', () => {
      this.checkBlockedStatusInBackground();
      
      // Re-validate admin status on focus after background suspension (iOS Edge issue)
      const currentUser = this.userSubject.value;
      if (currentUser) {
        this.checkAdminStatus(currentUser).catch(error => {
          console.error('Error re-validating admin status on focus:', error);
        });
      }
    });

    // Also handle visibilitychange event for iOS app background/foreground transitions
    // This fires before focus on some iOS browsers
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('[AdminAuth] App became visible, re-validating admin state');
        // Re-validate admin status when app returns from background
        const currentUser = this.userSubject.value;
        if (currentUser) {
          this.checkAdminStatus(currentUser).catch(error => {
            console.error('Error re-validating admin status on visibility change:', error);
          });
        }
        
        // Check approval session
        const approvalEmail = localStorage.getItem('approvalAdminEmail');
        const sessionValidated = localStorage.getItem('approvalSessionValidated');
        if (approvalEmail && sessionValidated === 'true') {
          this.isEmailAdmin(approvalEmail).then(isAdmin => {
            this.isAdminSubject.next(isAdmin);
            this.hasAdminEmailSubject.next(isAdmin);
          }).catch(error => {
            console.error('Error re-validating approval session on visibility change:', error);
          });
        }
      }
    });

    // Set up session timeout checks
    this.setupSessionTimeouts();
    } finally {
      // Ensure loading is cleared on all code paths (success/error)
      this.loadingSubject.next(false);
    }
  }

  /**
   * Safety API to clear loading state when external flows need a fallback
   */
  public clearLoading(): void {
    this.loadingSubject.next(false);
  }

  private async checkAdminStatus(user: User): Promise<void> {
    if (!user?.email) {
      this.isAdminSubject.next(false);
      this.hasAdminEmailSubject.next(false);
      this.isAuthenticatedSubject.next(false);
      return;
    }

    try {
      const email = user.email.toLowerCase().trim();
      const activeTenantId = this.tenantContext.getActiveTenant()?.id || localStorage.getItem('active_tenant_id');
      const memberships = this.tenantContext.getMemberships();
      const isSuperAdminFromContext = this.tenantContext.getIsSuperAdmin();
      const isTenantAdminFromContext = !!activeTenantId && memberships.some(
        (membership) =>
          membership.tenant_id === activeTenantId &&
          membership.user_email?.toLowerCase().trim() === email &&
          membership.role === 'tenant_admin'
      );

      // Prefer local tenant context first to avoid extra network calls.
      let isAdmin = isSuperAdminFromContext || isTenantAdminFromContext;
      if (!isAdmin) {
        isAdmin = await this.isEmailAdmin(email);
      }
      this.isAdminSubject.next(isAdmin);
      this.hasAdminEmailSubject.next(isAdmin);
    } catch (error) {
      console.error('Error checking admin status:', error);
      this.isAdminSubject.next(false);
      this.hasAdminEmailSubject.next(false);
    }
  }

  checkBlockedStatusInBackground(returnUrl?: string): void {
    const now = Date.now();
    if (now - this.lastBlockedCheck < 60000) return; // throttle to avoid spamming
    this.lastBlockedCheck = now;

    // Fire and forget – do not block UI rendering
    this.supabase.directQuery<{ is_blocked: boolean }>(
      'tenant_memberships',
      {
        select: 'is_blocked',
        eq: { user_email: this.userSubject.value?.email?.toLowerCase() || '' },
        limit: 1,
        timeout: 5000
      }
    ).then(({ data, error }) => {
      if (error) {
        console.warn('[AdminAuth] Block check skipped due to error:', error);
        return;
      }

      const isBlocked = data && Array.isArray(data) && data.length > 0 && data[0]?.is_blocked;
      if (isBlocked) {
        console.log('[AdminAuth] User is blocked - logging out');
        this.logout();
        this.router.navigate(['/login'], {
          queryParams: {
            returnUrl: returnUrl || '/',
            blocked: 'true'
          }
        });
      }
    }).catch(error => {
      console.warn('[AdminAuth] Block check exception:', error);
    });
  }

  private trackUserActivity(): void {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, () => {
        this.lastActivity = Date.now();
      });
    });
  }

  /**
   * Record user activity to prevent inactivity timeout
   * Call this whenever user interacts with the admin panel
   */
  recordActivity(): void {
    this.lastActivity = Date.now();
  }

  private setupSessionTimeouts(): void {
    // Admin sessions now stay active indefinitely, matching normal user behavior
    // Sessions are maintained via Supabase auth and manual logout only
  }

  private getPersistedSessionStart(): number | null {
    try {
      const stored = localStorage.getItem('adminSessionStart');
      if (stored) {
        const timestamp = parseInt(stored, 10);
        if (!isNaN(timestamp)) return timestamp;
      }
    } catch (e) {
      console.error('Error reading session start:', e);
    }
    return null;
  }

  private persistSessionStart(timestamp: number | null): void {
    try {
      if (timestamp === null) {
        localStorage.removeItem('adminSessionStart');
      } else {
        localStorage.setItem('adminSessionStart', timestamp.toString());
      }
    } catch (e) {
      console.error('Error persisting session start:', e);
    }
  }

  /**
   * Send login OTP via Supabase Auth (or skip send for app test account).
   */
  async sendMfaCode(email: string): Promise<{ success: boolean; error?: string; isTestAccount?: boolean }> {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      console.log('[AdminAuth] Requesting login OTP for:', normalizedEmail);

      const { data: settings } = await this.supabase.client
        .from('admin_settings')
        .select('require_site_login')
        .eq('id', 1)
        .maybeSingle();

      const siteProtectionEnabled = settings?.require_site_login ?? true;
      if (!siteProtectionEnabled) {
        const isAdmin = await this.isEmailAdmin(normalizedEmail);
        if (!isAdmin) {
          return { success: false, error: 'Email address is not authorized for admin access' };
        }
      }

      const isTestAccount = await this.authIdentity.isTestAccountEmail(normalizedEmail);
      this.authIdentity.setPendingLogin(normalizedEmail, isTestAccount);

      if (isTestAccount) {
        console.log('[AdminAuth] Test account login — no email sent');
        return { success: true, isTestAccount: true };
      }

      if (siteProtectionEnabled) {
        const { data: allowed, error: allowedError } = await this.supabase.client.rpc(
          'is_login_allowed_email',
          { p_email: normalizedEmail }
        );
        if (allowedError) {
          console.error('[AdminAuth] is_login_allowed_email error:', allowedError);
          return { success: false, error: 'Unable to verify account. Please try again.' };
        }
        if (!allowed) {
          return {
            success: false,
            error: 'This email is not registered or is pending approval. Please sign up or contact an administrator.'
          };
        }
      }

      const { error } = await this.supabase.client.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: true }
      });

      if (error) {
        console.error('[AdminAuth] signInWithOtp error:', error);
        return { success: false, error: error.message };
      }

      console.log('[AdminAuth] Login OTP sent successfully');
      return { success: true, isTestAccount: false };
    } catch (error) {
      console.error('[AdminAuth] Unexpected error sending login OTP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if email is in admin list
   */
  private async isEmailAdmin(email: string): Promise<boolean> {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const tenantId = this.tenantContext.getActiveTenant()?.id || localStorage.getItem('active_tenant_id') || undefined;
      const memberships = this.tenantContext.getMemberships();
      const isSuperAdminFromContext = this.tenantContext.getIsSuperAdmin();
      const isTenantAdminFromContext = !!tenantId && memberships.some(
        (membership) =>
          membership.tenant_id === tenantId &&
          membership.user_email?.toLowerCase().trim() === normalizedEmail &&
          membership.role === 'tenant_admin'
      );

      // Always prefer local tenant context first (works for MFA-local sessions and avoids network calls).
      if (isSuperAdminFromContext || isTenantAdminFromContext) {
        return true;
      }

      const { data, error, response } = await this.supabase.client.functions.invoke(
        'check-admin-status',
        {
          body: { email: normalizedEmail, tenantId }
        }
      );

      if (error) {
        const detail = await this.supabase.describeFunctionInvokeFailure(
          error,
          response,
          'check-admin-status'
        );
        console.error('[AdminAuth] Error checking admin status:', error, detail);
        return false;
      }

      console.log('[AdminAuth] Admin check result:', data);
      return data?.is_admin === true || data?.is_super_admin === true || data?.is_tenant_admin === true;
    } catch (error) {
      console.error('[AdminAuth] Exception checking admin status:', error);
      return false;
    }
  }

  /**
   * Verify login OTP (Supabase Auth or app test account fixed code).
   */
  async verifyMfaCode(code: string): Promise<{ success: boolean; error?: string; isAdmin?: boolean }> {
    try {
      const email = this.authIdentity.getPendingLoginEmail();
      if (!email) {
        return { success: false, error: 'No login session found. Please request a code again.' };
      }

      const token = code.trim();
      if (!/^\d{6}$/.test(token)) {
        return { success: false, error: 'Please enter the complete 6-digit code.' };
      }

      let verifyError: Error | null = null;

      if (this.authIdentity.isPendingTestAccountLogin()) {
        const { data, error, response } = await this.supabase.client.functions.invoke('test-account-auth', {
          body: { email, code: token }
        });
        if (error) {
          const message = await this.supabase.describeFunctionInvokeFailure(
            error,
            response,
            'test-account-auth'
          );
          return { success: false, error: message };
        }
        if (data?.error) {
          return { success: false, error: 'The code you entered is incorrect. Please check and try again.' };
        }
        const { error: otpError } = await this.supabase.client.auth.verifyOtp({
          token_hash: data.hashed_token,
          type: 'email'
        });
        verifyError = otpError;
      } else {
        const { error: otpError } = await this.supabase.client.auth.verifyOtp({
          email,
          token,
          type: 'email'
        });
        verifyError = otpError;
      }

      if (verifyError) {
        console.error('[AdminAuth] verifyOtp error:', verifyError);
        return {
          success: false,
          error: 'The code you entered is incorrect. Please check and try again.'
        };
      }

      const { data: { session } } = await this.supabase.client.auth.getSession();
      if (!session?.user) {
        return { success: false, error: 'Verification failed. Please try again.' };
      }

      this.userSubject.next(session.user);
      const isAdmin = await this.isEmailAdmin(email);
      this.isAdminSubject.next(isAdmin);
      this.hasAdminEmailSubject.next(isAdmin);
      if (isAdmin) {
        this.adminSessionStart = Date.now();
        this.adminSessionExpiredSubject.next(false);
      }
      this.isAuthenticatedSubject.next(true);
      this.sessionStart = Date.now();
      this.persistSessionStart(this.sessionStart);
      this.cacheService.invalidateCategory('personalTenant_');
      this.authIdentity.clearPendingLogin();

      console.log('[AdminAuth] Login verification successful (isAdmin:', isAdmin, ')');
      return { success: true, isAdmin };
    } catch (error) {
      console.error('[AdminAuth] Unexpected error verifying login OTP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }



  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      // Get user email before clearing auth state
      const userEmail = this.userSubject.value?.email ?? (await this.authIdentity.getEmail());

      // Remove this device's push token so we don't send notifications after logout
      try {
        const pushService = this.injector.get(PushNotificationService);
        await pushService.removeDeviceToken();
      } catch {
        // Ignore if push service not available (e.g. web) or remove fails
      }

      await this.supabase.client.auth.signOut();
      this.userSubject.next(null);
      this.isAdminSubject.next(false);
      this.isAuthenticatedSubject.next(false);
      this.sessionStart = null;
      this.persistSessionStart(null);
      
      // Clear approval code session data
      localStorage.removeItem('approvalAdminEmail');
      localStorage.removeItem('approvalSessionValidated');
      localStorage.removeItem('approvalApprovalType');
      localStorage.removeItem('approvalApprovalId');
      
      this.authIdentity.clearPendingLogin();
      localStorage.removeItem('mfa_authenticated_email');
      localStorage.removeItem('mfa_session_start');
      localStorage.removeItem('mfa_code_id');
      localStorage.removeItem('mfa_user_email');

      // Clear user-specific caches to prevent next user from seeing previous user's data
      this.cacheService.invalidateCategory('personalTenant_');
      this.cacheService.invalidateCategory('prayers');
      this.cacheService.invalidateCategory('prompts');
      
      // Clear badge read tracking (which prayers/prompts user has read)
      localStorage.removeItem('read_prayers_data');
      localStorage.removeItem('read_prompts_data');

      // Clear Pray For modal "do not show again" preference so next user sees the modal if desired
      localStorage.removeItem('prayer_encouragement_modal_do_not_show');

      // Clear Pray For cooldown keys so next user doesn't see previous user's cooldowns
      try {
        const prayerEncouragement = this.injector.get(PrayerEncouragementService);
        prayerEncouragement.clearCooldownKeys();
      } catch {
        // Ignore if service not available
      }
      
      // Clear analytics activity tracking for this user
      if (userEmail) {
        localStorage.removeItem(`last_activity_update_${userEmail}`);
      }
      
      // Always redirect to login page after logout
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  /**
   * Get current user
   */
  getUser(): User | null {
    return this.userSubject.value;
  }

  /**
   * Check if current user is admin
   */
  getIsAdmin(): boolean {
    return this.isAdminSubject.value;
  }

  /**
   * Check if auth is loading
   */
  isLoading(): boolean {
    return this.loadingSubject.value;
  }

  /**
   * Reload site protection setting from database
   */
  async reloadSiteProtectionSetting(): Promise<void> {
    try {
      const { data, error } = await this.supabase.directQuery<Array<{
        require_site_login: boolean;
      }>>('admin_settings', {
        select: 'require_site_login',
        eq: { id: 1 },
        limit: 1,
        timeout: 10000
      });

      if (!error && data && data[0]) {
        this.requireSiteLoginSubject.next(data[0].require_site_login ?? true);
      }
    } catch (error) {
      console.error('Error reloading site protection setting:', error);
    }
  }
}
