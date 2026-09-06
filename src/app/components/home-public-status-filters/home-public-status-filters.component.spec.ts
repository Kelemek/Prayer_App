import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ɵresolveComponentResources as resolveComponentResources } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { of } from "rxjs";
import { BadgeService } from "../../services/badge.service";
import { HomePublicStatusFiltersComponent } from "./home-public-status-filters.component";

const componentDir = dirname(fileURLToPath(import.meta.url));

function readComponentResource(url: string): string {
  const path = join(componentDir, url);
  if (existsSync(path)) {
    return readFileSync(path, "utf-8");
  }
  throw new Error(`Component resource not found: ${url}`);
}

describe("HomePublicStatusFiltersComponent", () => {
  beforeAll(async () => {
    await resolveComponentResources((url) =>
      Promise.resolve(readComponentResource(url))
    );
  });

  let fixture: ComponentFixture<HomePublicStatusFiltersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePublicStatusFiltersComponent],
    })
      .overrideProvider(BadgeService, {
        useValue: {
          getBadgeFunctionalityEnabled$: () => of(false),
          markAllAsReadByStatus: vi.fn(),
          markAllAsRead: vi.fn(),
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(HomePublicStatusFiltersComponent);
    fixture.componentInstance.activeFilter = "current";
    fixture.componentInstance.currentPrayersCount = 4;
    fixture.componentInstance.answeredPrayersCount = 3;
    fixture.componentInstance.archivedPrayersCount = 15;
    fixture.componentInstance.totalPrayersCount = 22;
    fixture.componentInstance.promptsCount = 12;
    fixture.componentInstance.currentPrayerBadge$ = of(0);
    fixture.componentInstance.answeredPrayerBadge$ = of(0);
    fixture.componentInstance.promptBadge$ = of(0);
    fixture.componentRef.setInput("canAccessShared", true);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it("puts Add, Current, Answered, and Archived on the first status row", () => {
    const panel = fixture.nativeElement.querySelector(
      ".rounded-b-lg, .rounded-b-none"
    ) as HTMLElement;
    const rows = panel.querySelectorAll(":scope > div");
    expect(rows).toHaveLength(2);
    expect(rows[1]!.className).toContain("mt-2");

    const firstRowIds = [...rows[0]!.querySelectorAll("button")].map(
      (button) => button.id
    );
    const secondRowIds = [...rows[1]!.querySelectorAll("button")].map(
      (button) => button.id
    );
    expect(firstRowIds).toEqual([
      "tour-filter-add-church",
      "tour-filter-current",
      "tour-filter-answered",
      "tour-filter-archived",
    ]);
    expect(secondRowIds).toEqual([
      "tour-filter-total",
      "tour-filter-prompts",
    ]);
  });

  it("still shows Archived and Prompts when shared access is off", () => {
    fixture.componentRef.setInput("canAccessShared", false);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector("#tour-filter-add-church")
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector("#tour-filter-archived")
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector("#tour-filter-prompts")
    ).toBeTruthy();
  });

  it("emits addChurch when the Add chip is clicked", () => {
    const emitSpy = vi.spyOn(fixture.componentInstance.addChurch, "emit");

    const addChip = fixture.nativeElement.querySelector(
      "#tour-filter-add-church"
    ) as HTMLButtonElement;
    addChip.click();

    expect(emitSpy).toHaveBeenCalled();
  });

  it("emits prompts when the Prompts chip is clicked", () => {
    const emitted: string[] = [];
    fixture.componentInstance.selectFilter.subscribe((value) =>
      emitted.push(value)
    );

    const promptsChip = fixture.nativeElement.querySelector(
      "#tour-filter-prompts"
    ) as HTMLButtonElement;
    promptsChip.click();

    expect(emitted).toEqual(["prompts"]);
  });

  it("removes bottom rounding when prompts panel is expanded", () => {
    fixture.componentRef.setInput("promptsPanelExpanded", true);
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector(
      ".rounded-b-none"
    ) as HTMLElement;
    expect(row).toBeTruthy();
  });
});
