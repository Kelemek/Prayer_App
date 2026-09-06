import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ɵresolveComponentResources as resolveComponentResources } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";
import {
  HOME_SUB_FILTER_CHIP_DRAG_STRETCH_CLASS,
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
  let groupPrayerCounts$: BehaviorSubject<ReadonlyMap<string, number>>;

  beforeEach(async () => {
    groupPrayerCounts$ = new BehaviorSubject<ReadonlyMap<string, number>>(
      new Map([["g1", 3]])
    );

    await TestBed.configureTestingModule({
      imports: [HomeGroupFiltersComponent],
    })
      .overrideProvider(PrayerGroupService, {
        useValue: {
          renameGroup: vi.fn().mockResolvedValue(true),
          deleteGroup: vi.fn().mockResolvedValue(true),
          reorderGroups: vi.fn().mockResolvedValue(true),
          groupPrayerCounts$,
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(HomeGroupFiltersComponent);
    fixture.componentInstance.groups = [familyGroup];
    fixture.componentInstance.selectedGroupId = "g1";
    fixture.componentInstance.filterMode = "named";
    fixture.componentInstance.currentCount = 2;
    fixture.componentInstance.answeredCount = 1;
    fixture.componentInstance.totalCount = 3;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it("shows the prayer count on each group chip", () => {
    const chip = fixture.nativeElement.querySelector(
      "#tour-filter-group-g1"
    ) as HTMLButtonElement;
    expect(chip.textContent?.replace(/\s+/g, " ").trim()).toBe("Family (3)");
  });

  it("shows status filter chips with counts on the first row", () => {
    const current = fixture.nativeElement.querySelector(
      "#tour-filter-groups-current"
    ) as HTMLButtonElement;
    const answered = fixture.nativeElement.querySelector(
      "#tour-filter-groups-answered"
    ) as HTMLButtonElement;
    const total = fixture.nativeElement.querySelector(
      "#tour-filter-groups-total"
    ) as HTMLButtonElement;
    expect(current.textContent?.replace(/\s+/g, " ").trim()).toBe("Current (2)");
    expect(answered.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "Answered (1)"
    );
    expect(total.textContent?.replace(/\s+/g, " ").trim()).toBe("Total (3)");
  });

  it("keeps Add on the status row and group chips on a following drop list", () => {
    fixture.componentRef.setInput("canCreateGroups", true);
    fixture.detectChanges();
    const addChip = fixture.nativeElement.querySelector(
      "#tour-filter-add-group"
    ) as HTMLElement;
    const dropList = fixture.nativeElement.querySelector(
      ".cdk-drop-list"
    ) as HTMLElement;
    expect(addChip).toBeTruthy();
    expect(dropList.contains(addChip)).toBe(false);
    expect(
      dropList.querySelector("[data-group-filter-chip='g1']")
    ).toBeTruthy();
  });

  it("keeps status chips on one equal-share row without wrap hosts", () => {
    fixture.componentRef.setInput("canCreateGroups", true);
    fixture.detectChanges();
    const currentHost = fixture.nativeElement.querySelector(
      "#tour-filter-groups-current"
    )?.parentElement as HTMLElement;
    const answeredHost = fixture.nativeElement.querySelector(
      "#tour-filter-groups-answered"
    )?.parentElement as HTMLElement;
    const totalHost = fixture.nativeElement.querySelector(
      "#tour-filter-groups-total"
    )?.parentElement as HTMLElement;
    const addHost = fixture.nativeElement.querySelector(
      "#tour-filter-add-group"
    )?.parentElement as HTMLElement;

    expect(currentHost.parentElement).toBe(answeredHost.parentElement);
    expect(currentHost.parentElement).toBe(totalHost.parentElement);
    expect(currentHost.parentElement).toBe(addHost.parentElement);
    expect(currentHost.classList.contains("flex-1")).toBe(true);
    expect(answeredHost.classList.contains("flex-1")).toBe(true);
    expect(totalHost.classList.contains("flex-1")).toBe(true);
    expect(addHost.classList.contains("flex-1")).toBe(false);
    expect(currentHost.className).not.toContain("flex-[1_1_0]");
  });

  it("emits selectFilterMode when Current is clicked", () => {
    const emitted: string[] = [];
    fixture.componentInstance.selectFilterMode.subscribe((mode) =>
      emitted.push(mode)
    );
    (
      fixture.nativeElement.querySelector(
        "#tour-filter-groups-current"
      ) as HTMLButtonElement
    ).click();
    expect(emitted).toEqual(["current"]);
  });

  it("emits total when the active group chip is toggled off", () => {
    const emitted: string[] = [];
    fixture.componentInstance.selectFilterMode.subscribe((mode) =>
      emitted.push(mode)
    );
    (
      fixture.nativeElement.querySelector(
        "#tour-filter-group-g1"
      ) as HTMLButtonElement
    ).click();
    expect(emitted).toEqual(["total"]);
  });

  it("updates the prayer count when groupPrayerCounts$ emits", () => {
    groupPrayerCounts$.next(new Map([["g1", 5]]));
    fixture.detectChanges();
    const chip = fixture.nativeElement.querySelector(
      "#tour-filter-group-g1"
    ) as HTMLButtonElement;
    expect(chip.textContent?.replace(/\s+/g, " ").trim()).toBe("Family (5)");
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

  it("shows Add when at group cap on free tier", () => {
    fixture.componentRef.setInput("canCreateGroups", false);
    fixture.componentRef.setInput("showProUpgrade", true);
    fixture.detectChanges();
    const addChip = fixture.nativeElement.querySelector(
      "#tour-filter-add-group"
    ) as HTMLButtonElement;
    expect(addChip).toBeTruthy();
    expect(addChip.textContent?.replace(/\s+/g, " ").trim()).toBe("Add");
    expect(
      fixture.nativeElement.querySelector("#tour-filter-upgrade-pro")
    ).toBeNull();
  });

  it("opens an upgrade modal when Add is clicked at the free group cap", () => {
    fixture.componentRef.setInput("canCreateGroups", false);
    fixture.componentRef.setInput("showProUpgrade", true);
    fixture.componentRef.setInput("maxGroupsOwned", 1);
    fixture.detectChanges();
    const emitted: number[] = [];
    fixture.componentInstance.upgradePro.subscribe(() => emitted.push(1));
    (
      fixture.nativeElement.querySelector(
        "#tour-filter-add-group"
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.showProUpgradeModal).toBe(true);
    expect(fixture.nativeElement.textContent).toContain("Group limit reached");
    expect(fixture.nativeElement.textContent).toContain(
      "You've reached your free plan limit of 1 group."
    );
    expect(emitted).toEqual([]);
    fixture.componentInstance.confirmProUpgrade();
    expect(emitted).toEqual([1]);
    expect(fixture.componentInstance.showProUpgradeModal).toBe(false);
  });

  it("shows Add for creators with no groups yet", () => {
    fixture.componentRef.setInput("canCreateGroups", true);
    fixture.componentInstance.groups = [];
    fixture.detectChanges();
    const addChip = fixture.nativeElement.querySelector(
      "#tour-filter-add-group"
    ) as HTMLButtonElement;
    expect(addChip).toBeTruthy();
    expect(addChip.textContent?.replace(/\s+/g, " ").trim()).toBe("Add");
  });

  it("shows Add for creators once a group exists", () => {
    fixture.componentRef.setInput("canCreateGroups", true);
    fixture.detectChanges();
    const addChip = fixture.nativeElement.querySelector(
      "#tour-filter-add-group"
    ) as HTMLButtonElement;
    expect(addChip.textContent?.replace(/\s+/g, " ").trim()).toBe("Add");
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

  it("wraps group chips with the equal-width flex host", () => {
    const host = fixture.nativeElement.querySelector(
      "[data-group-filter-chip='g1']"
    ) as HTMLElement;
    expect(host.className).toContain(
      HOME_WRAP_FILTER_CHIP_FLEX_CLASS.split(" ")[0]
    );
    expect(host.className).toContain("flex-[1_1_0]");
  });

  it("uses a real flex drop list container for drag reorder", () => {
    const dropList = fixture.nativeElement.querySelector(
      ".cdk-drop-list"
    ) as HTMLElement;
    expect(dropList).toBeTruthy();
    expect(dropList.className).toContain("flex");
    expect(dropList.className).toContain("flex-wrap");
    expect(dropList.className).not.toContain("contents");
  });

  it("shows a drag handle on group chips", () => {
    const handle = fixture.nativeElement.querySelector(
      "[data-group-filter-drag-handle]"
    );
    expect(handle).toBeTruthy();
  });

  it("calls reorderGroups when a group chip is dropped", async () => {
    const reorderGroups = vi.fn().mockResolvedValue(true);
    const prayerGroupService = TestBed.inject(PrayerGroupService) as {
      reorderGroups: ReturnType<typeof vi.fn>;
    };
    prayerGroupService.reorderGroups = reorderGroups;

    fixture.componentInstance.groups = [
      familyGroup,
      {
        ...familyGroup,
        id: "g2",
        name: "Friends",
      },
    ];
    fixture.detectChanges();

    await fixture.componentInstance.onGroupDrop({
      previousIndex: 0,
      currentIndex: 1,
    } as any);

    expect(reorderGroups).toHaveBeenCalledWith(["g2", "g1"]);
  });

  it("uses the drag-stretch chip shell for group chips", () => {
    const shell = fixture.nativeElement.querySelector(
      "[data-group-filter-chip='g1'] > div"
    ) as HTMLElement;
    expect(shell.className).toContain(
      HOME_SUB_FILTER_CHIP_DRAG_STRETCH_CLASS.split(" ")[0]
    );
  });
});
