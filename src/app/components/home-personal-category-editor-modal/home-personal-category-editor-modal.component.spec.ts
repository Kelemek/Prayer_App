import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ɵresolveComponentResources as resolveComponentResources } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HomePersonalCategoryEditorModalComponent } from "./home-personal-category-editor-modal.component";
import { PERSONAL_CATEGORY_COLOR_PRESETS } from "../../../utils/personalCategoryColor";

const componentDir = dirname(fileURLToPath(import.meta.url));

function readComponentResource(url: string): string {
  const path = join(componentDir, url);
  if (existsSync(path)) {
    return readFileSync(path, "utf-8");
  }
  throw new Error(`Component resource not found: ${url}`);
}

describe("HomePersonalCategoryEditorModalComponent", () => {
  beforeAll(async () => {
    await resolveComponentResources((url) =>
      Promise.resolve(readComponentResource(url))
    );
  });

  let fixture: ComponentFixture<HomePersonalCategoryEditorModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePersonalCategoryEditorModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePersonalCategoryEditorModalComponent);
    fixture.componentRef.setInput("isOpen", true);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it("shows create category form with color picker", () => {
    expect(fixture.nativeElement.textContent).toContain("Create a category");
    expect(fixture.nativeElement.textContent).toContain("Category name");
    expect(fixture.nativeElement.textContent).toContain("Color");
    expect(fixture.nativeElement.textContent).toContain("Create category");
  });

  it("clears the name draft and resets color when reopened", () => {
    fixture.componentInstance.nameDraft = "Family";
    fixture.componentInstance.colorDraft = PERSONAL_CATEGORY_COLOR_PRESETS[2]!;
    fixture.componentRef.setInput("isOpen", false);
    fixture.detectChanges();
    fixture.componentRef.setInput("isOpen", true);
    fixture.detectChanges();
    expect(fixture.componentInstance.nameDraft).toBe("");
    expect(fixture.componentInstance.colorDraft).toBe(
      PERSONAL_CATEGORY_COLOR_PRESETS[0]
    );
  });

  it("emits trimmed name and color on create", () => {
    const emitted: { name: string; color: string }[] = [];
    fixture.componentInstance.createCategory.subscribe((payload) =>
      emitted.push(payload)
    );
    fixture.componentInstance.nameDraft = "  Family  ";
    fixture.componentInstance.colorDraft = PERSONAL_CATEGORY_COLOR_PRESETS[1]!;
    fixture.componentInstance.submitCreate();
    expect(emitted).toEqual([
      { name: "Family", color: PERSONAL_CATEGORY_COLOR_PRESETS[1] },
    ]);
  });

  it("closes from the header close button", () => {
    const closeSpy = vi.spyOn(fixture.componentInstance.close, "emit");
    const closeButton = fixture.nativeElement.querySelector(
      'button[aria-label="Close"]'
    ) as HTMLButtonElement;
    expect(closeButton).toBeTruthy();
    closeButton.click();
    expect(closeSpy).toHaveBeenCalled();
  });
});
