import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantManagementService } from '../../services/tenant-management.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-tenant-claim',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
      <div class="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
        <h1 class="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">Join Tenant</h1>
        <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">Use your invite token to join a group or church tenant.</p>

        <div class="text-xs text-gray-500 dark:text-gray-400 mb-4 break-all">Token: {{ token || 'missing' }}</div>

        <button
          (click)="claimInvite()"
          [disabled]="loading || !token"
          class="w-full px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {{ loading ? 'Claiming...' : 'Claim Invite' }}
        </button>
      </div>
    </div>
  `
})
export class TenantClaimComponent {
  token: string | null = null;
  loading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tenantManagement: TenantManagementService,
    private toast: ToastService
  ) {
    this.token = this.route.snapshot.paramMap.get('token');
  }

  async claimInvite(): Promise<void> {
    if (!this.token || this.loading) return;
    this.loading = true;
    try {
      await this.tenantManagement.claimInvite(this.token);
      this.toast.success('Invite claimed successfully');
      this.router.navigate(['/']);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Failed to claim invite');
    } finally {
      this.loading = false;
    }
  }
}
