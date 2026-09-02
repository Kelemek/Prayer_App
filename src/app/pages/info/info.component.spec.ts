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
      const toggle = el.querySelector("app-theme-toggle");
      expect(toggle).toBeTruthy();
      expect(toggle?.parentElement?.className).toContain("safe-area-top-right");
      expect(el.firstElementChild?.className).toContain("relative");
      expect(el.textContent).toContain("Web Site");
      expect(el.textContent).toContain("App Store");
      expect(el.textContent).toContain("Play Store");
    });

    it("should show filter tabs with Church, Personal, Prompts and public sub-chips", () => {
      component.ngOnInit();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.textContent).toContain("Church");
      expect(el.textContent).toContain("Groups");
      expect(el.textContent).toContain("Current");
      expect(el.textContent).toContain("Answered");
      expect(el.textContent).toContain("Total");
      expect(el.textContent).toContain("Prompts");
      expect(el.textContent).toContain("Personal");
      expect(el.textContent).toContain("Memorize");
    });

    it("shows the live card meta header and update header on the Current preview", () => {
      component.ngOnInit();
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector("app-prayer-card-meta-header")).toBeTruthy();
      expect(el.querySelector("app-prayer-update-row")).toBeTruthy();
      const header = el.querySelector(
        "app-prayer-card-meta-header"
      ) as HTMLElement;
      expect(header.textContent).toContain("Current");
      expect(header.textContent).toContain("Jan 12, 2025");
      const update = el.querySelector("app-prayer-update-row") as HTMLElement;
      expect(update.textContent).toContain("Update");
      expect(update.textContent).toContain("Updated by:");
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

    it("opens a prayer reminder explanation from the card overflow menu", async () => {
      component.ngOnInit();
      fixture.detectChanges();
      const trigger = fixture.nativeElement.querySelector(
        '[data-testid="card-actions-overflow-trigger"]'
      ) as HTMLButtonElement;
      expect(trigger).toBeTruthy();
      trigger.click();
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      fixture.detectChanges();

      const reminder = document.querySelector(
        '[data-card-action="reminder"]'
      ) as HTMLButtonElement | null;
      expect(reminder).toBeTruthy();
      reminder!.click();
      fixture.detectChanges();

      expect(previewModals().activeModal).toEqual({
        kind: "header",
        action: "card-reminder",
      });
      expect(fixture.nativeElement.textContent).toContain(
        "private reminder for this specific request"
      );
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

    it("opens a card explanation from the Answered preview header actions", async () => {
      component.ngOnInit();
      fixture.detectChanges();
      const answeredTab = [...fixture.nativeElement.querySelectorAll("button")].find(
        (button: HTMLButtonElement) => button.textContent?.includes("Answered")
      ) as HTMLButtonElement;
      answeredTab.click();
      fixture.detectChanges();

      const addUpdate = [...fixture.nativeElement.querySelectorAll("button")].find(
        (button: HTMLButtonElement) => button.textContent?.trim() === "Add Update"
      ) as HTMLButtonElement;
      addUpdate.click();
      fixture.detectChanges();
      expect(previewModals().activeModal).toEqual({
        kind: "header",
        action: "card-update",
      });

      const trigger = fixture.nativeElement.querySelector(
        '[data-testid="card-actions-overflow-trigger"]'
      ) as HTMLButtonElement;
      trigger.click();
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      fixture.detectChanges();
      const reminder = document.querySelector(
        '[data-card-action="reminder"]'
      ) as HTMLButtonElement | null;
      expect(reminder).toBeTruthy();
      reminder!.click();
      fixture.detectChanges();
      expect(previewModals().activeModal).toEqual({
        kind: "header",
        action: "card-reminder",
      });
    });

    it("opens a Bible Books explanation about memorizing book names", () => {
      component.ngOnInit();
      fixture.detectChanges();
      const memorizeTab = fixture.nativeElement.querySelector(
        "#tour-filter-memorize"
      ) as HTMLButtonElement;
      memorizeTab.click();
      fixture.detectChanges();

      const bibleBooks = [
        ...fixture.nativeElement.querySelectorAll("button"),
      ].find(
        (button: HTMLButtonElement) =>
          button.textContent?.trim() === "Bible Books"
      ) as HTMLButtonElement;
      bibleBooks.click();
      fixture.detectChanges();

      expect(previewModals().activeModal).toEqual({
        kind: "memorizeAction",
        action: "bible-books",
      });
      expect(fixture.nativeElement.textContent).toContain(
        "names of the books of the Bible"
      );
    });

    it("opens practice screenshots when the Memorize verse card is clicked", () => {
      component.ngOnInit();
      fixture.detectChanges();
      const memorizeTab = fixture.nativeElement.querySelector(
        "#tour-filter-memorize"
      ) as HTMLButtonElement;
      memorizeTab.click();
      fixture.detectChanges();

      const verseCard = fixture.nativeElement.querySelector(
        'app-info-home-filter-preview-memorize-card button[aria-label="See how verse practice works"]'
      ) as HTMLButtonElement;
      verseCard.click();
      fixture.detectChanges();

      expect(previewModals().activeModal).toEqual({
        kind: "memorizePractice",
      });
      expect(fixture.nativeElement.textContent).toContain("Practice a verse");
      expect(fixture.nativeElement.textContent).toContain("1 of 5");
      expect(
        fixture.nativeElement.querySelector(
          'img[src="/info/memorize-practice/light/01-type.png"]'
        )
      ).toBeTruthy();
    });

    it("opens a Memorize explanation when Add Verses is clicked", () => {
      component.ngOnInit();
      fixture.detectChanges();
      const memorizeTab = fixture.nativeElement.querySelector(
        "#tour-filter-memorize"
      ) as HTMLButtonElement;
      memorizeTab.click();
      fixture.detectChanges();

      const addVerses = [...fixture.nativeElement.querySelectorAll("button")].find(
        (button: HTMLButtonElement) => button.textContent?.trim() === "Add Verses"
      ) as HTMLButtonElement;
      addVerses.click();
      fixture.detectChanges();

      expect(previewModals().activeModal).toEqual({
        kind: "memorizeAction",
        action: "add-verses",
      });
      expect(fixture.nativeElement.textContent).toContain("passage picker");
    });
  });
});
