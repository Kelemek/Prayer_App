import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Component, Input } from '@angular/core';
import { AdminSiteAnalyticsPanelComponent } from './admin-site-analytics-panel.component';
import type { AnalyticsStats } from '../../services/analytics.service';

@Component({ selector: 'app-admin-analytics-stat-tile', standalone: true, template: '' })
class StatTileStubComponent {
  @Input() label = '';
  @Input() value = '';
  @Input() subtitle = '';
  @Input() accent = '';
  @Input() icon = '';
}

@Component({ selector: 'app-site-analytics-activity-chart', standalone: true, template: '' })
class ActivityChartStubComponent {}

const baseStats: AnalyticsStats = {
  loading: false,
  totalUsers: 10,
  activeUsers7d: 4,
  activeUsers30d: 8,
  totalPrayers: 100,
  prayersLast7d: 12,
  prayersLast30d: 40,
  totalPrompts: 5,
  memorizationSessions7d: 2,
  memorizationSessions30d: 6,
};

describe('AdminSiteAnalyticsPanelComponent', () => {
  it('builds tile views from stats', () => {
    TestBed.configureTestingModule({
      imports: [AdminSiteAnalyticsPanelComponent],
    }).overrideComponent(AdminSiteAnalyticsPanelComponent, {
      set: { imports: [StatTileStubComponent, ActivityChartStubComponent] },
    });

    const fixture = TestBed.createComponent(AdminSiteAnalyticsPanelComponent);
    fixture.componentRef.setInput('stats', baseStats);
    fixture.detectChanges();

    expect(fixture.componentInstance.tileViews.length).toBeGreaterThan(0);
    expect(fixture.nativeElement.textContent).toContain('Site Analytics');
  });

  it('shows loading spinner while stats are loading', () => {
    TestBed.configureTestingModule({
      imports: [AdminSiteAnalyticsPanelComponent],
    }).overrideComponent(AdminSiteAnalyticsPanelComponent, {
      set: { imports: [StatTileStubComponent, ActivityChartStubComponent] },
    });

    const fixture = TestBed.createComponent(AdminSiteAnalyticsPanelComponent);
    fixture.componentRef.setInput('stats', { ...baseStats, loading: true });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
  });
});
