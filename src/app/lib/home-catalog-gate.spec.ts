import { describe, expect, it, vi } from "vitest";
import { BehaviorSubject, Subject } from "rxjs";
import { HomeCatalogGate, type HomeCatalogId } from "./home-catalog-gate";

const ALL_CATALOGS: readonly HomeCatalogId[] = [
  "community",
  "prompts",
  "personal",
  "memorize",
  "groups",
];

function settledGate(): HomeCatalogGate {
  const gate = new HomeCatalogGate();
  gate.finish(ALL_CATALOGS);
  return gate;
}

describe("HomeCatalogGate", () => {
  it("settles a catalog only after its first load finishes for a signed-in user", () => {
    const gate = new HomeCatalogGate();
    const loading$ = new BehaviorSubject(true);
    const destroy$ = new Subject<void>();
    const markForCheck = vi.fn();
    gate.bind(
      destroy$,
      {
        communityLoading$: loading$,
        promptsLoading$: new BehaviorSubject(true),
        personalLoading$: new BehaviorSubject(true),
        memorizeLoading$: new BehaviorSubject(true),
        tenantId$: new BehaviorSubject<string | null>("church-1"),
        hasEmail: () => true,
      },
      markForCheck
    );

    expect(gate.isSettled("community")).toBe(false);
    loading$.next(false);
    expect(gate.isSettled("community")).toBe(true);

    destroy$.next();
    destroy$.complete();
  });

  it("clears tenant-scoped catalogs when the active tenant changes and keeps groups", () => {
    const gate = new HomeCatalogGate();
    gate.noteTenant("church-1");
    gate.finish(["community", "groups"]);

    gate.noteTenant("church-2");

    expect(gate.isSettled("community")).toBe(false);
    expect(gate.isSettled("groups")).toBe(true);
  });

  it("ignores a later loading false and waits for the reload that started after the church change", () => {
    const gate = new HomeCatalogGate();
    const loading$ = new BehaviorSubject(true);
    const tenantId$ = new BehaviorSubject<string | null>("church-1");
    const destroy$ = new Subject<void>();
    gate.bind(
      destroy$,
      {
        communityLoading$: loading$,
        promptsLoading$: new BehaviorSubject(true),
        personalLoading$: new BehaviorSubject(true),
        memorizeLoading$: new BehaviorSubject(true),
        tenantId$,
        hasEmail: () => true,
      },
      vi.fn()
    );

    loading$.next(false);
    expect(gate.isSettled("community")).toBe(true);

    const startedGeneration = gate.reloadGeneration();
    tenantId$.next("church-2");
    loading$.next(false);
    expect(gate.isSettled("community")).toBe(false);

    gate.finishTenantReload(startedGeneration);
    expect(gate.isSettled("community")).toBe(false);
    gate.finishTenantReload(gate.reloadGeneration());
    expect(gate.isSettled("community")).toBe(true);
    expect(gate.isSettled("prompts")).toBe(true);

    destroy$.next();
    destroy$.complete();
  });
});

describe("HomeCatalogGate.awaiting", () => {
  const visible = {
    viewReady: true,
    tenantLoading: false,
    canAccessShared: true,
    planningCenterSettled: true,
  };

  it("keeps skeletons up until the view is ready", () => {
    expect(
      settledGate().awaiting({
        ...visible,
        viewReady: false,
        activeFilter: "groups",
      })
    ).toBe(true);
  });

  it("keeps the groups tab on skeletons until groups have finished", () => {
    const gate = settledGate();
    expect(
      new HomeCatalogGate().awaiting({ ...visible, activeFilter: "groups" })
    ).toBe(true);
    expect(gate.awaiting({ ...visible, activeFilter: "groups" })).toBe(false);
  });

  it("keeps church tabs on skeletons until prayers and prompts have both finished", () => {
    const promptsOpen = new HomeCatalogGate();
    promptsOpen.finish(["community"]);
    expect(promptsOpen.awaiting({ ...visible, activeFilter: "current" })).toBe(true);

    const prayersOpen = new HomeCatalogGate();
    prayersOpen.finish(["prompts"]);
    expect(prayersOpen.awaiting({ ...visible, activeFilter: "prompts" })).toBe(true);

    expect(settledGate().awaiting({ ...visible, activeFilter: "current" })).toBe(false);
  });

  it("shows the church preview once it is known the user is not in a church", () => {
    expect(
      new HomeCatalogGate().awaiting({
        ...visible,
        activeFilter: "current",
        canAccessShared: false,
      })
    ).toBe(false);
  });

  it("keeps church skeletons up while membership is still loading", () => {
    expect(
      new HomeCatalogGate().awaiting({
        ...visible,
        activeFilter: "current",
        canAccessShared: false,
        tenantLoading: true,
      })
    ).toBe(true);
  });

  it("keeps personal and memorize on skeletons until their catalogs finish", () => {
    const gate = new HomeCatalogGate();
    expect(gate.awaiting({ ...visible, activeFilter: "personal" })).toBe(true);
    expect(gate.awaiting({ ...visible, activeFilter: "memorize" })).toBe(true);
    gate.finish(["personal", "memorize"]);
    expect(gate.awaiting({ ...visible, activeFilter: "personal" })).toBe(false);
    expect(gate.awaiting({ ...visible, activeFilter: "memorize" })).toBe(false);
  });
});
