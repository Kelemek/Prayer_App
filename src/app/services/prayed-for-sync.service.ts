import { Injectable, Injector, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { distinctUntilChanged, filter, takeUntil } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { ConnectivityService } from './connectivity.service';
import { UserSessionService } from './user-session.service';
import { TenantContextService } from './tenant-context.service';
import { PrayerService } from './prayer.service';
import { PromptService } from './prompt.service';

export type PrayedForItemKind = 'community_prayer' | 'personal_prayer' | 'prompt';

interface PendingPrayedForEntry {
  id: string;
  itemId: string;
  kind: PrayedForItemKind;
  createdAt: string;
}

const QUEUE_KEY_PREFIX = 'prayed_for_pending:v1';

@Injectable({
  providedIn: 'root',
})
export class PrayedForSyncService implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private syncInFlight: Promise<void> | null = null;
  private queue: PendingPrayedForEntry[] = [];
  private queueLoaded = false;

  constructor(
    private supabase: SupabaseService,
    private connectivity: ConnectivityService,
    private userSession: UserSessionService,
    private tenantContext: TenantContextService,
    private injector: Injector
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
        distinctUntilChanged((prev, curr) => prev?.email === curr?.email),
        takeUntil(this.destroy$)
      )
      .subscribe((session) => {
        if (session?.email) {
          this.ensureQueueLoaded();
          void this.flush();
        } else {
          this.clearQueue();
        }
      });

    this.tenantContext.activeTenant$
      .pipe(
        distinctUntilChanged((a, b) => a?.id === b?.id),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.queueLoaded = false;
        this.queue = [];
        this.ensureQueueLoaded();
        void this.flush();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  enqueue(kind: PrayedForItemKind, itemId: string): void {
    this.ensureQueueLoaded();
    this.queue.push({
      id: this.newEntryId(),
      itemId,
      kind,
      createdAt: new Date().toISOString(),
    });
    this.persistQueue();
  }

  getPendingCount(itemId: string, kind: PrayedForItemKind): number {
    this.ensureQueueLoaded();
    return this.queue.filter((e) => e.itemId === itemId && e.kind === kind).length;
  }

  /** Server count plus unsynced local increments for this item. */
  mergeServerCount(
    itemId: string,
    kind: PrayedForItemKind,
    serverCount: number
  ): number {
    return (serverCount ?? 0) + this.getPendingCount(itemId, kind);
  }

  flush(): Promise<void> {
    this.syncInFlight = (this.syncInFlight ?? Promise.resolve())
      .then(() => this.runFlush())
      .catch((error) => {
        console.warn('[PrayedForSync] Flush failed:', error);
      });
    return this.syncInFlight;
  }

  clearQueue(): void {
    this.queue = [];
    this.queueLoaded = true;
    const key = this.getQueueStorageKey();
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }
  }

  private newEntryId(): string {
    try {
      return crypto.randomUUID();
    } catch {
      return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }

  private getQueueStorageKey(): string | null {
    const tenantId = this.tenantContext.getActiveTenant()?.id;
    const email = this.userSession.getUserEmail()?.trim().toLowerCase();
    if (!tenantId || !email) {
      return null;
    }
    return `${QUEUE_KEY_PREFIX}:${tenantId}:${email}`;
  }

  private ensureQueueLoaded(): void {
    if (this.queueLoaded) {
      return;
    }
    this.queueLoaded = true;
    const key = this.getQueueStorageKey();
    if (!key) {
      this.queue = [];
      return;
    }
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        this.queue = [];
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        this.queue = [];
        return;
      }
      this.queue = parsed.filter(
        (entry): entry is PendingPrayedForEntry =>
          !!entry &&
          typeof entry.id === 'string' &&
          typeof entry.itemId === 'string' &&
          (entry.kind === 'community_prayer' ||
            entry.kind === 'personal_prayer' ||
            entry.kind === 'prompt')
      );
    } catch {
      this.queue = [];
    }
  }

  private persistQueue(): void {
    const key = this.getQueueStorageKey();
    if (!key) {
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(this.queue));
    } catch (error) {
      console.warn('[PrayedForSync] Failed to persist queue:', error);
    }
  }

  private async runFlush(): Promise<void> {
    if (!this.connectivity.isOnline()) {
      return;
    }
    this.ensureQueueLoaded();
    while (this.queue.length > 0 && this.connectivity.isOnline()) {
      const entry = this.queue[0];
      const serverCount = await this.executeRpc(entry);
      if (serverCount === null) {
        return;
      }
      this.queue.shift();
      this.persistQueue();
      this.applyServerCount(entry, serverCount);
    }
  }

  private async executeRpc(entry: PendingPrayedForEntry): Promise<number | null> {
    try {
      if (entry.kind === 'community_prayer') {
        const { data, error } = await this.supabase.client.rpc(
          'increment_prayed_for_count',
          { prayer_id: entry.itemId }
        );
        if (error) throw error;
        return typeof data === 'number' ? data : null;
      }

      const userEmail = this.userSession.getUserEmail()?.trim().toLowerCase();
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

  private applyServerCount(
    entry: PendingPrayedForEntry,
    count: number
  ): void {
    const prayerService = this.injector.get(PrayerService);
    const promptService = this.injector.get(PromptService);

    switch (entry.kind) {
      case 'community_prayer':
        prayerService.applyCommunityPrayedForCount(entry.itemId, count);
        break;
      case 'personal_prayer':
        prayerService.applyPersonalPrayedForCount(entry.itemId, count);
        break;
      case 'prompt':
        promptService.applyPromptPrayedForCount(entry.itemId, count);
        break;
      default: {
        const _exhaustive: never = entry.kind;
        return _exhaustive;
      }
    }
  }
}
