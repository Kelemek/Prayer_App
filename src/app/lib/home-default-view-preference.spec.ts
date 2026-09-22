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
    expect(parseHomeDefaultPrayerView("memorize")).toBe("memorize");
    expect(parseHomeDefaultPrayerView("unknown")).toBe("current");
    expect(parseHomeDefaultPrayerView(null)).toBe("current");
  });

  it("labels church, group, and personal views", () => {
    expect(homeDefaultPrayerViewLabel("current")).toBe("Church");
    expect(homeDefaultPrayerViewLabel("groups")).toBe("Groups");
    expect(homeDefaultPrayerViewLabel("personal")).toBe("Personal");
    expect(homeDefaultPrayerViewLabel("memorize")).toBe("Memorize");
  });

  it("describes the view shown after login", () => {
    expect(homeDefaultPrayerViewDescription("current")).toBe(
      "You will see church prayers when you log in"
    );
    expect(homeDefaultPrayerViewDescription("groups")).toBe(
      "You will see group prayers when you log in"
    );
  });

  it("keeps a saved personal preference when church access is unavailable", () => {
    expect(
      resolveHomeFilterForDefaultView("personal", {
        canAccessShared: false,
        canAccessGroupsTab: true,
      })
    ).toBe("personal");
  });

  it("opens church when that is the saved preference even without church access", () => {
    expect(
      resolveHomeFilterForDefaultView("current", {
        canAccessShared: false,
        canAccessGroupsTab: true,
      })
    ).toBe("current");
  });

  it("opens groups when that is the saved preference", () => {
    expect(
      resolveHomeFilterForDefaultView("groups", {
        canAccessShared: true,
        canAccessGroupsTab: true,
      })
    ).toBe("groups");
  });

  it("opens memorization when that is the saved preference", () => {
    expect(
      resolveHomeFilterForDefaultView("memorize", {
        canAccessShared: true,
        canAccessGroupsTab: true,
      })
    ).toBe("memorize");
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
