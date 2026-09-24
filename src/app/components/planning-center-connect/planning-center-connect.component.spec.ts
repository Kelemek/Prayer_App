import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanningCenterConnectComponent } from './planning-center-connect.component';
import { SupabaseService } from '../../services/supabase.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { ToastService } from '../../services/toast.service';
import { ChangeDetectorRef } from '@angular/core';

vi.mock('../../lib/planning-center', () => ({
  fetchPlanningCenterCredentialsStatus: vi.fn(),
  savePlanningCenterCredentials: vi.fn(),
  testPlanningCenterCredentials: vi.fn(),
  setPlanningCenterEnabled: vi.fn(),
  clearPlanningCenterCredentials: vi.fn(),
}));

import {
  clearPlanningCenterCredentials,
  fetchPlanningCenterCredentialsStatus,
  savePlanningCenterCredentials,
  setPlanningCenterEnabled,
  testPlanningCenterCredentials,
} from '../../lib/planning-center';

describe('PlanningCenterConnectComponent', () => {
  let component: PlanningCenterConnectComponent;
  let toast: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };
  let emitConfigured: ReturnType<typeof vi.fn>;
  let markForCheck: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    toast = { error: vi.fn(), success: vi.fn() };
    markForCheck = vi.fn();
    component = new PlanningCenterConnectComponent(
      { client: {} } as SupabaseService,
      { getActiveTenant: () => ({ id: 'tenant-fallback' }) } as TenantContextService,
      toast as ToastService,
      { markForCheck } as ChangeDetectorRef
    );
    emitConfigured = vi.fn();
    component.credentialsConfiguredChange.subscribe(emitConfigured);
  });

  it('clears status when no tenant is active', async () => {
    component = new PlanningCenterConnectComponent(
      { client: {} } as SupabaseService,
      { getActiveTenant: () => null } as TenantContextService,
      toast as ToastService,
      { markForCheck } as ChangeDetectorRef
    );
    component.credentialsConfiguredChange.subscribe(emitConfigured);
    await component.loadStatus();
    expect(component.status).toBeNull();
    expect(emitConfigured).toHaveBeenCalledWith(false);
    expect(markForCheck).toHaveBeenCalled();
  });

  it('loads credentials status for active tenant', async () => {
    component.activeTenantId = 'tenant-1';
    vi.mocked(fetchPlanningCenterCredentialsStatus).mockResolvedValue({
      status: { configured: true, enabled: true, app_id_last4: 'abcd' },
      error: null,
    });
    await component.loadStatus();
    expect(component.status?.configured).toBe(true);
    expect(emitConfigured).toHaveBeenCalledWith(true);
    expect(component.loading).toBe(false);
  });

  it('toasts when status load fails', async () => {
    component.activeTenantId = 'tenant-1';
    vi.mocked(fetchPlanningCenterCredentialsStatus).mockResolvedValue({
      status: null,
      error: 'Load failed',
    });
    await component.loadStatus();
    expect(toast.error).toHaveBeenCalledWith('Load failed');
    expect(emitConfigured).toHaveBeenCalledWith(false);
  });

  it('reloads status when section expands', async () => {
    component.activeTenantId = 'tenant-1';
    vi.mocked(fetchPlanningCenterCredentialsStatus).mockResolvedValue({
      status: { configured: false, enabled: false },
      error: null,
    });
    component.onExpandedChange(true);
    await vi.waitFor(() =>
      expect(fetchPlanningCenterCredentialsStatus).toHaveBeenCalled()
    );
    expect(component.sectionExpanded).toBe(true);
  });

  it('ngOnChanges loads status when tenant changes', async () => {
    component.activeTenantId = 'tenant-2';
    vi.mocked(fetchPlanningCenterCredentialsStatus).mockResolvedValue({
      status: { configured: true, enabled: false },
      error: null,
    });
    component.ngOnChanges({
      activeTenantId: {
        currentValue: 'tenant-2',
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true,
      },
    });
    await vi.waitFor(() =>
      expect(fetchPlanningCenterCredentialsStatus).toHaveBeenCalled()
    );
  });

  it('saves credentials and clears form fields on success', async () => {
    component.activeTenantId = 'tenant-1';
    component.appId = ' app ';
    component.secret = ' secret ';
    vi.mocked(savePlanningCenterCredentials).mockResolvedValue({ error: null });
    vi.mocked(fetchPlanningCenterCredentialsStatus).mockResolvedValue({
      status: { configured: true, enabled: true },
      error: null,
    });
    await component.onSave();
    expect(savePlanningCenterCredentials).toHaveBeenCalledWith(
      {},
      'tenant-1',
      'app',
      'secret'
    );
    expect(toast.success).toHaveBeenCalledWith('Planning Center credentials saved');
    expect(component.appId).toBe('');
    expect(component.secret).toBe('');
  });

  it('toasts save errors', async () => {
    component.activeTenantId = 'tenant-1';
    component.appId = 'a';
    component.secret = 'b';
    vi.mocked(savePlanningCenterCredentials).mockResolvedValue({
      error: 'Save failed',
    });
    await component.onSave();
    expect(toast.error).toHaveBeenCalledWith('Save failed');
  });

  it('tests connection with form credentials when provided', async () => {
    component.activeTenantId = 'tenant-1';
    component.appId = 'id';
    component.secret = 'sec';
    vi.mocked(testPlanningCenterCredentials).mockResolvedValue({ ok: true, error: null });
    await component.onTest();
    expect(testPlanningCenterCredentials).toHaveBeenCalledWith(
      {},
      'tenant-1',
      'id',
      'sec'
    );
    expect(toast.success).toHaveBeenCalledWith('Planning Center connection succeeded');
  });

  it('tests stored credentials when form is empty', async () => {
    component.activeTenantId = 'tenant-1';
    vi.mocked(testPlanningCenterCredentials).mockResolvedValue({ ok: false, error: 'nope' });
    await component.onTest();
    expect(testPlanningCenterCredentials).toHaveBeenCalledWith(
      {},
      'tenant-1',
      undefined,
      undefined
    );
    expect(toast.error).toHaveBeenCalledWith('nope');
  });

  it('toggles enabled flag and reloads status', async () => {
    component.activeTenantId = 'tenant-1';
    vi.mocked(setPlanningCenterEnabled).mockResolvedValue({ error: null });
    vi.mocked(fetchPlanningCenterCredentialsStatus).mockResolvedValue({
      status: { configured: true, enabled: true },
      error: null,
    });
    const event = { target: { checked: true } } as unknown as Event;
    await component.onToggleEnabled(event);
    expect(setPlanningCenterEnabled).toHaveBeenCalledWith({}, 'tenant-1', true);
  });

  it('toasts toggle errors', async () => {
    component.activeTenantId = 'tenant-1';
    vi.mocked(setPlanningCenterEnabled).mockResolvedValue({ error: 'toggle fail' });
    await component.onToggleEnabled({
      target: { checked: false },
    } as unknown as Event);
    expect(toast.error).toHaveBeenCalledWith('toggle fail');
  });

  it('disconnects and reloads status', async () => {
    component.activeTenantId = 'tenant-1';
    component.appId = 'x';
    component.secret = 'y';
    vi.mocked(clearPlanningCenterCredentials).mockResolvedValue({ error: null });
    vi.mocked(fetchPlanningCenterCredentialsStatus).mockResolvedValue({
      status: { configured: false, enabled: false },
      error: null,
    });
    await component.onDisconnect();
    expect(toast.success).toHaveBeenCalledWith('Planning Center disconnected');
    expect(component.appId).toBe('');
  });

  it('no-ops save when tenant is missing', async () => {
    component = new PlanningCenterConnectComponent(
      { client: {} } as SupabaseService,
      { getActiveTenant: () => null } as TenantContextService,
      toast as ToastService,
      { markForCheck } as ChangeDetectorRef
    );
    component.appId = 'a';
    component.secret = 'b';
    await component.onSave();
    expect(savePlanningCenterCredentials).not.toHaveBeenCalled();
  });
});
