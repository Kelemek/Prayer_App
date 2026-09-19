import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TenantManagementService } from '../../services/tenant-management.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { ToastService } from '../../services/toast.service';
import { InviteEmailSendError } from '../../lib/tenant-invite';
import { AdminCollapsibleSectionComponent } from '../admin-collapsible-section/admin-collapsible-section.component';

interface LastInvite {
  email: string;
  url: string;
  emailSent: boolean;
}

@Component({
  selector: 'app-church-member-invite',
  standalone: true,
  imports: [FormsModule, AdminCollapsibleSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-admin-collapsible-section
      title="Invite members"
      triggerId="church-member-invite-trigger"
      panelId="church-member-invite-panel"
      [expanded]="sectionExpanded"
      (expandedChange)="sectionExpanded = $event"
    >
      <svg
        sectionIcon
        class="text-blue-600 dark:text-blue-400 shrink-0"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="8.5" cy="7" r="4"></circle>
        <line x1="20" y1="8" x2="20" y2="14"></line>
        <line x1="23" y1="11" x2="17" y2="11"></line>
      </svg>

      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Send someone an email invite to join this church. The link works only
        for that address and expires after 7 days.
      </p>

      <form class="flex flex-col sm:flex-row gap-2" (ngSubmit)="createInvite()">
        <label class="sr-only" for="church-member-invite-email">Email address</label>
        <input
          id="church-member-invite-email"
          name="email"
          type="email"
          autocomplete="off"
          [(ngModel)]="emailDraft"
          [disabled]="busy"
          placeholder="member@example.com"
          class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          type="submit"
          [disabled]="busy || !canSubmit"
          class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        >
          {{ busy ? 'Creating…' : 'Create invite' }}
        </button>
      </form>

      @if (lastInvite; as invite) {
        <div
          class="mt-4 p-3 rounded-md border text-sm"
          [class]="
            invite.emailSent
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100'
          "
          role="status"
          aria-live="polite"
        >
          <p class="mb-1">
            @if (invite.emailSent) {
              Invite emailed to {{ invite.email }}. If it does not arrive, share
              this link instead.
            } @else {
              Invite created for {{ invite.email }}, but the email could not be
              sent. Share this link with them.
            }
          </p>
          <a
            [href]="invite.url"
            target="_blank"
            rel="noopener"
            class="break-all underline"
            data-testid="church-member-invite-link"
            >{{ invite.url }}</a
          >
        </div>
      }
    </app-admin-collapsible-section>
  `,
})
export class ChurchMemberInviteComponent {
  private readonly tenantManagement = inject(TenantManagementService);
  private readonly tenantContext = inject(TenantContextService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  sectionExpanded = false;
  emailDraft = '';
  busy = false;
  lastInvite: LastInvite | null = null;

  get canSubmit(): boolean {
    return this.emailDraft.trim().includes('@');
  }

  async createInvite(): Promise<void> {
    if (this.busy || !this.canSubmit) {
      return;
    }
    const tenantId = this.tenantContext.getActiveTenant()?.id;
    if (!tenantId) {
      this.toast.error('Pick a church first, then invite members.');
      return;
    }

    const email = this.emailDraft.trim().toLowerCase();
    this.busy = true;
    this.cdr.markForCheck();
    try {
      const created = await this.tenantManagement.createInvite(tenantId, email);
      this.lastInvite = { email, url: created.url, emailSent: true };
      this.emailDraft = '';
      this.toast.success(`Invitation sent to ${email}`);
    } catch (error) {
      if (error instanceof InviteEmailSendError) {
        this.lastInvite = { email, url: error.url, emailSent: false };
        this.emailDraft = '';
        this.toast.error('Invite created, but the email could not be sent. Share the link below.');
      } else {
        this.toast.error(error instanceof Error ? error.message : 'Failed to create invite');
      }
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
