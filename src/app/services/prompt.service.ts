import { Injectable, Optional } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';
import { CacheService } from './cache.service';
import { BadgeService } from './badge.service';
import { ConnectivityService } from './connectivity.service';
import { PrayedForSyncService, type PrayedForSyncedEvent } from './prayed-for-sync.service';
import { UserSessionService } from './user-session.service';
import { PrayerPrompt } from '../components/prompt-card/prompt-card.component';
import { TenantContextService } from './tenant-context.service';

@Injectable({
  providedIn: 'root'
})
export class PromptService {
  public promptsSubject = new BehaviorSubject<PrayerPrompt[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(true);
  private errorSubject = new BehaviorSubject<string | null>(null);
  /** Bumps on session email change so late count hydrates are ignored. */
  private countsHydrateGeneration = 0;
  private readonly promptServerPrayedFor = new Map<string, number>();

  public prompts$ = this.promptsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  getPromptsSnapshot(): PrayerPrompt[] {
    return this.promptsSubject.value;
  }

  isPromptsLoading(): boolean {
    return this.loadingSubject.value;
  }

  getActivePromptCategories(): string[] {
    const seen = new Set<string>();
    const categories: string[] = [];
    for (const prompt of this.promptsSubject.value) {
      if (!seen.has(prompt.type)) {
        seen.add(prompt.type);
        categories.push(prompt.type);
      }
    }
    return categories;
  }

  constructor(
    private supabase: SupabaseService,
    private toast: ToastService,
    private cache: CacheService,
    private badgeService: BadgeService,
    private connectivity: ConnectivityService,
    private userSessionService: UserSessionService,
    @Optional() private prayedForSync: PrayedForSyncService | null = null,
    private tenantContext?: TenantContextService
  ) {
    this.loadPrompts();
    this.userSessionService.userSession$
      .pipe(
        distinctUntilChanged((prev, curr) => prev?.email === curr?.email)
      )
      .subscribe((session) => {
        void this.onUserSessionEmailChange(session?.email ?? null);
      });
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
    this.attachPrayedForSyncListeners();
  }

  private attachPrayedForSyncListeners(): void {
    if (!this.prayedForSync) {
      return;
    }
    this.prayedForSync.pendingChanged$.subscribe(() => {
      this.reprojectPromptCounts();
    });
    this.prayedForSync.synced$.subscribe((event) => {
      this.onPrayedForSynced(event);
    });
  }

  private onPrayedForSynced(event: PrayedForSyncedEvent): void {
    if (event.kind !== 'prompt') {
      return;
    }
    const sessionEmail = this.userSessionService.getUserEmail()?.trim().toLowerCase();
    if (!sessionEmail) {
      return;
    }
    this.promptServerPrayedFor.set(event.itemId, event.serverCount);
    this.countsHydrateGeneration += 1;
    this.reprojectPromptCounts();
  }

  private seedPromptServerCounts(prompts: PrayerPrompt[]): void {
    for (const prompt of prompts) {
      this.promptServerPrayedFor.set(prompt.id, prompt.prayed_for_count ?? 0);
    }
  }

  private promptServerBaseline(promptId: string): number {
    const existing = this.promptServerPrayedFor.get(promptId);
    if (existing !== undefined) {
      return existing;
    }
    const displayed =
      this.promptsSubject.value.find((p) => p.id === promptId)
        ?.prayed_for_count ?? 0;
    const pending =
      this.prayedForSync?.getPendingCount(promptId, 'prompt') ?? 0;
    const server = displayed - pending;
    this.promptServerPrayedFor.set(promptId, server);
    return server;
  }

  private displayPromptPrayedForCount(promptId: string): number {
    const server = this.promptServerBaseline(promptId);
    return (
      this.prayedForSync?.displayCount(server, promptId, 'prompt') ?? server
    );
  }

  private withPromptDisplayCounts(prompts: PrayerPrompt[]): PrayerPrompt[] {
    return prompts.map((prompt) => ({
      ...prompt,
      prayed_for_count: this.displayPromptPrayedForCount(prompt.id),
    }));
  }

  private toPromptServerOnly(prompts: PrayerPrompt[]): PrayerPrompt[] {
    return prompts.map((prompt) => ({
      ...prompt,
      prayed_for_count:
        this.promptServerPrayedFor.get(prompt.id) ??
        prompt.prayed_for_count ??
        0,
    }));
  }

  private reprojectPromptCounts(): void {
    const updated = this.withPromptDisplayCounts(
      this.toPromptServerOnly(this.promptsSubject.value)
    );
    this.promptsSubject.next(updated);
  }

  private publishPrompts(serverPrompts: PrayerPrompt[]): void {
    this.seedPromptServerCounts(serverPrompts);
    this.promptsSubject.next(this.withPromptDisplayCounts(serverPrompts));
  }

  /**
   * Load prompts from database with caching, then attach the current user's Pray For counts.
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

      // Try to get from cache first (base prompts without user-specific counts)
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

        // Cache the results without user-specific counts
        this.cache.set(cacheKey, sortedPrompts);
      }

      await this.publishPromptsWithFreshCounts(sortedPrompts);
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
   * Attach counts and publish. Uses UserSession email (not lingering Supabase auth) so a late
   * load after logout cannot restore another user's private tallies. Retries once if generation
   * changes mid-flight.
   */
  private async publishPromptsWithFreshCounts(base: PrayerPrompt[]): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const generation = this.countsHydrateGeneration;
      const sessionEmail = this.userSessionService.getUserEmail();
      const withCounts = sessionEmail
        ? await this.attachPrayedForCounts(base, sessionEmail)
        : base.map((p) => ({ ...p, prayed_for_count: 0 }));
      if (generation === this.countsHydrateGeneration) {
        this.publishPrompts(withCounts);
        return;
      }
    }

