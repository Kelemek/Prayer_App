/** True when a SECURITY DEFINER tenant-admin RPC rejected the caller. */
export function isTenantAdminRpcUnauthorized(error: { message?: string } | null): boolean {
  return !!error?.message?.includes('Not authorized');
}
