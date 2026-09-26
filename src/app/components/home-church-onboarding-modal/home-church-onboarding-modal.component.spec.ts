import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ɵresolveComponentResources as resolveComponentResources } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HomeChurchOnboardingModalComponent } from "./home-church-onboarding-modal.component";
import { TenantManagementService } from "../../services/tenant-management.service";
import { TenantContextService } from "../../services/tenant-context.service";
import { ToastService } from "../../services/toast.service";

const switchTenantWithNavigation = vi.fn();

vi.mock("../../lib/tenant-navigation", () => ({
  switchTenantWithNavigation: (...args: unknown[]) =>
    switchTenantWithNavigation(...args),
}));

const componentDir = dirname(fileURLToPath(import.meta.url));

function readComponentResource(url: string): string {
  const path = join(componentDir, url);
  if (existsSync(path)) {
    return readFileSync(path, "utf-8");
  }
  throw new Error(`Component resource not found: ${url}`);
}

describe("HomeChurchOnboardingModalComponent", () => {
  beforeAll(async () => {
    await resolveComponentResources((url) =>
      Promise.resolve(readComponentResource(url))
    );
  });

  let fixture: ComponentFixture<HomeChurchOnboardingModalComponent>;
  let createTenant: ReturnType<typeof vi.fn>;
  let claimInvite: ReturnType<typeof vi.fn>;
  let switchTenant: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    switchTenantWithNavigation.mockReset();
    switchTenantWithNavigation.mockResolvedValue("switched");
    createTenant = vi.fn();
    claimInvite = vi.fn().mockResolvedValue("tenant-join");
    switchTenant = vi.fn().mockResolvedValue(true);
    toastSuccess = vi.fn();
    toastError = vi.fn();

    await TestBed.configureTestingModule({
      imports: [HomeChurchOnboardingModalComponent],
      providers: [
        { provide: TenantManagementService, useValue: { createTenant, claimInvite } },
        {
          provide: TenantContextService,
          useValue: {
            switchTenant,
            getAvailableTenants: vi.fn(() => [
              {
                id: "tenant-join",
                name: "Joined Church",
                slug: "joined-church",
                plan_tier: "churches",
                plan_status: "active",
              },
            ]),
          },
        },
        { provide: ToastService, useValue: { success: toastSuccess, error: toastError } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeChurchOnboardingModalComponent);
    fixture.componentRef.setInput("isOpen", true);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it("shows tour and join choices without create-church purchase copy", () => {
    expect(document.body.textContent).toContain("Connect to a church");
    expect(document.body.textContent).toContain("See Church features");
    expect(document.body.textContent).toContain("Join a church");
    expect(document.body.textContent).not.toContain("Create a church");
    expect(document.body.textContent).not.toMatch(/\$|Buy|Checkout/i);
  });

  it("emits startChurchTour and does not create a tenant", () => {
    const tourSpy = vi.spyOn(fixture.componentInstance.startChurchTour, "emit");
    fixture.componentInstance.onSeeChurchFeatures();
    expect(tourSpy).toHaveBeenCalled();
    expect(createTenant).not.toHaveBeenCalled();
  });

  it("does not claim when first or last name is missing", async () => {
    fixture.componentInstance.showJoin();
    fixture.componentInstance.inviteToken = "token-abc";
    fixture.componentInstance.firstName = "Pat";
    await fixture.componentInstance.submitJoin();
    expect(claimInvite).not.toHaveBeenCalled();
    expect(fixture.componentInstance.submitting).toBe(false);
  });

  it("claims an invite token and switches tenant", async () => {
    const completedSpy = vi.spyOn(fixture.componentInstance.completed, "emit");
    fixture.componentInstance.showJoin();
    fixture.componentInstance.inviteToken = " token-abc ";
    fixture.componentInstance.firstName = "Pat";
    fixture.componentInstance.lastName = "Lee";
    await fixture.componentInstance.submitJoin();
    expect(claimInvite).toHaveBeenCalledWith("token-abc", "Pat Lee");
    expect(switchTenantWithNavigation).toHaveBeenCalled();
    expect(completedSpy).toHaveBeenCalled();
  });

  it("navigates to subdomain without toast when navigation starts", async () => {
    switchTenantWithNavigation.mockResolvedValue("navigated");
    const completedSpy = vi.spyOn(fixture.componentInstance.completed, "emit");
    fixture.componentInstance.showJoin();
    fixture.componentInstance.inviteToken = "token-abc";
    fixture.componentInstance.firstName = "Pat";
    fixture.componentInstance.lastName = "Lee";
    await fixture.componentInstance.submitJoin();
    expect(completedSpy).toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("shows join title and blocks chooser while submitting", async () => {
    fixture.componentInstance.showJoin();
    expect(fixture.componentInstance.title).toBe("Join a church");
    fixture.componentInstance.submitting = true;
    fixture.componentInstance.showChooser();
    expect(fixture.componentInstance.view).toBe("join");
  });

  it("resets form when reopened and surfaces join errors", async () => {
    claimInvite.mockRejectedValueOnce(new Error("bad token"));
    fixture.componentInstance.showJoin();
    fixture.componentInstance.inviteToken = "x";
    fixture.componentInstance.firstName = "Pat";
    fixture.componentInstance.lastName = "Lee";
    await fixture.componentInstance.submitJoin();
    expect(toastError).toHaveBeenCalledWith("bad token");
    expect(fixture.componentInstance.submitting).toBe(false);

    fixture.componentRef.setInput("isOpen", false);
    fixture.detectChanges();
    fixture.componentRef.setInput("isOpen", true);
    fixture.detectChanges();
    expect(fixture.componentInstance.view).toBe("chooser");
    expect(fixture.componentInstance.inviteToken).toBe("");
  });

  it("closes from the header close button", () => {
    const closeSpy = vi.spyOn(fixture.componentInstance.close, "emit");
    const closeButton = document.body.querySelector(
      'button[aria-label="Close"]'
    ) as HTMLButtonElement;
    closeButton.click();
    expect(closeSpy).toHaveBeenCalled();
  });
});
