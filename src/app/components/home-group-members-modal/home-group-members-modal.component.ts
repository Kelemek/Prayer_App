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
import { parseInviteEmails } from "../../lib/prayer-group-invite-emails";
import type { PrayerGroup, PrayerGroupMember } from "../../types/prayer-group";
import { PrayerGroupService } from "../../services/prayer-group.service";
import { ConfirmationDialogComponent } from "../confirmation-dialog/confirmation-dialog.component";

type MembersConfirmAction =
  | { type: "leave"; groupId: string; groupName: string }
  | { type: "removeMember"; groupId: string; email: string; label: string };

@Component({
  selector: "app-home-group-members-modal",
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationDialogComponent],
  templateUrl: "./home-group-members-modal.component.html",
  host: { class: "contents" },
})
export class HomeGroupMembersModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() group: PrayerGroup | null = null;
  @Input() currentUserEmail = "";
  @Input() maxMembersPerGroup: number | null = null;
  @Input() submitting = false;

  @Output() close = new EventEmitter<void>();
  @Output() groupsChanged = new EventEmitter<void>();

  private readonly prayerGroupService = inject(PrayerGroupService);
  private readonly cdr = inject(ChangeDetectorRef);

  members: PrayerGroupMember[] = [];
  emailsDraft = "";
  loadingMembers = false;
  pendingConfirm: MembersConfirmAction | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (
      this.isOpen &&
      this.group &&
      (changes["isOpen"]?.currentValue === true || changes["group"])
    ) {
      this.emailsDraft = "";
      void this.loadMembers();
    }
    if (changes["isOpen"]?.currentValue === false) {
      this.members = [];
      this.emailsDraft = "";
      this.pendingConfirm = null;
    }
  }

  title(): string {
    const name = this.group?.name?.trim();
    return name ? `Manage members — ${name}` : "Manage members";
  }

  isOwner(): boolean {
    return this.group?.my_role === "owner";
  }

  async loadMembers(): Promise<void> {
    const groupId = this.group?.id;
    if (!groupId || this.loadingMembers) {
      return;
    }
    this.loadingMembers = true;
    this.cdr.markForCheck();
    try {
      this.members = await this.prayerGroupService.loadGroupMembers(groupId);
    } finally {
      this.loadingMembers = false;
      this.cdr.markForCheck();
    }
  }

  memberLabel(member: PrayerGroupMember): string {
    const name = member.name?.trim();
    return name ? `${name} (${member.user_email})` : member.user_email;
  }

  canRemoveMember(member: PrayerGroupMember): boolean {
    if (!this.group || !this.isOwner()) return false;
    if (member.user_email.toLowerCase() === this.currentUserEmail.toLowerCase()) {
      return false;
    }
    if (member.role === "owner") {
      const owners = this.members.filter((row) => row.role === "owner");
      return owners.length > 1;
    }
    return true;
  }

  canLeaveGroup(): boolean {
    if (!this.group) return false;
    if (!this.isOwner()) return true;
    const owners = this.members.filter((row) => row.role === "owner");
    return owners.length > 1;
  }

  memberCapReached(): boolean {
    if (this.maxMembersPerGroup == null) {
      return false;
    }
    return this.members.length >= this.maxMembersPerGroup;
  }

  remainingInviteSlots(): number {
    if (this.maxMembersPerGroup == null) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, this.maxMembersPerGroup - this.members.length);
  }

  async sendInvites(): Promise<void> {
    const groupId = this.group?.id;
    if (!groupId || !this.isOwner() || this.memberCapReached()) return;
    const emails = parseInviteEmails(this.emailsDraft).slice(
      0,
      this.remainingInviteSlots()
    );
    if (emails.length === 0) return;
    const invited = await this.prayerGroupService.inviteMembers(groupId, emails);
    if (invited > 0) {
      this.emailsDraft = "";
      await this.loadMembers();
      this.groupsChanged.emit();
    }
  }

  requestRemoveMember(member: PrayerGroupMember): void {
    if (!this.group) return;
    this.pendingConfirm = {
      type: "removeMember",
      groupId: this.group.id,
      email: member.user_email,
      label: this.memberLabel(member),
    };
  }

  requestLeaveGroup(): void {
    if (!this.group) return;
    this.pendingConfirm = {
      type: "leave",
      groupId: this.group.id,
      groupName: this.group.name,
    };
  }

  confirmTitle(): string {
    if (!this.pendingConfirm) return "";
    switch (this.pendingConfirm.type) {
      case "leave":
        return "Leave group?";
      case "removeMember":
        return "Remove member?";
      default: {
        const _exhaustive: never = this.pendingConfirm;
        void _exhaustive;
        return "";
      }
    }
  }

  confirmMessage(): string {
    if (!this.pendingConfirm) return "";
    switch (this.pendingConfirm.type) {
      case "leave":
        return `Leave "${this.pendingConfirm.groupName}"? You can be invited again later.`;
      case "removeMember":
        return `Remove ${this.pendingConfirm.label} from this group?`;
      default: {
        const _exhaustive: never = this.pendingConfirm;
        void _exhaustive;
        return "";
      }
    }
  }

  async onConfirmAction(): Promise<void> {
    const action = this.pendingConfirm;
    this.pendingConfirm = null;
    if (!action) return;

    let ok = false;
    switch (action.type) {
      case "leave":
        ok = await this.prayerGroupService.leaveGroup(action.groupId);
        break;
      case "removeMember":
        ok = await this.prayerGroupService.removeMember(action.groupId, action.email);
        if (ok) {
          await this.loadMembers();
        }
        break;
      default: {
        const _exhaustive: never = action;
        void _exhaustive;
      }
    }

    if (ok) {
      this.groupsChanged.emit();
      if (action.type === "leave") {
        this.close.emit();
      }
    }
    this.cdr.markForCheck();
  }

  cancelConfirm(): void {
    this.pendingConfirm = null;
  }
}
