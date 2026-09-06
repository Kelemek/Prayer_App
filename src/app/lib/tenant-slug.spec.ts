import { describe, it, expect } from "vitest";
import { normalizeTenantSlug, suggestTenantSlugFromName } from "./tenant-slug";

describe("tenant slug helpers", () => {
  it("normalizes whitespace, case, and punctuation", () => {
    expect(normalizeTenantSlug("  Cross Pointe!! ")).toBe("cross-pointe");
  });

  it("suggests a slug from a church name", () => {
    expect(suggestTenantSlugFromName("Cross Pointe Church")).toBe(
      "cross-pointe-church"
    );
  });
});
