import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, distinctUntilChanged, map } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { CacheService } from './cache.service';
import { UserSessionService } from './user-session.service';
import { TenantContextService } from './tenant-context.service';
import { ToastService } from './toast.service';
import {
  getPersonalCategoryColor,
  normalizePersonalCategoryHexColor,
  sanitizePersonalCategoryName,
} from '../../utils/personalCategoryColor';

export type PersonalCategoryColorMap = Record<string, string>;

@Injectable({
  providedIn: 'root',
})
export class PersonalCategoryColorService {
  private readonly colorsSubject = new BehaviorSubject<PersonalCategoryColorMap>(
    {}
  );

  private activeCacheKey: string | null = null;

  readonly colors$ = this.colorsSubject.asObservable();

  constructor(
    private supabase: SupabaseService,
    private cache: CacheService,
    private userSessionService: UserSessionService,
    private tenantContext: TenantContextService,
    private toast: ToastService
  ) {
    combineLatest([
      this.userSessionService.userSession$.pipe(
        map((session) => session?.email?.toLowerCase().trim() ?? null),
        distinctUntilChanged()
      ),
      this.tenantContext.activeTenant$.pipe(
        map((tenant) => tenant?.id ?? null),
        distinctUntilChanged()
      ),
    ]).subscribe(([email, tenantId]) => {
      if (!email || !tenantId) {
        this.invalidate();
        return;
      }
      this.invalidate();
      void this.loadColors(true);
    });
  }

  getColorsSnapshot(): PersonalCategoryColorMap {
    return this.colorsSubject.value;
  }

  getColor(
    category: string | null | undefined,
    map?: PersonalCategoryColorMap
  ): string {
    return getPersonalCategoryColor(
      category,
      map ?? this.colorsSubject.value
    );
  }

  async loadColors(forceRefresh = false): Promise<PersonalCategoryColorMap> {
    const userEmail = this.userSessionService.getUserEmail();
    const tenantId = this.tenantContext.getActiveTenant()?.id ?? null;
    if (!userEmail || !tenantId) {
      this.colorsSubject.next({});
      return {};
    }

    const loadForEmail = userEmail.toLowerCase().trim();
    const loadForTenantId = tenantId;
    const cacheKey = this.getCacheKey(tenantId);
    this.activeCacheKey = cacheKey;

    const cached = this.cache.get<PersonalCategoryColorMap>(cacheKey);
    if (cached && !forceRefresh) {
      this.colorsSubject.next(cached);
      return cached;
    }

    try {
      const { data, error } = await this.supabase.client
        .from('personal_categories')
        .select('name, color')
        .eq('tenant_id', tenantId);

      if (error) {
        throw error;
      }

      const currentEmail = this.userSessionService.getUserEmail();
      const currentTenantId = this.tenantContext.getActiveTenant()?.id ?? null;
      if (
        !currentEmail ||
        currentEmail.toLowerCase().trim() !== loadForEmail ||
        currentTenantId !== loadForTenantId
      ) {
        return this.colorsSubject.value;
      }

      const map: PersonalCategoryColorMap = {};
      for (const row of data ?? []) {
        const category = sanitizePersonalCategoryName(row.name);
        const color = normalizePersonalCategoryHexColor(row.color);
        if (category && color) {
          map[category] = color;
        }
      }

      this.cache.set(cacheKey, map);
      this.colorsSubject.next(map);
      return map;
    } catch (err) {
      console.error('[PersonalCategoryColorService] Failed to load colors:', err);
      if (cached) {
        this.colorsSubject.next(cached);
        return cached;
      }
      return {};
    }
  }

