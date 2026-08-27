import type {
  MemorizationMasterLevel,
  MemorizationPracticeSessionRecord,
  MemorizedItem,
} from '../../types/memorization';

export function countCompletedSessions(item: MemorizedItem): number {
  return item.practiceSessions.filter((s) => s.completed).length;
}

export function masterLevelFromCompletedCount(
  completedCount: number
): MemorizationMasterLevel {
  if (completedCount < 3) return 'learning';
  if (completedCount < 9) return 'practicing';
  return 'mastered';
}

export function getMasterLevel(item: MemorizedItem): MemorizationMasterLevel {
  return masterLevelFromCompletedCount(countCompletedSessions(item));
}

export function masterLevelLabel(level: MemorizationMasterLevel): string {
  switch (level) {
    case 'learning':
      return 'Learning';
    case 'practicing':
      return 'Practicing';
    case 'mastered':
      return 'Mastered';
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

export function groupItemsByMasterLevel(items: MemorizedItem[]): {
  learning: MemorizedItem[];
  practicing: MemorizedItem[];
  mastered: MemorizedItem[];
} {
  const learning: MemorizedItem[] = [];
  const practicing: MemorizedItem[] = [];
  const mastered: MemorizedItem[] = [];
  for (const item of items) {
    const level = getMasterLevel(item);
    if (level === 'learning') learning.push(item);
    else if (level === 'practicing') practicing.push(item);
    else mastered.push(item);
  }
  return { learning, practicing, mastered };
}

/** Tenant / list totals for Learning / Practicing / Mastered. */
export function countByMasterLevel(
  items: Array<{ practiceSessions: MemorizationPracticeSessionRecord[] }>
): { learning: number; practicing: number; mastered: number } {
  let learning = 0;
  let practicing = 0;
  let mastered = 0;
  for (const item of items) {
    const completed = item.practiceSessions.filter((s) => s.completed).length;
    const level = masterLevelFromCompletedCount(completed);
    if (level === 'learning') learning += 1;
    else if (level === 'practicing') practicing += 1;
    else mastered += 1;
  }
  return { learning, practicing, mastered };
}
