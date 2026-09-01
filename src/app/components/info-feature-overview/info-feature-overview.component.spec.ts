import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";
import { InfoFeatureOverviewComponent } from "./info-feature-overview.component";
import { InfoMockAppHeaderComponent } from "../info-mock-app-header/info-mock-app-header.component";
import { InfoPreviewModalsComponent } from "../info-preview-modals/info-preview-modals.component";
import { setupInfoPreviewComponentResources } from "../info-preview-component-resources.spec-helper";

describe("InfoFeatureOverviewComponent", () => {
  beforeAll(async () => {
    await setupInfoPreviewComponentResources();
  });

  let component: InfoFeatureOverviewComponent;
  let fixture: ComponentFixture<InfoFeatureOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfoFeatureOverviewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InfoFeatureOverviewComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("defaults brandingImageUrl to empty string", () => {
    expect(component.brandingImageUrl).toBe("");
  });

  it("renders mock header, search bar, and filter preview", () => {
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector("app-info-mock-app-header")
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector("app-info-mock-search-bar")
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector("app-info-home-filter-preview-tabs")
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector("app-info-home-filter-preview-panels")
    ).toBeTruthy();
  });

  it("routes mock header preview events to preview modals", () => {
    fixture.detectChanges();

    const modals = fixture.debugElement.query(
      By.directive(InfoPreviewModalsComponent)
    ).componentInstance;
    const header = fixture.debugElement.query(
      By.directive(InfoMockAppHeaderComponent)
    ).componentInstance;
    header.openHeaderPreview.emit("settings");
    fixture.detectChanges();

    expect(modals.activeModal).toEqual({ kind: "header", action: "settings" });
  });

  it("hides the mock search bar until the header search button is clicked", () => {
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector(
      "#info-mock-search-panel"
    ) as HTMLElement;
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    expect(panel.className).toContain("max-h-0");

    const searchButton = fixture.nativeElement.querySelector(
      'button[title="Search"]'
    ) as HTMLButtonElement;
    searchButton.click();
    fixture.detectChanges();

    expect(component.showSearchPanel).toBe(true);
    expect(panel.getAttribute("aria-hidden")).toBe("false");
    expect(panel.className).toContain("max-h-28");
  });

  it("routes mock search open to preview modals", () => {
    fixture.detectChanges();

    const searchButton = fixture.nativeElement.querySelector(
      'button[title="Search"]'
    ) as HTMLButtonElement;
    searchButton.click();
    fixture.detectChanges();

    const modals = fixture.debugElement.query(
      By.directive(InfoPreviewModalsComponent)
    ).componentInstance;
    const searchField = fixture.nativeElement.querySelector(
      "app-info-mock-search-bar .cursor-pointer"
    ) as HTMLElement;
    searchField.click();
    fixture.detectChanges();

    expect(modals.activeModal).toEqual({ kind: "header", action: "search" });
  });
});
