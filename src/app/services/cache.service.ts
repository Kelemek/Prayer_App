import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { tap, shareReplay, catchError } from 'rxjs/operators';

/**
 * User-scoped CacheService keys cleared on logout and rehydrated at startup.
 * Configured aliases (`prayers` → `prayers_cache`, etc.) are cleared with these.
 *
 * - `tenant_` — `tenant_${id}_prayers`
 * - `personalTenant_` — personal prayers, including unaffiliated
 * - `personalCategoryColors_` — per-tenant personal category colors
 * - `prompts:` — `prompts:${tenantId}`
 * - `groupPrayers:` — `groupPrayers:${groupId}`
 * - `memorizationRecommendations:` — `memorizationRecommendations:${tenantId}`
 * - `memberPrayedForCounts` — member pray-for counts
 * - `memberPrayerUpdates` — member prayer update counts
 */
export const USER_SCOPED_CACHE_PREFIXES = [
  'tenant_',
  'personalTenant_',
  'personalCategoryColors_',
  'prompts:',
  'groupPrayers:',
  'memorizationRecommendations:',
  'memberPrayedForCounts',
  'memberPrayerUpdates',
] as const;

/**
 * Cache configuration for different data types
 */
export interface CacheConfig {
  key: string;
  ttl: number; // Time to live in milliseconds
}

/**
 * Cached data structure
 */
interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * CacheService provides in-memory and localStorage caching with TTL support.
 * 
 * Features:
 * - In-memory cache for fast access
 * - LocalStorage for persistent cache
 * - TTL (Time-To-Live) for automatic cache invalidation
 * - Observable caching with RxJS shareReplay
 * - Cache invalidation on mutations
 * 
 * Default TTL values (Tier 1 optimizations):
 * - Prayers: 20 minutes (cache-first to reduce DB hits)
 * - Personal Prayers: 20 minutes (only change when user adds)
 * - Prompts: 1 hour (rarely change)
 * - Prayer Types: 1 hour (rarely change)
 * - Admin Settings: 1 hour (rarely change)
 * - Email Settings: 1 hour (rarely change)
 * - Analytics: 15 minutes (safe to cache for longer)
 */
@Injectable({
  providedIn: 'root'
})
export class CacheService {
  private inMemoryCache = new Map<string, CachedData<any>>();
  private observableCache = new Map<string, Observable<any>>();
  private localStorageEnabled = this.isLocalStorageAvailable();

  // Default cache configurations (in milliseconds)
  // Tier 1: Cache-first approach with extended TTLs to reduce database queries
  private cacheConfigs: Map<string, CacheConfig> = new Map([
    ['prayers', { key: 'prayers_cache', ttl: 20 * 60 * 1000 }],        // 20 min (was 5)
    ['updates', { key: 'updates_cache', ttl: 20 * 60 * 1000 }],        // 20 min (was 5)
    ['personalPrayers', { key: 'personalPrayers_cache', ttl: 20 * 60 * 1000 }],  // 20 min (was 5)
    ['prompts', { key: 'prompts_cache', ttl: 60 * 60 * 1000 }],        // 1 hour (was 10 min)
    ['prayerTypes', { key: 'prayerTypes_cache', ttl: 60 * 60 * 1000 }],  // 1 hour (was 10 min)
    ['adminSettings', { key: 'adminSettings_cache', ttl: 60 * 60 * 1000 }],  // 1 hour (was 15 min)
    ['emailSettings', { key: 'emailSettings_cache', ttl: 60 * 60 * 1000 }],  // 1 hour (was 15 min)
    ['analytics', { key: 'analytics_cache', ttl: 15 * 60 * 1000 }]     // 15 min (was 5)
  ]);

  constructor() {
    this.initializeFromLocalStorage();
  }

