export type SlugAvailabilityStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'taken'
  | 'invalid';

export const TENANT_SLUG_AVAILABILITY_DEBOUNCE_MS = 400;

export function slugAvailabilityBlocksSubmit(status: SlugAvailabilityStatus): boolean {
  return status !== 'available';
}
