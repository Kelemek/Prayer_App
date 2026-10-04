/** Stable root element id for an expanded admin settings collapsible (highlights header + body). */
export function adminCollapsibleTourSectionId(triggerId: string): string {
  if (triggerId.endsWith('-trigger')) {
    return triggerId.replace(/-trigger$/, '-section');
  }
  return `${triggerId}-section`;
}
