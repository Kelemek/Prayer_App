import type {
  MemorizationMasterLevel,
  MemorizedItem,
} from '../../types/memorization';

export function countCompletedSessions(item: MemorizedItem): number {
  return item.practiceSessions.filter((s) => s.completed).length;
}

export function getMasterLevel(item: MemorizedItem): MemorizationMasterLevel {
  const n = countCompletedSessions(item);
  if (n < 3) return 'learning';
  if (n < 9) return 'practicing';
  return 'mastered';
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
