import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/angular";
import { provideRouter } from "@angular/router";
import { TermsComponent } from "./terms.component";

describe("TermsComponent", () => {
  it("renders Terms of Service heading", async () => {
    await render(TermsComponent, {
      providers: [provideRouter([])],
    });
    expect(
      screen.getByRole("heading", { name: "Terms of Service" }).textContent,
    ).toBe("Terms of Service");
  });
});
