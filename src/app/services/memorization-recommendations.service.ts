import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { CacheService } from './cache.service';
import { TenantContextService } from './tenant-context.service';
import { isTenantAdminRpcUnauthorized } from '../lib/supabase/tenant-admin-rpc';
import {
  type IbcdCatalogStatus,
  type MemorizationRecommendation,
  type MemorizationRecommendationCategory,
  type MemorizationRecommendationCategoryGroup,
  type MemorizationRecommendationCategoryRow,
  type MemorizationRecommendationRow,
} from '../types/memorization';

function cacheKeyForTenant(tenantId: string): string {
  return `memorizationRecommendations:${tenantId}`;
}

export type AddRecommendationOutcome =
  | { ok: true; item: MemorizationRecommendation }
  | {
      ok: false;
      reason:
        | 'empty_reference'
        | 'missing_category'
        | 'no_tenant'
        | 'duplicate'
        | 'db_error'
        | 'invalid_passage';
    };

export type AddCategoryOutcome =
  | { ok: true; category: MemorizationRecommendationCategory }
  | { ok: false; reason: 'empty_name' | 'duplicate' | 'no_tenant' | 'db_error' };

export type DeleteCategoryOutcome =
  | { ok: true }
  | { ok: false; reason: 'not_empty' | 'db_error' };

export type ApplyIbcdCatalogOutcome =
  | { ok: true; categoriesAdded: number; versesAdded: number }
  | { ok: false; reason: 'no_tenant' | 'not_admin' | 'db_error' };

export type RemoveIbcdCatalogOutcome =
  | { ok: true; removedCategories: number; removedVerses: number }
  | { ok: false; reason: 'no_tenant' | 'not_admin' | 'db_error' };

@Injectable({
  providedIn: 'root',
})
export class MemorizationRecommendationsService {
  private readonly itemsSubject = new BehaviorSubject<MemorizationRecommendation[]>([]);
  private readonly categoriesSubject = new BehaviorSubject<
    MemorizationRecommendationCategory[]
  >([]);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  /** Monotonic token so overlapping load() results cannot overwrite newer state. */
  private loadGeneration = 0;

  readonly items$ = this.itemsSubject.asObservable();
  readonly categories$ = this.categoriesSubject.asObservable();
  readonly loading$ = this.loadingSubject.asObservable();
  readonly hasRecommendations$ = this.items$.pipe(map((items) => items.length > 0));
  readonly grouped$ = combineLatest([this.categories$, this.items$]).pipe(
    map(([categories, items]) => groupByCategory(categories, items))
  );

  constructor(
    private supabase: SupabaseService,
    private cache: CacheService,
    private tenantContext: TenantContextService
  ) {
    let previousTenantId = this.tenantContext.getActiveTenant()?.id ?? null;
    this.tenantContext.activeTenant$.subscribe((tenant) => {
      const nextTenantId = tenant?.id ?? null;
      if (nextTenantId === previousTenantId) {
        return;
      }
      previousTenantId = nextTenantId;
      this.itemsSubject.next([]);
      this.categoriesSubject.next([]);
      if (nextTenantId) {
        void this.load();
      }
    });
    void this.load();
  }

  get snapshot(): MemorizationRecommendation[] {
    return this.itemsSubject.value;
  }

  get categoriesSnapshot(): MemorizationRecommendationCategory[] {
    return this.categoriesSubject.value;
  }

  get groupedSnapshot(): MemorizationRecommendationCategoryGroup[] {
    return groupByCategory(this.categoriesSubject.value, this.itemsSubject.value);
  }

  private getActiveTenantId(): string | null {
    return this.tenantContext.getActiveTenant()?.id ?? null;
  }

  invalidateCache(): void {
    const tenantId = this.getActiveTenantId();
    if (tenantId) {
      this.cache.invalidate(cacheKeyForTenant(tenantId));
    }
  }

