import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ɵresolveComponentResources as resolveComponentResources } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { HomeChurchDemoPanelComponent } from "./home-church-demo-panel.component";

const componentDir = dirname(fileURLToPath(import.meta.url));

function readComponentResource(url: string): string {
  const path = join(componentDir, url);
  if (existsSync(path)) {
    return readFileSync(path, "utf-8");
  }
  throw new Error(`Component resource not found: ${url}`);
}

describe("HomeChurchDemoPanelComponent", () => {
  beforeAll(async () => {
    await resolveComponentResources((url) =>
      Promise.resolve(readComponentResource(url))
    );
  });

  let fixture: ComponentFixture<HomeChurchDemoPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeChurchDemoPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HomeChurchDemoPanelComponent);
    fixture.componentRef.setInput("activeFilter", "current");
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it("shows current preview copy and a create/join CTA", () => {
    expect(fixture.nativeElement.textContent).toContain("Church preview — Current");
    expect(fixture.nativeElement.textContent).toContain(
      "preview of current church prayers"
    );
    expect(fixture.nativeElement.textContent).toContain("Create or join a church");
  });

  it("swaps copy for Answered, Total, Archived, and Prompts", () => {
    fixture.componentRef.setInput("activeFilter", "answered");
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      "Church preview — Answered"
    );
    expect(fixture.nativeElement.textContent).toContain("answered church prayers");

    fixture.componentRef.setInput("activeFilter", "total");
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Church preview — Total");
    expect(fixture.nativeElement.textContent).toContain("full church prayer list");

    fixture.componentRef.setInput("activeFilter", "archived");
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      "Church preview — Archived"
    );
    expect(fixture.nativeElement.textContent).toContain("archived church prayers");

    fixture.componentRef.setInput("activeFilter", "prompts");
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      "Church preview — Prompts"
    );
    expect(fixture.nativeElement.textContent).toContain("church prayer prompts");
  });

  it("emits addChurch from the CTA", () => {
    const emitSpy = vi.spyOn(fixture.componentInstance.addChurch, "emit");
    const button = [...fixture.nativeElement.querySelectorAll("button")].find(
      (el: HTMLButtonElement) =>
        el.textContent?.includes("Create or join a church")
    ) as HTMLButtonElement;
    button.click();
    expect(emitSpy).toHaveBeenCalled();
  });
});
