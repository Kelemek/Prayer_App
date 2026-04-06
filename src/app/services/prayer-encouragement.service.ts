import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, takeUntil } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { TenantContextService } from './tenant-context.service';

const DEFAULT_COOLDOWN_HOURS = 4;
const FLAG_CACHE_KEY_BASE = 'prayer_encouragement_enabled';
const FLAG_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CachedFlag {
  value: boolean;
  cooldownHours: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class PrayerEncouragementService implements OnDestroy {
  private enabledSubject = new BehaviorSubject<boolean>(false);
  private cooldownHoursSubject = new BehaviorSubject<number>(DEFAULT_COOLDOWN_HOURS);
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private supabase: SupabaseService,
    private tenantContext: TenantContextService
  ) {
    this.seedFromLocalStorage();
    this.cleanExpiredCooldownKeys();

    this.tenantContext.activeTenant$
      .pipe(
        map((t) => t?.id ?? null),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loaded = false;
        this.loadPromise = null;
        this.ensureLoaded();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private flagCacheKey(): string {
    const tid = this.tenantContext.getActiveTenant()?.id;
    return tid ? `${FLAG_CACHE_KEY_BASE}:${tid}` : FLAG_CACHE_KEY_BASE;
  }

  /** Cooldown duration in ms (from cached or default hours). */
  private getCooldownMs(): number {
    const hours = this.cooldownHoursSubject.value;
    return hours * 60 * 60 * 1000;
  }

  /**
   * Remove expired prayed_for_* keys from localStorage to avoid buildup.
   * Runs once on service init.
   */
  private cleanExpiredCooldownKeys(): void {
    try {
      const prefix = 'prayed_for_';
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(prefix)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const at = new Date(raw).getTime();
        if (isNaN(at) || (Date.now() - at) >= this.getCooldownMs()) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {}
  }

  /**
   * Observable of the feature flag. Sourced from cache/localStorage first, then one Supabase read per TTL.
   */
  getPrayerEncouragementEnabled$(): Observable<boolean> {
    this.ensureLoaded();
    return this.enabledSubject.asObservable();
  }

  /** Observable of cooldown hours (cached same as enabled flag). */
  getCooldownHours$(): Observable<number> {
    this.ensureLoaded();
    return this.cooldownHoursSubject.asObservable();
  }

  getCooldownKey(prayerId: string): string {
    return `prayed_for_${prayerId}`;
  }

  /**
   * True if the user can click Pray For (no cooldown or cooldown expired).
   * Removes the key from localStorage when cooldown has expired to avoid buildup.
   */
  canPrayFor(prayerId: string): boolean {
    try {
      const key = this.getCooldownKey(prayerId);
      const raw = localStorage.getItem(key);
      if (!raw) return true;
      const at = new Date(raw).getTime();
      if (isNaN(at)) {
        localStorage.removeItem(key);
        return true;
      }
      const expired = (Date.now() - at) >= this.getCooldownMs();
      if (expired) {
        localStorage.removeItem(key);
        return true;
      }
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Record that the user clicked Pray For (starts cooldown per configured hours).
   */
  recordPrayedFor(prayerId: string): void {
    try {
      localStorage.setItem(this.getCooldownKey(prayerId), new Date().toISOString());
    } catch (e) {
      console.warn('[PrayerEncouragement] Failed to set cooldown', e);
    }
  }

  /**
   * Remove all prayed_for_* cooldown keys from localStorage (e.g. on logout).
   */
  clearCooldownKeys(): void {
    try {
      const prefix = 'prayed_for_';
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) keysToRemove.push(key);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {}
  }

  /**
   * Invalidate cached flag (call after admin saves the toggle).
   */
  invalidateFlagCache(): void {
    this.loaded = false;
    this.loadPromise = null;
    try {
      localStorage.removeItem(this.flagCacheKey());
    } catch {}
    this.ensureLoaded();
  }

  private seedFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(this.flagCacheKey());
      if (!raw) return;
      const parsed: CachedFlag = JSON.parse(raw);
      if (typeof parsed.value === 'boolean' && typeof parsed.timestamp === 'number') {
        if (Date.now() - parsed.timestamp < FLAG_CACHE_TTL_MS) {
          this.enabledSubject.next(parsed.value);
          const hours = typeof parsed.cooldownHours === 'number' && parsed.cooldownHours >= 1 && parsed.cooldownHours <= 168
            ? parsed.cooldownHours
            : DEFAULT_COOLDOWN_HOURS;
          this.cooldownHoursSubject.next(hours);
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

      if (tenantId) {
        const { data, error } = await this.supabase.client
          .from('tenant_settings')
          .select('prayer_encouragement_enabled, prayer_encouragement_cooldown_hours')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (error) {
          console.warn('[PrayerEncouragement] Failed to load flag', error);
          return;
        }

        const value = !!data?.prayer_encouragement_enabled;
        const rawHours = data?.prayer_encouragement_cooldown_hours;
        const cooldownHours = typeof rawHours === 'number' && rawHours >= 1 && rawHours <= 168
          ? rawHours
          : DEFAULT_COOLDOWN_HOURS;

        this.enabledSubject.next(value);
        this.cooldownHoursSubject.next(cooldownHours);
        this.loaded = true;

        try {
          localStorage.setItem(this.flagCacheKey(), JSON.stringify({
            value,
            cooldownHours,
            timestamp: Date.now()
          } as CachedFlag));
        } catch {}
        return;
      }

      const { data, error } = await this.supabase.client
        .from('admin_settings')
        .select('prayer_encouragement_enabled, prayer_encouragement_cooldown_hours')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        console.warn('[PrayerEncouragement] Failed to load flag', error);
        return;
      }

      const value = !!data?.prayer_encouragement_enabled;
      const rawHours = data?.prayer_encouragement_cooldown_hours;
      const cooldownHours = typeof rawHours === 'number' && rawHours >= 1 && rawHours <= 168
        ? rawHours
        : DEFAULT_COOLDOWN_HOURS;

      this.enabledSubject.next(value);
      this.cooldownHoursSubject.next(cooldownHours);
      this.loaded = true;

      try {
        localStorage.setItem(this.flagCacheKey(), JSON.stringify({
          value,
          cooldownHours,
          timestamp: Date.now()
        } as CachedFlag));
      } catch {}
    } catch (e) {
      console.warn('[PrayerEncouragement] Error loading flag', e);
    } finally {
      this.loadPromise = null;
    }
  }
}
