import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from "vitest";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { InfoFeatureOverviewComponent } from "../../components/info-feature-overview/info-feature-overview.component";
import { InfoPreviewModalsComponent } from "../../components/info-preview-modals/info-preview-modals.component";
import { provideRouter } from "@angular/router";
import { InfoComponent } from "./info.component";
import { setupInfoPreviewComponentResources } from "../../components/info-preview-component-resources.spec-helper";

describe("InfoComponent", () => {
  beforeAll(async () => {
    await setupInfoPreviewComponentResources();
  });

  let component: InfoComponent;
  let fixture: ComponentFixture<InfoComponent>;

  beforeEach(async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-color-scheme: dark)" ? false : true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    await TestBed.configureTestingModule({
      imports: [InfoComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(InfoComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.clearAllMocks();
    fixture?.destroy();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  function previewFilter(): string {
    return featureOverview().previewFilter;
  }

  function previewModals(): InfoPreviewModalsComponent {
    fixture.detectChanges();
    return fixture.debugElement.query(By.directive(InfoPreviewModalsComponent))
      .componentInstance as InfoPreviewModalsComponent;
  }

  function featureOverview(): InfoFeatureOverviewComponent {
    fixture.detectChanges();
    return fixture.debugElement.query(By.directive(InfoFeatureOverviewComponent))
      .componentInstance as InfoFeatureOverviewComponent;
  }

  describe("default state", () => {
    it("should have empty webAppQrUrl before init", () => {
      expect(component.webAppQrUrl).toBe("");
      expect(component.iosStoreQrUrl).toBe("");
    });
  });

  describe("ngOnInit", () => {
    it("should set webAppQrUrl and store QR URLs with encoded URLs", () => {
      component.ngOnInit();
      expect(component.webAppQrUrl).toContain("api.qrserver.com");
      expect(component.webAppQrUrl).toContain(
        encodeURIComponent("https://prayerapp.romans8.net/")
      );
      expect(component.iosStoreQrUrl).toContain("api.qrserver.com");
      expect(component.iosStoreQrUrl).toContain(
        encodeURIComponent(
          "https://apps.apple.com/us/app/cross-pointe-prayer/id6759469929"
        )
      );
    });
  });

  describe("template", () => {
    it("should render hero title and description after detectChanges", () => {
      component.ngOnInit();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain("Prayer Community");
      expect(el.textContent).toContain("Rejoice always");
    });

    it("should show theme toggle and CTA buttons", () => {
      component.ngOnInit();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("app-theme-toggle")).toBeTruthy();
      expect(el.textContent).toContain("Web Site");
      expect(el.textContent).toContain("App Store");
      expect(el.textContent).toContain("Play Store");
    });

    it("should show filter tabs with Public, Personal, Prompts and public sub-chips", () => {
      component.ngOnInit();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain("Public");
      expect(el.textContent).toContain("Groups");
      expect(el.textContent).toContain("Current");
      expect(el.textContent).toContain("Answered");
      expect(el.textContent).toContain("Total");
      expect(el.textContent).toContain("Prompts");
      expect(el.textContent).toContain("Personal");
    });

    it("should open badges modal when badge button is clicked", () => {
      component.ngOnInit();
      fixture.detectChanges();
      const badgeBtn = fixture.nativeElement.querySelector(
        'button[aria-label="About badges"]'
      ) as HTMLButtonElement;
      expect(badgeBtn).toBeTruthy();
      badgeBtn.click();
      fixture.detectChanges();
      expect(previewModals().activeModal).toEqual({ kind: "badges" });
    });

    it("should set previewFilter when filter tab is clicked", () => {
      component.ngOnInit();
      fixture.detectChanges();
      const buttons = fixture.nativeElement.querySelectorAll("button");
      let answeredBtn: HTMLButtonElement | null = null;
      buttons.forEach((b: HTMLButtonElement) => {
        if (b.textContent?.includes("Answered")) answeredBtn = b;
      });
      if (answeredBtn) {
        answeredBtn.click();
        fixture.detectChanges();
        expect(previewFilter()).toBe("answered");
      }
    });
  });
});
