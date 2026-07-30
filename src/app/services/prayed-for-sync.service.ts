import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { distinctUntilChanged, filter, pairwise, takeUntil } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { ConnectivityService } from './connectivity.service';
import { UserSessionService } from './user-session.service';
import { TenantContextService } from './tenant-context.service';

export type PrayedForItemKind = 'community_prayer' | 'personal_prayer' | 'prompt';

export interface PrayedForSyncedEvent {
  kind: PrayedForItemKind;
  itemId: string;
  serverCount: number;
}

interface PendingPrayedForEntry {
  id: string;
  itemId: string;
  kind: PrayedForItemKind;
  createdAt: string;
  attempts: number;
}

const QUEUE_KEY_PREFIX = 'prayed_for_pending:v2';
const MAX_FLUSH_ATTEMPTS = 5;

@Injectable({
  providedIn: 'root',
})
export class PrayedForSyncService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly pendingChangedSubject = new Subject<void>();
  private readonly syncedSubject = new Subject<PrayedForSyncedEvent>();

  readonly pendingChanged$: Observable<void> =
    this.pendingChangedSubject.asObservable();
  readonly synced$: Observable<PrayedForSyncedEvent> =
    this.syncedSubject.asObservable();

  private syncInFlight: Promise<void> | null = null;
  private queue: PendingPrayedForEntry[] = [];
  private loadedStorageKey: string | null = null;

  constructor(
    private supabase: SupabaseService,
    private connectivity: ConnectivityService,
    private userSession: UserSessionService,
    private tenantContext: TenantContextService
  ) {
    this.connectivity.isOnline$
      .pipe(
        distinctUntilChanged(),
        filter((online) => online),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        void this.flush();
      });

    this.userSession.userSession$
      .pipe(
        pairwise(),
        takeUntil(this.destroy$)
      )
      .subscribe(([prev, curr]) => {
        if (prev?.email && !curr?.email) {
          const tenantId = this.tenantContext.getActiveTenant()?.id ?? null;
          void this.flushThenClearStorage(
            this.buildStorageKey(tenantId, prev.email)
          );
          return;
        }
        if (curr?.email) {
          this.reloadQueueForCurrentScope();
          void this.flush();
        }
      });

    this.tenantContext.activeTenant$
      .pipe(
        distinctUntilChanged((a, b) => a?.id === b?.id),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.reloadQueueForCurrentScope();
        void this.flush();
      });

    if (this.userSession.getUserEmail()) {
      this.reloadQueueForCurrentScope();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Server tally plus unsynced queue entries for this item. */
  displayCount(
    serverCount: number,
    itemId: string,
    kind: PrayedForItemKind
  ): number {
    return (serverCount ?? 0) + this.getPendingCount(itemId, kind);
  }

  /**
   * Queue one Pray For increment. Returns false when tenant/email are unavailable.
   */
  enqueue(kind: PrayedForItemKind, itemId: string): boolean {
    const key = this.getQueueStorageKey();
    if (!key) {
      console.warn('[PrayedForSync] Cannot enqueue without tenant and user email');
      return false;
    }
    this.ensureQueueLoaded(key);
    this.queue.push({
      id: this.newEntryId(),
      itemId,
      kind,
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
    this.persistQueue(key);
    this.pendingChangedSubject.next();
    return true;
  }

  getPendingCount(itemId: string, kind: PrayedForItemKind): number {
    const key = this.getQueueStorageKey();
    if (!key) {
      return 0;
    }
    this.ensureQueueLoaded(key);
    return this.queue.filter((e) => e.itemId === itemId && e.kind === kind).length;
  }

  flush(): Promise<void> {
    this.syncInFlight = (this.syncInFlight ?? Promise.resolve())
      .then(() => this.runFlush())
      .catch((error) => {
        console.warn('[PrayedForSync] Flush failed:', error);
      });
    return this.syncInFlight;
  }

  private buildStorageKey(
    tenantId: string | null | undefined,
    email: string
  ): string | null {
    const tid = tenantId?.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!tid || !normalizedEmail) {
      return null;
    }
    return `${QUEUE_KEY_PREFIX}:${tid}:${normalizedEmail}`;
  }

  private getQueueStorageKey(): string | null {
    const tenantId = this.tenantContext.getActiveTenant()?.id;
    const email = this.userSession.getUserEmail()?.trim().toLowerCase();
    if (!tenantId || !email) {
      return null;
    }
    return this.buildStorageKey(tenantId, email);
  }

  private reloadQueueForCurrentScope(): void {
    const key = this.getQueueStorageKey();
    this.queue = [];
    this.loadedStorageKey = null;
    if (key) {
      this.ensureQueueLoaded(key);
    }
    this.pendingChangedSubject.next();
  }

  private async flushThenClearStorage(storageKey: string | null): Promise<void> {
    if (storageKey) {
      this.ensureQueueLoaded(storageKey);
      await this.runFlush(storageKey);
      this.removeQueueStorage(storageKey);
    }
    this.queue = [];
    this.loadedStorageKey = null;
    this.pendingChangedSubject.next();
  }

  private removeQueueStorage(storageKey: string): void {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }

  private newEntryId(): string {
    try {
      return crypto.randomUUID();
    } catch {
      return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }

  private ensureQueueLoaded(storageKey: string): void {
    if (this.loadedStorageKey === storageKey) {
      return;
    }
    this.loadedStorageKey = storageKey;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        this.queue = [];
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.queue = [];
        return;
      }
      this.queue = parsed
        .map((entry) => ({
          id: typeof entry?.id === 'string' ? entry.id : this.newEntryId(),
          itemId: entry?.itemId,
          kind: entry?.kind,
          createdAt:
            typeof entry?.createdAt === 'string'
              ? entry.createdAt
              : new Date().toISOString(),
          attempts:
            typeof entry?.attempts === 'number' && entry.attempts >= 0
              ? entry.attempts
              : 0,
        }))
        .filter(
          (entry): entry is PendingPrayedForEntry =>
            typeof entry.itemId === 'string' &&
            (entry.kind === 'community_prayer' ||
              entry.kind === 'personal_prayer' ||
              entry.kind === 'prompt')
        );
    } catch {
      this.queue = [];
    }
  }

  private persistQueue(storageKey: string): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(this.queue));
    } catch (error) {
      console.warn('[PrayedForSync] Failed to persist queue:', error);
    }
  }

  private async runFlush(storageKeyOverride?: string): Promise<void> {
    if (!this.connectivity.isOnline()) {
      return;
    }

    const storageKey = storageKeyOverride ?? this.getQueueStorageKey();
    if (!storageKey) {
      return;
    }

    this.ensureQueueLoaded(storageKey);

    while (this.queue.length > 0 && this.connectivity.isOnline()) {
      const entry = this.queue[0];
      const flushEmail = this.emailForStorageKey(storageKey);
      const serverCount = await this.executeRpc(entry, flushEmail);

      if (serverCount === null) {
        entry.attempts += 1;
        if (entry.attempts >= MAX_FLUSH_ATTEMPTS) {
          console.warn(
            '[PrayedForSync] Dropping entry after max attempts',
            entry
          );
          this.queue.shift();
          this.persistQueue(storageKey);
          this.pendingChangedSubject.next();
          continue;
        }
        this.persistQueue(storageKey);
        return;
      }

      if (this.queue[0]?.id !== entry.id) {
        return;
      }

      this.queue.shift();
      this.persistQueue(storageKey);
      this.syncedSubject.next({
        kind: entry.kind,
        itemId: entry.itemId,
        serverCount,
      });
      this.pendingChangedSubject.next();
    }
  }

  private emailForStorageKey(storageKey: string): string | null {
    const parts = storageKey.split(':');
    const email = parts[parts.length - 1]?.trim().toLowerCase();
    return email || null;
  }

  private async executeRpc(
    entry: PendingPrayedForEntry,
    emailOverride: string | null
  ): Promise<number | null> {
    try {
      if (entry.kind === 'community_prayer') {
        const { data, error } = await this.supabase.client.rpc(
          'increment_prayed_for_count',
          { prayer_id: entry.itemId }
        );
        if (error) throw error;
        return typeof data === 'number' ? data : null;
      }

      const userEmail =
        emailOverride ??
        this.userSession.getUserEmail()?.trim().toLowerCase() ??
        null;
      if (!userEmail) {
        return null;
      }

      if (entry.kind === 'personal_prayer') {
        const { data, error } = await this.supabase.client.rpc(
          'increment_personal_prayed_for_count',
          {
            personal_prayer_id: entry.itemId,
            p_user_email: userEmail,
          }
        );
        if (error) throw error;
        return typeof data === 'number' && data > 0 ? data : null;
      }

      const { data, error } = await this.supabase.client.rpc(
        'increment_prompt_prayed_for_count',
        {
          p_prompt_id: entry.itemId,
          p_user_email: userEmail,
        }
      );
      if (error) throw error;
      return typeof data === 'number' && data > 0 ? data : null;
    } catch (error) {
      console.warn('[PrayedForSync] RPC failed:', error);
      return null;
    }
  }
}
