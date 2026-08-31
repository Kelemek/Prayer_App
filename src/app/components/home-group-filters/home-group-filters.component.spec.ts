import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ɵresolveComponentResources as resolveComponentResources } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import {
  HOME_WRAP_FILTER_CHIP_FLEX_CLASS,
} from "../../lib/home-sub-filter-chip-classes";
import { HomeGroupFiltersComponent } from "./home-group-filters.component";
import { PrayerGroupService } from "../../services/prayer-group.service";
import type { PrayerGroup } from "../../types/prayer-group";

const componentDir = dirname(fileURLToPath(import.meta.url));
const membersModalDir = join(componentDir, "../home-group-members-modal");

function readComponentResource(url: string): string {
  const candidates = [
    join(componentDir, url),
    join(membersModalDir, url.replace("./home-group-members-modal.", "./home-group-members-modal.")),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return readFileSync(path, "utf-8");
    }
  }
  const membersPath = join(membersModalDir, url.replace(/^\.\//, ""));
  if (existsSync(membersPath)) {
    return readFileSync(membersPath, "utf-8");
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

describe("HomeGroupFiltersComponent", () => {
  beforeAll(async () => {
    await resolveComponentResources((url) =>
      Promise.resolve(readComponentResource(url))
    );
  });

  let fixture: ComponentFixture<HomeGroupFiltersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeGroupFiltersComponent],
    })
      .overrideProvider(PrayerGroupService, {
        useValue: {
          renameGroup: vi.fn().mockResolvedValue(true),
          deleteGroup: vi.fn().mockResolvedValue(true),
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(HomeGroupFiltersComponent);
    fixture.componentInstance.groups = [familyGroup];
    fixture.componentInstance.selectedGroupId = "g1";
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it("shows group overflow for invitees without the add group chip", () => {
    fixture.componentRef.setInput("canCreateGroups", false);
    fixture.componentInstance.groups = [
      {
        ...familyGroup,
        my_role: "member",
      },
    ];
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector("#tour-filter-add-group")
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector("#tour-filter-group-g1")
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="card-actions-overflow-trigger"]'
      )
    ).toBeTruthy();
  });

  it("shows Upgrade to Pro when at group cap on free tier", () => {
    fixture.componentRef.setInput("canCreateGroups", false);
    fixture.componentRef.setInput("showProUpgrade", true);
    fixture.detectChanges();
    const upgradeChip = fixture.nativeElement.querySelector(
      "#tour-filter-upgrade-pro"
    ) as HTMLButtonElement;
    expect(upgradeChip).toBeTruthy();
    expect(upgradeChip.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "Upgrade to Pro"
    );
  });

  it("emits upgradePro when upgrade chip is clicked", () => {
    fixture.componentRef.setInput("canCreateGroups", false);
    fixture.componentRef.setInput("showProUpgrade", true);
    fixture.detectChanges();
    const emitted: number[] = [];
    fixture.componentInstance.upgradePro.subscribe(() => emitted.push(1));
    const upgradeChip = fixture.nativeElement.querySelector(
      "#tour-filter-upgrade-pro"
    ) as HTMLButtonElement;
    upgradeChip.click();
    expect(emitted).toEqual([1]);
  });

  it("shows Add Group for creators with no groups yet", () => {
    fixture.componentRef.setInput("canCreateGroups", true);
    fixture.componentInstance.groups = [];
    fixture.detectChanges();
    const addChip = fixture.nativeElement.querySelector(
      "#tour-filter-add-group"
    ) as HTMLButtonElement;
    expect(addChip).toBeTruthy();
    expect(addChip.textContent?.replace(/\s+/g, " ").trim()).toBe("Add Group");
  });

  it("shows Add Group for creators once a group exists", () => {
    fixture.componentRef.setInput("canCreateGroups", true);
    fixture.detectChanges();
    const addChip = fixture.nativeElement.querySelector(
      "#tour-filter-add-group"
    ) as HTMLButtonElement;
    expect(addChip.textContent?.replace(/\s+/g, " ").trim()).toBe("Add Group");
  });

  it("emits addGroup when the add chip is clicked", () => {
    fixture.componentRef.setInput("canCreateGroups", true);
    fixture.detectChanges();
    const emitted: number[] = [];
    fixture.componentInstance.addGroup.subscribe(() => emitted.push(1));
    const addChip = fixture.nativeElement.querySelector(
      "#tour-filter-add-group"
    ) as HTMLButtonElement;
    addChip.click();
    expect(emitted).toEqual([1]);
  });

  it("shows overflow menu for owned groups", () => {
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="card-actions-overflow-trigger"]'
      )
    ).toBeTruthy();
  });

  it("includes manage members in overflow items for owners", () => {
    const items = fixture.componentInstance.overflowItems(familyGroup);
    expect(items.map((item) => item.id)).toEqual(["members", "edit", "delete"]);
  });

  it("uses the Groups tab slate fill instead of Public blue", () => {
    const panel = fixture.nativeElement.querySelector(
      ".rounded-b-lg"
    ) as HTMLElement;
    expect(panel.className).toContain("bg-slate-200");
    expect(panel.className).toContain("border-[#0047AB]");
    expect(panel.className).not.toContain("bg-blue-200");
  });

  it("wraps group chips with the same flex host as Personal categories", () => {
    const host = fixture.nativeElement.querySelector(
      "#tour-filter-group-g1"
    )?.parentElement?.parentElement as HTMLElement;
    expect(host.className).toContain(
      HOME_WRAP_FILTER_CHIP_FLEX_CLASS.split(" ")[0]
    );
    expect(host.className).toContain("flex-[1_1_0]");
  });
});
