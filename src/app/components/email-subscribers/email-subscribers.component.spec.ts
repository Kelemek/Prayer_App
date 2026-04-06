import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { of } from 'rxjs';
import { EmailSubscribersComponent } from './email-subscribers.component';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { AdminDataService } from '../../services/admin-data.service';

const MOCK_TENANT = {
  id: 'tenant-1',
  name: 'Test Org',
  slug: 'test-org',
  plan_tier: 'churches' as const,
  plan_status: 'active' as const
};

function createFromMock() {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    in: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    })
  };
  chain.select.mockImplementation(() => chain);
  return chain;
}

describe('EmailSubscribersComponent', () => {
  let component: EmailSubscribersComponent;
  let mockSupabaseService: any;
  let mockToastService: any;
  let mockChangeDetectorRef: any;
  let mockAdminDataService: any;
  let mockBreakpointObserver: any;
  let mockTenantContext: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTenantContext = {
      getActiveTenant: vi.fn(() => MOCK_TENANT),
      activeTenant$: of(MOCK_TENANT)
    };

    const fromChain = createFromMock();
    mockSupabaseService = {
      client: {
        from: vi.fn(() => fromChain)
      }
    };

    mockToastService = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn()
    };

    mockChangeDetectorRef = {
      markForCheck: vi.fn(),
      detectChanges: vi.fn()
    };

    mockAdminDataService = {
      sendSubscriberWelcomeEmail: vi.fn().mockResolvedValue({})
    };

    mockBreakpointObserver = {
      observe: vi.fn().mockReturnValue({
        subscribe: vi.fn().mockImplementation((fn: (v: { matches: boolean }) => void) => {
          fn({ matches: false });
          return { unsubscribe: vi.fn() };
        })
      })
    };

    component = new EmailSubscribersComponent(
      mockSupabaseService as unknown as SupabaseService,
      mockToastService as unknown as ToastService,
      mockChangeDetectorRef as any,
      mockAdminDataService as unknown as AdminDataService,
      mockBreakpointObserver as any,
      mockTenantContext
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.subscribers).toEqual([]);
    expect(component.searchQuery).toBe('');
    expect(component.sortBy).toBe('last_activity_date');
    expect(component.showAddForm).toBe(false);
  });

  it('toggleSort should toggle direction when same column', () => {
    component.sortBy = 'name';
    component.sortDirection = 'asc';
    component.toggleSort('name');
    expect(component.sortDirection).toBe('desc');
  });

  it('toggleSort should switch column and default to asc for non-activity columns', () => {
    component.sortBy = 'name';
    component.sortDirection = 'desc';
    component.toggleSort('email');
    expect(component.sortBy).toBe('email');
    expect(component.sortDirection).toBe('asc');
  });

  it('handleAddSubscriber should insert subscriber without Planning Center fields', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const addChain: any = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      }),
      insert: insertMock
    };

    mockSupabaseService.client.from = vi.fn(() => addChain);

    component.newName = 'Test User';
    component.newEmail = 'test@example.com';
    await component.handleAddSubscriber();

    expect(insertMock).toHaveBeenCalledWith({
      name: 'Test User',
      email: 'test@example.com',
      is_active: true,
      is_admin: false,
      receive_admin_emails: false,
      tenant_id: MOCK_TENANT.id
    });
  });
});
