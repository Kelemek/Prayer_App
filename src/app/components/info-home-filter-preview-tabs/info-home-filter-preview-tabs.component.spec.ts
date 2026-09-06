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

  it("puts Add, Current, Answered, and Archived on the first public preview row", () => {
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
      "Add",
      "Current (22)",
      "Answered (4)",
      "Archived (21)",
    ]);
    expect(secondRowLabels).toEqual(["Total (47)", "Prompts (12)"]);
  });

  it("still shows Church with Archived and Prompts when canAccessShared is false", () => {
    component.canAccessShared = false;
    fixture.detectChanges();
    const row = fixture.nativeElement.querySelector(
      ".flex.w-full.gap-1.mb-0"
    ) as HTMLElement;
    expect(row.textContent).toContain("Church");
    expect(row.textContent).toContain("Personal");
    expect(row.textContent).toContain("Groups");
    expect(row.textContent).toContain("Memorize");
    expect(
      fixture.nativeElement.querySelector("#tour-filter-prompts")
    ).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain("Add");
    expect(fixture.nativeElement.textContent).toContain("Current (22)");
    expect(fixture.nativeElement.textContent).toContain("Archived (21)");
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

  it("emits memorize action explanations when Memorize chips are clicked", () => {
    const emitted: string[] = [];
    component.openMemorizeAction.subscribe((value) => emitted.push(value));
    component.previewFilter = "memorize";
    fixture.detectChanges();

    const clickChip = (label: string) => {
      const button = [...fixture.nativeElement.querySelectorAll("button")].find(
        (el: HTMLButtonElement) => el.textContent?.trim() === label
      ) as HTMLButtonElement | undefined;
      expect(button).toBeTruthy();
      button!.click();
    };

    clickChip("Add Verses");
    clickChip("Bible Books");
    clickChip("Recommended");

    expect(emitted).toEqual(["add-verses", "bible-books", "recommended"]);
  });
});
