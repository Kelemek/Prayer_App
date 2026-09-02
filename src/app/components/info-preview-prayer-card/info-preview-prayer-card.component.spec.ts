import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { InfoPreviewPrayerCardComponent } from "./info-preview-prayer-card.component";
import { setupInfoPreviewComponentResources } from "../info-preview-component-resources.spec-helper";

describe("InfoPreviewPrayerCardComponent", () => {
  beforeAll(async () => {
    await setupInfoPreviewComponentResources();
  });

  let component: InfoPreviewPrayerCardComponent;
  let fixture: ComponentFixture<InfoPreviewPrayerCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfoPreviewPrayerCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InfoPreviewPrayerCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput("status", "current");
    fixture.componentRef.setInput("title", "Prayer for Marcus");
    fixture.componentRef.setInput("requester", "Sarah");
    fixture.componentRef.setInput("createdAt", "2025-01-12T12:00:00");
    fixture.componentRef.setInput(
      "description",
      "See every active request in one place."
    );
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it("renders the status header, date, title, and requester", () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("Current");
    expect(fixture.nativeElement.textContent).toContain("Jan 12, 2025");
    expect(fixture.nativeElement.textContent).toContain("Prayer for Marcus");
    expect(fixture.nativeElement.textContent).toContain("Requested by:");
    expect(fixture.nativeElement.textContent).toContain("Sarah");
    expect(
      fixture.nativeElement.querySelector("app-prayer-card-meta-header")
    ).toBeTruthy();
  });

  it("renders the update row header when an update is provided", () => {
    component.update = {
      id: "info-preview-update",
      content: "Surgery went well.",
      author: "Someone",
      created_at: "2025-01-10T14:20:00",
    };
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector("app-prayer-update-row")
    ).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain("Update");
    expect(fixture.nativeElement.textContent).toContain("Updated by:");
    expect(fixture.nativeElement.textContent).toContain("Someone");
    expect(fixture.nativeElement.textContent).toContain("Surgery went well.");
  });

  it("emits card-update and card-pray-for from the action buttons", () => {
    fixture.componentRef.setInput("showPrayFor", true);
    const emitted: string[] = [];
    component.openHeaderPreview.subscribe((value) => emitted.push(value));
    fixture.detectChanges();

    const addUpdate = [...fixture.nativeElement.querySelectorAll("button")].find(
      (button: HTMLButtonElement) => button.textContent?.trim() === "Add Update"
    ) as HTMLButtonElement;
    const prayFor = [...fixture.nativeElement.querySelectorAll("button")].find(
      (button: HTMLButtonElement) => button.textContent?.trim() === "Pray For"
    ) as HTMLButtonElement;
    addUpdate.click();
    prayFor.click();

    expect(emitted).toEqual(["card-update", "card-pray-for"]);
  });

  it("emits card-reminder from the overflow menu", async () => {
    const emitted: string[] = [];
    component.openHeaderPreview.subscribe((value) => emitted.push(value));
    fixture.detectChanges();

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

    expect(emitted).toEqual(["card-reminder"]);
  });
});
