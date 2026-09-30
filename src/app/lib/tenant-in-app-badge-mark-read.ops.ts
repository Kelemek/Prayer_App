import type { InAppBadgeReadState, InAppBadgeReceiptRow } from './in-app-prayer-badge-count';
import { readPendingSeedFlag, writePendingSeedFlag } from './tenant-in-app-badge-read-cache';
import { addIdsToInAppBadgeReadState } from './tenant-in-app-badge-read-state-mut';
import {
  collectTenantBadgeUpdateIds,
  readTenantBadgeCachedItems,
  tenantBadgeCacheHasItems,
} from './tenant-in-app-badge-item-cache';
import type { TenantInAppBadgeCountOps } from './tenant-in-app-badge-count.ops';

type BadgeItemKind = 'prayer' | 'prayer_update' | 'prompt' | 'prompt_update';
type MarkAllKind = 'prayers' | 'prompts';

export interface TenantInAppBadgeMarkReadHost {
  getPrayersCacheStorageKey(): string;
  getPromptsCacheStorageKey(): string;
  getPendingSeedKey(): string | null;
  getReadState(): InAppBadgeReadState;
  setReadState(state: InAppBadgeReadState): void;
  getPendingSeedAllAsRead(): boolean;
  setPendingSeedAllAsRead(value: boolean): void;
  persistReadStateLocally(): void;
  queueReceiptUpsert(receipts: InAppBadgeReceiptRow[]): void;
  notifyBadgesChanged(): void;
}

export class TenantInAppBadgeMarkReadOps {
  constructor(
    private readonly host: TenantInAppBadgeMarkReadHost,
    private readonly counts: TenantInAppBadgeCountOps
  ) {}

  restorePendingSeedFlag(): void {
    if (readPendingSeedFlag(this.host.getPendingSeedKey())) {
      this.host.setPendingSeedAllAsRead(true);
    }
  }

  persistPendingSeedFlag(pending: boolean): void {
    writePendingSeedFlag(this.host.getPendingSeedKey(), pending);
  }

  /** Pending mark-all on badge enable is orchestrated by BadgeService (tenant + groups). */
  maybeSeedPendingMarkAll(): void {
    this.restorePendingSeedFlag();
  }

  markPrayerAsRead(prayerId: string): void {
    this.markItemAsRead(prayerId, 'prayers');
  }

  markPromptAsRead(promptId: string): void {
    this.markItemAsRead(promptId, 'prompts');
  }

  markUpdateAsRead(
    updateId: string,
    itemId: string,
    type: MarkAllKind
  ): void {
    try {
      const kind: BadgeItemKind =
        type === 'prayers' ? 'prayer_update' : 'prompt_update';
      const added = this.addIds(
        type === 'prayers' ? 'prayerUpdates' : 'promptUpdates',
        [updateId]
      );
      if (added.length > 0) {
        this.host.persistReadStateLocally();
        this.host.queueReceiptUpsert([{ item_kind: kind, item_id: updateId }]);
      }

      const cacheKey =
        type === 'prayers'
          ? this.host.getPrayersCacheStorageKey()
          : this.host.getPromptsCacheStorageKey();
      const items = readTenantBadgeCachedItems(localStorage, cacheKey, {
        propagateErrors: true,
      });
      const item = items.find((row) => row.id === itemId);
      const itemStatus = item?.status;

      this.counts.updateBadgeCount(type);

      if (type === 'prayers' && itemStatus) {
        this.counts.updateStatusBadgeCount(
          type,
          itemStatus as 'current' | 'answered'
        );
      }

      const key = `${type}_${itemId}`;
      this.counts.syncIndividualBadgeIfTracked(type, itemId, key);

      this.host.notifyBadgesChanged();
    } catch (error) {
      console.warn(`Failed to mark update as read:`, error);
    }
  }

  markAllAsRead(type: MarkAllKind): void {
    this.applyMarkAllFiltered(type, (items) => items, `all ${type}`);
  }

  markAllAsReadByStatus(
    type: MarkAllKind,
    status: 'current' | 'answered'
  ): void {
    this.applyMarkAllFiltered(
      type,
      (items) => items.filter((item) => item.status === status),
      `${type} with status ${status}`
    );
  }

  markAllAsReadByPromptType(promptType: string): void {
    this.applyMarkAllFiltered(
      'prompts',
      (items) => items.filter((item) => item.type === promptType),
      `prompts with type ${promptType}`
    );
  }

  markAllCachedItemsAsRead(): void {
    const hasContent =
      tenantBadgeCacheHasItems(
        localStorage,
        this.host.getPrayersCacheStorageKey()
      ) ||
      tenantBadgeCacheHasItems(
        localStorage,
        this.host.getPromptsCacheStorageKey()
      );
    if (!hasContent) {
      this.host.setPendingSeedAllAsRead(true);
      this.persistPendingSeedFlag(true);
      return;
    }
    this.host.setPendingSeedAllAsRead(false);
    this.persistPendingSeedFlag(false);
    this.markAllAsRead('prayers');
    this.markAllAsRead('prompts');
  }

