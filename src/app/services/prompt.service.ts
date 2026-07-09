import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';
import { CacheService } from './cache.service';
import { BadgeService } from './badge.service';
import { ConnectivityService } from './connectivity.service';
import { PrayerPrompt } from '../components/prompt-card/prompt-card.component';
import { TenantContextService } from './tenant-context.service';

@Injectable({
  providedIn: 'root'
})
export class PromptService {
  public promptsSubject = new BehaviorSubject<PrayerPrompt[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(true);
  private errorSubject = new BehaviorSubject<string | null>(null);

  public prompts$ = this.promptsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  constructor(
    private supabase: SupabaseService,
    private toast: ToastService,
    private cache: CacheService,
    private badgeService: BadgeService,
    private connectivity: ConnectivityService,
    private tenantContext?: TenantContextService
  ) {
    this.loadPrompts();
    if (this.tenantContext?.activeTenant$) {
      let previousTenantId = this.tenantContext.getActiveTenant()?.id || null;
      this.tenantContext.activeTenant$.subscribe((tenant) => {
        const nextTenantId = tenant?.id || null;
        if (nextTenantId === previousTenantId) {
          return;
        }
        previousTenantId = nextTenantId;
        this.loadPrompts();
      });
    }
  }

  /**
   * Load prompts from database with caching
   */
  async loadPrompts(): Promise<void> {
    try {
      this.loadingSubject.next(true);
      this.errorSubject.next(null);
      const tenantId = this.tenantContext?.getActiveTenant()?.id;

      if (this.tenantContext && !tenantId) {
        this.promptsSubject.next([]);
        return;
      }

      // Try to get from cache first
      const cacheKey = tenantId ? `prompts:${tenantId}` : 'prompts';
      let sortedPrompts =
        this.cache.get<PrayerPrompt[]>(cacheKey) ||
        (!this.connectivity.isOnline()
          ? this.cache.getStale<PrayerPrompt[]>(cacheKey)
          : null);

      if (!sortedPrompts && !this.connectivity.isOnline()) {
        console.log('[PromptService] Offline with no cached prompts');
        this.promptsSubject.next([]);
        this.errorSubject.next(null);
        return;
      }

      if (!sortedPrompts) {
        // Fetch prayer types for ordering
        let typesQuery = this.supabase.client
          .from('prayer_types')
          .select('name, display_order')
          .eq('is_active', true)
          .order('display_order', { ascending: true });
        if (tenantId) {
          typesQuery = typesQuery.eq('tenant_id', tenantId);
        }
        const { data: typesData, error: typesError } = await typesQuery;

        if (typesError) throw typesError;

        // Create a set of active type names for filtering
        const activeTypeNames = new Set((typesData || []).map((t: any) => t.name));

        // Create a map of type name to display_order
        const typeOrderMap = new Map(typesData?.map((t: any) => [t.name, t.display_order]) || []);

        // Fetch all prompts
        let promptsQuery = this.supabase.client
          .from('prayer_prompts')
          .select('*')
          .order('created_at', { ascending: false });
        if (tenantId) {
          promptsQuery = promptsQuery.eq('tenant_id', tenantId);
        }
        const { data, error } = await promptsQuery;

        if (error) throw error;

        // Filter to only include prompts with active types, then sort by type's display_order
        sortedPrompts = (data || [])
          .filter((p: any) => activeTypeNames.has(p.type))
          .sort((a: any, b: any) => {
            const orderA = typeOrderMap.get(a.type) ?? 999;
            const orderB = typeOrderMap.get(b.type) ?? 999;
            return orderA - orderB;
          });

        // Cache the results
        this.cache.set(cacheKey, sortedPrompts);
      }

      this.promptsSubject.next(sortedPrompts);
    } catch (err) {
      const cacheKey = this.tenantContext?.getActiveTenant()?.id
        ? `prompts:${this.tenantContext.getActiveTenant()!.id}`
        : 'prompts';
      const stale = this.cache.getStale<PrayerPrompt[]>(cacheKey);
      if (stale) {
        console.log('[PromptService] Showing stale cached prompts after error');
        this.promptsSubject.next(stale);
        this.errorSubject.next(null);
      } else if (this.supabase.isNetworkError(err) || !this.connectivity.isOnline()) {
        this.promptsSubject.next([]);
        this.errorSubject.next(null);
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load prompts';
        console.error('Failed to load prompts:', err);
        this.errorSubject.next(errorMessage);
        this.toast.error('Failed to load prompts');
      }
    } finally {
      this.loadingSubject.next(false);
      
      // Refresh badge counts to ensure badges show up for new prompts
      this.badgeService.refreshBadgeCounts();
    }
  }

  /**
   * Add a new prompt
   */
  async addPrompt(prompt: Omit<PrayerPrompt, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
    if (!this.connectivity.requireOnline('add a prompt')) {
      return false;
    }
    try {
      const { error } = await this.supabase.client
        .from('prayer_prompts')
        .insert({
          title: prompt.title,
          type: prompt.type,
          description: prompt.description,
          ...(this.tenantContext?.getActiveTenant()?.id ? { tenant_id: this.tenantContext.getActiveTenant()?.id } : {})
        });

      if (error) throw error;

      this.toast.success('Prompt added successfully');
      await this.loadPrompts();
      return true;
    } catch (error) {
      console.error('Error adding prompt:', error);
      this.toast.error('Failed to add prompt');
      return false;
    }
  }

  /**
   * Update a prompt
   */
  async updatePrompt(id: string, updates: Partial<PrayerPrompt>): Promise<boolean> {
    if (!this.connectivity.requireOnline('update a prompt')) {
      return false;
    }
    try {
      const tenantId = this.tenantContext?.getActiveTenant()?.id;
      let query = this.supabase.client
        .from('prayer_prompts')
        .update(updates)
        .eq('id', id);
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { error } = await query;

      if (error) throw error;

      this.toast.success('Prompt updated successfully');
      await this.loadPrompts();
      return true;
    } catch (error) {
      console.error('Error updating prompt:', error);
      this.toast.error('Failed to update prompt');
      return false;
    }
  }

  /**
   * Delete a prompt
   */
  async deletePrompt(id: string): Promise<boolean> {
    if (!this.connectivity.requireOnline('delete a prompt')) {
      return false;
    }
    try {
      const tenantId = this.tenantContext?.getActiveTenant()?.id;
      let query = this.supabase.client
        .from('prayer_prompts')
        .delete()
        .eq('id', id);
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { error } = await query;

      if (error) throw error;

      this.toast.success('Prompt deleted successfully');
      await this.loadPrompts();
      return true;
    } catch (error) {
      console.error('Error deleting prompt:', error);
      this.toast.error('Failed to delete prompt');
      return false;
    }
  }

  /**
   * Filter prompts by type
   */
  filterByType(type: string | null): PrayerPrompt[] {
    const allPrompts = this.promptsSubject.value;
    if (!type) return allPrompts;
    return allPrompts.filter(p => p.type === type);
  }
}
