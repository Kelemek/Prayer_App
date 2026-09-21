import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isPrayerAddUpdatePayload,
  PrayerAddUpdateModalComponent,
} from "./prayer-add-update-modal.component";
import { RichTextEditorComponent } from "../rich-text-editor/rich-text-editor.component";
import { ToastService } from "../../services/toast.service";

describe("PrayerAddUpdateModalComponent", () => {
  let component: PrayerAddUpdateModalComponent;
  let toast: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toast = { error: vi.fn() };
    component = new PrayerAddUpdateModalComponent(
      toast as unknown as ToastService
    );
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("showAnonymousOption returns false for personal prayers", () => {
    component.isPersonal = true;
    component.prayerId = "p1";
    expect(component.showAnonymousOption()).toBe(false);
  });

  it("showAnonymousOption returns true for community prayers", () => {
    component.isPersonal = false;
    component.prayerId = "community-1";
    expect(component.showAnonymousOption()).toBe(true);
  });

  it("handleSubmit emits payload without clearing fields before the modal closes", () => {
    const flush = vi.fn().mockReturnValue("Test update");
    component.richTextEditorsEnabled = true;
    component.addUpdateRichText = {
      flushMarkdownToForm: flush,
    } as unknown as RichTextEditorComponent;
    component.updateContent = "";
    component.updateIsAnonymous = true;
    component.updateMarkAsAnswered = true;
    const spy = vi.spyOn(component.updateSubmit, "emit");

    component.handleSubmit();

    expect(flush).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({
      content: "Test update",
      is_anonymous: true,
      mark_as_answered: true,
    });
    expect(component.updateIsAnonymous).toBe(true);
    expect(component.updateMarkAsAnswered).toBe(true);
  });

  it("handleSubmit uses textarea content when rich text is disabled", () => {
    component.richTextEditorsEnabled = false;
    component.updateContent = "Plain text update";
    const spy = vi.spyOn(component.updateSubmit, "emit");

    component.handleSubmit();

    expect(spy).toHaveBeenCalledWith({
      content: "Plain text update",
      is_anonymous: false,
      mark_as_answered: false,
    });
  });

  it("handleSubmit does not emit when content is empty", () => {
    component.richTextEditorsEnabled = false;
    component.updateContent = "   ";
    const spy = vi.spyOn(component.updateSubmit, "emit");

    component.handleSubmit();

    expect(spy).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Update content is required");
  });

  it("handleSubmit ignores a second submit while the first is in flight", () => {
    component.richTextEditorsEnabled = false;
    component.updateContent = "Once";
    const spy = vi.spyOn(component.updateSubmit, "emit");

    component.handleSubmit();
    component.handleSubmit();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("does not show required error when modal closes mid-submit and form fires again", () => {
    component.richTextEditorsEnabled = false;
    component.updateContent = "Once";
    vi.spyOn(component.updateSubmit, "emit");

    component.handleSubmit();
    component.ngOnChanges({
      isOpen: {
        currentValue: false,
        previousValue: true,
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    component.updateContent = "";
    component.handleSubmit();

    expect(toast.error).not.toHaveBeenCalled();
  });

  it("handleSubmit allows mark-as-answered with default content when body is empty", () => {
    component.richTextEditorsEnabled = false;
    component.updateContent = "";
    component.updateMarkAsAnswered = true;
    const spy = vi.spyOn(component.updateSubmit, "emit");

    component.handleSubmit();

    expect(spy).toHaveBeenCalledWith({
      content: "Marked as answered",
      is_anonymous: false,
      mark_as_answered: true,
    });
  });

  it("canSubmitUpdate returns false for whitespace-only content", () => {
    component.updateContent = "   \n\t";
    expect(component.canSubmitUpdate()).toBe(false);
  });

  it("closeModal emits close and resets form fields", () => {
    component.updateContent = "Draft";
    component.updateIsAnonymous = true;
    component.updateMarkAsAnswered = true;
    const spy = vi.spyOn(component.close, "emit");

    component.closeModal();

    expect(spy).toHaveBeenCalled();
    expect(component.updateContent).toBe("");
    expect(component.updateIsAnonymous).toBe(false);
    expect(component.updateMarkAsAnswered).toBe(false);
  });

  it("resets form when isOpen becomes false without emitting close", () => {
    component.updateContent = "Draft";
    component.updateIsAnonymous = true;
    component.updateMarkAsAnswered = true;
    const closeSpy = vi.spyOn(component.close, "emit");

    component.ngOnChanges({
      isOpen: {
        currentValue: false,
        previousValue: true,
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    expect(component.updateContent).toBe("");
    expect(component.updateIsAnonymous).toBe(false);
    expect(component.updateMarkAsAnswered).toBe(false);
    expect(closeSpy).not.toHaveBeenCalled();
  });

  it("uses tour element ids when provided", () => {
    component.tourElementIds = {
      content: "tour-prayer-update-content",
      submit: "tour-prayer-update-submit",
    };

    expect(component.updateContentElementId).toBe("tour-prayer-update-content");
    expect(component.submitButtonId).toBe("tour-prayer-update-submit");
  });

  it("falls back to per-prayer element ids when tour ids omitted", () => {
    component.prayerId = "p1";
    component.tourElementIds = null;

    expect(component.updateContentElementId).toBe("updateContent-p1");
    expect(component.anonymousCheckboxInputId).toBe("updateIsAnonymous-p1");
  });

  it("stops native form submit from bubbling", () => {
    component.richTextEditorsEnabled = false;
    component.updateContent = "Once";
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as Event;

    component.handleSubmit(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it("isPrayerAddUpdatePayload rejects native submit events", () => {
    expect(
      isPrayerAddUpdatePayload({
        content: "ok",
        is_anonymous: false,
        mark_as_answered: false,
      })
    ).toBe(true);
    expect(isPrayerAddUpdatePayload(new Event("submit"))).toBe(false);
  });
});
