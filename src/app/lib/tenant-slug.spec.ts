import { describe, it, expect } from "vitest";
import {
  RESERVED_TENANT_SLUGS,
  isAllowedTenantSlug,
  normalizeTenantSlug,
  suggestTenantSlugFromName,
  validateTenantSlug,
} from "./tenant-slug";

describe("tenant slug helpers", () => {
  it("normalizes whitespace, case, and punctuation", () => {
    expect(normalizeTenantSlug("  Cross Pointe!! ")).toBe("cross-pointe");
  });

  it("suggests a slug from a church name", () => {
    expect(suggestTenantSlugFromName("Cross Pointe Church")).toBe(
      "cross-pointe-church"
    );
  });

  it("includes P0 reserved slugs", () => {
    for (const slug of [
      "www",
      "app",
      "api",
      "admin",
      "mail",
      "prayer",
    ]) {
      expect(RESERVED_TENANT_SLUGS.has(slug)).toBe(true);
      expect(isAllowedTenantSlug(slug)).toBe(false);
    }
  });

  it("rejects invalid DNS labels", () => {
    expect(validateTenantSlug("-bad-")).toMatch(/DNS-safe/i);
    expect(isAllowedTenantSlug("cross-pointe")).toBe(true);
  });
});
