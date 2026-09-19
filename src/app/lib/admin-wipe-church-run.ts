import type { Router } from '@angular/router';
import { getPlatformOrigin } from './app-origin';
import { isTenantSlugHost, parseHost } from './tenant-host';
import { environment } from '../../environments/environment';
import type { SupabaseService } from '../services/supabase.service';
import type { TenantContextService } from '../services/tenant-context.service';
import { describeFunctionInvokeFailure } from '../utils/supabase-function-invoke-error';

export interface WipeChurchInvokeResult {
  success: boolean;
  alreadyWiped?: boolean;
  ops?: string[];
  error?: string;
}

export async function invokeWipeChurchTenant(
  supabase: SupabaseService,
  tenantId: string,
  confirmSlug: string
): Promise<WipeChurchInvokeResult> {
  const { data, error, response } = await supabase.client.functions.invoke('wipe-church-tenant', {
    body: { tenant_id: tenantId, confirm_slug: confirmSlug },
  });

  if (error) {
    return {
      success: false,
      error: await describeFunctionInvokeFailure(error, response, 'wipe-church-tenant'),
    };
  }

  if (!data || typeof data !== 'object' || (data as { success?: unknown }).success !== true) {
    const message =
      data &&
      typeof data === 'object' &&
      typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : 'Could not delete church. Please try again.';
    return { success: false, error: message };
  }

  const body = data as {
    already_wiped?: boolean;
    ops?: string[];
  };

  return {
    success: true,
    alreadyWiped: Boolean(body.already_wiped),
    ops: Array.isArray(body.ops) ? body.ops.filter((o): o is string => typeof o === 'string') : [],
  };
}

export async function navigateAfterChurchWipe(
  wipedSlug: string,
  tenantContext: TenantContextService,
  router: Router
): Promise<void> {
  if (typeof window !== 'undefined') {
    const parsed = parseHost(window.location.hostname, {
      platformHosts: environment.platformHosts ?? [],
      tenantHostSuffix: environment.tenantHostSuffix ?? '',
    });
    if (isTenantSlugHost(parsed) && parsed.slug.toLowerCase() === wipedSlug.toLowerCase()) {
      const platform = getPlatformOrigin();
      if (platform) {
        window.location.assign(`${platform}/`);
        return;
      }
    }
  }

  await tenantContext.refresh();
  await router.navigate(['/']);
}
