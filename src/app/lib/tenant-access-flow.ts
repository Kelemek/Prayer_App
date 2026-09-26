export type TenantAccessState =
  | 'member'
  | 'needs_name'
  | 'blocked'
  | 'pending'
  | 'none';

export type TenantAccessPhase =
  | 'loading'
  | 'name'
  | 'request'
  | 'pending_approval'
  | 'blocked'
  | 'error';

export function nextTenantAccessPhase(
  state: TenantAccessState,
  pcoMatch: boolean | null,
): TenantAccessPhase {
  switch (state) {
    case 'member':
      return 'loading';
    case 'blocked':
      return 'blocked';
    case 'pending':
      return 'pending_approval';
    case 'needs_name':
      return 'name';
    case 'none':
      if (pcoMatch === true) {
        return 'name';
      }
      if (pcoMatch === false) {
        return 'request';
      }
      return 'loading';
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function requiresAffiliationForPhase(phase: TenantAccessPhase): boolean {
  return phase === 'request';
}
