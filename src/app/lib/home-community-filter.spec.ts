import { describe, it, expect } from "vitest";
import {
  homeHasSubFilterRowBelowTabs,
  isAllowedHomeFilterWithoutSharedAccess,
  isChurchDemoFilter,
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

describe("isChurchDemoFilter", () => {
  it("returns true for every Church chip view, including Archived and Prompts", () => {
    expect(isChurchDemoFilter("current")).toBe(true);
    expect(isChurchDemoFilter("answered")).toBe(true);
    expect(isChurchDemoFilter("total")).toBe(true);
    expect(isChurchDemoFilter("archived")).toBe(true);
    expect(isChurchDemoFilter("prompts")).toBe(true);
  });

  it("returns false for other tabs", () => {
    expect(isChurchDemoFilter("personal")).toBe(false);
    expect(isChurchDemoFilter("groups")).toBe(false);
    expect(isChurchDemoFilter("memorize")).toBe(false);
  });
});

describe("isAllowedHomeFilterWithoutSharedAccess", () => {
  it("allows Church demo chips plus Personal, Groups, and Memorize", () => {
    expect(isAllowedHomeFilterWithoutSharedAccess("current")).toBe(true);
    expect(isAllowedHomeFilterWithoutSharedAccess("answered")).toBe(true);
    expect(isAllowedHomeFilterWithoutSharedAccess("total")).toBe(true);
    expect(isAllowedHomeFilterWithoutSharedAccess("archived")).toBe(true);
    expect(isAllowedHomeFilterWithoutSharedAccess("prompts")).toBe(true);
    expect(isAllowedHomeFilterWithoutSharedAccess("personal")).toBe(true);
    expect(isAllowedHomeFilterWithoutSharedAccess("groups")).toBe(true);
    expect(isAllowedHomeFilterWithoutSharedAccess("memorize")).toBe(true);
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
