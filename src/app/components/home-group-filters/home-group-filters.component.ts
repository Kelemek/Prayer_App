import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HomeSubFilterChipComponent } from "../home-sub-filter-chip/home-sub-filter-chip.component";
import { CardActionsOverflowMenuComponent } from "../card-actions-overflow-menu/card-actions-overflow-menu.component";
import type { CardActionsOverflowItem } from "../card-actions-overflow-menu/card-actions-overflow-menu.types";
import { ConfirmationDialogComponent } from "../confirmation-dialog/confirmation-dialog.component";
import { HomeGroupMembersModalComponent } from "../home-group-members-modal/home-group-members-modal.component";
import type { PrayerGroup } from "../../types/prayer-group";
import { PrayerGroupService } from "../../services/prayer-group.service";
import {
  HOME_GROUPS_SUB_FILTER_GROUP_CLASS,
  HOME_PUBLIC_STATUS_CHIP_THEMES,
  HOME_SUB_FILTER_CHIP_ROW_CLASS,
  HOME_SUB_FILTER_CHIP_WRAP_STRETCH_CLASS,
  HOME_WRAP_FILTER_CHIP_FLEX_CLASS,
} from "../../lib/home-sub-filter-chip-classes";
import { HOME_SHELL_SECTION_GAP_CLASSES } from "../../lib/home-shell-spacing";

@Component({
  selector: "app-home-group-filters",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HomeSubFilterChipComponent,
    CardActionsOverflowMenuComponent,
    ConfirmationDialogComponent,
    HomeGroupMembersModalComponent,
  ],
  templateUrl: "./home-group-filters.component.html",
  host: { class: "block" },
})
export class HomeGroupFiltersComponent implements OnChanges {
  @Input() groups: PrayerGroup[] = [];
  @Input() selectedGroupId: string | null = null;
  @Input() canCreateGroups = false;
  @Input() showProUpgrade = false;
  @Input() maxMembersPerGroup = 25;
  @Input() currentUserEmail = "";
  @Input() membersGroupIdToOpen: string | null = null;

  @Output() addGroup = new EventEmitter<void>();
  @Output() upgradePro = new EventEmitter<void>();
  @Output() selectGroup = new EventEmitter<string>();
  @Output() groupsChanged = new EventEmitter<void>();
  @Output() membersGroupOpened = new EventEmitter<void>();

  private readonly prayerGroupService = inject(PrayerGroupService);
  private readonly cdr = inject(ChangeDetectorRef);

  pendingDeleteGroup: PrayerGroup | null = null;
  renameTarget: PrayerGroup | null = null;
  membersTarget: PrayerGroup | null = null;
  renameDraft = "";
  groupActionSubmitting = false;

  readonly chipHostClass = HOME_WRAP_FILTER_CHIP_FLEX_CLASS;
  readonly chipButtonClass = HOME_SUB_FILTER_CHIP_WRAP_STRETCH_CLASS;
  readonly chipRowClass = HOME_SUB_FILTER_CHIP_ROW_CLASS;
  readonly sectionGapClass = HOME_SHELL_SECTION_GAP_CLASSES;
  readonly subFilterGroupClass = HOME_GROUPS_SUB_FILTER_GROUP_CLASS;
  readonly chipThemes = HOME_PUBLIC_STATUS_CHIP_THEMES;

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

  selectedGroup(): PrayerGroup | undefined {
    return this.groups.find((group) => group.id === this.selectedGroupId);
  }

  isOwner(group: PrayerGroup): boolean {
    return group.my_role === "owner";
  }

  chipShellClass(group: PrayerGroup): string {
    const stateClass =
      this.selectedGroupId === group.id
        ? this.chipThemes.members.active
        : this.chipThemes.members.inactive;
    return `${stateClass} relative flex w-full min-h-9 min-w-max items-center gap-0.5 rounded-lg px-3 pr-0.5 text-xs font-medium whitespace-nowrap transition-all`;
  }

  overflowItems(group: PrayerGroup): CardActionsOverflowItem[] {
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
