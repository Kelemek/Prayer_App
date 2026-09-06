import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonalCategoryDeps } from "./prayer-personal-add-plan";
import type { PersonalCategoryOrchestrationDeps } from "./prayer-personal-category-orchestrate";
import {
  queryMaxDisplayOrderForCategoryId,
  rpcEnsurePersonalCategory,
} from "./prayer-personal-db";
import type { PrayerRequest } from "./prayer-types";
import type { PersonalCategory } from "../types/personal-category";

export type PersonalCategoryQueryWireDeps = {
  client: SupabaseClient;
  getUserEmail: () => Promise<string | null>;
  getTenantId?: () => string | null;
};

export function createPersonalCategoryDeps(
  deps: PersonalCategoryQueryWireDeps,
  ensureCategory: (name: string) => Promise<string>
): PersonalCategoryDeps {
  return {
    ensureCategory,
    queryMaxDisplayOrder: async (categoryId) => {
      const userEmail = await deps.getUserEmail();
      if (!userEmail) {
        return { data: null, error: new Error("User email not available") };
      }
      return queryMaxDisplayOrderForCategoryId(
        deps.client,
        userEmail,
        categoryId,
        deps.getTenantId?.()
      );
    },
  };
}

export async function ensurePersonalCategoryForTenant(
  deps: PersonalCategoryQueryWireDeps,
  name: string
): Promise<string> {
  const tenantId = deps.getTenantId?.();
  if (!tenantId) {
    throw new Error("No active organization selected");
  }
  const { data, error } = await rpcEnsurePersonalCategory(
    deps.client,
    name,
    tenantId
  );
  if (error || !data) {
    throw error instanceof Error
      ? error
      : new Error("Failed to save category");
  }
  return data;
}

export type PersonalCategoryOrchestrationWireInput = {
  queryDeps: PersonalCategoryQueryWireDeps;
  getUserEmail: () => Promise<string | null>;
  getPrayers: () => PrayerRequest[];
  setPrayers: (prayers: PrayerRequest[]) => void;
  getCategories: () => PersonalCategory[];
  setCategories: (categories: PersonalCategory[]) => void;
};

export function buildPersonalCategoryOrchestrationDeps(
  input: PersonalCategoryOrchestrationWireInput
): PersonalCategoryOrchestrationDeps {
  return {
    getUserEmail: () => input.getUserEmail(),
    getTenantId: () => input.queryDeps.getTenantId?.() ?? null,
    client: input.queryDeps.client,
    local: {
      getPrayers: () => input.getPrayers(),
      setPrayers: (prayers) => input.setPrayers(prayers),
      getCategories: () => input.getCategories(),
      setCategories: (categories) => input.setCategories(categories),
    },
    runPrayerOrderRpc: async (args) =>
      input.queryDeps.client.rpc("reorder_personal_prayers", args),
  };
}
