import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TenantAccessService } from '../../services/tenant-access.service';

/** Legacy `/join/:token` links redirect into the request-access flow. */
@Component({
  selector: 'app-join-redirect',
  standalone: true,
  template: `<p class="p-8 text-center text-sm text-gray-600">Redirecting…</p>`,
})
export class JoinRedirectComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly tenantAccess = inject(TenantAccessService);

  async ngOnInit(): Promise<void> {
    const tenant = await this.tenantAccess.resolveTargetTenant(null);
    if (tenant) {
      await this.router.navigate(['/request-access'], { replaceUrl: true });
      return;
    }
    await this.router.navigate(['/'], { replaceUrl: true });
  }
}
