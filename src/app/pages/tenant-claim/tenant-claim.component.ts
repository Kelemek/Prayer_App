import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { TenantManagementService } from "../../services/tenant-management.service";
import { TenantContextService } from "../../services/tenant-context.service";
import { UserSessionService, splitPersonName } from "../../services/user-session.service";
import { ToastService } from "../../services/toast.service";
import { AdminAuthService } from "../../services/admin-auth.service";
import {
  describeJoinInviteState,
  type JoinInviteState,
  type TenantInvitePreview,
} from "../../lib/tenant-invite";

@Component({
  selector: "app-tenant-claim",
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6"
    >
      <div
        class="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6"
      >
        <h1 class="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
          {{ heading }}
        </h1>
        <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {{ statusCopy }}
        </p>

        @if (joinState === "mismatch") {
        <button
          type="button"
          (click)="signInAsInvitee()"
          [disabled]="loading || signingOut"
          class="w-full px-4 py-2 rounded-md btn-chip btn-chip-blue disabled:opacity-60"
        >
          {{ signingOut ? "Signing out..." : "Sign in as " + preview?.inviteeEmail }}
        </button>
        } @else if (needsSignIn) {
        <button
          type="button"
          (click)="goToSignIn()"
          class="w-full px-4 py-2 rounded-md btn-chip btn-chip-blue"
        >
          Sign in to join
        </button>
        } @else if (canClaim) {
        <div class="space-y-3 mb-4">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Your name
          </p>
          <div>
            <label
              for="join-first-name"
              class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
            >
              First name <span class="text-red-600">*</span>
            </label>
            <input
              id="join-first-name"
              type="text"
              [(ngModel)]="firstName"
              autocomplete="given-name"
              placeholder="First name"
              [disabled]="loading"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label
              for="join-last-name"
              class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"
            >
              Last name <span class="text-red-600">*</span>
            </label>
            <input
              id="join-last-name"
              type="text"
              [(ngModel)]="lastName"
              autocomplete="family-name"
              placeholder="Last name"
              [disabled]="loading"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <button
          type="button"
          (click)="claimInvite()"
          [disabled]="loading || !canSubmitName"
          class="w-full px-4 py-2 rounded-md btn-chip btn-chip-blue disabled:opacity-60"
        >
          {{ loading ? "Joining..." : claimButtonLabel }}
        </button>
        }
      </div>
    </div>
  `,
})
export class TenantClaimComponent implements OnInit {
  token: string | null = null;
  loading = false;
  signingOut = false;
  previewLoading = true;
  preview: TenantInvitePreview | null = null;
  currentEmail: string | null = null;
  firstName = "";
  lastName = "";

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tenantManagement: TenantManagementService,
    private tenantContext: TenantContextService,
    private userSession: UserSessionService,
    private toast: ToastService,
    private adminAuth: AdminAuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.token = this.route.snapshot.paramMap.get("token");
  }

  get joinState(): JoinInviteState {
    if (this.previewLoading) {
      return this.token ? "not-found" : "missing-token";
    }
    return describeJoinInviteState(this.token, this.preview, this.currentEmail);
  }

  get canClaim(): boolean {
    return (
      !this.previewLoading &&
      this.joinState === "ready" &&
      !!this.token &&
      !!this.currentEmail
    );
  }

  get canSubmitName(): boolean {
    return !!this.firstName.trim() && !!this.lastName.trim();
  }

  get needsSignIn(): boolean {
    return !this.previewLoading && this.joinState === "ready" && !this.currentEmail;
  }

  get heading(): string {
    if (
      this.preview?.tenantName &&
      (this.joinState === "ready" || this.joinState === "mismatch")
    ) {
      return `Join ${this.preview.tenantName}`;
    }
    if (this.joinState === "mismatch" && this.preview?.tenantName) {
      return `Join ${this.preview.tenantName}`;
    }
    return "Join church";
  }

  get statusCopy(): string {
    if (this.previewLoading) {
      return "Loading your invitation...";
    }
    switch (this.joinState) {
      case "missing-token":
        return "This invite link is missing a token.";
      case "not-found":
        return "This invite was not found or is no longer valid.";
      case "accepted":
        return "This invite has already been used.";
      case "revoked":
        return "This invite is no longer valid. Ask an admin to send a new invitation.";
      case "expired":
        return "This invite has expired. Ask an admin to send a new invitation.";
      case "mismatch":
        return `This invite is for ${this.preview?.inviteeEmail}. You're signed in as ${this.currentEmail}.`;
      case "ready":
        if (!this.currentEmail) {
          return `You're invited to join ${this.preview?.tenantName ?? "this church"}. Sign in as ${this.preview?.inviteeEmail ?? "the invited email"} to continue.`;
        }
        return `You're signed in as ${this.preview?.inviteeEmail ?? "the invited email"}. Enter your name, then join ${this.preview?.tenantName ?? "this church"}.`;
      default: {
        const _exhaustive: never = this.joinState;
        return _exhaustive;
      }
    }
  }

  get claimButtonLabel(): string {
    if (this.preview?.tenantName) {
      return `Join ${this.preview.tenantName}`;
    }
    return "Claim invite";
  }

  async ngOnInit(): Promise<void> {
    this.currentEmail = this.adminAuth.getUser()?.email?.toLowerCase().trim()
      ?? (await this.tenantManagement.getActorEmail())?.toLowerCase().trim()
      ?? null;
    if (this.currentEmail) {
      await this.prefillNameFromProfile();
    }
    if (!this.token) {
      this.previewLoading = false;
      this.cdr.markForCheck();
      return;
    }
    try {
      this.preview = await this.tenantManagement.getInvitePreview(this.token);
    } catch (error) {
      console.error("Failed to load invite preview:", error);
      this.preview = null;
    } finally {
      this.previewLoading = false;
      this.cdr.markForCheck();
    }
  }

  private async prefillNameFromProfile(): Promise<void> {
    const storedName = await this.tenantManagement.getActorDisplayName();
    if (!storedName) {
      return;
    }
    const { first, last } = splitPersonName(storedName);
    if (first && !this.firstName.trim()) {
      this.firstName = first;
    }
    if (last && !this.lastName.trim()) {
      this.lastName = last;
    }
  }

  goToSignIn(): void {
    if (!this.token) {
      return;
    }
    void this.router.navigate(["/login"], {
      queryParams: { returnUrl: `/join/${this.token}` },
    });
  }

  async signInAsInvitee(): Promise<void> {
    if (!this.token || !this.preview || this.signingOut) {
      return;
    }
    this.signingOut = true;
    this.cdr.markForCheck();
    try {
      await this.adminAuth.logout({
        returnUrl: `/join/${this.token}`,
        email: this.preview.inviteeEmail,
      });
    } catch (error) {
      this.toast.error(
        error instanceof Error ? error.message : "Failed to sign out"
      );
      this.signingOut = false;
      this.cdr.markForCheck();
    }
  }

  async claimInvite(): Promise<void> {
    if (!this.token || this.loading || !this.canClaim || !this.canSubmitName) {
      return;
    }
    const fullName = `${this.firstName.trim()} ${this.lastName.trim()}`;
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const tenantId = await this.tenantManagement.claimInvite(this.token, fullName);
      await this.tenantContext.switchTenant(tenantId);
      if (this.currentEmail) {
        try {
          await this.userSession.loadUserSession(this.currentEmail);
        } catch (sessionError) {
          console.warn("Failed to refresh user session after join:", sessionError);
        }
      }
      this.toast.success("Invite claimed successfully");
      await this.router.navigateByUrl("/");
    } catch (error) {
      this.toast.error(
        error instanceof Error ? error.message : "Failed to claim invite"
      );
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }
}