    // Still racing with session changes — publish list structure without applying a stale tally.
    // Prefer existing in-memory counts for matching ids; otherwise 0.
    const prevById = new Map(
      this.promptsSubject.value.map((p) => [p.id, p.prayed_for_count ?? 0] as const)
    );
    this.promptsSubject.next(
      base.map((p) => ({
        ...p,
        prayed_for_count: prevById.get(p.id) ?? 0,
      }))
    );
  }

  /**
   * Attach Pray For counts for the given user email (default 0 when missing).
   * Uses UserSession email only (or an explicit override) — never a lingering Supabase
   * auth session after logout, matching publishPromptsWithFreshCounts.
   */
  async attachPrayedForCounts(
    prompts: PrayerPrompt[],
    emailOverride?: string | null
  ): Promise<PrayerPrompt[]> {
    if (!prompts.length) {
      return prompts;
    }

    const userEmail =
      emailOverride !== undefined
        ? emailOverride?.trim().toLowerCase() || null
        : this.userSessionService.getUserEmail()?.trim().toLowerCase() || null;

    if (!userEmail) {
      return prompts.map((p) => ({ ...p, prayed_for_count: 0 }));
    }

    const countsMap = await this.getPromptPrayedForCountsBatch(
      prompts.map((p) => p.id),
      userEmail
    );

    return prompts.map((p) => ({
      ...p,
      prayed_for_count: countsMap[p.id] ?? 0,
    }));
  }

  /**
   * Batch-load Pray For counts for the given prompt ids and user email via RPC
   * (works for JWT and MFA; never relies on open table SELECT for anon).
   */
  async getPromptPrayedForCountsBatch(
    promptIds: string[],
    userEmail: string
  ): Promise<Record<string, number>> {
    try {
      if (promptIds.length === 0) {
        return {};
      }

      const email = userEmail.trim().toLowerCase();
      if (!email) {
        return {};
      }

      const { data, error } = await this.supabase.client.rpc(
        'get_prompt_prayed_for_counts',
        {
          p_prompt_ids: promptIds,
          p_user_email: email,
        }
      );

      if (error) throw error;

      const countsMap: Record<string, number> = {};
      (data || []).forEach((row: { prompt_id: string; prayed_for_count: number }) => {
        countsMap[row.prompt_id] = row.prayed_for_count ?? 0;
      });
      return countsMap;
    } catch (error) {
      console.error('Error fetching prompt prayed-for counts:', error);
      return {};
    }
  }

  /**
   * Clear or re-hydrate per-user counts when the logged-in email changes (logout / switch).
   * Uses the session email argument so counts hydrate even when Supabase auth is not ready yet.
   */
  private async onUserSessionEmailChange(email: string | null): Promise<void> {
    const generation = ++this.countsHydrateGeneration;
    const current = this.promptsSubject.value;
    if (!current.length) {
      return;
    }

    const cleared = current.map((p) => ({ ...p, prayed_for_count: 0 }));
    this.promptsSubject.next(cleared);

    if (!email) {
      return;
    }

    const withCounts = await this.attachPrayedForCounts(cleared, email);
    if (generation !== this.countsHydrateGeneration) {
      return;
    }
    this.publishPrompts(withCounts);
  }

  /**
   * Queue a prompt Pray For increment (works offline).
   */
  async incrementPromptPrayedFor(promptId: string): Promise<number | null> {
    const userEmail =
      this.userSessionService.getUserEmail()?.trim().toLowerCase() || null;
    if (!userEmail) {
      return null;
    }
    this.promptServerBaseline(promptId);
    if (!this.prayedForSync?.enqueue('prompt', promptId)) {
      return null;
    }
    this.countsHydrateGeneration += 1;
    void this.prayedForSync.flush();
    return this.displayPromptPrayedForCount(promptId);
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
