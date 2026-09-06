import { describe, it, expect } from "vitest";
import {
  namedPersonalCategoryNamesFromEntities,
  namedPersonalCategoryNamesFromPrayers,
  namedPersonalCategoryChipNames,
  personalCategoryNamesFromEntities,
  personalCategoryNamesFromPrayers,
} from "./personal-category-order";

describe("personalCategoryNamesFromPrayers", () => {
  it("returns unique category names in first-seen order", () => {
    const names = personalCategoryNamesFromPrayers([
      { category: "Members" },
      { category: "Leaders" },
      { category: "Members" },
    ]);
    expect(names).toEqual(["Members", "Leaders"]);
  });

  it("excludes Answered from named chip list", () => {
    const names = namedPersonalCategoryNamesFromPrayers([
      { category: "Answered" },
      { category: "Health" },
    ]);
    expect(names).toEqual(["Health"]);
  });
});

describe("personalCategoryNamesFromEntities", () => {
  it("sorts by display_order then name", () => {
    const names = personalCategoryNamesFromEntities([
      { name: "Members", display_order: 1 },
      { name: "Leaders", display_order: 0 },
    ]);
    expect(names).toEqual(["Leaders", "Members"]);
  });

  it("excludes Answered from named chip list", () => {
    const names = namedPersonalCategoryNamesFromEntities([
      { name: "Answered", display_order: 0 },
      { name: "Health", display_order: 1 },
    ]);
    expect(names).toEqual(["Health"]);
  });

  it("falls back to prayer names when the entity list is empty", () => {
    const names = namedPersonalCategoryChipNames(
      [],
      [{ category: "test2" }, { category: "test" }, { category: "test" }]
    );
    expect(names).toEqual(["test2", "test"]);
  });
});