  async load(force = false): Promise<MemorizationRecommendationCategoryGroup[]> {
    const tenantId = this.getActiveTenantId();
    if (!tenantId) {
      this.categoriesSubject.next([]);
      this.itemsSubject.next([]);
      return [];
    }

    const cacheKey = cacheKeyForTenant(tenantId);
    if (!force) {
      const cached = this.cache.get<{
        categories: MemorizationRecommendationCategory[];
        items: MemorizationRecommendation[];
      }>(cacheKey);
      if (cached) {
        this.categoriesSubject.next(cached.categories);
        this.itemsSubject.next(cached.items);
        return groupByCategory(cached.categories, cached.items);
      }
    }

    const generation = ++this.loadGeneration;
    this.loadingSubject.next(true);

    try {
      const [categoriesRes, itemsRes] = await Promise.all([
        this.supabase.client
          .from('memorization_recommendation_categories')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('display_order', { ascending: true }),
        this.supabase.client
          .from('memorization_recommendations')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('display_order', { ascending: true }),
      ]);

      if (generation !== this.loadGeneration) {
        return this.groupedSnapshot;
      }

      if (categoriesRes.error) throw categoriesRes.error;
      if (itemsRes.error) throw itemsRes.error;

      const categories =
        (categoriesRes.data as MemorizationRecommendationCategoryRow[] | null)?.map(
          mapCategoryRow
        ) ?? [];
      const items =
        (itemsRes.data as MemorizationRecommendationRow[] | null)?.map(mapItemRow) ??
        [];

      this.invalidateCache();
      this.cache.set(cacheKey, { categories, items }, 60 * 60 * 1000);
      this.categoriesSubject.next(categories);
      this.itemsSubject.next(items);
      return groupByCategory(categories, items);
    } catch (err) {
      console.error('Failed to load memorization recommendations:', err);
      return this.groupedSnapshot;
    } finally {
      if (generation === this.loadGeneration) {
        this.loadingSubject.next(false);
      }
    }
  }

  async addCategory(name: string): Promise<AddCategoryOutcome> {
    const normalized = name.trim();
    if (!normalized) return { ok: false, reason: 'empty_name' };
    const tenantId = this.getActiveTenantId();
    if (!tenantId) return { ok: false, reason: 'no_tenant' };

    const nextOrder =
      this.categoriesSubject.value.reduce(
        (max, c) => Math.max(max, c.displayOrder),
        -1
      ) + 1;

    const { data, error } = await this.supabase.client
      .from('memorization_recommendation_categories')
      .insert({
        tenant_id: tenantId,
        name: normalized,
        display_order: nextOrder,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') return { ok: false, reason: 'duplicate' };
      console.error('Failed to add recommendation category:', error);
      return { ok: false, reason: 'db_error' };
    }

    const category = mapCategoryRow(data as MemorizationRecommendationCategoryRow);
    this.categoriesSubject.next(
      [...this.categoriesSubject.value, category].sort(
        (a, b) => a.displayOrder - b.displayOrder
      )
    );
    this.commitLocalSnapshot();
    await this.load(true);
    return { ok: true, category };
  }

  async renameCategory(id: string, name: string): Promise<AddCategoryOutcome> {
    const normalized = name.trim();
    if (!normalized) return { ok: false, reason: 'empty_name' };
    const tenantId = this.getActiveTenantId();
    if (!tenantId) return { ok: false, reason: 'no_tenant' };

    const { data, error } = await this.supabase.client
      .from('memorization_recommendation_categories')
      .update({ name: normalized })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') return { ok: false, reason: 'duplicate' };
      console.error('Failed to rename recommendation category:', error);
      return { ok: false, reason: 'db_error' };
    }

    const category = mapCategoryRow(data as MemorizationRecommendationCategoryRow);
    this.categoriesSubject.next(
      this.categoriesSubject.value.map((c) => (c.id === id ? category : c))
    );
    this.commitLocalSnapshot();
    await this.load(true);
    return { ok: true, category };
  }

  async deleteCategory(id: string): Promise<DeleteCategoryOutcome> {
    const hasVerses = this.itemsSubject.value.some((i) => i.categoryId === id);
    if (hasVerses) return { ok: false, reason: 'not_empty' };
    const tenantId = this.getActiveTenantId();
    if (!tenantId) return { ok: false, reason: 'db_error' };

    const { error } = await this.supabase.client
      .from('memorization_recommendation_categories')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      if (error.code === '23503') return { ok: false, reason: 'not_empty' };
      console.error('Failed to delete recommendation category:', error);
      return { ok: false, reason: 'db_error' };
    }

