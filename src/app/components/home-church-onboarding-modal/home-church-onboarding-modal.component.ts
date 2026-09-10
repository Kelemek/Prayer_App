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
import { ChurchCheckoutService } from "../../services/church-checkout.service";
import { ToastService } from "../../services/toast.service";
import { switchTenantWithNavigation } from "../../lib/tenant-navigation";
import {
  normalizeTenantSlug,
  suggestTenantSlugFromName,
  validateTenantSlug,
} from "../../lib/tenant-slug";

export type ChurchOnboardingView = "chooser" | "create" | "join";

@Component({
  selector: "app-home-church-onboarding-modal",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./home-church-onboarding-modal.component.html",
  host: { class: "contents" },
})
export class HomeChurchOnboardingModalComponent implements OnChanges {
  @Input() isOpen = false;

  @Output() close = new EventEmitter<void>();
  @Output() completed = new EventEmitter<void>();

  view: ChurchOnboardingView = "chooser";
  submitting = false;
  nameDraft = "";
  slugDraft = "";
  slugTouched = false;
  inviteToken = "";

  private readonly tenantManagement = inject(TenantManagementService);
  private readonly tenantContext = inject(TenantContextService);
  private readonly churchCheckout = inject(ChurchCheckoutService);
  private readonly toast = inject(ToastService);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["isOpen"]?.currentValue === true) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.view = "chooser";
    this.submitting = false;
    this.nameDraft = "";
    this.slugDraft = "";
    this.slugTouched = false;
    this.inviteToken = "";
  }

  showCreate(): void {
    this.view = "create";
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

  onNameInput(value: string): void {
    this.nameDraft = value;
    if (!this.slugTouched) {
      this.slugDraft = suggestTenantSlugFromName(value);
    }
  }

  onSlugInput(value: string): void {
    this.slugTouched = true;
    this.slugDraft = value;
  }

  get canSubmitCreate(): boolean {
    return (
      !this.submitting &&
      this.nameDraft.trim().length > 0 &&
      normalizeTenantSlug(this.slugDraft).length > 0
    );
  }

  get canSubmitJoin(): boolean {
    return !this.submitting && this.inviteToken.trim().length > 0;
  }

  get title(): string {
    switch (this.view) {
      case "chooser":
        return "Connect to a church";
      case "create":
        return "Create a church";
      case "join":
        return "Join a church";
      default: {
        const _exhaustive: never = this.view;
        return _exhaustive;
      }
    }
  }

  async submitCreate(): Promise<void> {
    const name = this.nameDraft.trim();
    const slug = normalizeTenantSlug(this.slugDraft);
    if (!name || !slug || this.submitting) {
      return;
    }
    const slugError = validateTenantSlug(slug);
    if (slugError) {
      this.toast.error(slugError);
      return;
    }
    this.submitting = true;
    try {
      const tenant = await this.tenantManagement.createTenant(
        name,
        slug,
        "churches"
      );
      const switched = await this.tenantContext.switchTenant(tenant.id);
      if (!switched) {
        this.toast.error("Church created but could not switch organization");
        return;
      }
      const checkoutUrl = await this.churchCheckout.startChurchCheckout(
        tenant.id,
        tenant.slug
      );
      if (checkoutUrl) {
        this.completed.emit();
        window.location.assign(checkoutUrl);
        return;
      }
      const navResult = await switchTenantWithNavigation(
        tenant.id,
        tenant.slug,
        (id) => this.tenantContext.switchTenant(id)
      );
      if (navResult === "navigated") {
        this.completed.emit();
        return;
      }
      this.toast.success(`Church "${tenant.name}" created`);
      this.completed.emit();
    } catch (error) {
      this.toast.error(
        error instanceof Error ? error.message : "Failed to create church"
      );
    } finally {
      this.submitting = false;
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
