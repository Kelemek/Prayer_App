import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
import { MemorizationRecommendationsService } from '../../services/memorization-recommendations.service';
import { TenantContextService } from '../../services/tenant-context.service';
import { ToastService } from '../../services/toast.service';
import type { IbcdCatalogStatus } from '../../types/memorization';

@Component({
  selector: 'app-ibcd-memorization-catalog-panel',
  standalone: true,
  imports: [CommonModule, ConfirmationDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/30 p-4 space-y-3"
    >
      <div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
          IBCD counseling catalog (optional)
        </h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          The IBCD catalog is a curated set of about 30 biblical-counseling topic categories
          and roughly 100 verse references from Jim Newheiser / IBCD
          <em>Approximately 100 Go-to Texts for Biblical Counseling</em>. It is
          translation-agnostic and fully editable after you apply it.
        </p>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          New organizations start with no recommendations. Apply this catalog when you want a
          ready-made counseling-oriented list. Removing IBCD deletes only catalog-tagged
          verses and empty IBCD categories; your custom categories and verses are kept.
        </p>
      </div>

      @if (statusLoading) {
        <p class="text-sm text-gray-500 dark:text-gray-400" aria-live="polite">
          Loading IBCD catalog status…
        </p>
      } @else if (status && status.applied) {
        <p class="text-sm text-gray-700 dark:text-gray-200">
          IBCD catalog applied —
          {{ status.ibcdVerseCount }} verse{{ status.ibcdVerseCount === 1 ? '' : 's' }}
          in {{ status.ibcdCategoryCount }}
          categor{{ status.ibcdCategoryCount === 1 ? 'y' : 'ies' }}.
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            (click)="openApplyConfirm()"
            [disabled]="busy"
            class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            Re-apply IBCD catalog
          </button>
          <button
            type="button"
            (click)="openRemoveConfirm()"
            [disabled]="busy"
            class="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 cursor-pointer"
          >
            Remove IBCD catalog
          </button>
        </div>
      } @else if (!activeTenantId) {
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Select an organization to manage the IBCD catalog.
        </p>
      } @else {
        <button
          type="button"
          (click)="openApplyConfirm()"
          [disabled]="busy"
          class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          Apply IBCD catalog
        </button>
      }
    </div>

    @if (showApplyConfirm) {
      <app-confirmation-dialog
        title="Apply IBCD catalog?"
        message="Add the IBCD counseling memorization catalog to this organization? Existing custom categories and verses are kept; only missing IBCD categories and verses are added."
        confirmText="Apply catalog"
        (confirm)="applyCatalog()"
        (cancel)="closeApplyConfirm()"
      />
    }

    @if (showRemoveConfirm) {
      <app-confirmation-dialog
        title="Remove IBCD catalog?"
        message="Remove all IBCD-tagged memorization recommendations from this organization? Custom categories and verses you added separately are kept."
        confirmText="Remove IBCD catalog"
        [isDangerous]="true"
        (confirm)="removeCatalog()"
        (cancel)="closeRemoveConfirm()"
      />
    }
  `,
})
export class IbcdMemorizationCatalogPanelComponent implements OnInit, OnDestroy {
  @Output() catalogChanged = new EventEmitter<void>();

  activeTenantId: string | null = null;
  status: IbcdCatalogStatus | null = null;
  statusLoading = false;
  busy = false;
  showApplyConfirm = false;
  showRemoveConfirm = false;

  private tenantSub?: Subscription;
  private statusRequestGeneration = 0;

  constructor(
    private recommendations: MemorizationRecommendationsService,
    private tenantContext: TenantContextService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.activeTenantId = this.tenantContext.getActiveTenant()?.id ?? null;
    void this.refreshStatus();
    this.tenantSub = this.tenantContext.activeTenant$.subscribe((tenant) => {
      const nextId = tenant?.id ?? null;
      if (nextId === this.activeTenantId) {
        return;
      }
      this.activeTenantId = nextId;
      void this.refreshStatus();
    });
  }

  ngOnDestroy(): void {
    this.tenantSub?.unsubscribe();
  }

  async refreshStatus(): Promise<void> {
    const tenantId = this.activeTenantId;
    if (!tenantId) {
      this.status = null;
      this.statusLoading = false;
      this.mark();
      return;
    }
    const requestId = ++this.statusRequestGeneration;
    this.statusLoading = true;
    this.mark();
    const status = await this.recommendations.getIbcdCatalogStatus();
    if (requestId !== this.statusRequestGeneration) {
      return;
    }
    if (this.activeTenantId !== tenantId) {
      return;
    }
    this.status = status;
    this.statusLoading = false;
    this.mark();
  }

  openApplyConfirm(): void {
    this.showApplyConfirm = true;
    this.mark();
  }

  openRemoveConfirm(): void {
    this.showRemoveConfirm = true;
    this.mark();
  }

  closeApplyConfirm(): void {
    this.showApplyConfirm = false;
    this.mark();
  }

  closeRemoveConfirm(): void {
    this.showRemoveConfirm = false;
    this.mark();
  }

  async applyCatalog(): Promise<void> {
    this.showApplyConfirm = false;
    if (this.busy) return;
    this.busy = true;
    this.mark();

    const result = await this.recommendations.applyIbcdCatalog();
    this.busy = false;

    if (result.ok) {
      const added =
        result.categoriesAdded + result.versesAdded > 0
          ? ` Added ${result.categoriesAdded} categories and ${result.versesAdded} verses.`
          : ' Catalog is already up to date.';
      this.toast.success(`IBCD catalog applied.${added}`);
      await this.refreshStatus();
      this.catalogChanged.emit();
    } else if (result.reason === 'not_admin') {
      this.toast.error('You are not authorized to apply the IBCD catalog.');
    } else if (result.reason === 'no_tenant') {
      this.toast.error('Select an organization first.');
    } else {
      this.toast.error('Could not apply the IBCD catalog.');
    }
    this.mark();
  }

  async removeCatalog(): Promise<void> {
    this.showRemoveConfirm = false;
    if (this.busy) return;
    this.busy = true;
    this.mark();

    const result = await this.recommendations.removeIbcdCatalog();
    this.busy = false;

    if (result.ok) {
      this.toast.success(
        `Removed ${result.removedVerses} IBCD verse${result.removedVerses === 1 ? '' : 's'} and ${result.removedCategories} categor${result.removedCategories === 1 ? 'y' : 'ies'}.`
      );
      await this.refreshStatus();
      this.catalogChanged.emit();
    } else if (result.reason === 'not_admin') {
      this.toast.error('You are not authorized to remove the IBCD catalog.');
    } else if (result.reason === 'no_tenant') {
      this.toast.error('Select an organization first.');
    } else {
      this.toast.error('Could not remove the IBCD catalog.');
    }
    this.mark();
  }

  private mark(): void {
    this.cdr.markForCheck();
  }
}
