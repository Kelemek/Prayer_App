import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { NgZone } from '@angular/core';
import { NavigationEnd, Router, Event } from '@angular/router';
import { Subject, of } from 'rxjs';
import { setAnalyticsConsent } from '../../lib/analytics-consent';
import { PosthogService } from './posthog.service';
import { SupabaseService } from './supabase.service';
import { TenantContextService } from './tenant-context.service';

const initializePostHogMock = vi.fn();
const capturePostHogPageviewMock = vi.fn();
const applyPostHogAppContextMock = vi.fn();
const applyPostHogTenantGroupMock = vi.fn();
const applyAnalyticsConsentMock = vi.fn();
const identifyPostHogUserMock = vi.fn();

vi.mock('../../lib/posthog', () => ({
  initializePostHog: (...args: unknown[]) => initializePostHogMock(...args),
  capturePostHogPageview: (...args: unknown[]) => capturePostHogPageviewMock(...args),
  applyPostHogAppContext: (...args: unknown[]) => applyPostHogAppContextMock(...args),
  applyPostHogTenantGroup: (...args: unknown[]) => applyPostHogTenantGroupMock(...args),
  applyAnalyticsConsent: (...args: unknown[]) => applyAnalyticsConsentMock(...args),
  isPostHogConfigured: vi.fn(() => true),
  identifyPostHogUser: (...args: unknown[]) => identifyPostHogUserMock(...args),
  resetPostHogUser: vi.fn(),
  posthog: {},
}));

describe('PosthogService', () => {
  let events$: Subject<Event>;
  let runOutsideAngularMock: ReturnType<typeof vi.fn>;
  let activeTenant$: Subject<{ id: string; slug: string; name: string } | null>;

  beforeEach(() => {
    localStorage.clear();
    events$ = new Subject<Event>();
    activeTenant$ = new Subject<{ id: string; slug: string; name: string } | null>();
    initializePostHogMock.mockClear();
    capturePostHogPageviewMock.mockClear();
    applyPostHogAppContextMock.mockClear();
    applyPostHogTenantGroupMock.mockClear();
    runOutsideAngularMock = vi.fn((fn: () => void) => fn());

    TestBed.configureTestingModule({
      providers: [
        {
          provide: NgZone,
          useValue: {
            runOutsideAngular: runOutsideAngularMock,
          },
        },
        {
          provide: Router,
          useValue: {
            url: '/home',
            events: events$.asObservable(),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            client: {
              auth: {
                onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
              },
            },
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            activeTenant$: activeTenant$.asObservable(),
            getActiveTenant: vi.fn(() => null),
          },
        },
      ],
    });
  });

  it('initializes PostHog and captures the initial pageview outside Angular zone', () => {
    TestBed.inject(PosthogService);

    expect(runOutsideAngularMock).toHaveBeenCalled();
    expect(initializePostHogMock).toHaveBeenCalled();
    expect(capturePostHogPageviewMock).toHaveBeenCalledWith('/home');
  });

  it('captures pageviews on NavigationEnd outside Angular zone', () => {
    TestBed.inject(PosthogService);
    capturePostHogPageviewMock.mockClear();
    runOutsideAngularMock.mockClear();

    events$.next(new NavigationEnd(1, '/prayers', '/prayers?tab=active'));

    expect(runOutsideAngularMock).toHaveBeenCalled();
    expect(capturePostHogPageviewMock).toHaveBeenCalledWith('/prayers?tab=active');
  });

  it('applies tenant context when active tenant changes and consent accepted', () => {
    setAnalyticsConsent('accepted');
    TestBed.inject(PosthogService);
    applyPostHogAppContextMock.mockClear();
    applyPostHogTenantGroupMock.mockClear();

    activeTenant$.next({ id: 'tenant-1', slug: 'acme', name: 'Acme Church' });

    expect(applyPostHogAppContextMock).toHaveBeenCalledWith(
      {},
      { id: 'tenant-1', slug: 'acme', name: 'Acme Church' }
    );
    expect(applyPostHogTenantGroupMock).toHaveBeenCalledWith(
      {},
      { id: 'tenant-1', slug: 'acme', name: 'Acme Church' }
    );
  });

  it('setUserAnalyticsConsent persists and applies consent', () => {
    const service = TestBed.inject(PosthogService);
    applyAnalyticsConsentMock.mockClear();
    identifyPostHogUserMock.mockClear();

    service.setUserAnalyticsConsent('accepted');

    expect(service.analyticsConsent()).toBe('accepted');
    expect(applyAnalyticsConsentMock).toHaveBeenCalledWith('accepted');
    expect(capturePostHogPageviewMock).toHaveBeenCalledWith('/home');
  });
});
