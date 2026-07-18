import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { EmailSubscribersComponent } from './email-subscribers.component';
import { SupabaseService } from '../../services/supabase.service';
import { ToastService } from '../../services/toast.service';
import { AdminDataService } from '../../services/admin-data.service';

const MOCK_TENANT = {
  id: 'tenant-1',
  name: 'Test Org',
  slug: 'test-org',
  plan_tier: 'churches' as const,
  plan_status: 'active' as const,
};

function makeSubscriber(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    name: 'Alice',
    email: 'alice@test.com',
    is_active: true,
    is_blocked: false,
    receive_push: false,
    created_at: '2026-01-01T00:00:00Z',
    last_activity_date: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

describe('EmailSubscribersComponent', () => {
  let component: EmailSubscribersComponent;
  let mockSupabaseService: any;
  let mockToastService: any;
  let mockChangeDetectorRef: any;
  let mockAdminDataService: any;
  let mockBreakpointObserver: any;
  let mockTenantContext: any;
  let activeTenant$: BehaviorSubject<typeof MOCK_TENANT | null>;
  let fromChain: any;

  beforeEach(() => {
    vi.clearAllMocks();
    activeTenant$ = new BehaviorSubject<typeof MOCK_TENANT | null>(MOCK_TENANT);

    fromChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
    fromChain.select.mockImplementation(() => fromChain);

    mockTenantContext = {
      getActiveTenant: vi.fn(() => MOCK_TENANT),
      activeTenant$,
    };

    mockSupabaseService = {
      client: {
        from: vi.fn(() => fromChain),
        rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
      },
    };

    mockToastService = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    };

    mockChangeDetectorRef = {
      markForCheck: vi.fn(),
      detectChanges: vi.fn(),
    };

    mockAdminDataService = {
      sendSubscriberWelcomeEmail: vi.fn().mockResolvedValue({}),
    };

    mockBreakpointObserver = {
      observe: vi.fn().mockReturnValue({
        subscribe: vi.fn().mockImplementation((fn: (v: { matches: boolean }) => void) => {
          fn({ matches: false });
          return { unsubscribe: vi.fn() };
        }),
      }),
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

  it('should create and expose defaults', () => {
    expect(component).toBeTruthy();
    expect(component.subscribers).toEqual([]);
    expect(component.sortBy).toBe('last_activity_date');
    expect(component.activeTenantId).toBe('tenant-1');
  });

  it('ngOnInit wires tenant and orientation listeners', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    component.ngOnInit();
    expect(addSpy).toHaveBeenCalledWith('orientationchange', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(component.maxPaginationButtons).toBe(5);
  });

  it('resets state when active tenant cleared while expanded', async () => {
    component.ngOnInit();
    component.sectionExpanded = true;
    component.allSubscribers = [makeSubscriber() as any];
    mockTenantContext.getActiveTenant.mockReturnValue(null);
    activeTenant$.next(null);
    await vi.waitFor(() => {
      expect(component.allSubscribers).toEqual([]);
    });
  });

  it('lazy-loads on expand and cleans up on destroy', async () => {
    const searchSpy = vi.spyOn(component, 'handleSearch').mockResolvedValue(undefined);
    component.onExpandedChange(true);
    await Promise.resolve();
    expect(searchSpy).toHaveBeenCalled();

    component.ngOnInit();
    component.onListSearchQueryChange('ab');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    component.ngOnDestroy();
    expect(removeSpy).toHaveBeenCalled();
  });

  it('debounces search and ignores short queries', async () => {
    vi.useFakeTimers();
    const searchSpy = vi.spyOn(component, 'handleSearch').mockResolvedValue(undefined);
    component.onListSearchQueryChange('a');
    expect(searchSpy).not.toHaveBeenCalled();
    component.onListSearchQueryChange('ab');
    vi.advanceTimersByTime(component.listSearchDebounceMs);
    await Promise.resolve();
    expect(searchSpy).toHaveBeenCalled();
    component.onListSearchQueryChange('');
    vi.advanceTimersByTime(component.listSearchDebounceMs);
    await Promise.resolve();
    expect(searchSpy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('flushListSearchNow and clearListSearch', () => {
    const searchSpy = vi.spyOn(component, 'handleSearch').mockResolvedValue(undefined);
    component.searchQuery = 'a';
    component.flushListSearchNow();
    expect(searchSpy).not.toHaveBeenCalled();
    component.searchQuery = 'alice';
    component.onListSearchKeydown({
      key: 'Enter',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent);
    expect(searchSpy).toHaveBeenCalled();
    component.clearListSearch();
    expect(component.searchQuery).toBe('');
  });

  it('toggle forms and edit modal', async () => {
    component.toggleAddForm();
    expect(component.showAddForm).toBe(true);
    expect(component.showCSVUpload).toBe(false);
    component.toggleCSVUpload();
    expect(component.showCSVUpload).toBe(true);
    expect(component.showAddForm).toBe(false);

    const sub = makeSubscriber() as any;
    component.openEditSubscriberModal(sub);
    expect(component.showEditSubscriberDialog).toBe(true);
    expect(component.editName).toBe('Alice');

    component.editName = '  ';
    await component.saveEditSubscriber();
    expect(component.editError).toBe('Name is required');

    component.editName = 'Alice Updated';
    await component.saveEditSubscriber();
    expect(mockToastService.success).toHaveBeenCalledWith('Subscriber updated');
    expect(component.showEditSubscriberDialog).toBe(false);

    component.closeEditSubscriberModal();
    expect(component.editSubscriberId).toBeNull();
  });

  it('handleSearch maps rows and filters super admins', async () => {
    const rows = [
      {
        id: '1',
        name: 'A',
        user_email: 'a@test.com',
        is_active: true,
        is_blocked: false,
        role: 'member',
        created_at: '2026-01-01T00:00:00Z',
        last_activity_date: null,
      },
      {
        id: '2',
        name: 'Super',
        user_email: 'super@test.com',
        is_active: true,
        is_blocked: false,
        role: 'member',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    fromChain.order.mockResolvedValue({ data: rows, error: null, count: 2 });
    mockSupabaseService.client.rpc.mockImplementation((_name: string, args: any) =>
      Promise.resolve({
        data: args.email_to_check === 'super@test.com',
        error: null,
      })
    );

    await component.handleSearch();
    expect(component.allSubscribers).toHaveLength(1);
    expect(component.allSubscribers[0].email).toBe('a@test.com');
    expect(component.hasSearched).toBe(true);
  });

  it('handleSearch surfaces errors', async () => {
    fromChain.order.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await component.handleSearch();
    expect(component.error).toBe('Failed to fetch subscribers');
    expect(component.subscribers).toEqual([]);
  });

  it('sorts and paginates subscribers', () => {
    component.allSubscribers = [
      makeSubscriber({ id: '1', name: 'Zoe', email: 'z@test.com' }),
      makeSubscriber({ id: '2', name: 'Amy', email: 'a@test.com', is_active: false }),
      makeSubscriber({
        id: '3',
        name: 'Bob',
        email: 'b@test.com',
        receive_push: true,
        is_blocked: true,
        created_at: '2025-01-01T00:00:00Z',
        last_activity_date: '',
      }),
    ] as any;
    component.totalItems = 3;
    component.pageSize = 2;

    component.toggleSort('name');
    expect(component.sortBy).toBe('name');
    expect(component.allSubscribers[0].name).toBe('Amy');
    expect(component.getSortIndicator('name')).toContain('↑');

    component.toggleSort('email');
    component.toggleSort('created_at');
    component.toggleSort('last_activity_date');
    component.toggleSort('is_active');
    component.toggleSort('receive_push');
    component.toggleSort('is_blocked');
    expect(component.getSortIndicator('other')).toBe('');

    component.loadPageData();
    expect(component.subscribers).toHaveLength(2);
    expect(component.totalPages).toBe(2);
    expect(component.isFirstPage).toBe(true);
    expect(component.isLastPage).toBe(false);

    component.nextPage();
    expect(component.currentPage).toBe(2);
    component.previousPage();
    expect(component.currentPage).toBe(1);
    component.goToPage(2);
    component.changePageSize();
    expect(component.currentPage).toBe(1);
    expect(component.getPaginationRange().length).toBeGreaterThan(0);

    component.totalItems = 20;
    component.pageSize = 2;
    component.currentPage = 5;
    component.maxPaginationButtons = 3;
    expect(component.getPaginationRange()).toContain(5);
  });

  it('handleAddSubscriber validates and inserts', async () => {
    await component.handleAddSubscriber();
    expect(component.error).toBe('Name and email are required');

    component.newName = 'Test';
    component.newEmail = 'bad';
    await component.handleAddSubscriber();
    expect(component.error).toBe('Enter a valid email address');

    component.newEmail = 'test@example.com';
    fromChain.maybeSingle.mockResolvedValue({ data: { user_email: 'test@example.com' }, error: null });
    await component.handleAddSubscriber();
    expect(component.error).toBe('This email address is already subscribed');

    fromChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    fromChain.insert.mockResolvedValue({ error: null });
    vi.spyOn(component, 'handleSearch').mockResolvedValue(undefined);
    await component.handleAddSubscriber();
    expect(component.showSendWelcomeEmailDialog).toBe(true);
  });

  it('toggles active/push/blocked via confirmation actions', async () => {
    component.allSubscribers = [makeSubscriber({ id: 'sub-1' }) as any];
    fromChain.maybeSingle.mockResolvedValue({
      data: { user_email: 'alice@test.com' },
      error: null,
    });

    await component.handleToggleActive('sub-1', true);
    expect(component.showConfirmationDialog).toBe(true);
    await component.confirmationAction!();
    expect(mockToastService.success).toHaveBeenCalledWith('Subscriber deactivated');

    await component.handleToggleReceivePush('sub-1', false);
    await component.confirmationAction!();
    expect(mockToastService.success).toHaveBeenCalledWith('Push notifications enabled');

    await component.handleToggleBlocked('sub-1', false);
    await component.confirmationAction!();
    expect(mockToastService.success).toHaveBeenCalledWith(
      'User blocked - login disabled'
    );

    await component.handleToggleBlocked('sub-1', true);
    await component.confirmationAction!();
    expect(mockToastService.success).toHaveBeenCalledWith(
      'User unblocked - login enabled'
    );
  });

  it('handleDelete removes member and unsubscribes tenant admin', async () => {
    component.allSubscribers = [
      makeSubscriber({ id: 'm1' }),
      makeSubscriber({ id: 'a1', email: 'admin@test.com' }),
    ] as any;
    component.totalItems = 2;

    fromChain.maybeSingle.mockResolvedValue({ data: { role: 'member' }, error: null });
    mockSupabaseService.client.rpc.mockResolvedValue({ data: false, error: null });
    await component.handleDelete('m1', 'alice@test.com');
    await component.confirmationAction!();
    expect(mockToastService.success).toHaveBeenCalledWith('Subscriber removed');
    expect(component.allSubscribers.find((s) => s.id === 'm1')).toBeUndefined();

    fromChain.maybeSingle.mockResolvedValue({
      data: { role: 'tenant_admin' },
      error: null,
    });
    await component.handleDelete('a1', 'admin@test.com');
    await component.confirmationAction!();
    expect(component.csvSuccess).toContain('retains admin access');
  });

  it('parses CSV and uploads new rows', async () => {
    const file = new File(['Alice,alice@test.com\nbad,\nBob,not-an-email'], 't.csv', {
      type: 'text/csv',
    });
    const event = {
      target: { files: [file] },
    } as unknown as Event;

    await new Promise<void>((resolve) => {
      const original = FileReader.prototype.readAsText;
      FileReader.prototype.readAsText = function (this: FileReader) {
        setTimeout(() => {
          Object.defineProperty(this, 'result', {
            value: 'Alice,alice@test.com\nbad,\nBob,not-an-email',
          });
          this.onload?.({ target: this } as any);
          resolve();
        }, 0);
      };
      component.handleCSVUpload(event);
      FileReader.prototype.readAsText = original;
    });

    expect(component.getValidRowsCount()).toBe(1);
    expect(component.getInvalidRowsCount()).toBe(2);
    expect(component.getActiveCount()).toBe(0);

    await component.uploadCSVData();
    // valid rows exist from previous parse — re-set for upload path
    component.csvData = [
      { name: 'Alice', email: 'alice@test.com', valid: true },
      { name: 'Dup', email: 'dup@test.com', valid: true },
    ];
    fromChain.in.mockResolvedValue({
      data: [{ user_email: 'dup@test.com' }],
      error: null,
    });
    vi.spyOn(component, 'handleSearch').mockResolvedValue(undefined);
    await component.uploadCSVData();
    expect(component.csvSuccess).toContain('Successfully added');
  });

  it('uploadCSVData validates empty and no-tenant', async () => {
    component.csvData = [];
    await component.uploadCSVData();
    expect(component.error).toBe('No valid rows to upload');

    component.csvData = [{ name: 'A', email: 'a@test.com', valid: true }];
    mockTenantContext.getActiveTenant.mockReturnValue(null);
    await component.uploadCSVData();
    expect(component.error).toBe('Select an organization first');
  });

  it('welcome email and confirmation dialog helpers', async () => {
    component.pendingSubscriberEmail = 'new@test.com';
    await component.onConfirmSendWelcomeEmail();
    expect(mockAdminDataService.sendSubscriberWelcomeEmail).toHaveBeenCalledWith(
      'new@test.com'
    );
    expect(component.showSendWelcomeEmailDialog).toBe(false);

    component.showSendWelcomeEmailDialog = true;
    component.pendingSubscriberEmail = 'x@test.com';
    component.onDeclineSendWelcomeEmail();
    expect(component.showSendWelcomeEmailDialog).toBe(false);

    const action = vi.fn().mockResolvedValue(undefined);
    component.confirmationAction = action;
    component.showConfirmationDialog = true;
    await component.onConfirmDialog();
    expect(action).toHaveBeenCalled();
    expect(component.showConfirmationDialog).toBe(false);

    component.showConfirmationDialog = true;
    component.confirmationAction = action;
    component.onCancelDialog();
    expect(component.confirmationAction).toBeNull();
  });

  it('onManualAddFieldEnter delegates to handleAddSubscriber', () => {
    const spy = vi.spyOn(component, 'handleAddSubscriber').mockResolvedValue(undefined);
    component.onManualAddFieldEnter({ preventDefault: vi.fn() } as any);
    expect(spy).toHaveBeenCalled();
  });
});
