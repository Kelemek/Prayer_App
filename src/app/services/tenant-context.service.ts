import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { AuthIdentityService } from './auth-identity.service';
import { ConnectivityService } from './connectivity.service';
import type { Tenant, TenantMembership } from '../types/tenant';

const ACTIVE_TENANT_STORAGE_KEY = 'active_tenant_id';
const TENANT_SNAPSHOT_STORAGE_KEY = 'tenant_context_snapshot';

interface TenantContextSnapshot {
  memberships: TenantMembership[];
  availableTenants: Tenant[];
  activeTenantId: string | null;
  isSuperAdmin: boolean;
  savedAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class TenantContextService {
  private membershipsSubject = new BehaviorSubject<TenantMembership[]>([]);
  private availableTenantsSubject = new BehaviorSubject<Tenant[]>([]);
  private activeTenantSubject = new BehaviorSubject<Tenant | null>(null);
  private isSuperAdminSubject = new BehaviorSubject<boolean>(false);
  private loadingSubject = new BehaviorSubject<boolean>(true);

  public memberships$ = this.membershipsSubject.asObservable();
  public availableTenants$ = this.availableTenantsSubject.asObservable();
  public activeTenant$ = this.activeTenantSubject.asObservable();
  public isSuperAdmin$ = this.isSuperAdminSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  /** @deprecated Use memberships$ — kept for template compatibility during transition */
  public subscriberTenants$ = this.availableTenants$;

  constructor(
    private supabase: SupabaseService,
    private authIdentity: AuthIdentityService,
    private connectivity: ConnectivityService
  ) {
    this.initializeAuthStateSync().catch((error) => {
      console.error('[TenantContext] Failed to initialize auth sync:', error);
      this.loadingSubject.next(false);
    });
  }

  getActiveTenant(): Tenant | null {
    return this.activeTenantSubject.value;
  }

  getMemberships(): TenantMembership[] {
    return this.membershipsSubject.value;
  }

  getAvailableTenants(): Tenant[] {
    return this.availableTenantsSubject.value;
  }

  getMemberTenants(): Tenant[] {
    return this.normalizeTenants(this.extractTenantsFromMemberships(this.membershipsSubject.value));
  }

  /** @deprecated Subscribers merged into tenant_memberships */
  getSubscriberTenants(): Tenant[] {
    return this.getMemberTenants();
  }

  getAccessibleTenants(): Tenant[] {
    return this.getMemberTenants();
  }

  getTenantSwitcherOptions(): Tenant[] {
    const tenants = this.getIsSuperAdmin()
      ? this.getAvailableTenants()
      : this.getAccessibleTenants();
    return this.normalizeTenants(tenants);
  }

  getIsSuperAdmin(): boolean {
    return this.isSuperAdminSubject.value;
  }

  getIsImpersonatingTenant(): boolean {
    const activeTenant = this.getActiveTenant();
    if (!activeTenant || !this.getIsSuperAdmin()) {
      return false;
    }
    const memberships = this.membershipsSubject.value;
    return !memberships.some((membership) => membership.tenant_id === activeTenant.id);
  }

  async switchTenant(tenantId: string): Promise<boolean> {
    const allowedTenants = this.getIsSuperAdmin()
      ? this.availableTenantsSubject.value
      : this.getAccessibleTenants();
    const tenant = allowedTenants.find((item) => item.id === tenantId) || null;
    if (!tenant) {
      if (!this.connectivity.isOnline()) {
        this.connectivity.requireOnline('switch organizations');
      }
      return false;
    }

    this.activeTenantSubject.next(tenant);
    localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, tenantId);
    this.persistSnapshot();
    return true;
  }

