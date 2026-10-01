import type { Observable } from "rxjs";
import { takeUntil } from "rxjs";
import type { HomeActiveFilter } from "../services/home-deep-link-host.adapter";
import { isPublicAreaFilter } from "./home-community-filter";

export type HomeCatalogId =
  | "community"
  | "prompts"
  | "personal"
  | "memorize"
  | "groups";

const TENANT_SCOPED_CATALOGS: readonly HomeCatalogId[] = [
  "community",
  "prompts",
  "personal",
  "memorize",
];

export interface HomeCatalogGateSources {
  communityLoading$: Observable<boolean>;
  promptsLoading$: Observable<boolean>;
  personalLoading$: Observable<boolean>;
  memorizeLoading$: Observable<boolean>;
  tenantId$: Observable<string | null>;
  hasEmail(): boolean;
}

export interface HomeCatalogAwaiting {
  activeFilter: HomeActiveFilter;
  viewReady: boolean;
  tenantLoading: boolean;
  canAccessShared: boolean;
  planningCenterSettled: boolean;
}

/** Church preview is the body only after membership has settled and the user is not in a church. */
export function homeShowChurchPreview(params: {
  viewReady: boolean;
  canAccessShared: boolean;
  activeFilter: HomeActiveFilter;
  tenantLoading: boolean;
}): boolean {
  return (
    params.viewReady &&
    !params.tenantLoading &&
    !params.canAccessShared &&
    isPublicAreaFilter(params.activeFilter)
  );
}

/**
 * First-load readiness for each home catalog.
 * Generation 0 settles from the loading flags. A later church change clears
 * the tenant-scoped catalogs and waits for the reload started for that
 * generation. A loading flag falling to false, or an older reload finishing,
 * does not settle the new church.
 */
export class HomeCatalogGate {
  private readonly settled = new Set<HomeCatalogId>();
  private tenantId: string | null | undefined = undefined;
  private generation = 0;

  bind(
    destroy$: Observable<unknown>,
    sources: HomeCatalogGateSources,
    markForCheck: () => void
  ): void {
    sources.tenantId$.pipe(takeUntil(destroy$)).subscribe((tenantId) => {
      this.noteTenant(tenantId);
      markForCheck();
    });
    this.watch(destroy$, sources, "community", sources.communityLoading$, true, markForCheck);
    this.watch(destroy$, sources, "prompts", sources.promptsLoading$, true, markForCheck);
    this.watch(destroy$, sources, "personal", sources.personalLoading$, false, markForCheck);
    this.watch(destroy$, sources, "memorize", sources.memorizeLoading$, false, markForCheck);
  }

  finish(ids: readonly HomeCatalogId[]): void {
    for (const id of ids) {
      this.settled.add(id);
    }
  }

  reloadGeneration(): number {
    return this.generation;
  }

  finishTenantReload(generation: number): void {
    if (generation !== this.generation) {
      return;
    }
    this.finish(TENANT_SCOPED_CATALOGS);
  }

  isSettled(id: HomeCatalogId): boolean {
    return this.settled.has(id);
  }

  awaiting(params: HomeCatalogAwaiting): boolean {
    if (homeShowChurchPreview(params)) {
      return false;
    }
    if (
      !params.viewReady ||
      (params.tenantLoading &&
        !params.canAccessShared &&
        isPublicAreaFilter(params.activeFilter))
    ) {
      return true;
    }

    switch (params.activeFilter) {
      case "current":
      case "answered":
      case "archived":
      case "total":
      case "prompts":
        return !(this.isSettled("community") && this.isSettled("prompts"));
      case "planning_center_list":
        return !(
          this.isSettled("community") &&
          this.isSettled("prompts") &&
          params.planningCenterSettled
        );
      case "personal":
        return !this.isSettled("personal");
      case "memorize":
        return !this.isSettled("memorize");
      case "groups":
        return !this.isSettled("groups");
      default: {
        const _exhaustive: never = params.activeFilter;
        return _exhaustive;
      }
    }
  }

  noteTenant(tenantId: string | null): void {
    if (this.tenantId === undefined) {
      this.tenantId = tenantId;
      return;
    }
    if (this.tenantId === tenantId) {
      return;
    }
    this.tenantId = tenantId;
    this.generation += 1;
    for (const id of TENANT_SCOPED_CATALOGS) {
      this.settled.delete(id);
    }
  }

  private watch(
    destroy$: Observable<unknown>,
    sources: HomeCatalogGateSources,
    id: HomeCatalogId,
    loading$: Observable<boolean>,
    requiresTenant: boolean,
    markForCheck: () => void
  ): void {
    loading$.pipe(takeUntil(destroy$)).subscribe((loading) => {
      if (
        this.generation === 0 &&
        !loading &&
        sources.hasEmail() &&
        (!requiresTenant || !!this.tenantId)
      ) {
        this.settled.add(id);
      }
      markForCheck();
    });
  }
}
