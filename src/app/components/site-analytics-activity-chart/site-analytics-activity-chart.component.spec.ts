import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { BehaviorSubject } from 'rxjs';
import { SiteAnalyticsActivityChartComponent } from './site-analytics-activity-chart.component';
import { AnalyticsService } from '../../services/analytics.service';
import { TenantContextService } from '../../services/tenant-context.service';

const TEST_TENANT_ID = '11111111-1111-1111-1111-111111111111';

const chartMock = vi.hoisted(() => vi.fn());

vi.mock('chart.js/auto', () => ({
  Chart: class MockChart {
    destroy = vi.fn();
    update = vi.fn();
    constructor(..._args: unknown[]) {
      chartMock(..._args);
    }
  }
}));

describe('SiteAnalyticsActivityChartComponent', () => {
  let getPageViewTimeSeries: ReturnType<typeof vi.fn>;
  let activeTenant$: BehaviorSubject<{ id: string; name: string } | null>;

  beforeEach(() => {
    chartMock.mockClear();

    getPageViewTimeSeries = vi.fn().mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({
        bucketStart: `2024-01-0${i + 1}T12:00:00.000Z`,
        count: i,
        approvalCount: 0,
        approvalLabels: ''
      }))
    );

    activeTenant$ = new BehaviorSubject<{ id: string; name: string } | null>({
      id: TEST_TENANT_ID,
      name: 'Test Tenant'
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderComponent() {
    return render(SiteAnalyticsActivityChartComponent, {
      providers: [
        {
          provide: AnalyticsService,
          useValue: { getPageViewTimeSeries }
        },
        {
          provide: TenantContextService,
          useValue: {
            getActiveTenant: () => activeTenant$.value,
            activeTenant$: activeTenant$.asObservable()
          }
        }
      ]
    });
  }

  it('should create and load time series', async () => {
    await renderComponent();

    expect(await screen.findByRole('region', { name: /activity over time/i })).toBeTruthy();
    expect(getPageViewTimeSeries).toHaveBeenCalledWith(TEST_TENANT_ID, '24h');
    expect(chartMock).toHaveBeenCalled();
  });

  it('should refetch when a different range preset is selected', async () => {
    const user = userEvent.setup();
    await renderComponent();

    await screen.findByRole('region', { name: /activity over time/i });
    const initialCalls = getPageViewTimeSeries.mock.calls.length;

    await user.click(screen.getByRole('button', { name: '7d' }));

    expect(getPageViewTimeSeries.mock.calls.length).toBeGreaterThan(initialCalls);
    expect(getPageViewTimeSeries).toHaveBeenCalledWith(TEST_TENANT_ID, '7d');
  });

  it('should render canvas for chart', async () => {
    const { container } = await renderComponent();

    await screen.findByRole('region', { name: /activity over time/i });
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('should show message when no active tenant', async () => {
    activeTenant$.next(null);
    await renderComponent();

    expect(
      await screen.findByText(/select an organization above to view activity/i)
    ).toBeTruthy();
    expect(getPageViewTimeSeries).not.toHaveBeenCalled();
  });

  it('should reload when tenant changes', async () => {
    await renderComponent();
    await screen.findByRole('region', { name: /activity over time/i });

    const callsBefore = getPageViewTimeSeries.mock.calls.length;
    activeTenant$.next({ id: '22222222-2222-2222-2222-222222222222', name: 'Other' });

    await vi.waitFor(() => {
      expect(getPageViewTimeSeries.mock.calls.length).toBeGreaterThan(callsBefore);
    });
    expect(getPageViewTimeSeries).toHaveBeenCalledWith(
      '22222222-2222-2222-2222-222222222222',
      '24h'
    );
  });

  it('should ignore selecting the same preset and switch display modes', async () => {
    const user = userEvent.setup();
    await renderComponent();
    await screen.findByRole('region', { name: /activity over time/i });
    const callsBefore = getPageViewTimeSeries.mock.calls.length;

    await user.click(screen.getByRole('button', { name: '24h' }));
    expect(getPageViewTimeSeries.mock.calls.length).toBe(callsBefore);

    await user.click(screen.getByRole('button', { name: 'Line chart' }));
    await user.click(screen.getByRole('button', { name: 'Bar chart' }));
    expect(chartMock).toHaveBeenCalled();
  });

  it('should no-op display mode change when already selected', async () => {
    const user = userEvent.setup();
    getPageViewTimeSeries.mockResolvedValue([
      {
        bucketStart: '2024-01-01T12:00:00.000Z',
        count: 2,
        approvalCount: 1,
        approvalLabels: 'Prayer A\nPrayer B',
      },
    ]);
    await renderComponent();
    await screen.findByRole('region', { name: /activity over time/i });
    const callsBefore = chartMock.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Bar chart' }));
    expect(chartMock.mock.calls.length).toBe(callsBefore);
  });

  it('should exercise tooltip callbacks for activity and approvals', async () => {
    getPageViewTimeSeries.mockResolvedValue([
      {
        bucketStart: '2024-06-15T12:00:00.000Z',
        count: 5,
        approvalCount: 2,
        approvalLabels: 'Alpha\nBeta',
      },
      {
        bucketStart: '2024-06-16T12:00:00.000Z',
        count: 1,
        approvalCount: 0,
        approvalLabels: '',
      },
    ]);
    await renderComponent();
    await screen.findByRole('region', { name: /activity over time/i });
    await vi.waitFor(() => expect(chartMock).toHaveBeenCalled());

    const config = chartMock.mock.calls.at(-1)?.[1] as {
      options: {
        plugins: {
          tooltip: {
            filter: (item: { datasetIndex: number; raw: unknown }) => boolean;
            callbacks: {
              title: (items: { dataIndex?: number }[]) => string;
              label: (ctx: {
                datasetIndex: number;
                dataIndex: number;
                raw: unknown;
              }) => string | string[];
            };
          };
        };
      };
      data: { datasets: { pointRadius?: (ctx: { raw?: unknown }) => number }[] };
    };

    const tooltip = config.options.plugins.tooltip;
    expect(tooltip.filter({ datasetIndex: 1, raw: null })).toBe(false);
    expect(tooltip.filter({ datasetIndex: 0, raw: 5 })).toBe(true);
    expect(tooltip.callbacks.title([{ dataIndex: 0 }])).toContain('2024');
    expect(tooltip.callbacks.label({ datasetIndex: 0, dataIndex: 0, raw: 5 })).toBe(
      'Activity: 5'
    );
    const approvalLabel = tooltip.callbacks.label({
      datasetIndex: 1,
      dataIndex: 0,
      raw: 0,
    });
    expect(approvalLabel).toEqual(expect.arrayContaining(['2 approvals', 'Alpha', 'Beta']));
    expect(
      tooltip.callbacks.label({ datasetIndex: 1, dataIndex: 1, raw: null })
    ).toBe('');

    const pointRadius = config.data.datasets[1].pointRadius!;
    expect(pointRadius({ raw: null })).toBe(0);
    expect(pointRadius({ raw: 0 })).toBe(8);
  });

  it('should format long-range presets with year when switching to 90d', async () => {
    const user = userEvent.setup();
    await renderComponent();
    await screen.findByRole('region', { name: /activity over time/i });
    await user.click(screen.getByRole('button', { name: '90d' }));
    await vi.waitFor(() => {
      expect(getPageViewTimeSeries).toHaveBeenCalledWith(TEST_TENANT_ID, '90d');
    });
  });
});
