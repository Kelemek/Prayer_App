import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { UserSessionService } from './user-session.service';
import { TenantContextService } from './tenant-context.service';

export interface AnalyticsStats {
  todayPageViews: number;
  weekPageViews: number;
  monthPageViews: number;
  yearPageViews: number;
  totalPageViews: number;
  totalPrayers: number;
  currentPrayers: number;
  answeredPrayers: number;
  archivedPrayers: number;
  /** All memberships for the active tenant */
  totalTenantMembers: number;
  /** Members with leader or tenant_admin role */
  tenantLeadersAndAdmins: number;
  loading: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  constructor(
    private supabase: SupabaseService,
    private userSession: UserSessionService,
    private tenantContext: TenantContextService
  ) {}

  /**
   * Track a page view and update user's last activity date
   * Only tracks logged-in users to prevent admin page views from skewing analytics
   * Inserts a record into the analytics table and updates email_subscribers last_activity_date
   * Both operations are throttled to every 5 minutes to reduce database writes
   * Should be called from main site pages only, not from admin routes
   */
  async trackPageView(): Promise<void> {
    try {
      // Only track logged-in users
      const session = this.userSession.getCurrentSession();
      const userEmail = session?.email || null;

      if (!userEmail) {
        return; // Don't track non-logged-in users or admin pages
      }

      // Check if we've already updated within the last 5 minutes
      const lastUpdateKey = `last_activity_update_${userEmail}`;
      const lastUpdateTime = localStorage.getItem(lastUpdateKey);
      const now = Date.now();
      const fiveMinutesMs = 5 * 60 * 1000;

      // Only update if no previous update or if 5+ minutes have passed
      if (lastUpdateTime && now - parseInt(lastUpdateTime, 10) < fiveMinutesMs) {
        return; // Skip both operations - too recent
      }

      const tenantId = this.tenantContext.getActiveTenant()?.id ?? null;

      // Track the page view in analytics table
      await this.supabase.client.from('analytics').insert({
        event_type: 'page_view',
        tenant_id: tenantId,
        event_data: {
          timestamp: new Date().toISOString(),
          url: typeof window !== 'undefined' ? window.location.pathname : null
        }
      });

      // Update the user's last activity date in email_subscribers (active tenant row)
      if (tenantId) {
        await this.supabase.client
          .from('email_subscribers')
          .update({ last_activity_date: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('email', userEmail);
      }

      // Record the update time in localStorage
      localStorage.setItem(lastUpdateKey, String(now));
    } catch (error) {
      console.error('[Analytics] Failed to track page view:', error);
    }
  }

  async getStats(tenantId: string): Promise<AnalyticsStats> {
    const stats: AnalyticsStats = {
      todayPageViews: 0,
      weekPageViews: 0,
      monthPageViews: 0,
      yearPageViews: 0,
      totalPageViews: 0,
      totalPrayers: 0,
      currentPrayers: 0,
      answeredPrayers: 0,
      archivedPrayers: 0,
      totalTenantMembers: 0,
      tenantLeadersAndAdmins: 0,
      loading: true
    };

    if (!tenantId?.trim()) {
      stats.loading = false;
      return stats;
    }

    try {
      // Today: from 12 AM to 12 AM (00:00:00 to 23:59:59.999) local time
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Week: Sunday 12 AM to current time (current calendar week)
      const weekStart = new Date();
      const dayOfWeek = weekStart.getDay(); // 0 = Sunday
      weekStart.setDate(weekStart.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);

      // Month: 1st of current month 12 AM to current time
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      // Year: Jan 1 of current year 12 AM to current time
      const yearStart = new Date();
      yearStart.setMonth(0); // January
      yearStart.setDate(1);
      yearStart.setHours(0, 0, 0, 0);

      // Convert local times to ISO strings for database queries
      const todayStartISO = todayStart.toISOString();
      const weekStartISO = weekStart.toISOString();
      const monthStartISO = monthStart.toISOString();
      const yearStartISO = yearStart.toISOString();

      const analyticsBase = () =>
        this.supabase.client
          .from('analytics')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('event_type', 'page_view');

      const prayersBase = () =>
        this.supabase.client.from('prayers').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId);

      const [
        totalResult,
        todayResult,
        weekResult,
        monthResult,
        yearResult,
        prayersResult,
        currentPrayersResult,
        answeredPrayersResult,
        archivedPrayersResult,
        membersResult,
        leadersResult
      ] = await Promise.all([
        analyticsBase(),
        analyticsBase().gte('created_at', todayStartISO),
        analyticsBase().gte('created_at', weekStartISO),
        analyticsBase().gte('created_at', monthStartISO),
        analyticsBase().gte('created_at', yearStartISO),
        prayersBase(),
        prayersBase().eq('status', 'current'),
        prayersBase().eq('status', 'answered'),
        prayersBase().eq('status', 'archived'),
        this.supabase.client
          .from('tenant_memberships')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        this.supabase.client
          .from('tenant_memberships')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .in('role', ['leader', 'tenant_admin'])
      ]);

      if (totalResult.error) {
        console.error('Error fetching total page views:', totalResult.error);
      } else {
        stats.totalPageViews = totalResult.count || 0;
      }

      if (todayResult.error) {
        console.error('Error fetching today page views:', todayResult.error);
      } else {
        stats.todayPageViews = todayResult.count || 0;
      }

      if (weekResult.error) {
        console.error('Error fetching week page views:', weekResult.error);
      } else {
        stats.weekPageViews = weekResult.count || 0;
      }

      if (monthResult.error) {
        console.error('Error fetching month page views:', monthResult.error);
      } else {
        stats.monthPageViews = monthResult.count || 0;
      }

      if (yearResult.error) {
        console.error('Error fetching year page views:', yearResult.error);
      } else {
        stats.yearPageViews = yearResult.count || 0;
      }

      if (prayersResult.error) {
        console.error('Error fetching prayers count:', prayersResult.error);
      } else {
        stats.totalPrayers = prayersResult.count || 0;
      }

      if (currentPrayersResult.error) {
        console.error('Error fetching current prayers count:', currentPrayersResult.error);
      } else {
        stats.currentPrayers = currentPrayersResult.count || 0;
      }

      if (answeredPrayersResult.error) {
        console.error('Error fetching answered prayers count:', answeredPrayersResult.error);
      } else {
        stats.answeredPrayers = answeredPrayersResult.count || 0;
      }

      if (archivedPrayersResult.error) {
        console.error('Error fetching archived prayers count:', archivedPrayersResult.error);
      } else {
        stats.archivedPrayers = archivedPrayersResult.count || 0;
      }

      if (membersResult.error) {
        console.error('Error fetching tenant members count:', membersResult.error);
      } else {
        stats.totalTenantMembers = membersResult.count || 0;
      }

      if (leadersResult.error) {
        console.error('Error fetching leaders/admins count:', leadersResult.error);
      } else {
        stats.tenantLeadersAndAdmins = leadersResult.count || 0;
      }
    } catch (error) {
      console.error('Error fetching analytics stats:', error);
    } finally {
      stats.loading = false;
    }

    return stats;
  }
}
