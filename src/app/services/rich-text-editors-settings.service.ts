import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { distinctUntilChanged, map, takeUntil } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { TenantContextService } from './tenant-context.service';

const FLAG_CACHE_KEY_BASE = 'rich_text_editors_enabled';
const FLAG_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_ENABLED = true;

interface CachedFlag {
  value: boolean;
  timestamp: number;
}

/**
 * Reads `tenant_settings.rich_text_editors_enabled` for the active church.
 * Personal-only (no tenant) uses the default of enabled. Cached in memory +
 * localStorage with TTL; call `invalidateFlagCache()` after admin saves.
 */
@Injectable({
  providedIn: 'root',
})
export class RichTextEditorsSettingsService implements OnDestroy {
  private enabledSubject = new BehaviorSubject<boolean>(DEFAULT_ENABLED);
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private supabase: SupabaseService,
    private tenantContext: TenantContextService
  ) {
    this.seedFromLocalStorage();
    this.tenantContext.activeTenant$
      .pipe(
        map((t) => t?.id ?? null),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loaded = false;
        this.loadPromise = null;
        this.seedFromLocalStorage();
        this.ensureLoaded();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getRichTextEditorsEnabled$(): Observable<boolean> {
    this.ensureLoaded();
    return this.enabledSubject.asObservable();
  }

  /** Current value without waiting for network (default true until fetch completes). */
  getSnapshot(): boolean {
    return this.enabledSubject.value;
  }

  invalidateFlagCache(): void {
    this.loaded = false;
    this.loadPromise = null;
    try {
      localStorage.removeItem(this.flagCacheKey());
    } catch {}
    this.ensureLoaded();
  }

  private flagCacheKey(): string {
    const tid = this.tenantContext.getActiveTenant()?.id;
    return tid ? `${FLAG_CACHE_KEY_BASE}:${tid}` : FLAG_CACHE_KEY_BASE;
  }

  private seedFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(this.flagCacheKey());
      if (!raw) return;
      const parsed: CachedFlag = JSON.parse(raw);
      if (typeof parsed.value === 'boolean' && typeof parsed.timestamp === 'number') {
        if (Date.now() - parsed.timestamp < FLAG_CACHE_TTL_MS) {
          this.enabledSubject.next(parsed.value);
        }
      }
    } catch {}
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    if (this.loadPromise) return;
    this.loadPromise = this.fetchAndCacheFlag();
  }

  private async fetchAndCacheFlag(): Promise<void> {
    try {
      const tenantId = this.tenantContext.getActiveTenant()?.id;
      if (!tenantId) {
        this.enabledSubject.next(DEFAULT_ENABLED);
        this.loaded = true;
        return;
      }

      const { data, error } = await this.supabase.client
        .from('tenant_settings')
        .select('rich_text_editors_enabled')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        console.warn('[RichTextEditorsSettings] Failed to load flag', error);
        return;
      }

      const value = data?.rich_text_editors_enabled !== false;
      this.enabledSubject.next(value);
      this.loaded = true;

      try {
        localStorage.setItem(
          this.flagCacheKey(),
          JSON.stringify({ value, timestamp: Date.now() } satisfies CachedFlag)
        );
      } catch {}
    } catch (e) {
      console.warn('[RichTextEditorsSettings] Error loading flag', e);
    } finally {
      this.loadPromise = null;
    }
  }
}