  async setColor(category: string, color: string): Promise<boolean> {
    const sanitizedCategory = sanitizePersonalCategoryName(category);
    const normalizedColor = normalizePersonalCategoryHexColor(color);
    if (!sanitizedCategory || !normalizedColor) {
      return false;
    }

    const userEmail = this.userSessionService.getUserEmail();
    const tenantId = this.tenantContext.getActiveTenant()?.id ?? null;
    if (!userEmail) {
      this.toast.error('Sign in to save category colors');
      return false;
    }
    if (!tenantId) {
      this.toast.error('No active organization selected');
      return false;
    }

    const setForEmail = userEmail.toLowerCase().trim();
    const setForTenantId = tenantId;
    const cacheKey = this.getCacheKey(tenantId);

    try {
      const { data: categoryId, error: ensureError } = await this.supabase.client.rpc(
        'ensure_personal_category',
        {
          p_name: sanitizedCategory,
          p_tenant_id: tenantId,
        }
      );
      if (ensureError) {
        throw ensureError;
      }
      if (!categoryId) {
        throw new Error('Failed to save category');
      }

      const { error } = await this.supabase.client
        .from('personal_categories')
        .update({
          color: normalizedColor,
        })
        .eq('id', categoryId);

      if (error) {
        throw error;
      }

      const currentEmail = this.userSessionService.getUserEmail();
      const currentTenantId = this.tenantContext.getActiveTenant()?.id ?? null;
      if (
        !currentEmail ||
        currentEmail.toLowerCase().trim() !== setForEmail ||
        currentTenantId !== setForTenantId
      ) {
        return true;
      }

      const updated = {
        ...this.colorsSubject.value,
        [sanitizedCategory]: normalizedColor,
      };
      this.colorsSubject.next(updated);
      this.cache.set(cacheKey, updated);
      return true;
    } catch (err) {
      console.error('[PersonalCategoryColorService] Failed to set color:', err);
      this.toast.error(this.formatSetColorError(err));
      return false;
    }
  }

  async renameCategory(oldCategory: string, newCategory: string): Promise<boolean> {
    const oldName = sanitizePersonalCategoryName(oldCategory);
    const newName = sanitizePersonalCategoryName(newCategory);
    if (!oldName || !newName || oldName === newName) {
      return true;
    }

    const userEmail = this.userSessionService.getUserEmail();
    const tenantId = this.tenantContext.getActiveTenant()?.id ?? null;
    if (!userEmail || !tenantId) {
      return false;
    }

    const cacheKey = this.getCacheKey(tenantId);
    const currentMap = this.colorsSubject.value;
    const color = currentMap[oldName];
    if (!color) {
      return true;
    }

    const updated = { ...currentMap };
    delete updated[oldName];
    updated[newName] = color;
    this.colorsSubject.next(updated);
    this.cache.set(cacheKey, updated);
    return true;
  }

  async deleteCategory(category: string): Promise<boolean> {
    const name = sanitizePersonalCategoryName(category);
    if (!name) {
      return true;
    }

    const userEmail = this.userSessionService.getUserEmail();
    const tenantId = this.tenantContext.getActiveTenant()?.id ?? null;
    if (!userEmail || !tenantId) {
      return false;
    }

    const cacheKey = this.getCacheKey(tenantId);
    const currentMap = this.colorsSubject.value;
    if (!(name in currentMap)) {
      return true;
    }

    const updated = { ...currentMap };
    delete updated[name];
    this.colorsSubject.next(updated);
    this.cache.set(cacheKey, updated);
    return true;
  }

  invalidate(): void {
    this.colorsSubject.next({});
    if (this.activeCacheKey) {
      this.cache.invalidate(this.activeCacheKey);
      this.activeCacheKey = null;
    }
    this.cache.invalidateCategory('personalCategoryColors_');
  }

  private getCacheKey(tenantId: string): string {
    return `personalCategoryColors_${tenantId}`;
  }

  private formatSetColorError(err: unknown): string {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : '';

    if (
      message.includes('personal_categories') &&
      (message.includes('does not exist') || message.includes('Could not find'))
    ) {
      return 'Category colors need a database update. Apply the latest Supabase migration.';
    }

    if (message.includes('foreign key constraint')) {
      return 'Could not save category color for this organization.';
    }

    if (message.includes('row-level security') || message.includes('permission denied')) {
      return 'Permission denied saving category color. Try signing in again.';
    }

    return message ? `Failed to save category color: ${message}` : 'Failed to save category color';
  }
}
