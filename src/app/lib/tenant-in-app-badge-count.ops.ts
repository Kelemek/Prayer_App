import { BehaviorSubject, Observable } from 'rxjs';
import { startWith } from 'rxjs/operators';
import {
  countInAppPrayerBadgesForItems,
  isOwnBadgePrayerItem,
  isOwnBadgeUpdate,
  parseCachedBadgeItems,
  type InAppBadgeReadState,
} from './in-app-prayer-badge-count';
import { INDIVIDUAL_BADGE_SUBJECT_CAP } from './tenant-in-app-badge.constants';
import {
  findTenantBadgePrayerItem,
  findTenantBadgePrayerUpdate,
  readTenantBadgeCachedItems,
} from './tenant-in-app-badge-item-cache';

export interface TenantInAppBadgeCountHost {
  getPrayersCacheStorageKey(): string;
  getPromptsCacheStorageKey(): string;
  getActiveUserEmail(): string | null;
  getReadState(): InAppBadgeReadState;
  emitBadgesChanged(): void;
}

export class TenantInAppBadgeCountOps {
  constructor(
    private readonly host: TenantInAppBadgeCountHost,
    private readonly badgeCountSubject$: Map<
      string,
      BehaviorSubject<number>
    >,
    private readonly statusBadgeCountSubject$: Map<
      string,
      BehaviorSubject<number>
    >,
    private readonly individualBadgeSubject$: Map<
      string,
      BehaviorSubject<boolean>
    >
  ) {}

  clearIndividualBadgeSubjects(): void {
    for (const subject of this.individualBadgeSubject$.values()) {
      subject.complete();
    }
    this.individualBadgeSubject$.clear();
  }

  hasIndividualBadge$(
    type: 'prayers' | 'prompts',
    id: string
  ): Observable<boolean> {
    const key = `${type}_${id}`;
    let subject = this.individualBadgeSubject$.get(key);
    if (!subject) {
      this.evictIdleIndividualBadgeSubjects();
      subject = new BehaviorSubject<boolean>(false);
      this.individualBadgeSubject$.set(key, subject);
    }

    return subject
      .asObservable()
      .pipe(startWith(this.checkIndividualBadge(type, id)));
  }

  getBadgeCount$(
    type: 'prayers' | 'prompts',
    status?: 'current' | 'answered'
  ): Observable<number> {
    const key = status ? `${type}_${status}` : type;

    let subject = status
      ? this.statusBadgeCountSubject$.get(key)
      : this.badgeCountSubject$.get(type);

    if (!subject) {
      subject = new BehaviorSubject<number>(0);
      if (status) {
        this.statusBadgeCountSubject$.set(key, subject);
      } else {
        this.badgeCountSubject$.set(type, subject);
      }
    }

    subject.next(this.calculateBadgeCount(type, status));
    return subject.asObservable();
  }

  refreshBadgeCounts(beforeRefresh?: () => void): void {
    beforeRefresh?.();

    this.badgeCountSubject$.forEach((subject, key) => {
      if (key === 'prayers') {
        subject.next(this.calculateBadgeCount('prayers'));
      } else if (key === 'prompts') {
        subject.next(this.calculateBadgeCount('prompts'));
      }
    });

    this.statusBadgeCountSubject$.forEach((subject, key) => {
      const [type, status] = key.split('_') as [
        'prayers' | 'prompts',
        'current' | 'answered',
      ];
      subject.next(this.calculateBadgeCount(type, status));
    });

    this.individualBadgeSubject$.forEach((subject, key) => {
      const [type, ...idParts] = key.split('_');
      const id = idParts.join('_');
      subject.next(this.checkIndividualBadge(type as 'prayers' | 'prompts', id));
    });

    this.host.emitBadgesChanged();
  }

  updateBadgeCount(type: 'prayers' | 'prompts'): void {
    const count = this.calculateBadgeCount(type);
    const subject = this.badgeCountSubject$.get(type);
    subject?.next(count);
  }

  updateStatusBadgeCount(
    type: 'prayers' | 'prompts',
    status?: 'current' | 'answered'
  ): void {
    if (!status || type !== 'prayers') {
      return;
    }
    const key = `${type}_${status}`;
    const count = this.calculateBadgeCount(type, status);
    const subject = this.statusBadgeCountSubject$.get(key);
    subject?.next(count);
  }

  setIndividualBadgeKey(key: string, hasBadge: boolean): void {
    this.individualBadgeSubject$.get(key)?.next(hasBadge);
  }

