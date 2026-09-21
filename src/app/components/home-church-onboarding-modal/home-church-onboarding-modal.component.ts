import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TenantManagementService } from "../../services/tenant-management.service";
import { TenantContextService } from "../../services/tenant-context.service";
import { ToastService } from "../../services/toast.service";
import { switchTenantWithNavigation } from "../../lib/tenant-navigation";
import { AppTopChromeOverlayDirective } from "../../directives/app-top-chrome-overlay.directive";

export type ChurchOnboardingView = "chooser" | "join";

@Component({
  selector: "app-home-church-onboarding-modal",
  standalone: true,
  imports: [CommonModule, FormsModule, AppTopChromeOverlayDirective],
  templateUrl: "./home-church-onboarding-modal.component.html",
  host: { class: "contents" },
})
export class HomeChurchOnboardingModalComponent implements OnChanges {
  @Input() isOpen = false;

  @Output() close = new EventEmitter<void>();
  @Output() completed = new EventEmitter<void>();
  @Output() startChurchTour = new EventEmitter<void>();

  view: ChurchOnboardingView = "chooser";
  submitting = false;
  inviteToken = "";

  private readonly tenantManagement = inject(TenantManagementService);
  private readonly tenantContext = inject(TenantContextService);
  private readonly toast = inject(ToastService);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["isOpen"]?.currentValue === true) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.view = "chooser";
    this.submitting = false;
    this.inviteToken = "";
  }

  showJoin(): void {
    this.view = "join";
  }

  showChooser(): void {
    if (this.submitting) {
      return;
    }
    this.view = "chooser";
  }

  onSeeChurchFeatures(): void {
    this.startChurchTour.emit();
    this.close.emit();
  }

  get canSubmitJoin(): boolean {
    return !this.submitting && this.inviteToken.trim().length > 0;
  }

  get title(): string {
    switch (this.view) {
      case "chooser":
        return "Connect to a church";
      case "join":
        return "Join a church";
      default: {
        const _exhaustive: never = this.view;
        return _exhaustive;
      }
    }
  }

  async submitJoin(): Promise<void> {
    const token = this.inviteToken.trim();
    if (!token || this.submitting) {
      return;
    }
    this.submitting = true;
    try {
      const tenantId = await this.tenantManagement.claimInvite(token);
      const claimedTenant = this.tenantContext
        .getAvailableTenants()
        .find((t) => t.id === tenantId);
      const slug = claimedTenant?.slug ?? "";
      if (slug) {
        const navResult = await switchTenantWithNavigation(
          tenantId,
          slug,
          (id) => this.tenantContext.switchTenant(id)
        );
        if (navResult === "navigated") {
          this.completed.emit();
          return;
        }
      } else {
        await this.tenantContext.switchTenant(tenantId);
      }
      this.toast.success("Invite claimed successfully");
      this.completed.emit();
    } catch (error) {
      this.toast.error(
        error instanceof Error ? error.message : "Failed to join church"
      );
    } finally {
      this.submitting = false;
    }
  }
}
