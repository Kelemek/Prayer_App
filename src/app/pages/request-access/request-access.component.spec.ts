import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { RequestAccessComponent } from './request-access.component';
import { TenantAccessService } from '../../services/tenant-access.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { AdminAuthService } from '../../services/admin-auth.service';
import { SupabaseService } from '../../services/supabase.service';

describe('RequestAccessComponent', () => {
  let fixture: ComponentFixture<RequestAccessComponent>;
  let getState: ReturnType<typeof vi.fn>;
  let resolveTargetTenant: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getState = vi.fn().mockResolvedValue({
      state: 'none',
      pco_enabled: false,
      tenant_name: 'Cross Pointe Church',
    });
    resolveTargetTenant = vi.fn().mockResolvedValue({
      id: '04070487-cb3f-408d-ae5d-5a88f44613db',
      slug: 'crosspointe',
      name: 'Cross Pointe Church',
    });

    await TestBed.configureTestingModule({
      imports: [RequestAccessComponent],
      providers: [
        {
          provide: TenantAccessService,
          useValue: {
            resolveTargetTenant,
            getState,
            checkPco: vi.fn(),
            submitRequest: vi.fn(),
            joinViaPco: vi.fn(),
            completeProfile: vi.fn(),
          },
        },
        {
          provide: TenantContextService,
          useValue: { refresh: vi.fn(), switchTenant: vi.fn() },
        },
        { provide: AdminAuthService, useValue: { logout: vi.fn() } },
        {
          provide: SupabaseService,
          useValue: {
            client: {
              rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
            },
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: vi.fn(() => null) } } },
        },
        { provide: Router, useValue: { navigate: vi.fn(), navigateByUrl: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestAccessComponent);
  });

  it('shows affiliation field and admin approval notice when PCO is off and user is not a member', () => {
    const comp = fixture.componentInstance;
    comp.tenantName = 'Cross Pointe Church';
    comp.phase = 'request';
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent).toContain('Admin Approval Required');
    expect(html.textContent).toContain('How are you affiliated with the church?');
    expect(comp.requiresAffiliation).toBe(true);
  });

  it('loads request phase after refresh when access state is none and PCO is off', async () => {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();

    expect(getState).toHaveBeenCalledWith('04070487-cb3f-408d-ae5d-5a88f44613db');
    expect(fixture.componentInstance.phase).toBe('request');
  });
});
