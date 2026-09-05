import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ɵresolveComponentResources as resolveComponentResources } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import {
  HOME_PERSONAL_SUB_FILTER_GROUP_CLASS,
  HOME_SUB_FILTER_CHIP_DRAG_STRETCH_CLASS,
  HOME_WRAP_FILTER_CHIP_FLEX_CLASS,
} from "../../lib/home-sub-filter-chip-classes";
import { HomePersonalCategoryFiltersComponent } from "./home-personal-category-filters.component";

const componentDir = dirname(fileURLToPath(import.meta.url));

function readComponentResource(url: string): string {
  const path = join(componentDir, url);
  if (existsSync(path)) {
    return readFileSync(path, "utf-8");
  }
  throw new Error(`Component resource not found: ${url}`);
}

describe("HomePersonalCategoryFiltersComponent", () => {
  beforeAll(async () => {
    await resolveComponentResources((url) =>
      Promise.resolve(readComponentResource(url))
    );
  });

  let fixture: ComponentFixture<HomePersonalCategoryFiltersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePersonalCategoryFiltersComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePersonalCategoryFiltersComponent);
    fixture.componentInstance.personalPrayersCount = 8;
    fixture.componentInstance.filterMode = "current";
    fixture.componentInstance.personalCategoryActiveClass = "active-class";
    fixture.componentInstance.uniqueCategories = ["Family", "Health"];
    fixture.componentInstance.isCategoryDropListDisabled = false;
    fixture.componentInstance.personalCurrentCount = 5;
    fixture.componentInstance.personalAnsweredCount = 2;
    fixture.componentInstance.isCategorySwapping = () => false;
    fixture.componentInstance.isPersonalCategorySelected = () => false;
    fixture.componentInstance.getCategoryCount = (category) =>
      category === "Family" ? 3 : 1;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it("wraps status and category filters in the Personal folder panel", () => {
    const group = fixture.nativeElement.querySelector(
      "#tour-personal-category-filters > div"
    ) as HTMLElement;
    for (const token of HOME_PERSONAL_SUB_FILTER_GROUP_CLASS.split(" ")) {
      expect(group.className).toContain(token);
    }
  });

  it("wraps each category filter with shared wrap-row host classes like prompt types", () => {
    const hosts = fixture.nativeElement.querySelectorAll(
      "[data-personal-category-chip]"
    );
    expect(hosts.length).toBe(2);
    for (const host of hosts) {
      expect(host.className).toContain(
        HOME_WRAP_FILTER_CHIP_FLEX_CLASS.split(" ")[0]
      );
    }
  });

  it("uses drag stretch button classes on category chips", () => {
    const chip = fixture.nativeElement.querySelector(
      "[data-personal-category-chip='Family']"
    ) as HTMLElement;
    const select = chip.querySelector(
      "[data-personal-category-select]"
    ) as HTMLButtonElement;
    expect(select.textContent).toContain("Family (3)");
    expect(chip.querySelector("div")?.className).toContain(
      HOME_SUB_FILTER_CHIP_DRAG_STRETCH_CLASS.split(" ")[0]
    );
  });

  it("shows an overflow menu with rename and delete on category chips", () => {
    expect(
      fixture.nativeElement.querySelectorAll(
        '[data-testid="card-actions-overflow-trigger"]'
      ).length
    ).toBe(2);
    const items = fixture.componentInstance.overflowItems("Family");
    expect(items.map((item) => item.id)).toEqual(["edit", "delete"]);
  });

  it("emits renameCategory from the overflow rename action", () => {
    const emitted: string[] = [];
    fixture.componentInstance.renameCategory.subscribe((category) =>
      emitted.push(category)
    );
    fixture.componentInstance.overflowItems("Health")[0]?.onSelect();
    expect(emitted).toEqual(["Health"]);
  });

  it("asks for confirmation before emitting deleteCategory", () => {
    const emitted: string[] = [];
    fixture.componentInstance.deleteCategory.subscribe((category) =>
      emitted.push(category)
    );
    fixture.componentInstance.overflowItems("Family")[1]?.onSelect();
    fixture.detectChanges();
    expect(fixture.componentInstance.pendingDeleteCategory).toBe("Family");
    expect(emitted).toEqual([]);
    fixture.componentInstance.confirmDelete();
    expect(emitted).toEqual(["Family"]);
    expect(fixture.componentInstance.pendingDeleteCategory).toBeNull();
  });
});
