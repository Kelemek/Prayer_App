import { Component, ChangeDetectionStrategy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router } from "@angular/router";
import { TenantManagementService } from "../../services/tenant-management.service";
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
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.Eager,
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
        } @else {
        <button
          type="button"
          (click)="claimInvite()"
          [disabled]="loading || !canClaim"
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tenantManagement: TenantManagementService,
    private toast: ToastService,
    private adminAuth: AdminAuthService
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
    return !this.previewLoading && this.joinState === "ready" && !!this.token;
  }

  get heading(): string {
    if (this.preview?.tenantName && this.joinState === "ready") {
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
        return `You're signed in as ${this.preview?.inviteeEmail ?? "the invited email"}. Join ${this.preview?.tenantName ?? "this church"} to become a member.`;
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
    if (!this.token) {
      this.previewLoading = false;
      return;
    }
    try {
      this.preview = await this.tenantManagement.getInvitePreview(this.token);
    } catch (error) {
      console.error("Failed to load invite preview:", error);
      this.preview = null;
    } finally {
      this.previewLoading = false;
    }
  }

  async signInAsInvitee(): Promise<void> {
    if (!this.token || !this.preview || this.signingOut) {
      return;
    }
    this.signingOut = true;
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
    }
  }

  async claimInvite(): Promise<void> {
    if (!this.token || this.loading || !this.canClaim) return;
    this.loading = true;
    try {
      await this.tenantManagement.claimInvite(this.token);
      this.toast.success("Invite claimed successfully");
      this.router.navigate(["/"]);
    } catch (error) {
      this.toast.error(
        error instanceof Error ? error.message : "Failed to claim invite"
      );
    } finally {
      this.loading = false;
    }
  }
}
