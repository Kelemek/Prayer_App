import { BehaviorSubject, first } from "rxjs";
import { SupabaseService } from "./supabase.service";
import { ToastService } from "./toast.service";
import { CacheService } from "./cache.service";
import { EmailNotificationService } from "./email-notification.service";
import { UserSessionService } from "./user-session.service";
import { TenantContextService } from "./tenant-context.service";
import { ConnectivityService } from "./connectivity.service";
import { PrayedForSyncService } from "./prayed-for-sync.service";
import { personalCategoryNamesFromPrayers } from "../lib/personal-category-order";
import { planPersonalPrayerAdd } from "../lib/prayer-personal-add-plan";
import { resolvePersonalPrayerCategoryChangeDisplayOrder } from "../lib/prayer-personal-update-category-plan";
import {
  isPersonalPrayerDisplayOrderOnlyChange as isPersonalPrayerDisplayOrderOnlyDbChange,
  personalPrayerRowToPrayerRequest,
  sanitizePersonalPrayerCategory,
  sortPersonalPrayersForListing,
  type PersonalPrayerDbRow,
} from "../lib/prayer-personal-display";
import {
  appendPersonalPrayerUpdate,
  applyPersonalPrayerFieldUpdate,
  buildPersonalPrayerDbUpdatePayload,
  buildPersonalPrayerInsertRow,
  buildPersonalPrayerUpdateInsertRow,
  mapDbPersonalPrayerUpdateRow,
  personalPrayerRequestFromInsertedRow,
  patchPersonalPrayerUpdateLocally,
  personalPrayerUpdatePatchWithTimestamp,
  personalPrayerListAfterInsert,
  removePersonalPrayerById,
  removePersonalPrayerUpdateById,
} from "../lib/prayer-personal-mutations";
import { startPersonalPrayerUpdatePlan } from "../lib/prayer-personal-update-plan";
import { personalPrayersFromDbRows } from "../lib/prayer-personal-load";
import {
  deletePersonalPrayerRow,
  deletePersonalPrayerUpdateRow,
  fetchPersonalCategoriesList,
  fetchPersonalPrayerForShare,
  fetchPersonalPrayersList,
  insertPersonalPrayerRow,
  insertPersonalPrayerUpdateRow,
  insertSharedCommunityPrayerRow,
  insertSharedCommunityPrayerUpdates,
  markPersonalPrayerUpdateAnsweredRow,
  updatePersonalPrayerRow,
  updatePersonalPrayerUpdateRow,
} from "../lib/prayer-personal-db";
import {
  buildPersonalCategoryOrchestrationDeps,
  createPersonalCategoryDeps,
  ensurePersonalCategoryForTenant,
  type PersonalCategoryQueryWireDeps,
} from "../lib/prayer-personal-category-wire";
import {
  orchestratePersonalCategoryDelete,
  orchestratePersonalCategoryRename,
  orchestratePersonalCategoryReorder,
  orchestratePersonalPrayerOrderUpdate,
} from "../lib/prayer-personal-category-orchestrate";
import { extractSupabaseErrorMessage } from "../lib/prayer-error-message";
import {
  prayedForServerBaseline,
  seedPrayedForServerCounts,
  toPrayedForServerOnly,
  withPrayedForDisplayCounts,
} from "../lib/prayer-prayed-for-increment";
import {
  applyPersonalPrayerLoadCacheFallbackPlan,
  planPersonalPrayerLoadCacheFallback,
} from "../lib/prayer-catalog-load";
import {
  personalPrayersCacheKeyForTenant,
} from "../lib/prayer-tenant";
import {
  buildSharedPersonalPrayerCommunityRow,
  buildSharedPersonalPrayerUpdateRows,
  resolveSharedPrayerRequesterName,
} from "../lib/prayer-personal-share";
import type { PrayerRequest, PrayerUpdate } from "../lib/prayer-types";
import type { PersonalCategory } from "../types/personal-category";
import {
  normalizePersonalCategoryHexColor,
  sanitizePersonalCategoryName,
} from "../../utils/personalCategoryColor";

export type CreatePersonalCategoryResult =
  | { ok: true; name: string }
  | { ok: false; reason: "empty" | "duplicate" | "failed" };

