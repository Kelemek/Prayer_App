/** True when usage is at or above ratio of max but still below the hard cap. */
export function isNearQuota(used: number, max: number, ratio = 0.8): boolean {
  return max > 0 && used < max && used / max >= ratio;
}
