import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from "@angular/cdk/drag-drop";
import { HomeSubFilterChipComponent } from "../home-sub-filter-chip/home-sub-filter-chip.component";
import { CardActionsOverflowMenuComponent } from "../card-actions-overflow-menu/card-actions-overflow-menu.component";
import type { CardActionsOverflowItem } from "../card-actions-overflow-menu/card-actions-overflow-menu.types";
import { ConfirmationDialogComponent } from "../confirmation-dialog/confirmation-dialog.component";
import { HomeGroupMembersModalComponent } from "../home-group-members-modal/home-group-members-modal.component";
import type { PrayerGroup } from "../../types/prayer-group";
import { PrayerGroupService } from "../../services/prayer-group.service";
import type { GroupFilterMode } from "../../lib/home-group-catalog";
import {
  HOME_GROUPS_SUB_FILTER_GROUP_CLASS,
  HOME_PUBLIC_STATUS_CHIP_THEMES,
  HOME_SUB_FILTER_CHIP_DRAG_STRETCH_CLASS,
  HOME_SUB_FILTER_CHIP_ROW_CLASS,
  HOME_WRAP_FILTER_CHIP_FLEX_CLASS,
} from "../../lib/home-sub-filter-chip-classes";
import { buildHomeSubFilterChipButtonClass } from "../../lib/home-sub-filter-chip-button-class";
import { HOME_SHELL_SECTION_GAP_CLASSES } from "../../lib/home-shell-spacing";
import {
  lockHomePersonalCategoryDragScroll,
  unlockHomePersonalCategoryDragScroll,
} from "../../lib/personal-category-drag-scroll";

@Component({
  selector: "app-home-group-filters",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    HomeSubFilterChipComponent,
    CardActionsOverflowMenuComponent,
    ConfirmationDialogComponent,
    HomeGroupMembersModalComponent,
  ],
  templateUrl: "./home-group-filters.component.html",
  host: { class: "block" },
})
export class HomeGroupFiltersComponent implements OnInit, OnChanges {
  @Input() groups: PrayerGroup[] = [];
  @Input() selectedGroupId: string | null = null;
  @Input() filterMode: GroupFilterMode = "current";
  @Input() currentCount = 0;
  @Input() answeredCount = 0;
  @Input() totalCount = 0;
  @Input() canCreateGroups = false;
  @Input() showProUpgrade = false;
  @Input() maxGroupsOwned = 1;
  @Input() maxMembersPerGroup = 25;
  @Input() currentUserEmail = "";
  @Input() membersGroupIdToOpen: string | null = null;

  @Output() addGroup = new EventEmitter<void>();
  @Output() upgradePro = new EventEmitter<void>();
  @Output() selectGroup = new EventEmitter<string>();
  @Output() selectFilterMode = new EventEmitter<
    Exclude<GroupFilterMode, "named">
  >();
  @Output() groupsChanged = new EventEmitter<void>();
  @Output() membersGroupOpened = new EventEmitter<void>();