export type PrayerPersonalFacadeHooks = {
  getUserEmail: () => Promise<string | null>;
  loadPersonalPrayers: () => Promise<void>;
};

export class PrayerPersonalService {
  readonly allPersonalPrayersSubject = new BehaviorSubject<PrayerRequest[]>([]);
  readonly personalCategoriesSubject = new BehaviorSubject<PersonalCategory[]>(
    []
  );
  readonly loadingPersonalPrayersSubject = new BehaviorSubject<boolean>(true);
  readonly personalServerPrayedFor = new Map<string, number>();

  readonly allPersonalPrayers$ = this.allPersonalPrayersSubject.asObservable();
  readonly personalCategories$ = this.personalCategoriesSubject.asObservable();
  readonly loadingPersonalPrayers$ =
    this.loadingPersonalPrayersSubject.asObservable();

  constructor(
    private supabase: SupabaseService,
    private toast: ToastService,
    private cache: CacheService,
    private connectivity: ConnectivityService,
    private tenantContext: TenantContextService,
    private prayedForSync: PrayedForSyncService | null,
    private userSessionService: UserSessionService,
    private emailNotification: EmailNotificationService,
    private readonly facadeHooks: PrayerPersonalFacadeHooks
  ) {}

  getPersonalPrayersSnapshot(): PrayerRequest[] {
    return this.allPersonalPrayersSubject.value;
  }

  getPersonalCategoriesSnapshot(): PersonalCategory[] {
    return this.personalCategoriesSubject.value;
  }

  getActiveTenantId(): string | null {
    return this.tenantContext.getActiveTenant()?.id || null;
  }

  personalPrayersCacheKey(
    tenantId: string | null | undefined
  ): string {
    return personalPrayersCacheKeyForTenant(tenantId);
  }

  setPersonalPrayersCache(prayers: PrayerRequest[]): void {
    const key = this.personalPrayersCacheKey(this.getActiveTenantId());
    if (key) {
      this.cache.set(key, prayers);
    }
  }

  getPersonalPrayersCached(): PrayerRequest[] | null {
    const key = this.personalPrayersCacheKey(this.getActiveTenantId());
    if (!key) return null;
    return this.cache.get<PrayerRequest[]>(key);
  }

  getStalePersonalPrayers(): PrayerRequest[] | null {
    const key = this.personalPrayersCacheKey(this.getActiveTenantId());
    if (!key) return null;
    return this.cache.getStale?.<PrayerRequest[]>(key) ?? null;
  }

  invalidatePersonalPrayersCacheAll(): void {
    this.cache.invalidateCategory?.("personalTenant_");
  }

  clearCatalogOnLogout(): void {
    this.allPersonalPrayersSubject.next([]);
    this.personalCategoriesSubject.next([]);
    this.invalidatePersonalPrayersCacheAll();
  }

  seedPersonalServerCounts(prayers: PrayerRequest[]): void {
    seedPrayedForServerCounts(this.personalServerPrayedFor, prayers);
  }

  private withPersonalDisplayCounts(prayers: PrayerRequest[]): PrayerRequest[] {
    return withPrayedForDisplayCounts(prayers, (id) =>
      this.displayPersonalPrayedForCount(id)
    );
  }

  toPersonalServerOnly(prayers: PrayerRequest[]): PrayerRequest[] {
    return toPrayedForServerOnly(prayers, this.personalServerPrayedFor);
  }

  private personalServerBaseline(prayerId: string): number {
    return prayedForServerBaseline(
      prayerId,
      this.personalServerPrayedFor,
      this.allPersonalPrayersSubject.value.find((p) => p.id === prayerId)
        ?.prayed_for_count ?? 0,
      this.prayedForSync?.getPendingCount(prayerId, "personal_prayer") ?? 0
    );
  }

  displayPersonalPrayedForCount(prayerId: string): number {
    const server = this.personalServerBaseline(prayerId);
    return (
      this.prayedForSync?.displayCount(server, prayerId, "personal_prayer") ??
      server
    );
  }

  reprojectPersonalPrayers(): void {
    const updated = this.withPersonalDisplayCounts(
      this.toPersonalServerOnly(this.allPersonalPrayersSubject.value)
    );
    this.allPersonalPrayersSubject.next(updated);
    this.cache.set(
      this.personalPrayersCacheKey(this.getActiveTenantId()),
      this.toPersonalServerOnly(updated)
    );
  }

