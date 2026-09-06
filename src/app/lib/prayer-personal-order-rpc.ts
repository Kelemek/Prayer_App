import { groupPersonalPrayersByCategoryId, personalPrayerOrderRpcArgs } from './prayer-personal-category';
import type { PrayerRequest } from './prayer-types';

export type PersonalPrayerOrderRpcResult =
  | { ok: true }
  | { ok: false; message: string };

export async function runPersonalPrayerOrderRpcPerCategory(
  prayers: PrayerRequest[],
  rpcReorder: (
    args: ReturnType<typeof personalPrayerOrderRpcArgs>
  ) => Promise<{ data: unknown; error: unknown }>
): Promise<PersonalPrayerOrderRpcResult> {
  const prayersByCategory = groupPersonalPrayersByCategoryId(prayers);

  for (const [categoryId, categoryPrayers] of prayersByCategory) {
    const orderedPrayerIds = categoryPrayers.map((p) => p.id);
    const { error } = await rpcReorder(
      personalPrayerOrderRpcArgs(categoryId, orderedPrayerIds)
    );

    if (error) {
      const message =
        error instanceof Error ? error.message : 'Personal prayer reorder failed';
      return { ok: false, message };
    }
  }

  return { ok: true };
}
