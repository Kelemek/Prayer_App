import { describe, it, expect } from "vitest";
import {
  homeHasSubFilterRowBelowTabs,
  isCommunityPrayerFilter,
  isGroupsAreaFilter,
  isPublicAreaFilter,
  isPublicTabFilter,
} from "./home-community-filter";

describe("isCommunityPrayerFilter", () => {
  it("returns true for community prayer filters", () => {
    expect(isCommunityPrayerFilter("current")).toBe(true);
    expect(isCommunityPrayerFilter("answered")).toBe(true);
    expect(isCommunityPrayerFilter("archived")).toBe(true);
    expect(isCommunityPrayerFilter("total")).toBe(true);
  });

  it("returns false for other home filters", () => {
    expect(isCommunityPrayerFilter("prompts")).toBe(false);
    expect(isCommunityPrayerFilter("personal")).toBe(false);
    expect(isCommunityPrayerFilter("memorize")).toBe(false);
    expect(isCommunityPrayerFilter("groups")).toBe(false);
  });
});

describe("isPublicTabFilter", () => {
  it("returns true for community prayer filters", () => {
    expect(isPublicTabFilter("current")).toBe(true);
    expect(isPublicTabFilter("answered")).toBe(true);
    expect(isPublicTabFilter("archived")).toBe(true);
    expect(isPublicTabFilter("total")).toBe(true);
  });

  it("returns false for other home filters", () => {
    expect(isPublicTabFilter("prompts")).toBe(false);
    expect(isPublicTabFilter("personal")).toBe(false);
    expect(isPublicTabFilter("memorize")).toBe(false);
    expect(isPublicTabFilter("groups")).toBe(false);
  });
});

describe("isPublicAreaFilter", () => {
  it("returns true for community prayer filters and prompts", () => {
    expect(isPublicAreaFilter("current")).toBe(true);
    expect(isPublicAreaFilter("answered")).toBe(true);
    expect(isPublicAreaFilter("archived")).toBe(true);
    expect(isPublicAreaFilter("total")).toBe(true);
    expect(isPublicAreaFilter("prompts")).toBe(true);
  });

  it("returns false for other home filters", () => {
    expect(isPublicAreaFilter("personal")).toBe(false);
    expect(isPublicAreaFilter("memorize")).toBe(false);
    expect(isPublicAreaFilter("groups")).toBe(false);
  });
});

describe("isGroupsAreaFilter", () => {
  it("returns true only for the groups tab", () => {
    expect(isGroupsAreaFilter("groups")).toBe(true);
    expect(isGroupsAreaFilter("personal")).toBe(false);
    expect(isGroupsAreaFilter("current")).toBe(false);
  });
});

describe("homeHasSubFilterRowBelowTabs", () => {
  it("returns true when a sub-filter row renders under the main tabs", () => {
    expect(homeHasSubFilterRowBelowTabs("current")).toBe(true);
    expect(homeHasSubFilterRowBelowTabs("answered")).toBe(true);
    expect(homeHasSubFilterRowBelowTabs("archived")).toBe(true);
    expect(homeHasSubFilterRowBelowTabs("total")).toBe(true);
    expect(homeHasSubFilterRowBelowTabs("prompts")).toBe(true);
    expect(homeHasSubFilterRowBelowTabs("personal")).toBe(true);
    expect(homeHasSubFilterRowBelowTabs("memorize")).toBe(true);
    expect(homeHasSubFilterRowBelowTabs("groups")).toBe(true);
  });
});