  publishPersonalPrayers(serverPrayers: PrayerRequest[]): void {
    this.seedPersonalServerCounts(serverPrayers);
    const displayed = this.withPersonalDisplayCounts(serverPrayers);
    this.allPersonalPrayersSubject.next(displayed);
    this.setPersonalPrayersCache(this.toPersonalServerOnly(serverPrayers));
  }

  private setPersonalPrayersState(prayers: PrayerRequest[]): void {
    this.allPersonalPrayersSubject.next(prayers);
    this.setPersonalPrayersCache(this.toPersonalServerOnly(prayers));
  }

  private setPersonalCategoriesState(categories: PersonalCategory[]): void {
    this.personalCategoriesSubject.next(categories);
  }

  private upsertLocalPersonalCategory(
    categoryId: string,
    name: string
  ): void {
    const existing = this.personalCategoriesSubject.value;
    if (existing.some((category) => category.id === categoryId)) {
      return;
    }
    const nextOrder =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((category) => category.display_order)) + 1;
    this.setPersonalCategoriesState([
      ...existing,
      { id: categoryId, name, display_order: nextOrder, color: null },
    ]);
  }

  private categoryQueryDeps(): PersonalCategoryQueryWireDeps {
    return {
      client: this.supabase.client,
      getUserEmail: () => this.getUserEmail(),
      getTenantId: () => this.getActiveTenantId(),
    };
  }

  private personalCategoryOrchestrationDeps() {
    return buildPersonalCategoryOrchestrationDeps({
      queryDeps: this.categoryQueryDeps(),
      getUserEmail: () => this.getUserEmail(),
      getPrayers: () => this.allPersonalPrayersSubject.value,
      setPrayers: (prayers) => this.setPersonalPrayersState(prayers),
      getCategories: () => this.personalCategoriesSubject.value,
      setCategories: (categories) => this.setPersonalCategoriesState(categories),
    });
  }

  private personalCategoryDeps() {
    return createPersonalCategoryDeps(this.categoryQueryDeps(), (name) =>
      ensurePersonalCategoryForTenant(this.categoryQueryDeps(), name)
    );
  }

  isPersonalPrayerDisplayOrderOnlyChange(
    oldRow: Record<string, unknown> | undefined,
    newRow: Record<string, unknown> | undefined
  ): boolean {
    return isPersonalPrayerDisplayOrderOnlyDbChange(oldRow, newRow);
  }

  async loadPersonalPrayers(silentRefresh = false): Promise<void> {
    try {
      this.loadingPersonalPrayersSubject.next(true);
      console.log("[PrayerService] Loading personal prayers...");

      const tenantId = this.getActiveTenantId();
      const userEmail = await this.getUserEmail();
      if (!userEmail) {
        console.warn(
          "[PrayerService] User email not available for personal prayers"
        );
        this.loadingPersonalPrayersSubject.next(false);
        return;
      }

      const cacheKey = this.personalPrayersCacheKey(tenantId);
      const cachedPersonalPrayers =
        this.cache.get<PrayerRequest[]>(cacheKey) ||
        (!this.connectivity.isOnline()
          ? this.cache.getStale<PrayerRequest[]>(cacheKey)
          : null);
      if (cachedPersonalPrayers && cachedPersonalPrayers.length > 0) {
        console.log(
          `[PrayerService] Using cached personal prayers (${cachedPersonalPrayers.length} items)`
        );
        this.seedPersonalServerCounts(cachedPersonalPrayers);
        this.allPersonalPrayersSubject.next(
          this.withPersonalDisplayCounts(cachedPersonalPrayers)
        );

        if (silentRefresh || !this.connectivity.isOnline()) {
          console.log(
            "[PrayerService] Cache hit — skipping personal prayers database query"
          );
          this.loadingPersonalPrayersSubject.next(false);
          if (this.connectivity.isOnline()) {
            void this.loadPersonalCategories(false);
          }
          return;
        }
      }

      if (!this.connectivity.isOnline()) {
        console.log("[PrayerService] Offline with no personal prayer cache");
        this.allPersonalPrayersSubject.next([]);
        this.loadingPersonalPrayersSubject.next(false);
        return;
      }

      const { data, error } = await fetchPersonalPrayersList(
        this.supabase.client,
        userEmail,
        tenantId
      );
      if (error) throw error;

      await this.loadPersonalCategories(true);

      const personalPrayers = sortPersonalPrayersForListing(
        personalPrayersFromDbRows(
          data || [],
          (row) => personalPrayerRowToPrayerRequest(row as PersonalPrayerDbRow),
          (prayers) => prayers
        ),
        this.personalCategoriesSubject.value
      );

      console.log(
        `[PrayerService] Loaded ${personalPrayers.length} personal prayers from database`
      );
      this.publishPersonalPrayers(personalPrayers);
      this.loadingPersonalPrayersSubject.next(false);
    } catch (err) {
      console.error("[PrayerService] Failed to load personal prayers:", err);

      const userEmail = await this.getUserEmail();
      const cacheFallback = planPersonalPrayerLoadCacheFallback(
        this.getPersonalPrayersCached() || this.getStalePersonalPrayers(),
        userEmail
      );
      applyPersonalPrayerLoadCacheFallbackPlan(cacheFallback, {
        applyCachedSnapshot: (prayers) => {
          console.log(
            `[PrayerService] Showing ${prayers.length} cached personal prayers`
          );
          this.seedPersonalServerCounts(prayers);
          this.allPersonalPrayersSubject.next(
            this.withPersonalDisplayCounts(prayers)
          );
        },
        invalidatePersonalCache: () => this.invalidatePersonalPrayersCacheAll(),
        clearPersonalPrayers: () => {
          console.warn(
            "[PrayerService] Cached personal prayers do not match current user - discarding cache"
          );
          this.allPersonalPrayersSubject.next([]);
        },
      });
      this.loadingPersonalPrayersSubject.next(false);
    }
  }

  async incrementPersonalPrayedFor(prayerId: string): Promise<number | null> {
    const userEmail = this.userSessionService.getUserEmail();
    if (!userEmail) {
      return null;
    }
    this.personalServerBaseline(prayerId);
    if (!this.prayedForSync?.enqueue("personal_prayer", prayerId)) {
      return null;
    }
    void this.prayedForSync.flush();
    return this.displayPersonalPrayedForCount(prayerId);
  }

  async loadPersonalCategories(forceRefresh = false): Promise<PersonalCategory[]> {
    const tenantId = this.getActiveTenantId();
    const userEmail = await this.getUserEmail();
    if (!tenantId || !userEmail) {
      return this.personalCategoriesSubject.value;
    }

    if (!forceRefresh && this.personalCategoriesSubject.value.length > 0) {
      return this.personalCategoriesSubject.value;
    }

    if (!this.connectivity.isOnline()) {
      return this.personalCategoriesSubject.value;
    }

    try {
      const { data, error } = await fetchPersonalCategoriesList(
        this.supabase.client,
        userEmail,
        tenantId
      );
      if (error) {
        console.error("[PrayerService] Failed to load personal categories:", error);
        return this.personalCategoriesSubject.value;
      }

      const categories = data ?? [];
      this.setPersonalCategoriesState(categories);
      return categories;
    } catch (error) {
      console.error("[PrayerService] Failed to load personal categories:", error);
      return this.personalCategoriesSubject.value;
    }
  }

  async getPersonalPrayers(
    forceRefresh: boolean = false
  ): Promise<PrayerRequest[]> {
    try {
      const tenantId = this.getActiveTenantId();
      const userEmail = await this.getUserEmail();
      if (!userEmail) {
        console.error("User email not available");
        return [];
      }

      const cacheKey = this.personalPrayersCacheKey(tenantId);
      if (!forceRefresh) {
        const cached = this.cache.get<PrayerRequest[]>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      const { data, error } = await fetchPersonalPrayersList(
        this.supabase.client,
        userEmail,
        tenantId
      );
      if (error) {
        console.error("[PrayerService] Error querying personal_prayers:", error);
        throw error;
      }

      const prayers = personalPrayersFromDbRows(
        data || [],
        (row) => {
          const mapped = personalPrayerRowToPrayerRequest(
            row as PersonalPrayerDbRow
          );
          const { user_email: _userEmail, ...rest } = mapped;
          return rest as PrayerRequest;
        },
        (mapped) => mapped
      );

      this.seedPersonalServerCounts(prayers);
      this.setPersonalPrayersCache(prayers);
      return this.withPersonalDisplayCounts(prayers);
    } catch (error) {
      console.error("[PrayerService] Failed to load personal prayers:", error);
      return [];
    }
  }

  async addPersonalPrayer(
    prayer: Omit<
      PrayerRequest,
      | "id"
      | "date_requested"
      | "created_at"
      | "updated_at"
      | "updates"
      | "approval_status"
    >
  ): Promise<boolean> {
    if (!this.connectivity.requireOnline("add a personal prayer")) {
      return false;
    }
    try {
      const tenantId = this.getActiveTenantId();
      const userEmail = await this.getUserEmail();
      if (!userEmail) {
        this.toast.error("User email not available");
        return false;
      }

      console.log("Adding personal prayer for email:", userEmail);

      const addPlan = await planPersonalPrayerAdd(
        prayer.category,
        userEmail,
        (category) => sanitizePersonalPrayerCategory(category),
        this.personalCategoryDeps()
      );
      if (!addPlan.ok) {
        this.toast.error(addPlan.userMessage);
        return false;
      }
      const {
        category,
        categoryId,
        displayOrder: newDisplayOrder,
      } = addPlan;

      const prayerData = buildPersonalPrayerInsertRow(
        prayer,
        categoryId,
        userEmail,
        newDisplayOrder,
        tenantId
      );

      const { data, error } = await insertPersonalPrayerRow(
        this.supabase.client,
        prayerData
      );
      if (error) throw error;

      const updatedPrayers = personalPrayerListAfterInsert(
        this.allPersonalPrayersSubject.value,
        data,
        userEmail,
        newDisplayOrder,
        (row, email, order) =>
          personalPrayerRequestFromInsertedRow(
            row as Parameters<typeof personalPrayerRequestFromInsertedRow>[0],
            email,
            order,
            category
          ),
        (p) => p
      );
      this.setPersonalPrayersState(updatedPrayers);
      if (category && categoryId) {
        this.upsertLocalPersonalCategory(categoryId, category);
      }

      this.toast.success("Personal prayer added successfully");
      return true;
    } catch (error) {
      console.error("Error adding personal prayer:", error);
      this.toast.error(
        `Failed to add personal prayer: ${extractSupabaseErrorMessage(error)}`
      );
      return false;
    }
  }

  async deletePersonalPrayer(id: string): Promise<boolean> {
    if (!this.connectivity.requireOnline("delete a personal prayer")) {
      return false;
    }
    try {
      const tenantId = this.getActiveTenantId();
      const userEmail = await this.getUserEmail();
      if (!userEmail) {
        this.toast.error("User email not available");
        return false;
      }

      const { error } = await deletePersonalPrayerRow(
        this.supabase.client,
        id,
        userEmail,
        tenantId
      );
      if (error) throw error;

      this.setPersonalPrayersState(
        removePersonalPrayerById(this.allPersonalPrayersSubject.value, id)
      );

      this.toast.success("Personal prayer deleted");
      return true;
    } catch (error) {
      console.error("Error deleting personal prayer:", error);
      this.toast.error("Failed to delete personal prayer");
      return false;
    }
  }

  async updatePersonalPrayer(
    id: string,
    updates: Partial<
      Pick<PrayerRequest, "title" | "prayer_for" | "description" | "category">
    >
  ): Promise<boolean> {
    if (!this.connectivity.requireOnline("update a personal prayer")) {
      return false;
    }
    try {
      const tenantId = this.getActiveTenantId();
      const userEmail = await this.getUserEmail();
      if (!userEmail) {
        this.toast.error("User email not available");
        return false;
      }

      const startPlan = startPersonalPrayerUpdatePlan(
        this.allPersonalPrayersSubject.value,
        id,
        updates,
        (category) => sanitizePersonalPrayerCategory(category)
      );
      if (!startPlan.ok) {
        this.toast.error("Prayer not found");
        return false;
      }

      const { currentPrayer, newCategory, categoryChanged } = startPlan;
      const categoryChangePlan =
        await resolvePersonalPrayerCategoryChangeDisplayOrder(
          categoryChanged,
          updates.category !== undefined,
          newCategory,
          currentPrayer.category_id,
          currentPrayer.display_order,
          this.personalCategoryDeps()
        );
      if (!categoryChangePlan.ok) {
        this.toast.error(categoryChangePlan.userMessage);
        return false;
      }
      const newDisplayOrder = categoryChangePlan.displayOrder;
      const newCategoryId = categoryChangePlan.categoryId;

      const updateData = buildPersonalPrayerDbUpdatePayload(
        updates,
        newCategoryId,
        categoryChanged,
        newDisplayOrder
      );
      const updatedAt = updateData["updated_at"] as string;

      const { error } = await updatePersonalPrayerRow(
        this.supabase.client,
        id,
        userEmail,
        updateData,
        tenantId
      );
      if (error) throw error;

      this.setPersonalPrayersState(
        applyPersonalPrayerFieldUpdate(
          this.allPersonalPrayersSubject.value,
          id,
          {
            updates,
            newCategory,
            newCategoryId,
            newDisplayOrder,
            clearingAnswered: false,
            updatedAt,
          }
        )
      );
      if (newCategory && newCategoryId) {
        this.upsertLocalPersonalCategory(newCategoryId, newCategory);
      }

      console.log("[PrayerService] Personal prayer updated successfully");
      this.toast.success("Personal prayer updated");
      return true;
    } catch (error) {
      console.error("Error updating personal prayer:", error);
      this.toast.error("Failed to update personal prayer");
      return false;
    }
  }

  async updatePersonalPrayerOrder(
    prayers: PrayerRequest[],
    _categoryFilter?: string
  ): Promise<boolean> {
    if (!this.connectivity.requireOnline("reorder personal prayers")) {
      return false;
    }
    const tenantId = this.getActiveTenantId();
    if (!tenantId) {
      console.error("[PrayerService] No active tenant for order update");
      return false;
    }
    return orchestratePersonalPrayerOrderUpdate(
      prayers,
      this.personalCategoryOrchestrationDeps()
    );
  }

  async updatePersonalPrayerUpdate(
    updateId: string,
    prayerId: string,
    updates: Partial<Pick<PrayerUpdate, "content">>
  ): Promise<boolean> {
    if (!this.connectivity.requireOnline("update a personal prayer")) {
      return false;
    }
    try {
      const userEmail = await this.getUserEmail();
      if (!userEmail) {
        this.toast.error("User email not available");
        return false;
      }

      const updateData = personalPrayerUpdatePatchWithTimestamp(updates);
      const { error } = await updatePersonalPrayerUpdateRow(
        this.supabase.client,
        updateId,
        updateData
      );
      if (error) throw error;

      this.setPersonalPrayersState(
        patchPersonalPrayerUpdateLocally(
          this.allPersonalPrayersSubject.value,
          prayerId,
          updateId,
          updates
        )
      );

      console.log("[PrayerService] Personal prayer update updated successfully");
      return true;
    } catch (error) {
      console.error("Error updating personal prayer update:", error);
      this.toast.error("Failed to update prayer update");
      return false;
    }
  }

  async getUniqueCategoriesForUser(
    prayers?: PrayerRequest[]
  ): Promise<string[]> {
    if (prayers) {
      return personalCategoryNamesFromPrayers(prayers);
    }
    const loaded = this.personalCategoriesSubject.value;
    if (loaded.length > 0) {
      return [...loaded]
        .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name))
        .map((category) => category.name);
    }
    return personalCategoryNamesFromPrayers(this.allPersonalPrayersSubject.value);
  }

  async renamePersonalCategory(
    oldCategory: string,
    newCategory: string,
    options?: { reservedCategoryNames?: string[] }
  ): Promise<boolean> {
    return orchestratePersonalCategoryRename(
      oldCategory,
      newCategory,
      {
        requireOnline: () =>
          this.connectivity.requireOnline("rename a category"),
        toastError: (message) => this.toast.error(message),
        sanitize: (category) => sanitizePersonalPrayerCategory(category),
        getUniqueCategoryNames: () => this.getUniqueCategoriesForUser(),
        getTenantId: () => this.getActiveTenantId(),
        getUserEmail: () => this.getUserEmail(),
        client: this.supabase.client,
        local: {
          getPrayers: () => this.allPersonalPrayersSubject.value,
          setPrayers: (prayers) => this.setPersonalPrayersState(prayers),
          getCategories: () => this.personalCategoriesSubject.value,
          setCategories: (categories) => this.setPersonalCategoriesState(categories),
        },
      },
      options
    );
  }

  async createPersonalCategory(
    name: string,
    color: string
  ): Promise<CreatePersonalCategoryResult> {
    const sanitizedName = sanitizePersonalCategoryName(name);
    const normalizedColor = normalizePersonalCategoryHexColor(color);
    if (!sanitizedName) {
      return { ok: false, reason: "empty" };
    }
    if (!normalizedColor) {
      return { ok: false, reason: "failed" };
    }
    if (sanitizedName.toLowerCase() === "answered") {
      return { ok: false, reason: "duplicate" };
    }

    const exists = this.personalCategoriesSubject.value.some(
      (category) => category.name.toLowerCase() === sanitizedName.toLowerCase()
    );
    if (exists) {
      return { ok: false, reason: "duplicate" };
    }

    if (!this.connectivity.requireOnline("create a category")) {
      return { ok: false, reason: "failed" };
    }

    try {
      const categoryId = await ensurePersonalCategoryForTenant(
        this.categoryQueryDeps(),
        sanitizedName
      );
      const { error } = await this.supabase.client
        .from("personal_categories")
        .update({ color: normalizedColor })
        .eq("id", categoryId);
      if (error) {
        throw error;
      }
      await this.loadPersonalCategories(true);
      return { ok: true, name: sanitizedName };
    } catch (error) {
      console.error("[PrayerService] createPersonalCategory failed:", error);
      return { ok: false, reason: "failed" };
    }
  }

  async deletePersonalCategory(category: string): Promise<boolean> {
    return orchestratePersonalCategoryDelete(category, {
      requireOnline: () =>
        this.connectivity.requireOnline("delete a category"),
      toastError: (message) => this.toast.error(message),
      sanitize: (categoryName) => sanitizePersonalPrayerCategory(categoryName),
      getTenantId: () => this.getActiveTenantId(),
      getUserEmail: () => this.getUserEmail(),
      client: this.supabase.client,
      local: {
        getPrayers: () => this.allPersonalPrayersSubject.value,
        setPrayers: (prayers) => this.setPersonalPrayersState(prayers),
        getCategories: () => this.personalCategoriesSubject.value,
        setCategories: (categories) =>
          this.setPersonalCategoriesState(categories),
      },
    });
  }

  async addPersonalPrayerUpdate(
    personalPrayerId: string,
    content: string,
    author: string,
    authorEmail: string,
    markAsAnswered: boolean = false
  ): Promise<boolean> {
    if (!this.connectivity.requireOnline("add a personal prayer update")) {
      return false;
    }
    const trimmedContent = (content ?? "").trim();
    if (!trimmedContent) {
      this.toast.error("Update content is required");
      return false;
    }
    try {
      const updateData = buildPersonalPrayerUpdateInsertRow(
        personalPrayerId,
        trimmedContent,
        author,
        authorEmail,
        markAsAnswered
      );

      console.log("Adding personal prayer update with data:", updateData);

      const { data, error } = await insertPersonalPrayerUpdateRow(
        this.supabase.client,
        updateData
      );
      if (error) throw error;

      console.log("Personal prayer update added successfully:", data);

      const insertedRow = Array.isArray(data) ? data[0] : data;
      if (insertedRow) {
        const newUpdate = mapDbPersonalPrayerUpdateRow(
          personalPrayerId,
          insertedRow as Parameters<typeof mapDbPersonalPrayerUpdateRow>[1]
        );
        this.setPersonalPrayersState(
          appendPersonalPrayerUpdate(
            this.allPersonalPrayersSubject.value,
            personalPrayerId,
            newUpdate
          )
        );
      }

      this.toast.success("Update added to personal prayer");
      return true;
    } catch (error) {
      console.error("Error adding personal prayer update:", error);
      this.toast.error(
        `Failed to add update: ${extractSupabaseErrorMessage(error)}`
      );
      return false;
    }
  }

  async deletePersonalPrayerUpdate(updateId: string): Promise<boolean> {
    if (!this.connectivity.requireOnline("delete a personal prayer update")) {
      return false;
    }
    try {
      const userEmail = await this.getUserEmail();
      if (!userEmail) {
        this.toast.error("User email not available");
        return false;
      }

      const { error: deleteError } = await deletePersonalPrayerUpdateRow(
        this.supabase.client,
        updateId,
        userEmail
      );
      if (deleteError) throw deleteError;

      this.setPersonalPrayersState(
        removePersonalPrayerUpdateById(
          this.allPersonalPrayersSubject.value,
          updateId
        )
      );

      this.toast.success("Update deleted");
      return true;
    } catch (error) {
      console.error("Error deleting personal prayer update:", error);
      this.toast.error("Failed to delete update");
      return false;
    }
  }

  async markPersonalPrayerUpdateAsAnswered(updateId: string): Promise<boolean> {
    if (!this.connectivity.requireOnline("update a personal prayer")) {
      return false;
    }
    try {
      const { error } = await markPersonalPrayerUpdateAnsweredRow(
        this.supabase.client,
        updateId
      );
      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error marking personal prayer update as answered:", error);
      this.toast.error("Failed to mark update as answered");
      return false;
    }
  }

  async reorderCategories(orderedIds: string[]): Promise<boolean> {
    if (!this.connectivity.requireOnline("reorder categories")) {
      return false;
    }
    const tenantId = this.getActiveTenantId();
    if (!tenantId) {
      console.error("[PrayerService] No active tenant for category reorder");
      return false;
    }
    const success = await orchestratePersonalCategoryReorder(
      orderedIds,
      this.personalCategoryOrchestrationDeps()
    );
    if (success) {
      this.setPersonalPrayersState(
        sortPersonalPrayersForListing(
          this.allPersonalPrayersSubject.value,
          this.personalCategoriesSubject.value
        )
      );
    }
    return success;
  }

  async sharePrayerForApproval(personalPrayerId: string): Promise<string> {
    if (!this.connectivity.requireOnline("share a prayer")) {
      return "";
    }
    try {
      const tenantId = this.getActiveTenantId();
      if (!tenantId) {
        throw new Error("Select an organization to share a personal prayer.");
      }

      const { data: personalPrayer, error: fetchError } =
        await fetchPersonalPrayerForShare(
          this.supabase.client,
          personalPrayerId,
          tenantId
        );
      if (fetchError)
        throw new Error(
          `Failed to fetch personal prayer: ${(fetchError as Error).message}`
        );
      if (!personalPrayer) throw new Error("Personal prayer not found");

      const session = await this.userSessionService.userSession$
        .pipe(first())
        .toPromise();
      const requesterName = resolveSharedPrayerRequesterName(
        session?.fullName,
        personalPrayer.user_email
      );

      const publicPrayerData = buildSharedPersonalPrayerCommunityRow(
        personalPrayer,
        requesterName,
        tenantId
      );

      const { data: newPrayer, error: createError } =
        await insertSharedCommunityPrayerRow(
          this.supabase.client,
          publicPrayerData
        );
      if (createError)
        throw new Error(
          `Failed to create public prayer: ${(createError as Error).message}`
        );
      if (!newPrayer) throw new Error("Failed to create public prayer");

      const updatesCopy = buildSharedPersonalPrayerUpdateRows(
        personalPrayer,
        newPrayer.id,
        tenantId
      );
      if (updatesCopy.length > 0) {
        const { error: updatesCopyError } =
          await insertSharedCommunityPrayerUpdates(
            this.supabase.client,
            updatesCopy
          );
        if (updatesCopyError) {
          console.error(
            "Failed to copy updates, but public prayer was created:",
            updatesCopyError
          );
        }
      }

      this.emailNotification
        .sendAdminNotification({
          type: "prayer",
          title: personalPrayer.title,
          description: personalPrayer.description,
          requester: requesterName,
          requestId: newPrayer.id,
          tenantId,
        })
        .catch((err) =>
          console.error("Failed to send admin notification:", err)
        );

      await this.facadeHooks.loadPersonalPrayers();
      this.toast.success(
        "Prayer shared! It has been submitted for admin approval."
      );
      return newPrayer.id;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to share prayer";
      console.error("[PrayerService] Error sharing prayer:", error);
      this.toast.error(errorMessage);
      throw error;
    }
  }

  private async getUserEmail(): Promise<string | null> {
    return this.facadeHooks.getUserEmail();
  }
}
