import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { InfoHomeFilterPreviewTabsComponent } from "./info-home-filter-preview-tabs.component";
import { setupInfoPreviewComponentResources } from "../info-preview-component-resources.spec-helper";

describe("InfoHomeFilterPreviewTabsComponent", () => {
  beforeAll(async () => {
    await setupInfoPreviewComponentResources();
  });

  let component: InfoHomeFilterPreviewTabsComponent;
  let fixture: ComponentFixture<InfoHomeFilterPreviewTabsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfoHomeFilterPreviewTabsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InfoHomeFilterPreviewTabsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("selectPublicPreviewTab emits current when not on community filter", () => {
    const emitted: string[] = [];
    component.previewFilterChange.subscribe((value) => emitted.push(value));
    component.previewFilter = "prompts";

    component.selectPublicPreviewTab();

    expect(emitted).toEqual(["current"]);
  });

  it("selectPublicPreviewTab does nothing when already on community filter", () => {
    const emitted: string[] = [];
    component.previewFilterChange.subscribe((value) => emitted.push(value));
    component.previewFilter = "current";

    component.selectPublicPreviewTab();

    expect(emitted).toEqual([]);
  });

  it("shows main preview tab labels without a top-level Prompts tab", () => {
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector(
      ".flex.w-full.gap-1.mb-0"
    ) as HTMLElement;
    const publicTab = row.querySelector('[role="button"]') as HTMLElement;
    const topButtons = row.querySelectorAll(
      ":scope > button"
    ) as NodeListOf<HTMLButtonElement>;
    const normalize = (el: HTMLElement) =>
      el.textContent?.replace(/\s+/g, " ").trim() ?? "";

    expect(normalize(publicTab)).toBe("Church 1");
    expect(topButtons).toHaveLength(3);
    expect(normalize(topButtons[0]!)).toBe("Groups");
    expect(normalize(topButtons[1]!)).toBe("Personal");
    expect(normalize(topButtons[2]!)).toBe("Memorize");
    expect(
      row.querySelector("#tour-filter-prompts")
    ).toBeNull();
  });

  it("shows Prompts as the last public sub-filter chip", () => {
    fixture.detectChanges();
    const promptsChip = fixture.nativeElement.querySelector(
      "#tour-filter-prompts"
    ) as HTMLButtonElement;
    expect(promptsChip).toBeTruthy();
    expect(promptsChip.textContent?.trim()).toBe("Prompts (12)");
  });

  it("puts Current, Answered, and Archived on the first public preview row", () => {
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector(
      ".rounded-b-lg, .rounded-b-none"
    ) as HTMLElement;
    const rows = panel.querySelectorAll(":scope > div");
    expect(rows).toHaveLength(2);
    expect(rows[1]!.className).toContain("mt-2");

    const firstRowLabels = [...rows[0]!.querySelectorAll("button")].map(
      (button) => button.textContent?.trim() ?? ""
    );
    const secondRowLabels = [...rows[1]!.querySelectorAll("button")].map(
      (button) => button.textContent?.trim() ?? ""
    );
    expect(firstRowLabels).toEqual([
      "Current (22)",
      "Answered (4)",
      "Archived (21)",
    ]);
    expect(secondRowLabels).toEqual(["Total (47)", "Prompts (12)"]);

    for (const button of [...rows[0]!.querySelectorAll("button"), ...rows[1]!.querySelectorAll("button")]) {
      const host = button.parentElement as HTMLElement;
      expect(host.className).toContain("flex-[1_1_0]");
      expect(host.className).toContain("min-w-max");
      expect(button.className).toContain("min-w-max");
      expect(button.className).not.toContain("flex-1");
    }
  });

  it("hides Church area when canAccessShared is false", () => {
    component.canAccessShared = false;
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector(
      ".flex.w-full.gap-1.mb-0"
    ) as HTMLElement;
    expect(row.textContent).toContain("Personal");
    expect(row.textContent).toContain("Groups");
    expect(row.textContent).not.toContain("Church");
    expect(row.textContent).toContain("Memorize");
    expect(
      fixture.nativeElement.querySelector("#tour-filter-prompts")
    ).toBeNull();
  });

  it("shows memorize action chips when Memorize is selected", () => {
    component.previewFilter = "memorize";
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector(
      ".flex.w-full.gap-1.mb-0"
    ) as HTMLElement;
    expect(row.querySelector("#tour-filter-memorize")).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain("Add Verses");
    expect(fixture.nativeElement.textContent).toContain("Bible Books");
    expect(fixture.nativeElement.textContent).toContain("Recommended");
  });
});
