import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ɵresolveComponentResources as resolveComponentResources } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HomeGroupEditorModalComponent } from "./home-group-editor-modal.component";

const componentDir = dirname(fileURLToPath(import.meta.url));

function readComponentResource(url: string): string {
  const path = join(componentDir, url);
  if (existsSync(path)) {
    return readFileSync(path, "utf-8");
  }
  throw new Error(`Component resource not found: ${url}`);
}

describe("HomeGroupEditorModalComponent", () => {
  beforeAll(async () => {
    await resolveComponentResources((url) =>
      Promise.resolve(readComponentResource(url))
    );
  });

  let fixture: ComponentFixture<HomeGroupEditorModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeGroupEditorModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeGroupEditorModalComponent);
    fixture.componentRef.setInput("isOpen", true);
    fixture.componentRef.setInput("groupsOwned", 1);
    fixture.componentRef.setInput("maxGroupsOwned", 25);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it("shows create group form", () => {
    expect(document.body.textContent).toContain("Create a group");
    expect(document.body.textContent).toContain("Group name");
    expect(document.body.textContent).toContain("Create group");
    expect(document.body.textContent).toContain(
      "You're using 1 of 25 groups."
    );
  });

  it("clears the name draft when reopened", () => {
    fixture.componentInstance.nameDraft = "Family";
    fixture.componentRef.setInput("isOpen", false);
    fixture.detectChanges();
    fixture.componentRef.setInput("isOpen", true);
    fixture.detectChanges();
    expect(fixture.componentInstance.nameDraft).toBe("");
  });

  it("closes from the header close button", () => {
    const closeSpy = vi.spyOn(fixture.componentInstance.close, "emit");
    const closeButton = document.body.querySelector(
      'button[aria-label="Close"]'
    ) as HTMLButtonElement;
    expect(closeButton).toBeTruthy();
    closeButton.click();
    expect(closeSpy).toHaveBeenCalled();
  });
});