  async refresh(): Promise<void> {
    this.loadingSubject.next(true);
    const userEmail = await this.authIdentity.getEmail();

    if (!userEmail) {
      this.clearContext(true);
      this.loadingSubject.next(false);
      return;
    }

    if (!this.connectivity.isOnline()) {
      if (this.restoreSnapshot()) {
        console.log('[TenantContext] Restored tenant snapshot while offline');
      } else {
        console.warn('[TenantContext] Offline with no tenant snapshot');
      }
      this.loadingSubject.next(false);
      return;
    }

    const lowerEmail = userEmail.toLowerCase().trim();

    try {
      const [{ data: memberships, error: membershipsError }, { data: superRole, error: roleError }] = await Promise.all([
        this.supabase.client
          .from('tenant_memberships')
          .select('tenant_id, user_email, role, tenants(id, name, slug, plan_tier, plan_status)')
          .eq('user_email', lowerEmail),
        this.supabase.client
          .from('global_roles')
          .select('role')
          .eq('user_email', lowerEmail)
          .eq('role', 'super_admin')
          .maybeSingle()
      ]);

      const networkFailed =
        this.supabase.isNetworkError(membershipsError) ||
        this.supabase.isNetworkError(roleError) ||
        (!!membershipsError && !memberships) ||
        (!!roleError && roleError.message?.toLowerCase().includes('fetch'));

      if (networkFailed && this.restoreSnapshot()) {
        console.warn('[TenantContext] Network error during refresh; using snapshot');
        this.loadingSubject.next(false);
        return;
      }

      let normalizedMemberships: TenantMembership[] = [];
      if (membershipsError) {
        console.error('[TenantContext] Failed to load memberships:', membershipsError);
        if (this.restoreSnapshot()) {
          this.loadingSubject.next(false);
          return;
        }
        this.membershipsSubject.next([]);
      } else {
        normalizedMemberships = this.normalizeMemberships((memberships || []) as TenantMembership[]);
        this.membershipsSubject.next(normalizedMemberships);
      }

      let isSuperAdmin = false;
      if (roleError) {
        console.error('[TenantContext] Failed to load global roles:', roleError);
        this.isSuperAdminSubject.next(false);
      } else {
        isSuperAdmin = !!superRole;
        this.isSuperAdminSubject.next(isSuperAdmin);
      }

      const memberTenants = this.extractTenantsFromMemberships(normalizedMemberships);
      const allTenants = isSuperAdmin
        ? await this.getAllTenantsForSuperAdmin(lowerEmail, true)
        : memberTenants;
      this.availableTenantsSubject.next(this.normalizeTenants(allTenants));
      this.restoreOrAutoSelectActiveTenant();
      this.persistSnapshot();
    } catch (error) {
      console.error('[TenantContext] Failed to refresh tenant context:', error);
      if (!this.restoreSnapshot()) {
        // Keep any existing in-memory state; do not wipe active_tenant_id
      }
    } finally {
      this.loadingSubject.next(false);
    }
  }

