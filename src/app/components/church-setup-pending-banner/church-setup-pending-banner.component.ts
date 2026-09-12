import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-church-setup-pending-banner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible) {
      <div
        class="sticky top-0 z-40 border-b border-emerald-300 bg-emerald-50 px-4 py-2 text-center text-sm text-emerald-950 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100"
        role="status"
        data-testid="church-setup-pending-banner"
      >
        <p class="mb-2">You're paid — finish church setup on the web</p>
        <div class="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            class="px-3 py-1 rounded-md btn-chip btn-chip-blue cursor-pointer"
            (click)="openWeb.emit()"
          >
            Open setup
          </button>
          <button
            type="button"
            class="px-3 py-1 rounded-md btn-chip btn-chip-gray cursor-pointer"
            (click)="copyLink.emit()"
          >
            Copy link
          </button>
        </div>
      </div>
    }
  `,
})
export class ChurchSetupPendingBannerComponent {
  @Input() visible = false;
  @Output() openWeb = new EventEmitter<void>();
  @Output() copyLink = new EventEmitter<void>();
}
