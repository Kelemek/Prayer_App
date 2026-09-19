import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { fetchListMembers, type PlanningCenterListMember } from '../lib/planning-center';
import { SupabaseService } from './supabase.service';
import { UserSessionService } from './user-session.service';
import { TenantContextService } from './tenant-context.service';

interface PlanningCenterListCache {
  email: string;
  tenantId: string;
  listId: string | null;
  members: PlanningCenterListMember[];
}

interface StoredPlanningCenterListCache {
  data: PlanningCenterListCache;
  timestamp: number;
  ttl: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_KEY_PREFIX = 'prayerapp_planning_center_list_';

@Injectable({ providedIn: 'root' })
export class PlanningCenterListService {
  private readonly listIdSubject = new BehaviorSubject<string | null>(null);
  private readonly membersSubject = new BehaviorSubject<PlanningCenterListMember[]>([]);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);

  readonly listId$ = this.listIdSubject.asObservable();
  readonly members$ = this.membersSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();

  private loadInFlight: Promise<void> | null = null;
  private loadedEmail: string | null = null;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly userSessionService: UserSessionService,
    private readonly tenantContext: TenantContextService
  ) {
    const email = this.resolveEmail();
    if (email) {
      void this.loadForUser(email);
    }
  }

  getCurrentListId(): string | null {
    return this.listIdSubject.value;
  }

  getCurrentMembers(): PlanningCenterListMember[] {
    return this.membersSubject.value;
  }

  loadForCurrentUser(forceReload = false): Promise<void> {
    const email = this.resolveEmail();
    if (!email) {
      this.clearState();
      return Promise.resolve();
    }
    return this.loadForUser(email, forceReload);
  }

  async loadForUser(email: string, forceReload = false): Promise<void> {
    const normalized = this.normalizeEmail(email);
    if (!normalized) {
      this.clearState();
      return;
    }

    if (this.loadInFlight && this.loadedEmail === normalized && !forceReload) {
      return this.loadInFlight;
    }

    this.loadedEmail = normalized;
    this.hydrateFromCache(normalized);

    this.loadInFlight = this.refreshFromServer(normalized, forceReload).finally(() => {
      this.loadInFlight = null;
    });

    return this.loadInFlight;
  }

  invalidateForUser(email: string | null | undefined): void {
    const normalized = email ? this.normalizeEmail(email) : '';
    if (!normalized) {
      return;
    }
    try {
      localStorage.removeItem(this.cacheStorageKey(normalized));
    } catch {
      // ignore
    }
    if (this.loadedEmail === normalized) {
      this.clearState();
    }
  }

  private resolveEmail(): string | null {
    const sessionEmail = this.userSessionService.getCurrentSession()?.email;
    return sessionEmail?.trim() || null;
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  private cacheStorageKey(normalizedEmail: string): string {
    return `${CACHE_KEY_PREFIX}${normalizedEmail}`;
  }

  private isActiveLoad(normalizedEmail: string): boolean {
    return this.loadedEmail === normalizedEmail;
  }

  private hydrateFromCache(normalizedEmail: string): void {
    if (!this.isActiveLoad(normalizedEmail)) {
      return;
    }
    const cached = this.readCache(normalizedEmail);
    if (!cached) {
      return;
    }
    this.listIdSubject.next(cached.listId);
    this.membersSubject.next(cached.members ?? []);
  }

  private readCache(normalizedEmail: string): PlanningCenterListCache | null {
    try {
      const raw = localStorage.getItem(this.cacheStorageKey(normalizedEmail));
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as StoredPlanningCenterListCache;
      if (!parsed?.data || parsed.data.email !== normalizedEmail) {
        return null;
      }
      if (Date.now() - parsed.timestamp > parsed.ttl) {
        localStorage.removeItem(this.cacheStorageKey(normalizedEmail));
        return null;
      }
      return parsed.data;
    } catch {
      return null;
    }
  }

  private writeCache(normalizedEmail: string, data: PlanningCenterListCache): void {
    const stored: StoredPlanningCenterListCache = {
      data: { ...data, email: normalizedEmail },
      timestamp: Date.now(),
      ttl: CACHE_TTL_MS,
    };
    try {
      localStorage.setItem(this.cacheStorageKey(normalizedEmail), JSON.stringify(stored));
    } catch {
      // ignore
    }
  }

  private clearState(): void {
    this.listIdSubject.next(null);
    this.membersSubject.next([]);
    this.loadingSubject.next(false);
    this.loadedEmail = null;
  }

  private async refreshFromServer(normalizedEmail: string, forceReload: boolean): Promise<void> {
    const tenantId = this.tenantContext.getActiveTenant()?.id;
    if (!tenantId) {
      if (this.isActiveLoad(normalizedEmail)) {
        this.clearState();
      }
      return;
    }

    if (this.isActiveLoad(normalizedEmail)) {
      this.loadingSubject.next(true);
    }

    try {
      const { data, error } = await this.supabase.client
        .from('tenant_memberships')
        .select('planning_center_list_id')
        .eq('tenant_id', tenantId)
        .eq('user_email', normalizedEmail)
        .maybeSingle();

      if (!this.isActiveLoad(normalizedEmail)) {
        return;
      }

      if (error) {
        console.error('[PlanningCenterListService] list id fetch failed:', error);
        return;
      }

      const listId = data?.planning_center_list_id?.trim() || null;
      this.listIdSubject.next(listId);

      if (!listId) {
        this.membersSubject.next([]);
        this.writeCache(normalizedEmail, {
          email: normalizedEmail,
          tenantId,
          listId: null,
          members: [],
        });
        return;
      }

      const cached = !forceReload ? this.readCache(normalizedEmail) : null;
      if (
        cached &&
        cached.listId === listId &&
        cached.tenantId === tenantId &&
        cached.members.length > 0
      ) {
        this.membersSubject.next(cached.members);
        return;
      }

      const result = await fetchListMembers(this.supabase.client, tenantId, listId);
      if (!this.isActiveLoad(normalizedEmail)) {
        return;
      }
      if (result.error) {
        console.error('[PlanningCenterListService] members fetch failed:', result.error);
        this.membersSubject.next([]);
        return;
      }

      this.membersSubject.next(result.members);
      this.writeCache(normalizedEmail, {
        email: normalizedEmail,
        tenantId,
        listId,
        members: result.members,
      });
    } finally {
      if (this.isActiveLoad(normalizedEmail)) {
        this.loadingSubject.next(false);
      }
    }
  }
}