  markItemUpdatesAsRead(
    itemId: string,
    type: MarkAllKind
  ): InAppBadgeReceiptRow[] {
    const cacheKey =
      type === 'prayers'
        ? this.host.getPrayersCacheStorageKey()
        : this.host.getPromptsCacheStorageKey();
    const receipts: InAppBadgeReceiptRow[] = [];

    try {
      const items = readTenantBadgeCachedItems(localStorage, cacheKey, {
        propagateErrors: true,
      });
      const item = items.find((row) => row.id === itemId);
      if (!item?.updates?.length) {
        return receipts;
      }

      const updateIds = item.updates
        .map((u) => u.id)
        .filter((id): id is string => !!id);

      const field = type === 'prayers' ? 'prayerUpdates' : 'promptUpdates';
      const kind: BadgeItemKind =
        type === 'prayers' ? 'prayer_update' : 'prompt_update';
      this.addIds(field, updateIds).forEach((id) =>
        receipts.push({ item_kind: kind, item_id: id })
      );
    } catch (error) {
      console.warn(`Failed to mark item updates as read:`, error);
    }

    return receipts;
  }

  hasCachedTenantBadgeContent(): boolean {
    return (
      tenantBadgeCacheHasItems(
        localStorage,
        this.host.getPrayersCacheStorageKey()
      ) ||
      tenantBadgeCacheHasItems(
        localStorage,
        this.host.getPromptsCacheStorageKey()
      )
    );
  }

  private applyMarkAllFiltered(
    type: MarkAllKind,
    selectItems: (
      items: ReturnType<typeof readTenantBadgeCachedItems>
    ) => ReturnType<typeof readTenantBadgeCachedItems>,
    failureLabel: string
  ): void {
    const cacheKey =
      type === 'prayers'
        ? this.host.getPrayersCacheStorageKey()
        : this.host.getPromptsCacheStorageKey();

    try {
      const allItems = readTenantBadgeCachedItems(localStorage, cacheKey, {
        propagateErrors: true,
      });
      const items = selectItems(allItems);
      if (items.length === 0) {
        return;
      }

      const ids = items.map((item) => item.id).filter(Boolean);
      const updateIds = collectTenantBadgeUpdateIds(items);
      const receipts = this.buildMarkAllReceipts(type, ids, updateIds);

      this.host.persistReadStateLocally();
      this.host.queueReceiptUpsert(receipts);

      for (const item of items) {
        this.counts.clearIndividualBadgeKey(`${type}_${item.id}`);
      }

      this.counts.refreshBadgeCounts();
      this.host.notifyBadgesChanged();
    } catch (error) {
      console.warn(`Failed to mark all ${failureLabel} as read:`, error);
    }
  }

  private markItemAsRead(itemId: string, type: MarkAllKind): void {
    try {
      let itemStatus: string | undefined;
      const receipts: InAppBadgeReceiptRow[] = [];

      if (type === 'prayers') {
        const added = this.addIds('prayers', [itemId]);
        if (added.length > 0) {
          receipts.push({ item_kind: 'prayer', item_id: itemId });
        }
        const items = readTenantBadgeCachedItems(
          localStorage,
          this.host.getPrayersCacheStorageKey()
        );
        itemStatus = items.find((row) => row.id === itemId)?.status;
      } else {
        const added = this.addIds('prompts', [itemId]);
        if (added.length > 0) {
          receipts.push({ item_kind: 'prompt', item_id: itemId });
        }
      }

      receipts.push(...this.markItemUpdatesAsRead(itemId, type));

      this.host.persistReadStateLocally();
      this.host.queueReceiptUpsert(receipts);

      this.counts.updateBadgeCount(type);

      if (type === 'prayers' && itemStatus) {
        this.counts.updateStatusBadgeCount(
          type,
          itemStatus as 'current' | 'answered'
        );
      }

      this.counts.clearIndividualBadgeKey(`${type}_${itemId}`);
      this.host.notifyBadgesChanged();
    } catch (error) {
      console.warn(`Failed to mark ${itemId} as read:`, error);
    }
  }

  private buildMarkAllReceipts(
    type: MarkAllKind,
    ids: string[],
    updateIds: string[]
  ): InAppBadgeReceiptRow[] {
    const receipts: InAppBadgeReceiptRow[] = [];
    if (type === 'prayers') {
      this.addIds('prayers', ids).forEach((id) =>
        receipts.push({ item_kind: 'prayer', item_id: id })
      );
      this.addIds('prayerUpdates', updateIds).forEach((id) =>
        receipts.push({ item_kind: 'prayer_update', item_id: id })
      );
    } else {
      this.addIds('prompts', ids).forEach((id) =>
        receipts.push({ item_kind: 'prompt', item_id: id })
      );
      this.addIds('promptUpdates', updateIds).forEach((id) =>
        receipts.push({ item_kind: 'prompt_update', item_id: id })
      );
    }
    return receipts;
  }

  private addIds(field: keyof InAppBadgeReadState, ids: string[]): string[] {
    const result = addIdsToInAppBadgeReadState(
      this.host.getReadState(),
      field,
      ids
    );
    if (result.added.length > 0) {
      this.host.setReadState(result.state);
    }
    return result.added;
  }
}
