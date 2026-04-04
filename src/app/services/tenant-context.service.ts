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
  private activeTenantSubject = new BehaviorSubject<Tenant | null>(null);
  private isSuperAdminSubject = new BehaviorSubject<boolean>(false);
  private loadingSubject = new BehaviorSubject<boolean>(true);

  public memberships$ = this.membershipsSubject.asObservable();
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

  getIsSuperAdmin(): boolean {
    return this.isSuperAdminSubject.value;
  }

  async switchTenant(tenantId: string): Promise<boolean> {
    const membership = this.membershipsSubject.value.find((item) => item.tenant_id === tenantId);
    const tenant = this.toTenant(membership?.tenants);
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

      this.membershipsSubject.next(this.normalizeMemberships(memberships));
      this.isSuperAdminSubject.next(rows.some((row) => row.is_super_admin));
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

    if (membershipsError) {
      console.error('[TenantContext] Failed to load memberships:', membershipsError);

      this.membershipsSubject.next([]);
    } else {
      this.membershipsSubject.next(this.normalizeMemberships((memberships || []) as TenantMembership[]));
    }

    if (roleError) {
      console.error('[TenantContext] Failed to load global roles:', roleError);
      this.isSuperAdminSubject.next(false);
    } else {
      this.isSuperAdminSubject.next(!!superRole);
    }

    this.restoreOrAutoSelectActiveTenant();

    this.loadingSubject.next(false);
  }

  private restoreOrAutoSelectActiveTenant(): void {
    const memberships = this.membershipsSubject.value;
    if (memberships.length === 0) {
      this.activeTenantSubject.next(null);
      localStorage.removeItem(ACTIVE_TENANT_STORAGE_KEY);
      return;
    }

    const storedTenantId = localStorage.getItem(ACTIVE_TENANT_STORAGE_KEY);
    const stored = memberships.find((m) => m.tenant_id === storedTenantId && m.tenants);
    const storedTenant = this.toTenant(stored?.tenants);
    if (storedTenant) {
      this.activeTenantSubject.next(storedTenant);
      return;
    }

    const fallback = this.toTenant(memberships.find((m) => !!m.tenants)?.tenants);
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
