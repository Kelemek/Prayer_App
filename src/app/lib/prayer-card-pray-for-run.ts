import type { PrayerService } from '../services/prayer.service';
import type { PrayerEncouragementService } from '../services/prayer-encouragement.service';

export interface PrayerCardPrayForRunInput {
  prayerId: string;
  isMember: boolean;
  isPersonal: boolean;
  usePersonalCooldown: boolean;
}

export interface PrayerCardPrayForRunDeps {
  prayerService: PrayerService;
  prayerEncouragementService: PrayerEncouragementService;
}

/**
 * Records a Pray For click and increments the server count when allowed.
 * Returns the new count, or null when increment failed (cooldown cleared).
 */
export async function runPrayerCardPrayFor(
  deps: PrayerCardPrayForRunDeps,
  input: PrayerCardPrayForRunInput
): Promise<number | null> {
  const { prayerId, isMember, isPersonal, usePersonalCooldown } = input;

  if (
    !deps.prayerEncouragementService.canPrayFor(prayerId, usePersonalCooldown)
  ) {
    return null;
  }

  deps.prayerEncouragementService.recordPrayedFor(prayerId, usePersonalCooldown);

  let newCount: number | null;
  if (isMember) {
    // Member / Planning Center prayers are not a product feature here.
    newCount = null;
  } else if (isPersonal) {
    newCount = await deps.prayerService.incrementPersonalPrayedFor(prayerId);
  } else {
    newCount = await deps.prayerService.incrementPrayedFor(prayerId);
  }

  if (newCount === null) {
    deps.prayerEncouragementService.clearPrayedForCooldown(
      prayerId,
      usePersonalCooldown
    );
  }

  return newCount;
}
