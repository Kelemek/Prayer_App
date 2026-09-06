import { describe, it, expect } from "vitest";
import {
  countGroupPrayersByStatus,
  filterGroupPrayersForHome,
} from "./home-group-catalog";
import type { PrayerRequest } from "../services/prayer.service";

function prayer(
  overrides: Partial<PrayerRequest> & Pick<PrayerRequest, "id" | "status">
): PrayerRequest {
  return {
    title: "T",
    description: "D",
    prayer_for: "Someone",
    requester: "R",
    date_requested: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    updates: [],
    ...overrides,
  } as PrayerRequest;
}

describe("home-group-catalog", () => {
  const prayers = [
    prayer({ id: "c1", status: "current", group_id: "g1", title: "Alpha" }),
    prayer({ id: "a1", status: "answered", group_id: "g1", title: "Beta" }),
    prayer({ id: "c2", status: "current", group_id: "g2", title: "Gamma" }),
  ];

  it("counts current, answered, and total across groups", () => {
    expect(countGroupPrayersByStatus(prayers)).toEqual({
      current: 2,
      answered: 1,
      total: 3,
    });
  });

  it("filters current unanswered prayers from all groups", () => {
    expect(
      filterGroupPrayersForHome(prayers, {
        mode: "current",
        selectedGroupId: null,
      }).map((p) => p.id)
    ).toEqual(["c1", "c2"]);
  });

  it("filters answered prayers from all groups", () => {
    expect(
      filterGroupPrayersForHome(prayers, {
        mode: "answered",
        selectedGroupId: null,
      }).map((p) => p.id)
    ).toEqual(["a1"]);
  });

  it("returns all prayers for total", () => {
    expect(
      filterGroupPrayersForHome(prayers, {
        mode: "total",
        selectedGroupId: null,
      }).map((p) => p.id)
    ).toEqual(["c1", "a1", "c2"]);
  });

  it("filters named mode to one group including answered", () => {
    expect(
      filterGroupPrayersForHome(prayers, {
        mode: "named",
        selectedGroupId: "g1",
      }).map((p) => p.id)
    ).toEqual(["c1", "a1"]);
  });

  it("applies search across title and description", () => {
    expect(
      filterGroupPrayersForHome(prayers, {
        mode: "total",
        selectedGroupId: null,
        searchTerm: "gamma",
      }).map((p) => p.id)
    ).toEqual(["c2"]);
  });
});
