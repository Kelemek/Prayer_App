import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ɵresolveComponentResources as resolveComponentResources } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { HomeChurchOnboardingModalComponent } from "./home-church-onboarding-modal.component";
import { TenantAccessService } from "../../services/tenant-access.service";
import { ToastService } from "../../services/toast.service";

vi.mock("../../lib/tenant-navigation", () => ({
  shouldNavigateToTenantSubdomain: vi.fn(() => false),
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
  let resolveTargetTenant: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    resolveTargetTenant = vi.fn();
    navigate = vi.fn().mockResolvedValue(true);
    toastError = vi.fn();

    await TestBed.configureTestingModule({
      imports: [HomeChurchOnboardingModalComponent],
      providers: [
        { provide: TenantAccessService, useValue: { resolveTargetTenant } },
        { provide: Router, useValue: { navigate } },
        { provide: ToastService, useValue: { show: toastError, error: toastError } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeChurchOnboardingModalComponent);
    fixture.componentRef.setInput("isOpen", true);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it("shows tour and join choices", () => {
    expect(document.body.textContent).toContain("ask to join a church");
    expect(document.body.textContent).toContain("Join a church");
  });

  it("navigates to request-access with church slug on localhost", async () => {
    resolveTargetTenant.mockResolvedValue({
      id: "tenant-1",
      name: "Joined",
      slug: "joined-church",
    });
    fixture.componentInstance.showJoin();
    fixture.componentInstance.churchAddress = "joined-church";
    await fixture.componentInstance.submitJoin();
    expect(navigate).toHaveBeenCalledWith(["/request-access"], {
      queryParams: { church: "joined-church" },
    });
  });
});
