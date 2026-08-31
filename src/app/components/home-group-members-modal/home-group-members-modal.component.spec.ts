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
    expect(fixture.nativeElement.textContent).toContain("member@example.com");
    expect(fixture.nativeElement.textContent).toContain("Invite by email");
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

  it("blocks invites when the member cap is reached", async () => {
    fixture.componentRef.setInput("maxMembersPerGroup", 1);
    fixture.componentInstance.members = [memberRow];
    fixture.detectChanges();
    expect(fixture.componentInstance.memberCapReached()).toBe(true);
    fixture.componentInstance.emailsDraft = "new@example.com";
    await fixture.componentInstance.sendInvites();
    expect(prayerGroupService.inviteMembers).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      "reached the member limit"
    );
  });
});