    this.categoriesSubject.next(
      this.categoriesSubject.value.filter((c) => c.id !== id)
    );
    this.commitLocalSnapshot();
    await this.load(true);
    return { ok: true };
  }

  async reorderCategories(idsInOrder: string[]): Promise<boolean> {
    if (idsInOrder.length === 0) return true;
    try {
      const { error } = await this.supabase.client.rpc(
        'reorder_memorization_recommendation_categories',
        { p_ordered_ids: idsInOrder }
      );
      if (error) throw error;

      this.applyCategoryOrderLocally(idsInOrder);
      this.commitLocalSnapshot();
      await this.load(true);
      return true;
    } catch (err) {
      console.error('Failed to reorder recommendation categories:', err);
      return false;
    }
  }

  async addRecommendation(
    reference: string,
    categoryId: string
  ): Promise<AddRecommendationOutcome> {
    const normalizedRef = reference.trim();
    if (!normalizedRef) return { ok: false, reason: 'empty_reference' };
    if (!categoryId.trim()) return { ok: false, reason: 'missing_category' };
    const tenantId = this.getActiveTenantId();
    if (!tenantId) return { ok: false, reason: 'no_tenant' };

    const nextOrder =
      this.itemsSubject.value
        .filter((i) => i.categoryId === categoryId)
        .reduce((max, item) => Math.max(max, item.displayOrder), -1) + 1;

    const { data, error } = await this.supabase.client
      .from('memorization_recommendations')
      .insert({
        tenant_id: tenantId,
        reference: normalizedRef,
        category_id: categoryId,
        display_order: nextOrder,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') return { ok: false, reason: 'duplicate' };
      console.error('Failed to add memorization recommendation:', error);
      return { ok: false, reason: 'db_error' };
    }

    const item = mapItemRow(data as MemorizationRecommendationRow);
    this.itemsSubject.next([...this.itemsSubject.value, item]);
    this.commitLocalSnapshot();
    await this.load(true);
    return { ok: true, item };
  }

  async removeRecommendation(id: string): Promise<boolean> {
    const tenantId = this.getActiveTenantId();
    if (!tenantId) return false;

    const { error } = await this.supabase.client
      .from('memorization_recommendations')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Failed to remove memorization recommendation:', error);
      return false;
    }

    this.itemsSubject.next(this.itemsSubject.value.filter((i) => i.id !== id));
    this.commitLocalSnapshot();
    await this.load(true);
    return true;
  }

  async reorder(idsInOrder: string[]): Promise<boolean> {
    const categoryIdById = new Map(
      this.itemsSubject.value.map((item) => [item.id, item.categoryId])
    );
    const placements: { id: string; categoryId: string; displayOrder: number }[] =
      [];
    for (let displayOrder = 0; displayOrder < idsInOrder.length; displayOrder++) {
      const id = idsInOrder[displayOrder];
      const categoryId = categoryIdById.get(id);
      if (!categoryId) {
        console.error('Failed to reorder: unknown recommendation id', id);
        return false;
      }
      placements.push({ id, categoryId, displayOrder });
    }
    return this.persistVersePlacements(placements);
  }

  /**
   * Persist category membership and display_order for the given verses
   * (same-category reorder or move between categories) in one DB transaction.
   */
  async persistVersePlacements(
    placements: { id: string; categoryId: string; displayOrder: number }[]
  ): Promise<boolean> {
    if (placements.length === 0) return true;
    try {
      const { error } = await this.supabase.client.rpc(
        'apply_memorization_recommendation_placements',
        {
          p_placements: placements.map((p) => ({
            id: p.id,
            category_id: p.categoryId,
            display_order: p.displayOrder,
          })),
        }
      );
      if (error) throw error;

      this.applyPlacementsLocally(placements);
      this.commitLocalSnapshot();
      await this.load(true);
      return true;
    } catch (err) {
      console.error('Failed to update memorization recommendation placement:', err);
      return false;
    }
  }

  async getIbcdCatalogStatus(): Promise<IbcdCatalogStatus | null> {
    const tenantId = this.getActiveTenantId();
    if (!tenantId) return null;

    try {
      const { data, error } = await this.supabase.client.rpc(
        'get_memorization_ibcd_catalog_status',
        { p_tenant_id: tenantId }
      );
      if (error) throw error;
      return mapIbcdCatalogStatus(data);
    } catch (err) {
      console.error('Failed to load IBCD catalog status:', err);
      return null;
    }
  }

  async applyIbcdCatalog(): Promise<ApplyIbcdCatalogOutcome> {
    const tenantId = this.getActiveTenantId();
    if (!tenantId) return { ok: false, reason: 'no_tenant' };

    try {
      const { data, error } = await this.supabase.client.rpc(
        'apply_ibcd_memorization_recommendations',
        { p_tenant_id: tenantId }
      );
      if (error) {
        if (isTenantAdminRpcUnauthorized(error)) {
          return { ok: false, reason: 'not_admin' };
        }
        throw error;
      }

      this.invalidateCache();
      await this.load(true);
      const payload = data as Record<string, unknown> | null;
      return {
        ok: true,
        categoriesAdded: Number(payload?.['categories_added'] ?? 0),
        versesAdded: Number(payload?.['verses_added'] ?? 0),
      };
    } catch (err) {
      console.error('Failed to apply IBCD catalog:', err);
      return { ok: false, reason: 'db_error' };
    }
  }

  async removeIbcdCatalog(): Promise<RemoveIbcdCatalogOutcome> {
    const tenantId = this.getActiveTenantId();
    if (!tenantId) return { ok: false, reason: 'no_tenant' };

    try {
      const { data, error } = await this.supabase.client.rpc(
        'remove_ibcd_memorization_recommendations',
        { p_tenant_id: tenantId }
      );
      if (error) {
        if (isTenantAdminRpcUnauthorized(error)) {
          return { ok: false, reason: 'not_admin' };
        }
        throw error;
      }

      this.invalidateCache();
      await this.load(true);
      const payload = data as Record<string, unknown> | null;
      return {
        ok: true,
        removedCategories: Number(payload?.['removed_categories'] ?? 0),
        removedVerses: Number(payload?.['removed_verses'] ?? 0),
      };
    } catch (err) {
      console.error('Failed to remove IBCD catalog:', err);
      return { ok: false, reason: 'db_error' };
    }
  }

  private commitLocalSnapshot(): void {
    const tenantId = this.getActiveTenantId();
    if (!tenantId) return;
    this.cache.set(
      cacheKeyForTenant(tenantId),
      {
        categories: this.categoriesSubject.value,
        items: this.itemsSubject.value,
      },
      60 * 60 * 1000
    );
  }

  private applyPlacementsLocally(
    placements: { id: string; categoryId: string; displayOrder: number }[]
  ): void {
    const byId = new Map(placements.map((p) => [p.id, p]));
    this.itemsSubject.next(
      this.itemsSubject.value.map((item) => {
        const placement = byId.get(item.id);
        if (!placement) return item;
        return {
          ...item,
          categoryId: placement.categoryId,
          displayOrder: placement.displayOrder,
        };
      })
    );
  }

  private applyCategoryOrderLocally(idsInOrder: string[]): void {
    const orderById = new Map(idsInOrder.map((id, index) => [id, index]));
    this.categoriesSubject.next(
      [...this.categoriesSubject.value]
        .map((category) => ({
          ...category,
          displayOrder: orderById.get(category.id) ?? category.displayOrder,
        }))
        .sort((a, b) => a.displayOrder - b.displayOrder)
    );
  }
}

function mapCategoryRow(
  row: MemorizationRecommendationCategoryRow
): MemorizationRecommendationCategory {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItemRow(row: MemorizationRecommendationRow): MemorizationRecommendation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    reference: row.reference,
    categoryId: row.category_id,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function groupByCategory(
  categories: MemorizationRecommendationCategory[],
  items: MemorizationRecommendation[]
): MemorizationRecommendationCategoryGroup[] {
  return categories.map((category) => ({
    category: { ...category },
    items: items
      .filter((i) => i.categoryId === category.id)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((i) => ({ ...i })),
  }));
}

function mapIbcdCatalogStatus(data: unknown): IbcdCatalogStatus {
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    applied: Boolean(row['applied']),
    ibcdCategoryCount: Number(row['ibcd_category_count'] ?? 0),
    ibcdVerseCount: Number(row['ibcd_verse_count'] ?? 0),
  };
}

export type { IbcdCatalogStatus } from '../types/memorization';
