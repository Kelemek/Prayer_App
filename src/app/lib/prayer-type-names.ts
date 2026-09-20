/** First-seen order; drops duplicate type names (e.g. duplicate DB rows). */
export function uniquePrayerTypeNamesInOrder(
  rows: ReadonlyArray<{ name: string }>
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const name = row.name?.trim();
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  return names;
}
