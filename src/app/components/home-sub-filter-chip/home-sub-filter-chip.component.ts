import { Component, EventEmitter, Input, Output } from "@angular/core";
import {
  HOME_SUB_FILTER_ADD_CHIP_LAYOUT_CLASS,
  HOME_SUB_FILTER_CHIP_BASE_CLASS,
} from "../../lib/home-sub-filter-chip-classes";

@Component({
  selector: "app-home-sub-filter-chip",
  standalone: true,
  host: {
    class: "flex min-w-0",
    "[class.flex-1]": "stretch",
  },
  template: `
    <button
      type="button"
      [attr.id]="chipId || null"
      [attr.aria-busy]="busy || null"
      [attr.aria-label]="addIcon ? chipAriaLabel : null"
      [attr.title]="chipTitle || (addIcon ? chipAriaLabel : null) || null"
      [disabled]="disabled"
      (click)="chipClick.emit($event)"
      [class]="
        resolvedLayoutClass +
        (stretch && !addIcon ? ' w-full' : '') +
        (active ? ' ' + activeClass : ' ' + resolvedInactiveClass) +
        (disabled ? ' opacity-50 cursor-not-allowed' : ' cursor-pointer') +
        (badgeOverlay ? ' relative' : '')
      "
    >
      @if (addIcon) {
        <svg
          class="size-5 sm:size-6 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      } @else {
        <ng-content />
      }
    </button>
  `,
})
export class HomeSubFilterChipComponent {
  @Input() chipId = "";
  /** Icon-only plus control; requires {@link chipAriaLabel} for accessibility. */
  @Input() addIcon = false;
  @Input() chipAriaLabel = "";
  @Input() chipTitle = "";
  @Input() active = false;
  @Input() disabled = false;
  @Input() busy = false;
  /** When true, the host grows with flex-1 so chips share the row equally. */
  @Input() stretch = true;
  /** When true, adds {@code relative} for absolutely positioned badge pills. */
  @Input() badgeOverlay = false;
  @Input() layoutClass = HOME_SUB_FILTER_CHIP_BASE_CLASS;
  @Input({ required: true }) activeClass!: string;
  @Input({ required: true }) inactiveClass!: string;
  /**
   * When {@link addIcon} is true, used instead of {@link inactiveClass} while inactive
   * (ghost + hover/focus chrome). Falls back to {@link inactiveClass}.
   */
  @Input() addIconInactiveClass = "";

  @Output() chipClick = new EventEmitter<MouseEvent>();

  get resolvedLayoutClass(): string {
    return this.addIcon ? HOME_SUB_FILTER_ADD_CHIP_LAYOUT_CLASS : this.layoutClass;
  }

  get resolvedInactiveClass(): string {
    if (this.addIcon && this.addIconInactiveClass) {
      return this.addIconInactiveClass;
    }
    return this.inactiveClass;
  }
}
