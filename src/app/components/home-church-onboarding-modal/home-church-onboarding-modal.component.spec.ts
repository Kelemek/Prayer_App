import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ɵresolveComponentResources as resolveComponentResources } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HomeChurchOnboardingModalComponent } from "./home-church-onboarding-modal.component";
import { TenantManagementService } from "../../services/tenant-management.service";
import { TenantContextService } from "../../services/tenant-context.service";
import { ChurchCheckoutService } from "../../services/church-checkout.service";
import { ToastService } from "../../services/toast.service";

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
  let startChurchCheckout: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    createTenant = vi.fn().mockResolvedValue({
      id: "tenant-new",
      name: "New Church",
      slug: "new-church",
      plan_tier: "churches",
      plan_status: "active",
    });
    claimInvite = vi.fn().mockResolvedValue("tenant-join");
    switchTenant = vi.fn().mockResolvedValue(true);
    startChurchCheckout = vi.fn().mockResolvedValue(null);
    toastSuccess = vi.fn();
    toastError = vi.fn();

    await TestBed.configureTestingModule({
      imports: [HomeChurchOnboardingModalComponent],
      providers: [
        { provide: TenantManagementService, useValue: { createTenant, claimInvite } },
        { provide: TenantContextService, useValue: { switchTenant } },
        { provide: ChurchCheckoutService, useValue: { startChurchCheckout } },
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

  it("shows create and join choices", () => {
    expect(fixture.nativeElement.textContent).toContain("Connect to a church");
    expect(fixture.nativeElement.textContent).toContain("Create a church");
    expect(fixture.nativeElement.textContent).toContain("Join a church");
  });

  it("suggests a slug from the church name", () => {
    fixture.componentInstance.showCreate();
    fixture.detectChanges();
    fixture.componentInstance.onNameInput("Cross Pointe");
    expect(fixture.componentInstance.slugDraft).toBe("cross-pointe");
  });

  it("creates a churches tenant and emits completed", async () => {
    const completedSpy = vi.spyOn(fixture.componentInstance.completed, "emit");
    fixture.componentInstance.showCreate();
    fixture.componentInstance.onNameInput("New Church");
    await fixture.componentInstance.submitCreate();
    expect(createTenant).toHaveBeenCalledWith("New Church", "new-church", "churches");
    expect(switchTenant).toHaveBeenCalledWith("tenant-new");
    expect(startChurchCheckout).toHaveBeenCalledWith("tenant-new");
    expect(toastSuccess).toHaveBeenCalled();
    expect(completedSpy).toHaveBeenCalled();
  });

  it("claims an invite token and switches tenant", async () => {
    const completedSpy = vi.spyOn(fixture.componentInstance.completed, "emit");
    fixture.componentInstance.showJoin();
    fixture.componentInstance.inviteToken = " token-abc ";
    await fixture.componentInstance.submitJoin();
    expect(claimInvite).toHaveBeenCalledWith("token-abc");
    expect(switchTenant).toHaveBeenCalledWith("tenant-join");
    expect(completedSpy).toHaveBeenCalled();
  });

  it("closes from the header close button", () => {
    const closeSpy = vi.spyOn(fixture.componentInstance.close, "emit");
    const closeButton = fixture.nativeElement.querySelector(
      'button[aria-label="Close"]'
    ) as HTMLButtonElement;
    closeButton.click();
    expect(closeSpy).toHaveBeenCalled();
  });
});
