import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';
import type { Tenant, TenantMembership } from '../types/tenant';

const ACTIVE_TENANT_STORAGE_KEY = 'active_tenant_id';
type TenantContextRpcRow = {
  tenant_id: string;
  user_email: string;
  role: TenantMembership['role'];
  tenant: Tenant | null;
  is_super_admin: boolean;
};

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

  constructor(
    private supabase: SupabaseService
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
    const tenant = this.availableTenantsSubject.value.find((item) => item.id === tenantId) || null;
    if (!tenant) {
      return false;
    }

    this.activeTenantSubject.next(tenant);
    localStorage.setItem(ACTIVE_TENANT_STORAGE_KEY, tenantId);
    return true;
  }

  async refresh(): Promise<void> {
    this.loadingSubject.next(true);
    const { data: { session } } = await this.supabase.client.auth.getSession();
    const hasSupabaseSessionUser = !!session?.user?.email;
    const hasMfaEmail = !!localStorage.getItem('mfa_authenticated_email');
    const userEmail = await this.getUserEmail();

    if (!userEmail) {
      this.membershipsSubject.next([]);
      this.availableTenantsSubject.next([]);
      this.activeTenantSubject.next(null);
      this.isSuperAdminSubject.next(false);
      this.loadingSubject.next(false);
      return;
    }

    const lowerEmail = userEmail.toLowerCase().trim();

    if (!hasSupabaseSessionUser && hasMfaEmail) {
      const { data: contextRows, error: contextError } = await this.supabase.client.rpc('get_tenant_context_by_email', {
        p_email: lowerEmail
      });

      if (contextError) {
        console.error('[TenantContext] MFA context lookup failed:', contextError);
        this.membershipsSubject.next([]);
        this.activeTenantSubject.next(null);
        this.isSuperAdminSubject.next(false);
        this.loadingSubject.next(false);
        return;
      }

      const rows = (contextRows || []) as TenantContextRpcRow[];
      const memberships = rows
        .filter((row) => !!row.tenant_id && !!row.role && !!row.tenant)
        .map((row) => ({
          tenant_id: row.tenant_id,
          user_email: row.user_email,
          role: row.role,
          tenants: row.tenant
        } as TenantMembership));
      const normalizedMemberships = this.normalizeMemberships(memberships);
      const isSuperAdmin = rows.some((row) => row.is_super_admin);
      const allTenants = isSuperAdmin
        ? await this.getAllTenantsForSuperAdmin(lowerEmail, false)
        : this.extractTenantsFromMemberships(normalizedMemberships);

      this.membershipsSubject.next(normalizedMemberships);
      this.availableTenantsSubject.next(this.normalizeTenants(allTenants));
      this.isSuperAdminSubject.next(isSuperAdmin);
      this.restoreOrAutoSelectActiveTenant();
      this.loadingSubject.next(false);
      return;
    }

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

    let normalizedMemberships: TenantMembership[] = [];
    if (membershipsError) {
      console.error('[TenantContext] Failed to load memberships:', membershipsError);

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

    const allTenants = isSuperAdmin
      ? await this.getAllTenantsForSuperAdmin(lowerEmail, true)
      : this.extractTenantsFromMemberships(normalizedMemberships);
    this.availableTenantsSubject.next(this.normalizeTenants(allTenants));
    this.restoreOrAutoSelectActiveTenant();

    this.loadingSubject.next(false);
  }

  private restoreOrAutoSelectActiveTenant(): void {
    const availableTenants = this.availableTenantsSubject.value;
    if (availableTenants.length === 0) {
      this.activeTenantSubject.next(null);
      localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
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

  private async getUserEmail(): Promise<string | null> {
    try {
      const { data: { session } } = await this.supabase.client.auth.getSession();
      if (session?.user?.email) {
        return session.user.email;
      }
    } catch (error) {
      console.warn('[TenantContext] Failed to read auth session:', error);
    }

    return localStorage.getItem('mfa_authenticated_email');
  }

  private async initializeAuthStateSync(): Promise<void> {
    const { data: { session } } = await this.supabase.client.auth.getSession();
    this.handleAuthState(!!session?.user || !!localStorage.getItem('mfa_authenticated_email'));

    this.supabase.client.auth.onAuthStateChange((_event, authSession) => {
      this.handleAuthState(!!authSession?.user || !!localStorage.getItem('mfa_authenticated_email'));
    });
  }

  private handleAuthState(isAuthenticated: boolean): void {
    if (!isAuthenticated) {
      this.membershipsSubject.next([]);
      this.availableTenantsSubject.next([]);
      this.activeTenantSubject.next(null);
      this.isSuperAdminSubject.next(false);
      this.loadingSubject.next(false);
      localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
      return;
    }

    this.refresh().catch((error) => {
      console.error('[TenantContext] Failed to refresh tenant context:', error);
      this.loadingSubject.next(false);
    });
  }
}