  /**
   * Initialize in-memory cache from localStorage (config keys + tenant-scoped keys).
   */
  private initializeFromLocalStorage(): void {
    if (!this.localStorageEnabled) return;

    try {
      for (const [, config] of this.cacheConfigs) {
        this.hydrateKeyFromLocalStorage(config.key);
      }

      // Dynamic user-scoped keys (same prefixes logout wipes).
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (this.isUserScopedCacheKey(key)) {
          this.hydrateKeyFromLocalStorage(key);
        }
      }
    } catch (error) {
      console.warn('Failed to initialize cache from localStorage:', error);
    }
  }

  private hydrateKeyFromLocalStorage(storageKey: string): void {
    if (!this.localStorageEnabled || this.inMemoryCache.has(storageKey)) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CachedData<any>;
      if (parsed && typeof parsed.timestamp === 'number' && 'data' in parsed) {
        this.inMemoryCache.set(storageKey, parsed);
      }
    } catch {
      // Ignore corrupt entries
    }
  }

  private resolveStorageKey(key: string): string {
    const configKey = key.split('_')[0];
    const config = this.cacheConfigs.get(configKey);
    return config?.key || key;
  }

  private readEntry(storageKey: string): CachedData<any> | null {
    let cached = this.inMemoryCache.get(storageKey) || null;
    if (!cached) {
      this.hydrateKeyFromLocalStorage(storageKey);
      cached = this.inMemoryCache.get(storageKey) || null;
    }
    return cached;
  }

  /**
   * Get cached data by key (respects TTL — expired entries are removed).
   */
  get<T>(key: string): T | null {
    const storageKey = this.resolveStorageKey(key);
    const cached = this.readEntry(storageKey);

    if (!cached) {
      return null;
    }

    // Check if cache has expired — drop from memory only; keep localStorage for getStale/offline
    if (this.isExpired(cached)) {
      this.inMemoryCache.delete(storageKey);
      return null;
    }

    return cached.data as T;
  }

  /**
   * Get cached data even if TTL has expired (for offline read fallback).
   * Does not delete expired entries.
   */
  getStale<T>(key: string): T | null {
    const storageKey = this.resolveStorageKey(key);
    const cached = this.readEntry(storageKey);
    if (!cached) {
      return null;
    }
    return cached.data as T;
  }

  /**
   * Whether any cached payload exists for the key (fresh or stale).
   */
  hasData(key: string): boolean {
    return this.getStale(key) !== null;
  }

  /**
   * Set cached data with TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const configKey = key.split('_')[0];
    const config = this.cacheConfigs.get(configKey);
    const storageKey = this.resolveStorageKey(key);
    const finalTtl = ttl || config?.ttl || 5 * 60 * 1000;

    const cached: CachedData<T> = {
      data,
      timestamp: Date.now(),
      ttl: finalTtl
    };

    this.inMemoryCache.set(storageKey, cached);

    // Persist to localStorage if available
    if (this.localStorageEnabled) {
      try {
        console.log('[CacheService] Setting cache for', storageKey, 'with', Array.isArray(data) ? data.length + ' items' : 'data');
        localStorage.setItem(storageKey, JSON.stringify(cached));
      } catch (error) {
        console.warn('Failed to persist cache to localStorage:', error);
      }
    }
  }

  /**
   * Cache an Observable and return cached value on subsequent calls
   */
  cacheObservable<T>(
    key: string,
    source$: Observable<T>,
    ttl?: number
  ): Observable<T> {
    // Return cached observable if available and not expired
    const cached = this.observableCache.get(key);
    if (cached) {
      const data = this.get<T>(key);
      if (data !== null) {
        return of(data);
      }
    }

    // Cache the observable with shareReplay for multiple subscribers
    const cached$ = source$.pipe(
      tap(data => this.set(key, data, ttl)),
      shareReplay(1)
    );

    this.observableCache.set(key, cached$);
    return cached$;
  }

  /**
   * Invalidate cache for a specific key.
   * Uses the same storage key as get/set (`prayers` → `prayers_cache`).
   */
  invalidate(key: string): void {
    const storageKey = this.resolveStorageKey(key);
    const keys = storageKey === key ? [key] : [key, storageKey];
    for (const cacheKey of keys) {
      this.inMemoryCache.delete(cacheKey);
      this.observableCache.delete(cacheKey);
      if (this.localStorageEnabled) {
        try {
          localStorage.removeItem(cacheKey);
        } catch (error) {
          console.warn('Failed to remove cache from localStorage:', error);
        }
      }
    }
  }

  /**
   * Invalidate all caches
   */
  invalidateAll(): void {
    if (this.localStorageEnabled) {
      try {
        for (const key of this.inMemoryCache.keys()) {
          localStorage.removeItem(key);
        }
        for (const [, config] of this.cacheConfigs) {
          localStorage.removeItem(config.key);
        }
      } catch (error) {
        console.warn('Failed to clear localStorage cache:', error);
      }
    }

    this.inMemoryCache.clear();
    this.observableCache.clear();
  }

  /**
   * Invalidate cache by category.
   * Matches the category prefix and the resolved storage key (`prayers` → `prayers_cache`),
   * including entries that exist only in localStorage.
   */
  invalidateCategory(category: string): void {
    const resolved = this.resolveStorageKey(category);
    const matches = (key: string): boolean =>
      key.startsWith(category) ||
      key === resolved ||
      (resolved !== category && key.startsWith(resolved));

    const keysToInvalidate = new Set<string>();
    this.inMemoryCache.forEach((_, key) => {
      if (matches(key)) {
        keysToInvalidate.add(key);
      }
    });

    if (this.localStorageEnabled) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && matches(key)) {
            keysToInvalidate.add(key);
          }
        }
      } catch (error) {
        console.warn('Failed to scan localStorage for cache invalidation:', error);
      }
    }

    keysToInvalidate.forEach(key => this.invalidate(key));
    this.invalidate(category);
  }

  /**
   * Drop every user-scoped cache entry from memory and localStorage.
   * Logout and signed-out auth state both call this so the next startup
   * cannot rehydrate another user's tenant or prayer caches.
   */
  clearUserScopedCaches(): void {
    for (const key of [...this.inMemoryCache.keys()]) {
      if (this.isUserScopedCacheKey(key)) {
        this.inMemoryCache.delete(key);
      }
    }
    for (const key of [...this.observableCache.keys()]) {
      if (this.isUserScopedCacheKey(key) || this.isUserScopedCacheKey(this.resolveStorageKey(key))) {
        this.observableCache.delete(key);
      }
    }

    if (!this.localStorageEnabled) {
      return;
    }

    try {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && this.isUserScopedCacheKey(key)) {
          toRemove.push(key);
        }
      }
      for (const key of toRemove) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('Failed to clear user-scoped cache from localStorage:', error);
    }
  }

  private isUserScopedCacheKey(key: string): boolean {
    if (this.cacheConfigs.has(key)) {
      return true;
    }
    for (const config of this.cacheConfigs.values()) {
      if (key === config.key) {
        return true;
      }
    }
    return USER_SCOPED_CACHE_PREFIXES.some(
      (prefix) => key === prefix || key.startsWith(prefix)
    );
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): {
    inMemoryCount: number;
    localStorageCount: number;
    details: Array<{ key: string; size: string; expired: boolean }>;
  } {
    const details: Array<{ key: string; size: string; expired: boolean }> = [];

    this.inMemoryCache.forEach((cached, key) => {
      const size = JSON.stringify(cached.data).length;
      const sizeStr = this.formatBytes(size);
      details.push({
        key,
        size: sizeStr,
        expired: this.isExpired(cached)
      });
    });

    return {
      inMemoryCount: this.inMemoryCache.size,
      localStorageCount: this.localStorageEnabled ? localStorage.length : 0,
      details
    };
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(cached: CachedData<any>): boolean {
    return Date.now() - cached.timestamp > cached.ttl;
  }

  /**
   * Check if localStorage is available
   */
  private isLocalStorageAvailable(): boolean {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format bytes to human-readable size
   */
  private formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}
