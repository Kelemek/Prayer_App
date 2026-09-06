import { describe, expect, it } from "vitest";
import {
  homeDefaultPrayerViewDescription,
  homeDefaultPrayerViewLabel,
  parseHomeDefaultPrayerView,
  resolveHomeFilterForDefaultView,
} from "./home-default-view-preference";

describe("home default prayer view helpers", () => {
  it("parses stored values and falls back to church", () => {
    expect(parseHomeDefaultPrayerView("personal")).toBe("personal");
    expect(parseHomeDefaultPrayerView("groups")).toBe("groups");
    expect(parseHomeDefaultPrayerView("current")).toBe("current");
    expect(parseHomeDefaultPrayerView("unknown")).toBe("current");
    expect(parseHomeDefaultPrayerView(null)).toBe("current");
  });

  it("labels church, group, and personal views", () => {
    expect(homeDefaultPrayerViewLabel("current")).toBe("Church Prayers");
    expect(homeDefaultPrayerViewLabel("groups")).toBe("Group Prayers");
    expect(homeDefaultPrayerViewLabel("personal")).toBe("Personal Prayers");
  });

  it("describes the view shown after login", () => {
    expect(homeDefaultPrayerViewDescription("current")).toBe(
      "You will see church prayers when you log in"
    );
    expect(homeDefaultPrayerViewDescription("groups")).toBe(
      "You will see group prayers when you log in"
    );
  });

  it("keeps groups as the landing tab when church access is unavailable", () => {
    expect(
      resolveHomeFilterForDefaultView("personal", {
        canAccessShared: false,
        canAccessGroupsTab: true,
      })
    ).toBe("groups");
  });

  it("opens groups when that is the saved preference", () => {
    expect(
      resolveHomeFilterForDefaultView("groups", {
        canAccessShared: true,
        canAccessGroupsTab: true,
      })
    ).toBe("groups");
  });

  it("falls back to church when groups are not available", () => {
    expect(
      resolveHomeFilterForDefaultView("groups", {
        canAccessShared: true,
        canAccessGroupsTab: false,
      })
    ).toBe("current");
  });
});
