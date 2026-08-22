import { describe, it, expect } from 'vitest';
import {
  buildAdminAnalyticsTileViews,
  ADMIN_SITE_ANALYTICS_TILES,
} from './admin-analytics-tiles';
import type { AnalyticsStats } from '../services/analytics.service';

const stubStats = (): AnalyticsStats => ({
  todayPageViews: 1,
  weekPageViews: 2,
  monthPageViews: 3,
  yearPageViews: 4,
  totalPageViews: 5,
  totalPrayers: 6,
  currentPrayers: 7,
  answeredPrayers: 8,
  archivedPrayers: 9,
  totalTenantMembers: 10,
  tenantLeadersAndAdmins: 11,
  memorizationTotal: 12,
  memorizationLearning: 13,
  memorizationPracticing: 14,
  memorizationMastered: 15,
  loading: false,
});

describe('admin-analytics-tiles', () => {
  it('maps every catalog tile to a numeric value', () => {
    const views = buildAdminAnalyticsTileViews(stubStats());
    expect(views.length).toBe(ADMIN_SITE_ANALYTICS_TILES.length);
    expect(views[0]).toMatchObject({ label: 'Today', value: 1 });
    expect(views.at(-1)?.value).toBe(15);
    expect(views.some((tile) => tile.statKey === 'totalTenantMembers')).toBe(true);
    expect(views.some((tile) => tile.statKey === 'tenantLeadersAndAdmins')).toBe(true);
  });
});
