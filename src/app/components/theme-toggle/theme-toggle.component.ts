import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

const THEME_ICON_LAYER_BASE = 'ui-theme-icon-layer';
const THEME_ICON_LAYER_VISIBLE = 'scale-100 opacity-100 blur-0';
const THEME_ICON_LAYER_HIDDEN = 'scale-[0.25] opacity-0 blur-[4px]';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [],
  template: `
    <button
      type="button"
      (click)="toggleTheme()"
      class="relative flex size-11 items-center justify-center rounded-lg bg-gray-200 text-gray-700 transition-colors duration-150 ease-out hover:bg-gray-300 ui-press dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
      [title]="'Current theme: ' + themeService.getTheme()"
    >
      <span class="relative block size-5" aria-hidden="true">
        <span
          [class]="
            themeIconLayerClass(!themeService.isDark())
          "
        >
          <svg
            class="size-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            ></path>
          </svg>
        </span>
        <span
          [class]="
            themeIconLayerClass(themeService.isDark())
          "
        >
          <svg
            class="size-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            ></path>
          </svg>
        </span>
      </span>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.Default,
  styles: [],
})
export class ThemeToggleComponent {
  public themeService = inject(ThemeService);

  themeIconLayerClass(visible: boolean): string {
    return `${THEME_ICON_LAYER_BASE} ${
      visible ? THEME_ICON_LAYER_VISIBLE : THEME_ICON_LAYER_HIDDEN
    }`;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
