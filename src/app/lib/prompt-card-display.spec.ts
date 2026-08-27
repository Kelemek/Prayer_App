import { describe, it, expect } from "vitest";
import { getPromptCardVariantLayout } from "./prayer-card-layout";
import {
  getPromptCardShellClasses,
  prayedForCountLabelForPromptCard,
  promptCardTypeHeaderTextClasses,
  showPromptCardPrayedForBadge,
} from "./prompt-card-display";

describe("prompt-card-display", () => {
  it("joins home shell padding so the type header can bleed to the card edge", () => {
    const classes = getPromptCardShellClasses(getPromptCardVariantLayout("home"));
    expect(classes).toContain("pt-0");
    expect(classes).toContain("px-4");
    expect(classes).toContain("prompt-card");
  });

  it("promptCardTypeHeaderTextClasses uses stone when the type filter is active", () => {
    expect(promptCardTypeHeaderTextClasses(true)).toContain("#988F83");
    expect(promptCardTypeHeaderTextClasses(false)).toContain("text-gray-700");
  });

  it("showPromptCardPrayedForBadge is true only when count > 0", () => {
    expect(showPromptCardPrayedForBadge(0)).toBe(false);
    expect(showPromptCardPrayedForBadge(2)).toBe(true);
  });

  it("prayedForCountLabelForPromptCard uses singular Prayer when count is 1", () => {
    expect(prayedForCountLabelForPromptCard(1)).toBe("Prayer");
    expect(prayedForCountLabelForPromptCard(2)).toBe("Prayers");
  });
});
