import type { InAppBadgeReadState } from './in-app-prayer-badge-count';

export function addIdsToInAppBadgeReadState(
  readState: InAppBadgeReadState,
  field: keyof InAppBadgeReadState,
  ids: string[]
): { state: InAppBadgeReadState; added: string[] } {
  const added: string[] = [];
  const existing = new Set(readState[field]);
  for (const id of ids) {
    if (!id || existing.has(id)) {
      continue;
    }
    existing.add(id);
    added.push(id);
  }
  if (added.length === 0) {
    return { state: readState, added };
  }
  return {
    state: {
      ...readState,
      [field]: Array.from(existing),
    },
    added,
  };
}
