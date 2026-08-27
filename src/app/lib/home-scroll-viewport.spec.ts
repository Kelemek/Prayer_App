import { describe, it, expect, afterEach } from "vitest";
import {
  HOME_SCROLL_VIEWPORT_SELECTOR,
  resetHomeScrollViewport,
} from "./home-scroll-viewport";

describe("resetHomeScrollViewport", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("resets scrollTop on the home safe-area viewport", () => {
    const shell = document.createElement("div");
    shell.className = "main-page-shell";
    const viewport = document.createElement("div");
    viewport.className = "safe-area-viewport";
    viewport.scrollTop = 240;
    shell.appendChild(viewport);
    document.body.appendChild(shell);

    resetHomeScrollViewport();

    expect(HOME_SCROLL_VIEWPORT_SELECTOR).toBe(
      ".main-page-shell .safe-area-viewport"
    );
    expect(viewport.scrollTop).toBe(0);
  });

  it("no-ops when the viewport is missing", () => {
    expect(() => resetHomeScrollViewport()).not.toThrow();
  });
});