  private restoreOrAutoSelectActiveTenant(): void {
    const availableTenants = this.availableTenantsSubject.value;
    if (availableTenants.length === 0) {
      this.activeTenantSubject.next(null);
      // Do not remove ACTIVE_TENANT_STORAGE_KEY here when offline restore may still need it
      return;
    }

    const storedTenantId = localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
    const storedTenant = availableTenants.find((tenant) => tenant.id === storedTenantId) || null;
    if (storedTenant) {
      this.activeTenantSubject.next(storedTenant);
      return;
    }

    const fallback = availableTenants[0] || null;
    this.activeTenantSubject.next(fallback);
    if (fallback?.id) {
      localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, fallback.id);
    }
  }

  private persistSnapshot(): void {
    try {
      const snapshot: TenantContextSnapshot = {
        memberships: this.membershipsSubject.value,
        availableTenants: this.availableTenantsSubject.value,
        activeTenantId: this.activeTenantSubject.value?.id
          ?? localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY),
        isSuperAdmin: this.isSuperAdminSubject.value,
        savedAt: Date.now()
      };
      localStorage.setItem(TENANT_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
      if (snapshot.activeTenantId) {
        localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, snapshot.activeTenantId);
      }
    } catch (error) {
      console.warn('[TenantContext] Failed to persist snapshot:', error);
    }
  }

  private restoreSnapshot(): boolean {
    try {
      const raw = localStorage.getItem(TENANT_SNAPSHOT_STORAGE_KEY);
      if (!raw) {
        return this.restoreMinimalActiveTenant();
      }
      const snapshot = JSON.parse(raw) as TenantContextSnapshot;
      if (!snapshot || !Array.isArray(snapshot.availableTenants)) {
        return this.restoreMinimalActiveTenant();
      }

      this.membershipsSubject.next(snapshot.memberships || []);
      this.availableTenantsSubject.next(this.normalizeTenants(snapshot.availableTenants || []));
      this.isSuperAdminSubject.next(!!snapshot.isSuperAdmin);

      const storedId =
        snapshot.activeTenantId ||
        localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
      const active =
        this.availableTenantsSubject.value.find((t) => t.id === storedId) ||
        this.availableTenantsSubject.value[0] ||
        null;
      this.activeTenantSubject.next(active);
      if (active?.id) {
        localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, active.id);
      }
      return !!active;
    } catch (error) {
      console.warn('[TenantContext] Failed to restore snapshot:', error);
      return this.restoreMinimalActiveTenant();
    }
  }

  /** Last-resort: active_tenant_id alone with a stub tenant so prayer caches can load. */
  private restoreMinimalActiveTenant(): boolean {
    const storedId = localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
    if (!storedId) {
      return false;
    }
    const stub: Tenant = {
      id: storedId,
      name: 'Offline',
      slug: 'offline',
      plan_tier: 'free',
      plan_status: 'active'
    };
    this.activeTenantSubject.next(stub);
    if (this.availableTenantsSubject.value.length === 0) {
      this.availableTenantsSubject.next([stub]);
    }
    return true;
  }

  private clearContext(clearStorage: boolean): void {
    this.membershipsSubject.next([]);
    this.availableTenantsSubject.next([]);
    this.activeTenantSubject.next(null);
    this.isSuperAdminSubject.next(false);
    if (clearStorage) {
      localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
      localStorage.removeItem(TENANT_SNAPSHOT_STORAGE_KEY);
    }
  }

  private normalizeMemberships(memberships: TenantMembership[]): TenantMembership[] {
    return memberships.map((membership) => ({
      ...membership,
      tenants: this.toTenant(membership.tenants)
    }));
  }

  private toTenant(value: TenantMembership['tenants']): Tenant | null {
    if (!value) return null;
    if (Array.isArray(value)) {
      return value.length > 0 ? value[0] : null;
    }
    return value;
  }

  private extractTenantsFromMemberships(memberships: TenantMembership[]): Tenant[] {
    return memberships
      .map((membership) => this.toTenant(membership.tenants))
      .filter((tenant): tenant is Tenant => !!tenant);
  }

  private normalizeTenants(tenants: Tenant[]): Tenant[] {
    const unique = new Map<string, Tenant>();
    tenants.forEach((tenant) => {
      if (tenant?.id) {
        unique.set(tenant.id, tenant);
      }
    });
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  private async getAllTenantsForSuperAdmin(
    userEmail: string,
    allowTableFallback: boolean
  ): Promise<Tenant[]> {
    const { data, error } = await this.supabase.client.rpc('get_all_tenants_for_email', {
      p_email: userEmail
    });
    if (!error && data) {
      return this.normalizeTenants((data || []) as Tenant[]);
    }

    if (error) {
      console.error('[TenantContext] Failed to load all tenants for super admin:', error);
    }
    if (!allowTableFallback) {
      return [];
    }

    const { data: tenantRows, error: tenantError } = await this.supabase.client
      .from('tenants')
      .select('id, name, slug, plan_tier, plan_status')
      .order('name', { ascending: true });
    if (tenantError) {
      console.error('[TenantContext] Fallback all-tenant query failed:', tenantError);
      return [];
    }

    return this.normalizeTenants((tenantRows || []) as Tenant[]);
  }

  private async initializeAuthStateSync(): Promise<void> {
    const { data: { session } } = await this.supabase.client.auth.getSession();
    this.handleAuthState(!!session?.user);

    this.supabase.client.auth.onAuthStateChange((_event, authSession) => {
      this.handleAuthState(!!authSession?.user);
    });
  }

  private handleAuthState(isAuthenticated: boolean): void {
    if (!isAuthenticated) {
      this.clearContext(true);
      this.loadingSubject.next(false);
      return;
    }

    this.refresh().catch((error) => {
      console.error('[TenantContext] Failed to refresh tenant context:', error);
      if (!this.restoreSnapshot()) {
        // leave loading false below
      }
      this.loadingSubject.next(false);
    });
  }
}