  syncIndividualBadgeIfTracked(
    type: 'prayers' | 'prompts',
    id: string,
    key: string
  ): void {
    if (this.individualBadgeSubject$.has(key)) {
      this.setIndividualBadgeKey(key, this.checkIndividualBadge(type, id));
    }
  }

  clearIndividualBadgeKey(key: string): void {
    this.individualBadgeSubject$.get(key)?.next(false);
  }

  getUnreadIds(type: 'prayers' | 'prompts'): string[] {
    const cacheKey =
      type === 'prayers'
        ? this.host.getPrayersCacheStorageKey()
        : this.host.getPromptsCacheStorageKey();

    try {
      const items = readTenantBadgeCachedItems(localStorage, cacheKey);
      const readIds =
        type === 'prayers'
          ? this.host.getReadState().prayers
          : this.host.getReadState().prompts;

      return items
        .filter((item) => !readIds.includes(item.id))
        .map((item) => item.id);
    } catch (error) {
      console.warn(`Failed to get unread IDs for ${type}:`, error);
      return [];
    }
  }

  isUpdateUnread(updateId: string): boolean {
    const viewerEmail = this.host.getActiveUserEmail();
    const found = findTenantBadgePrayerUpdate(
      localStorage,
      this.host.getPrayersCacheStorageKey(),
      updateId
    );
    if (found && isOwnBadgeUpdate(found.update, viewerEmail)) {
      return false;
    }
    return !this.host.getReadState().prayerUpdates.includes(updateId);
  }

  isPrayerUnread(prayerId: string): boolean {
    const viewerEmail = this.host.getActiveUserEmail();
    const item = findTenantBadgePrayerItem(
      localStorage,
      this.host.getPrayersCacheStorageKey(),
      prayerId
    );
    if (item && isOwnBadgePrayerItem(item, viewerEmail)) {
      return false;
    }
    return !this.host.getReadState().prayers.includes(prayerId);
  }

  isPromptUnread(promptId: string): boolean {
    return !this.host.getReadState().prompts.includes(promptId);
  }

  checkIndividualBadge(type: 'prayers' | 'prompts', id: string): boolean {
    const cacheKey =
      type === 'prayers'
        ? this.host.getPrayersCacheStorageKey()
        : this.host.getPromptsCacheStorageKey();

    try {
      const items = readTenantBadgeCachedItems(localStorage, cacheKey);
      const item = items.find((row) => row.id === id);
      if (!item) {
        return false;
      }

      const readIds =
        type === 'prayers'
          ? this.host.getReadState().prayers
          : this.host.getReadState().prompts;
      if (readIds.includes(id)) {
        return false;
      }
      const viewerEmail = this.host.getActiveUserEmail();
      if (type === 'prayers' && isOwnBadgePrayerItem(item, viewerEmail)) {
        return false;
      }
      return true;
    } catch (error) {
      console.warn(`Failed to check individual badge for ${type}:${id}:`, error);
      return false;
    }
  }

  calculateBadgeCount(
    type: 'prayers' | 'prompts',
    status?: 'current' | 'answered'
  ): number {
    try {
      const cached = localStorage.getItem(
        type === 'prayers'
          ? this.host.getPrayersCacheStorageKey()
          : this.host.getPromptsCacheStorageKey()
      );
      if (!cached) {
        return 0;
      }
      const readState = this.host.getReadState();
      return countInAppPrayerBadgesForItems(
        parseCachedBadgeItems(cached),
        type === 'prayers' ? readState.prayers : readState.prompts,
        type === 'prayers' ? readState.prayerUpdates : readState.promptUpdates,
        status,
        this.host.getActiveUserEmail()
      );
    } catch (error) {
      console.warn(`Failed to calculate badge count for ${type}:`, error);
      return 0;
    }
  }

  private evictIdleIndividualBadgeSubjects(): void {
    const overCap = () =>
      this.individualBadgeSubject$.size >= INDIVIDUAL_BADGE_SUBJECT_CAP;
    if (!overCap()) {
      return;
    }

    for (const [key, subject] of [...this.individualBadgeSubject$.entries()]) {
      if (!overCap()) {
        return;
      }
      if (!subject.observed) {
        subject.complete();
        this.individualBadgeSubject$.delete(key);
      }
    }

    while (overCap()) {
      const oldest = this.individualBadgeSubject$.keys().next().value;
      if (oldest === undefined) {
        return;
      }
      this.individualBadgeSubject$.get(oldest)?.complete();
      this.individualBadgeSubject$.delete(oldest);
    }
  }
}
