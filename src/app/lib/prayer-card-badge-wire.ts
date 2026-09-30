import { BehaviorSubject, type Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  isOwnBadgePrayerItem,
  isOwnBadgeUpdate,
} from './in-app-prayer-badge-count';
import type { BadgeService } from '../services/badge.service';
import type { PrayerRequest } from '../services/prayer.service';
import type { PrayerUpdateRecord } from './prayer-update-header';

export class PrayerCardBadgeWire {
  readonly updateBadges$ = new Map<string, BehaviorSubject<boolean>>();
  readonly prayerBadge$: Observable<boolean>;

  private storageListener: ((event: StorageEvent) => void) | null = null;

  constructor(
    private readonly badgeService: BadgeService,
    private readonly getPrayer: () => PrayerRequest
  ) {
    this.prayerBadgeSubject$ = new BehaviorSubject<boolean>(false);
    this.prayerBadge$ = this.prayerBadgeSubject$.asObservable();
  }

  private readonly prayerBadgeSubject$: BehaviorSubject<boolean>;

  init(destroy$: Subject<void>): void {
    this.syncPrayerBadge();
    this.seedUpdateBadges(this.getPrayer().updates);

    this.badgeService
      .getUpdateBadgesChanged$()
      .pipe(takeUntil(destroy$))
      .subscribe(() => {
        this.syncPrayerBadge();
        this.syncAllUpdateBadges(this.getPrayer().updates);
      });

    this.storageListener = (event: StorageEvent) => {
      if (
        event.key === 'read_prayers_data' ||
        event.key?.startsWith('badge_read_groups:')
      ) {
        this.syncPrayerBadge();
        this.syncAllUpdateBadges(this.getPrayer().updates);
      }
    };
    window.addEventListener('storage', this.storageListener);
  }

  destroy(): void {
    if (this.storageListener) {
      window.removeEventListener('storage', this.storageListener);
      this.storageListener = null;
    }
  }

  onPrayerChanged(
    previousPrayer: PrayerRequest | undefined,
    currentPrayer: PrayerRequest
  ): void {
    const previousUpdateIds = previousPrayer?.updates?.map((u) => u.id) ?? [];
    const currentUpdateIds = currentPrayer.updates?.map((u) => u.id) ?? [];
    const newUpdateIds = currentUpdateIds.filter(
      (id) => !previousUpdateIds.includes(id)
    );

    if (newUpdateIds.length === 0) {
      return;
    }

    for (const newUpdateId of newUpdateIds) {
      const update = currentPrayer.updates?.find((u) => u.id === newUpdateId);
      if (update && !this.updateBadges$.has(update.id)) {
        this.ensureUpdateBadge(update.id);
      }
    }
    this.syncAllUpdateBadges(currentPrayer.updates);
  }

  markUpdateRead(updateId: string, prayerId: string): void {
    const prayer = this.getPrayer();
    if (prayer?.group_id) {
      this.badgeService.markGroupUpdateAsRead(updateId, prayer.group_id);
    } else {
      this.badgeService.markUpdateAsRead(updateId, prayerId, 'prayers');
    }
    const subject = this.updateBadges$.get(updateId);
    if (subject) {
      subject.next(false);
    }
  }

  private seedUpdateBadges(updates: PrayerUpdateRecord[] | undefined): void {
    if (!updates?.length) {
      return;
    }
    updates.forEach((update) => this.ensureUpdateBadge(update.id));
  }

  private ensureUpdateBadge(updateId: string): void {
    if (!this.updateBadges$.has(updateId)) {
      this.updateBadges$.set(
        updateId,
        new BehaviorSubject<boolean>(this.isUpdateUnread(updateId))
      );
      return;
    }
    this.syncUpdateBadge(updateId);
  }

  private syncPrayerBadge(): void {
    const prayer = this.getPrayer();
    if (!prayer?.id) {
      return;
    }
    this.prayerBadgeSubject$.next(this.isPrayerUnread(prayer));
  }

  private isPrayerUnread(prayer: PrayerRequest): boolean {
    const viewerEmail = this.badgeService.getViewerEmailForBadges();
    if (isOwnBadgePrayerItem(prayer, viewerEmail)) {
      return false;
    }
    if (prayer.group_id) {
      return this.badgeService.isGroupPrayerUnread(prayer.id);
    }
    return this.badgeService.isPrayerUnread(prayer.id);
  }

  private isUpdateUnread(updateId: string): boolean {
    const prayer = this.getPrayer();
    const update = prayer.updates?.find((row) => row.id === updateId);
    const viewerEmail = this.badgeService.getViewerEmailForBadges();
    if (update && isOwnBadgeUpdate(update, viewerEmail)) {
      return false;
    }
    if (prayer?.group_id) {
      return this.badgeService.isGroupUpdateUnread(updateId);
    }
    return this.badgeService.isUpdateUnread(updateId);
  }

  private syncUpdateBadge(updateId: string): void {
    const subject = this.updateBadges$.get(updateId);
    if (subject) {
      subject.next(this.isUpdateUnread(updateId));
    }
  }

  private syncAllUpdateBadges(updates: PrayerUpdateRecord[] | undefined): void {
    if (!updates?.length) {
      return;
    }
    updates.forEach((update) => this.syncUpdateBadge(update.id));
  }
}
