import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ɵresolveComponentResources as resolveComponentResources } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HomeGroupMembersModalComponent } from "./home-group-members-modal.component";
import { PrayerGroupService } from "../../services/prayer-group.service";
import type { PrayerGroup, PrayerGroupMember } from "../../types/prayer-group";

const componentDir = dirname(fileURLToPath(import.meta.url));

function readComponentResource(url: string): string {
  const path = join(componentDir, url);
  if (existsSync(path)) {
    return readFileSync(path, "utf-8");
  }
  throw new Error(`Component resource not found: ${url}`);
}

const familyGroup: PrayerGroup = {
  id: "g1",
  name: "Family",
  created_by_email: "owner@example.com",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  my_role: "owner",
};

const memberRow: PrayerGroupMember = {
  id: "m1",
  group_id: "g1",
  user_email: "member@example.com",
  role: "member",
  is_active: true,
};

describe("HomeGroupMembersModalComponent", () => {
  const prayerGroupService = {
    loadGroupMembers: vi.fn().mockResolvedValue([memberRow]),
    inviteMembers: vi.fn().mockResolvedValue(1),
    removeMember: vi.fn().mockResolvedValue(true),
    leaveGroup: vi.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    await resolveComponentResources((url) =>
      Promise.resolve(readComponentResource(url))
    );
  });

  let fixture: ComponentFixture<HomeGroupMembersModalComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [HomeGroupMembersModalComponent],
    })
      .overrideProvider(PrayerGroupService, { useValue: prayerGroupService })
      .compileComponents();

    fixture = TestBed.createComponent(HomeGroupMembersModalComponent);
    fixture.componentRef.setInput("isOpen", true);
    fixture.componentRef.setInput("group", familyGroup);
    fixture.componentRef.setInput("currentUserEmail", "owner@example.com");
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it("loads and shows members for the selected group", async () => {
    expect(prayerGroupService.loadGroupMembers).toHaveBeenCalledWith("g1");
    expect(document.body.textContent).toContain("member@example.com");
    expect(document.body.textContent).toContain("Invite by email");
  });

  it("does not allow removing the current owner from their own group", () => {
    fixture.componentInstance.members = [
      {
        id: "owner",
        group_id: "g1",
        user_email: "owner@example.com",
        role: "owner",
        is_active: true,
      },
      memberRow,
    ];
    const ownerMember = fixture.componentInstance.members.find(
      (member) => member.user_email === "owner@example.com"
    )!;
    expect(fixture.componentInstance.canRemoveMember(ownerMember)).toBe(false);
    expect(fixture.componentInstance.canRemoveMember(memberRow)).toBe(true);
  });

  it("shows near-cap copy when at 80% of member limit", async () => {
    fixture.componentRef.setInput("maxMembersPerGroup", 5);
    fixture.componentInstance.members = [
      memberRow,
      { ...memberRow, id: "m2", user_email: "a@example.com" },
      { ...memberRow, id: "m3", user_email: "b@example.com" },
      { ...memberRow, id: "m4", user_email: "c@example.com" },
    ];
    fixture.detectChanges();
    expect(fixture.componentInstance.memberNearCap()).toBe(true);
    expect(document.body.textContent).toContain("near the member limit");
  });

  it("formats member labels and modal title", () => {
    expect(fixture.componentInstance.title()).toContain("Family");
    expect(
      fixture.componentInstance.memberLabel({ ...memberRow, name: "Ann Lee" })
    ).toContain("Ann Lee");
  });

  it("confirms leave and remove member flows", async () => {
    fixture.componentInstance.requestLeaveGroup();
    expect(fixture.componentInstance.confirmTitle()).toBe("Leave group?");
    fixture.componentInstance.cancelConfirm();
    expect(fixture.componentInstance.pendingConfirm).toBeNull();

    fixture.componentInstance.requestRemoveMember(memberRow);
    expect(fixture.componentInstance.confirmMessage()).toContain("member@example.com");
    await fixture.componentInstance.onConfirmAction();
    expect(prayerGroupService.removeMember).toHaveBeenCalledWith(
      "g1",
      "member@example.com"
    );
  });

  it("sends invites when emails are valid", async () => {
    fixture.componentInstance.emailsDraft = "new@example.com, other@example.com";
    await fixture.componentInstance.sendInvites();
    expect(prayerGroupService.inviteMembers).toHaveBeenCalled();
  });

  it("allows a non-owner member to leave the group", () => {
    fixture.componentRef.setInput("currentUserEmail", "member@example.com");
    fixture.componentRef.setInput("group", {
      ...familyGroup,
      my_role: "member",
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.isOwner()).toBe(false);
    expect(fixture.componentInstance.canLeaveGroup()).toBe(true);
  });

  it("reports remaining invite slots from the cap", () => {
    fixture.componentRef.setInput("maxMembersPerGroup", 5);
    fixture.componentInstance.members = [memberRow, { ...memberRow, id: "m2" }];
    expect(fixture.componentInstance.remainingInviteSlots()).toBe(3);
  });

  it("closes after a successful leave confirmation", async () => {
    const close = vi.fn();
    fixture.componentInstance.close.subscribe(close);
    fixture.componentInstance.requestLeaveGroup();
    await fixture.componentInstance.onConfirmAction();
    expect(prayerGroupService.leaveGroup).toHaveBeenCalledWith("g1");
    expect(close).toHaveBeenCalled();
  });

  it("clears state when modal closes", async () => {
    fixture.componentRef.setInput("isOpen", false);
    fixture.detectChanges();
    expect(fixture.componentInstance.members).toEqual([]);
  });

  it("blocks invites when the member cap is reached", async () => {
    fixture.componentRef.setInput("maxMembersPerGroup", 1);
    fixture.componentInstance.members = [memberRow];
    fixture.detectChanges();
    expect(fixture.componentInstance.memberCapReached()).toBe(true);
    fixture.componentInstance.emailsDraft = "new@example.com";
    await fixture.componentInstance.sendInvites();
    expect(prayerGroupService.inviteMembers).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "reached the member limit"
    );
  });
});
