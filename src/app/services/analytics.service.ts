import { Injectable } from '@angular/core';
import { countByMasterLevel } from '../lib/memorization/memorization-mastery';
import type { MemorizationPracticeSessionRecord } from '../types/memorization';
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
  memorizationLearning: number;
  memorizationPracticing: number;
  memorizationMastered: number;
  loading: boolean;
}

/** Presets for Site Analytics activity chart (maps to window + RPC bucket). */
export type PageViewTimeSeriesPreset =
  | '12h'
  | '24h'
  | '48h'
  | '7d'
  | '30d'
  | '90d'
  | '180d'
  | '365d';

export interface PageViewTimeSeriesPoint {
  bucketStart: string;
  /** Logged-in activity samples (page_view) for this bucket. */
  count: number;
  /** Approved prayers + updates in this bucket (subscriber bulk send at approval). */
  approvalCount: number;
  /** First 8 titles, newline-separated; "+ N more" if count > 8. */
  approvalLabels: string;
}

const PAGE_VIEW_PRESET_MS: Record<PageViewTimeSeriesPreset, number> = {
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '48h': 48 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
  '180d': 180 * 24 * 60 * 60 * 1000,
  '365d': 365 * 24 * 60 * 60 * 1000
};

const PAGE_VIEW_PRESET_BUCKET: Record<PageViewTimeSeriesPreset, 'hour' | 'day'> = {
  '12h': 'hour',
  '24h': 'hour',
  '48h': 'hour',
  '7d': 'day',
  '30d': 'day',
  '90d': 'day',
  '180d': 'day',
  '365d': 'day'
};

/**
 * UTC bucket starts matching Postgres `date_trunc('hour'|'day', created_at)` with UTC session TZ.
 */
function enumerateUtcBucketStarts(
  rangeStart: Date,
  rangeEnd: Date,
  bucket: 'hour' | 'day'
): string[] {
  const keys: string[] = [];
  if (bucket === 'hour') {
    const cur = new Date(rangeStart);
    cur.setUTCMinutes(0, 0, 0);
    while (cur.getTime() < rangeEnd.getTime()) {
      keys.push(cur.toISOString());
      cur.setTime(cur.getTime() + 60 * 60 * 1000);
    }
  } else {
    const cur = new Date(
      Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate())
    );
    while (cur.getTime() < rangeEnd.getTime()) {
      keys.push(cur.toISOString());
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  return keys;
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
   * Inserts a record into the analytics table and updates tenant_memberships last_activity_date
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

      // Update the user's last activity date in tenant_memberships (active tenant row)
      if (tenantId) {
        await this.supabase.client
          .from('tenant_memberships')
          .update({ last_activity_date: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('user_email', userEmail.toLowerCase().trim());
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
      memorizationLearning: 0,
      memorizationPracticing: 0,
      memorizationMastered: 0,
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
        leadersResult,
        memorizedResult
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
          .in('role', ['leader', 'tenant_admin']),
        this.supabase.client
          .from('memorized_items')
          .select('practice_sessions')
          .eq('tenant_id', tenantId)
          .or('kind.eq.verse,kind.is.null')
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

      if (memorizedResult.error) {
        console.error('Error fetching memorized items for mastery counts:', memorizedResult.error);
      } else {
        const rows = (memorizedResult.data ?? []) as Array<{
          practice_sessions?: MemorizationPracticeSessionRecord[] | null;
        }>;
        const mastery = countByMasterLevel(
          rows.map((row) => ({
            practiceSessions: Array.isArray(row.practice_sessions) ? row.practice_sessions : []
          }))
        );
        stats.memorizationLearning = mastery.learning;
        stats.memorizationPracticing = mastery.practicing;
        stats.memorizationMastered = mastery.mastered;
      }
    } catch (error) {
      console.error('Error fetching analytics stats:', error);
    } finally {
      stats.loading = false;
    }

    return stats;
  }

  /**
   * Activity samples and approval events per time bucket for the Site Analytics chart.
   */
  async getPageViewTimeSeries(
    tenantId: string,
    preset: PageViewTimeSeriesPreset
  ): Promise<PageViewTimeSeriesPoint[]> {
    if (!tenantId?.trim()) {
      return [];
    }

    const rangeEnd = new Date();
    const rangeStart = new Date(rangeEnd.getTime() - PAGE_VIEW_PRESET_MS[preset]);
    const bucket = PAGE_VIEW_PRESET_BUCKET[preset];
    const bucketKeys = enumerateUtcBucketStarts(rangeStart, rangeEnd, bucket);
    const pStart = rangeStart.toISOString();
    const pEnd = rangeEnd.toISOString();

    const [pvResult, apResult] = await Promise.all([
      this.supabase.client.rpc('analytics_page_view_buckets', {
        p_tenant_id: tenantId,
        p_start: pStart,
        p_end: pEnd,
        p_bucket: bucket
      }),
      this.supabase.client.rpc('analytics_approval_buckets', {
        p_tenant_id: tenantId,
        p_start: pStart,
        p_end: pEnd,
        p_bucket: bucket
      })
    ]);

    if (pvResult.error) {
      console.error('[Analytics] getPageViewTimeSeries page views:', pvResult.error);
    }
    if (apResult.error) {
      console.error('[Analytics] getPageViewTimeSeries approvals:', apResult.error);
    }

    const counts = new Map<string, number>();
    for (const row of pvResult.data ?? []) {
      const key = new Date(row.bucket_start as string).toISOString();
      counts.set(key, Number(row.event_count));
    }

    const approvals = new Map<string, { count: number; labels: string }>();
    for (const row of apResult.data ?? []) {
      const key = new Date(row.bucket_start as string).toISOString();
      approvals.set(key, {
        count: Number(row.approval_count),
        labels: String(row.approval_labels ?? '')
      });
    }

    return bucketKeys.map((bucketStart) => {
      const ap = approvals.get(bucketStart);
      return {
        bucketStart,
        count: pvResult.error ? 0 : (counts.get(bucketStart) ?? 0),
        approvalCount: apResult.error ? 0 : (ap?.count ?? 0),
        approvalLabels: apResult.error ? '' : (ap?.labels ?? '')
      };
    });
  }
}