  private readonly prayerGroupService = inject(PrayerGroupService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  pendingDeleteGroup: PrayerGroup | null = null;
  showProUpgradeModal = false;
  renameTarget: PrayerGroup | null = null;
  membersTarget: PrayerGroup | null = null;
  renameDraft = "";
  groupActionSubmitting = false;
  isGroupReordering = false;
  private groupDragScrollLockTarget: HTMLElement | null = null;
  private groupPrayerCounts = new Map<string, number>();

  readonly chipHostClass = HOME_WRAP_FILTER_CHIP_FLEX_CLASS;
  readonly chipDragShellClass = HOME_SUB_FILTER_CHIP_DRAG_STRETCH_CLASS;
  /** Same equal-share status row as Personal (no 2-per-row wrap hosts). */
  readonly statusChipRowClass = HOME_SUB_FILTER_CHIP_ROW_CLASS;
  readonly chipRowClass = HOME_SUB_FILTER_CHIP_ROW_CLASS;
  readonly sectionGapClass = HOME_SHELL_SECTION_GAP_CLASSES;
  readonly subFilterGroupClass = HOME_GROUPS_SUB_FILTER_GROUP_CLASS;
  readonly chipThemes = HOME_PUBLIC_STATUS_CHIP_THEMES;

  ngOnInit(): void {
    this.prayerGroupService.groupPrayerCounts$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((counts) => {
        this.groupPrayerCounts = new Map(counts);
        this.cdr.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const groupId = changes["membersGroupIdToOpen"]?.currentValue as string | null;
    if (!groupId) {
      return;
    }
    const group = this.groups.find((row) => row.id === groupId);
    if (group) {
      this.membersTarget = group;
      this.cdr.markForCheck();
      this.membersGroupOpened.emit();
    }
  }

  groupPrayerCount(groupId: string): number {
    return this.groupPrayerCounts.get(groupId) ?? 0;
  }

  isGroupChipActive(groupId: string): boolean {
    return this.filterMode === "named" && this.selectedGroupId === groupId;
  }

  onGroupChipClick(groupId: string): void {
    if (this.isGroupChipActive(groupId)) {
      this.selectFilterMode.emit("total");
      return;
    }
    this.selectGroup.emit(groupId);
  }

  selectedGroup(): PrayerGroup | undefined {
    return this.groups.find((group) => group.id === this.selectedGroupId);
  }

  isOwner(group: PrayerGroup): boolean {
    return group.my_role === "owner";
  }

  chipShellClass(group: PrayerGroup): string {
    return buildHomeSubFilterChipButtonClass({
      base: this.chipDragShellClass,
      active: this.isGroupChipActive(group.id),
      activeClass: this.chipThemes.members.active,
      inactiveClass: this.chipThemes.members.inactive,
      disabled: this.isGroupReordering,
    });
  }

  onGroupDragStarted(): void {
    document.body.style.cursor = "grabbing";
    this.groupDragScrollLockTarget = lockHomePersonalCategoryDragScroll();
  }

  onGroupDragEnded(): void {
    document.body.style.cursor = "";
    unlockHomePersonalCategoryDragScroll(this.groupDragScrollLockTarget);
    this.groupDragScrollLockTarget = null;
  }

  async onGroupDrop(event: CdkDragDrop<PrayerGroup[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex || this.isGroupReordering) {
      return;
    }

    const orderedGroupIds = this.groups.map((group) => group.id);
    moveItemInArray(orderedGroupIds, event.previousIndex, event.currentIndex);

    this.isGroupReordering = true;
    this.cdr.markForCheck();

    await this.prayerGroupService.reorderGroups(orderedGroupIds);

    this.isGroupReordering = false;
    this.cdr.markForCheck();
  }

  overflowItems(group: PrayerGroup): CardActionsOverflowItem[] {
    if (this.isGroupReordering) {
      return [];
    }
    const items: CardActionsOverflowItem[] = [
      {
        id: "members",
        label: "Manage members",
        icon: "users",
        tone: "blue",
        ariaLabel: `Manage members of ${group.name}`,
        onSelect: () => this.openManageMembers(group),
      },
    ];
    if (!this.isOwner(group)) {
      return items;
    }
    return [
      items[0]!,
      {
        id: "edit",
        label: "Rename group",
        icon: "edit",
        tone: "blue",
        ariaLabel: `Rename ${group.name}`,
        onSelect: () => this.openRename(group),
      },
      {
        id: "delete",
        label: "Delete group",
        icon: "trash",
        tone: "red",
        ariaLabel: `Delete ${group.name}`,
        onSelect: () => {
          this.pendingDeleteGroup = group;
          this.cdr.markForCheck();
        },
      },
    ];
  }

  openManageMembers(group: PrayerGroup): void {
    this.membersTarget = group;
    this.cdr.markForCheck();
  }

  closeManageMembers(): void {
    this.membersTarget = null;
    this.cdr.markForCheck();
  }

  openRename(group: PrayerGroup): void {
    this.renameTarget = group;
    this.renameDraft = group.name;
    this.cdr.markForCheck();
  }

  cancelRename(): void {
    this.renameTarget = null;
    this.renameDraft = "";
    this.cdr.markForCheck();
  }

  canSaveRename(): boolean {
    const nextName = this.renameDraft.trim();
    const currentName = this.renameTarget?.name.trim() ?? "";
    return nextName.length > 0 && nextName !== currentName;
  }

  async saveRename(): Promise<void> {
    if (!this.renameTarget || !this.canSaveRename() || this.groupActionSubmitting) {
      return;
    }
    this.groupActionSubmitting = true;
    this.cdr.markForCheck();
    const ok = await this.prayerGroupService.renameGroup(
      this.renameTarget.id,
      this.renameDraft.trim()
    );
    this.groupActionSubmitting = false;
    if (ok) {
      this.renameTarget = null;
      this.renameDraft = "";
      this.groupsChanged.emit();
    }
    this.cdr.markForCheck();
  }

  cancelDelete(): void {
    this.pendingDeleteGroup = null;
    this.cdr.markForCheck();
  }

  onAddChipClick(): void {
    if (this.canCreateGroups) {
      this.addGroup.emit();
      return;
    }
    if (this.showProUpgrade) {
      this.showProUpgradeModal = true;
      this.cdr.markForCheck();
    }
  }

  proUpgradeMessage(): string {
    const limit = Math.max(1, this.maxGroupsOwned);
    const groupWord = limit === 1 ? "group" : "groups";
    return `You've reached your free plan limit of ${limit} ${groupWord}. Upgrade to Pro to create more groups.`;
  }

  confirmProUpgrade(): void {
    this.showProUpgradeModal = false;
    this.cdr.markForCheck();
    this.upgradePro.emit();
  }

  cancelProUpgrade(): void {
    this.showProUpgradeModal = false;
    this.cdr.markForCheck();
  }

  deleteConfirmMessage(): string {
    const name = this.pendingDeleteGroup?.name ?? "this group";
    return `Delete "${name}" and all of its prayers? This cannot be undone.`;
  }

  async confirmDelete(): Promise<void> {
    const group = this.pendingDeleteGroup;
    if (!group || this.groupActionSubmitting) {
      return;
    }
    this.groupActionSubmitting = true;
    this.cdr.markForCheck();
    const ok = await this.prayerGroupService.deleteGroup(group.id);
    this.groupActionSubmitting = false;
    this.pendingDeleteGroup = null;
    if (ok) {
      this.groupsChanged.emit();
    }
    this.cdr.markForCheck();
  }
}
