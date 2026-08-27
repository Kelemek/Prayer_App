import { describe, it, expect, vi, beforeEach } from "vitest";
import { HomeAdminNavigationController } from "./home-admin-navigation.controller";

describe("HomeAdminNavigationController", () => {
  const router = { navigate: vi.fn() };
  const toastService = { error: vi.fn() };
  const connectivity = { requireOnline: vi.fn(() => true) };
  const tenantPermissionService = { canAccessAdmin: vi.fn(() => true) };
  const tenantContextService = { getMemberships: vi.fn(() => []) };
  let userSessionService: { getUserEmail: ReturnType<typeof vi.fn> };
  let controller: HomeAdminNavigationController;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    userSessionService = { getUserEmail: vi.fn(() => null) };
    controller = new HomeAdminNavigationController(
      router as any,
      toastService as any,
      userSessionService as any,
      tenantPermissionService as any,
      tenantContextService as any,
      connectivity as any
    );
  });

  it("getUserEmail prefers cached session email", () => {
    userSessionService.getUserEmail.mockReturnValue("cached@example.com");
    expect(controller.getUserEmail()).toBe("cached@example.com");
  });

  it("getUserEmail falls back through localStorage keys", () => {
    localStorage.setItem("approvalAdminEmail", "a@b.com");
    expect(controller.getUserEmail()).toBe("a@b.com");
  });

  it("navigateToAdmin goes to admin when online and permitted", () => {
    controller.navigateToAdmin();
    expect(router.navigate).toHaveBeenCalledWith(["/admin"]);
  });

  it("navigateToAdmin shows error when offline", () => {
    connectivity.requireOnline.mockReturnValue(false);
    controller.navigateToAdmin();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
