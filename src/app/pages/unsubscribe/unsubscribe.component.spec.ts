import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { UnsubscribeComponent } from './unsubscribe.component';
import { SupabaseService } from '../../services/supabase.service';
import { BrandingService } from '../../services/branding.service';

describe('UnsubscribeComponent', () => {
  let fixture: ComponentFixture<UnsubscribeComponent>;
  let component: UnsubscribeComponent;
  const fetchMock = vi.fn();

  beforeEach(async () => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);

    await TestBed.configureTestingModule({
      imports: [UnsubscribeComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: { get: (key: string) => (key === 'token' ? 'abc' : null) } },
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getSupabaseUrl: () => 'https://example.supabase.co',
            getPublishableKey: () => 'publishable-key',
          },
        },
        {
          provide: BrandingService,
          useValue: {
            initialize: vi.fn(async () => undefined),
            branding$: new BehaviorSubject({ useLogo: false }),
            getImageUrl: vi.fn(() => ''),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UnsubscribeComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets missing state when token is absent', () => {
    TestBed.resetTestingModule();
    void TestBed.configureTestingModule({
      imports: [UnsubscribeComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
        {
          provide: SupabaseService,
          useValue: {
            getSupabaseUrl: () => 'https://example.supabase.co',
            getPublishableKey: () => 'publishable-key',
          },
        },
        {
          provide: BrandingService,
          useValue: {
            initialize: vi.fn(async () => undefined),
            branding$: new BehaviorSubject({ useLogo: false }),
            getImageUrl: vi.fn(() => ''),
          },
        },
      ],
    }).compileComponents();

    const missingFixture = TestBed.createComponent(UnsubscribeComponent);
    missingFixture.detectChanges();
    expect(missingFixture.componentInstance.state()).toBe('missing');
  });

  it('sets success state when unsubscribe succeeds', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true }),
    });

    fixture.detectChanges();
    await vi.waitFor(() => expect(component.state()).toBe('success'));
    expect(component.fallbackUnsubscribeUrl()).toContain('email-unsubscribe');
  });

  it('sets error state when unsubscribe fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ ok: false }),
    });

    fixture.detectChanges();
    await vi.waitFor(() => expect(component.state()).toBe('error'));
  });
});
