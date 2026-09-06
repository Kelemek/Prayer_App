import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyPersonalCategoriesDeleteLocally,
  applyPersonalCategoriesRenameLocally,
  applyPersonalCategoriesReorderLocally,
  applyPersonalCategoryDeleteLocally,
  applyPersonalCategoryRenameLocally,
  findPersonalCategoryIdByName,
  validatePersonalCategoryRename,
} from './prayer-personal-category';
import {
  rpcDeletePersonalCategory,
  rpcRenamePersonalCategory,
  rpcReorderPersonalCategories,
} from './prayer-personal-db';
import { runPersonalPrayerOrderRpcPerCategory } from './prayer-personal-order-rpc';
import type { PersonalCategory } from '../types/personal-category';
import type { PrayerRequest } from './prayer-types';

export type PersonalCategoryLocalActions = {
  getPrayers: () => PrayerRequest[];
  setPrayers: (prayers: PrayerRequest[]) => void;
  getCategories: () => PersonalCategory[];
  setCategories: (categories: PersonalCategory[]) => void;
};

export type PersonalCategoryOrchestrationDeps = {
  getUserEmail: () => Promise<string | null>;
  getTenantId?: () => string | null;
  client: SupabaseClient;
  local: PersonalCategoryLocalActions;
  runPrayerOrderRpc: (
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: unknown }>;
};

export function applyPersonalCategoryRenameSnapshot(
  actions: PersonalCategoryLocalActions,
  oldName: string,
  newName: string
): void {
  actions.setPrayers(
    applyPersonalCategoryRenameLocally(actions.getPrayers(), oldName, newName)
  );
  actions.setCategories(
    applyPersonalCategoriesRenameLocally(actions.getCategories(), oldName, newName)
  );
}

export function applyPersonalCategoryDeleteSnapshot(
  actions: PersonalCategoryLocalActions,
  categoryName: string
): void {
  actions.setPrayers(
    applyPersonalCategoryDeleteLocally(actions.getPrayers(), categoryName)
  );
  actions.setCategories(
    applyPersonalCategoriesDeleteLocally(actions.getCategories(), categoryName)
  );
}

export async function orchestratePersonalCategoryReorder(
  orderedIds: string[],
  deps: PersonalCategoryOrchestrationDeps
): Promise<boolean> {
  try {
    const userEmail = await deps.getUserEmail();
    if (!userEmail) {
      console.error('[PrayerService] User email not available for category reorder');
      return false;
    }

    if (orderedIds.length === 0) {
      return true;
    }

    const previous = deps.local.getCategories();
    deps.local.setCategories(
      applyPersonalCategoriesReorderLocally(previous, orderedIds)
    );

    const { error } = await rpcReorderPersonalCategories(deps.client, orderedIds);
    if (error) {
      deps.local.setCategories(previous);
      console.error('[PrayerService] Reorder categories failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[PrayerService] Error reordering categories:', error);
    return false;
  }
}

export async function orchestratePersonalPrayerOrderUpdate(
  prayers: PrayerRequest[],
  deps: PersonalCategoryOrchestrationDeps
): Promise<boolean> {
  try {
    const userEmail = await deps.getUserEmail();
    if (!userEmail) {
      console.error('[PrayerService] User email not available for order update');
      return false;
    }

    const rpcResult = await runPersonalPrayerOrderRpcPerCategory(
      prayers,
      (args) => deps.runPrayerOrderRpc(args)
    );

    if (!rpcResult.ok) {
      console.error('[PrayerService] Reorder prayers failed:', rpcResult.message);
      return false;
    }

    console.log('[PrayerService] Personal prayer order updated successfully');
    return true;
  } catch (error) {
    console.error('[PrayerService] Error updating personal prayer order:', error);
    return false;
  }
}

export type PersonalCategoryRenameDeps = {
  requireOnline: () => boolean;
  toastError: (message: string) => void;
  sanitize: (category: string | null | undefined) => string | null;
  getUniqueCategoryNames: () => Promise<string[]>;
  getTenantId: () => string | null;
  getUserEmail: () => Promise<string | null>;
  client: SupabaseClient;
  local: PersonalCategoryLocalActions;
};

export async function orchestratePersonalCategoryRename(
  oldCategory: string,
  newCategory: string,
  deps: PersonalCategoryRenameDeps,
  options?: { reservedCategoryNames?: string[] }
): Promise<boolean> {
  if (!deps.requireOnline()) {
    return false;
  }

  const validation = validatePersonalCategoryRename(
    oldCategory,
    newCategory,
    deps.sanitize,
    await deps.getUniqueCategoryNames(),
    options?.reservedCategoryNames ?? []
  );

  if (!validation.ok) {
    deps.toastError(validation.errorMessage);
    return false;
  }

  if (validation.unchanged) {
    return true;
  }

  const { oldName, newName } = validation;
  const tenantId = deps.getTenantId();
  if (!tenantId) {
    deps.toastError('No active organization selected');
    return false;
  }

  try {
    const userEmail = await deps.getUserEmail();
    if (!userEmail) {
      deps.toastError('User email not available');
      return false;
    }

    const categoryId = findPersonalCategoryIdByName(
      deps.local.getCategories(),
      oldName
    );
    if (!categoryId) {
      deps.toastError('Category not found');
      return false;
    }

    const { error } = await rpcRenamePersonalCategory(
      deps.client,
      categoryId,
      newName
    );
    if (error) {
      throw error;
    }

    applyPersonalCategoryRenameSnapshot(deps.local, oldName, newName);
    return true;
  } catch (error) {
    console.error('[PrayerService] Error renaming personal category:', error);
    deps.toastError('Failed to rename category');
    return false;
  }
}

export type PersonalCategoryDeleteDeps = {
  requireOnline: () => boolean;
  toastError: (message: string) => void;
  sanitize: (category: string | null | undefined) => string | null;
  getTenantId: () => string | null;
  getUserEmail: () => Promise<string | null>;
  client: SupabaseClient;
  local: PersonalCategoryLocalActions;
};

export async function orchestratePersonalCategoryDelete(
  category: string,
  deps: PersonalCategoryDeleteDeps
): Promise<boolean> {
  if (!deps.requireOnline()) {
    return false;
  }

  const categoryName = deps.sanitize(category);
  if (!categoryName) {
    deps.toastError('Category name is required');
    return false;
  }

  const tenantId = deps.getTenantId();
  if (!tenantId) {
    deps.toastError('No active organization selected');
    return false;
  }

  try {
    const userEmail = await deps.getUserEmail();
    if (!userEmail) {
      deps.toastError('User email not available');
      return false;
    }

    const categoryId = findPersonalCategoryIdByName(
      deps.local.getCategories(),
      categoryName
    );
    if (!categoryId) {
      deps.toastError('Category not found');
      return false;
    }

    const { error } = await rpcDeletePersonalCategory(deps.client, categoryId);
    if (error) {
      throw error;
    }

    applyPersonalCategoryDeleteSnapshot(deps.local, categoryName);
    return true;
  } catch (error) {
    console.error('[PrayerService] Error deleting personal category:', error);
    deps.toastError('Failed to delete category');
    return false;
  }
}
