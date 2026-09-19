import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { Tenant } from '../../types/tenant';
import { AdminWipeChurchDialogComponent } from '../admin-wipe-church-dialog/admin-wipe-church-dialog.component';

@Component({
  selector: 'app-admin-wipe-church',
  standalone: true,
  imports: [CommonModule, AdminWipeChurchDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canWipe && tenant && tenant.slug !== 'default-tenant') {
      <div
        class="mt-6 p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10"
      >
        <h4 class="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">Danger zone</h4>
        <p class="text-sm text-gray-700 dark:text-gray-300 mb-3">
          Permanently delete this church organization. Members keep their accounts and personal
          data.
        </p>
        <button
          type="button"
          (click)="showDialog = true"
          class="px-4 py-2 rounded-md btn-chip btn-chip-red cursor-pointer"
        >
          Delete church
        </button>
      </div>

      <app-admin-wipe-church-dialog
        [tenantId]="tenant.id"
        [tenantName]="tenant.name"
        [tenantSlug]="tenant.slug"
        [open]="showDialog"
        (openChange)="showDialog = $event"
      ></app-admin-wipe-church-dialog>
    }
  `,
})
export class AdminWipeChurchComponent {
  @Input({ required: true }) tenant: Tenant | null = null;
  @Input() canWipe = false;

  showDialog = false;
}
