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
import { Router } from "@angular/router";
import { TenantAccessService } from "../../services/tenant-access.service";
import { ToastService } from "../../services/toast.service";
import { AppTopChromeOverlayDirective } from "../../directives/app-top-chrome-overlay.directive";
import { environment } from "../../../environments/environment";
import { buildTenantOrigin } from "../../lib/tenant-host";
import { shouldNavigateToTenantSubdomain } from "../../lib/tenant-navigation";
import { parseChurchSlugFromInput } from "../../lib/parse-church-slug-input";

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
  churchAddress = "";

  private readonly tenantAccess = inject(TenantAccessService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["isOpen"]?.currentValue === true) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.view = "chooser";
    this.submitting = false;
    this.churchAddress = "";
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
    return !this.submitting && this.churchAddress.trim().length > 0;
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
    if (!this.canSubmitJoin) {
      return;
    }
    this.submitting = true;
    try {
      const suffix = environment.tenantHostSuffix ?? "";
      const slug = parseChurchSlugFromInput(this.churchAddress, suffix);
      if (!slug) {
        this.toast.error("Enter a valid church web address or short name.");
        return;
      }

      const tenant = await this.tenantAccess.resolveTargetTenant(slug);
      if (!tenant) {
        this.toast.error("We could not find that church. Check the address and try again.");
        return;
      }

      if (shouldNavigateToTenantSubdomain()) {
        const origin = buildTenantOrigin(
          tenant.slug,
          suffix,
          typeof window !== "undefined" ? window.location.protocol : "https:",
        );
        window.location.assign(`${origin}/request-access`);
        return;
      }

      await this.router.navigate(["/request-access"], { queryParams: { church: tenant.slug } });
      this.completed.emit();
      this.close.emit();
    } catch (err) {
      console.error("Join church navigation failed:", err);
      this.toast.error("Could not open the church join flow. Try again.");
    } finally {
      this.submitting = false;
    }
  }
}
