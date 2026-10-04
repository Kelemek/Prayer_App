import type { CardActionsOverflowItem } from '../components/card-actions-overflow-menu/card-actions-overflow-menu.types';

/**
 * Row-level “show drag handles / allow reorder” state for Home surfaces
 * (filter chips, personal prayer cards in a single named category, etc.).
 */
export class HomeReorderHandlesUi {
  handlesVisible = false;

  private notifyChange?: () => void;
  private readonly cachedReorderOverflowItem: CardActionsOverflowItem;

  constructor(notifyChange?: () => void) {
    this.notifyChange = notifyChange;
    this.cachedReorderOverflowItem = this.createReorderOverflowItem();
  }

  setNotifyChange(notifyChange: () => void): void {
    this.notifyChange = notifyChange;
  }

  toggle(): void {
    this.handlesVisible = !this.handlesVisible;
    this.patchReorderOverflowItemLabels();
    this.notifyChange?.();
  }

  resetHandles(): void {
    if (!this.handlesVisible) {
      return;
    }
    this.handlesVisible = false;
    this.patchReorderOverflowItemLabels();
    this.notifyChange?.();
  }

  chipShellBaseClass(withHandleClass: string, withoutHandleClass: string): string {
    return this.handlesVisible ? withHandleClass : withoutHandleClass;
  }

  isChipDragDisabled(blocked: boolean): boolean {
    return blocked || !this.handlesVisible;
  }

  isReorderActive(eligible: boolean): boolean {
    return eligible && this.handlesVisible;
  }

  reorderMenuWhen(eligible: boolean): CardActionsOverflowItem | null {
    return eligible ? this.reorderOverflowItem() : null;
  }

  /** Stable reference; label/tone update when visibility changes. */
  reorderOverflowItem(): CardActionsOverflowItem {
    return this.cachedReorderOverflowItem;
  }

  private createReorderOverflowItem(): CardActionsOverflowItem {
    return {
      id: 'reorder',
      label: this.reorderMenuLabel(),
      icon: 'grip',
      tone: 'blue',
      ariaLabel: this.reorderMenuAriaLabel(),
      onSelect: () => this.toggle(),
    };
  }

  private patchReorderOverflowItemLabels(): void {
    this.cachedReorderOverflowItem.label = this.reorderMenuLabel();
    this.cachedReorderOverflowItem.ariaLabel = this.reorderMenuAriaLabel();
  }

  private reorderMenuLabel(): string {
    return this.handlesVisible ? 'Disable Reorder' : 'Enable reorder';
  }

  private reorderMenuAriaLabel(): string {
    return this.handlesVisible
      ? 'Disable reorder and hide drag handles'
      : 'Enable reorder and show drag handles';
  }
}
