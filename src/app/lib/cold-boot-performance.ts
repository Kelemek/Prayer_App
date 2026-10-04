/**
 * Dev-only cold boot timing. Enable with `?cold_boot_perf=1` or
 * `localStorage.setItem('cold_boot_perf', '1')`.
 */

const STORAGE_KEY = 'cold_boot_perf';
const QUERY_PARAM = 'cold_boot_perf';

export function isColdBootPerfEnabled(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') {
      return true;
    }
    return new URLSearchParams(window.location.search).get(QUERY_PARAM) === '1';
  } catch {
    return false;
  }
}

export function markColdBoot(phase: string): void {
  if (!isColdBootPerfEnabled()) {
    return;
  }
  try {
    performance.mark(`cold-boot:${phase}`);
  } catch {
    // Ignore when Performance API unavailable.
  }
}

export function measureColdBoot(
  name: string,
  startPhase: string,
  endPhase: string
): void {
  if (!isColdBootPerfEnabled()) {
    return;
  }
  try {
    performance.measure(
      `cold-boot:${name}`,
      `cold-boot:${startPhase}`,
      `cold-boot:${endPhase}`
    );
    const entries = performance.getEntriesByName(`cold-boot:${name}`);
    const last = entries[entries.length - 1];
    if (last) {
      console.info(
        `[ColdBoot] ${name}: ${Math.round(last.duration)}ms (${startPhase} → ${endPhase})`
      );
    }
  } catch {
    // Missing marks or duplicate measure names.
  }
}
