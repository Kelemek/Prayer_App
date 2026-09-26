import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-login-header',
  standalone: true,
  template: `
    <div class="text-center mb-8">
      @if (logoUrl) {
        <img
          [src]="logoUrl"
          [alt]="tenantName + ' logo'"
          class="h-24 w-24 mx-auto rounded-2xl object-contain shadow-lg mb-4 bg-white/10"
        />
      } @else {
        <div
          class="h-24 w-24 mx-auto rounded-2xl bg-white/15 flex items-center justify-center shadow-lg mb-4"
        >
          <svg class="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            />
          </svg>
        </div>
      }
      <h1 class="text-3xl font-bold text-white">{{ tenantName || 'Prayer Community' }}</h1>
      <p class="mt-2 text-sm text-emerald-50/90">{{ subtitle }}</p>
    </div>
  `,
})
export class LoginHeaderComponent {
  @Input() tenantName = 'Prayer Community';
  @Input() logoUrl: string | null = null;
  @Input() subtitle = 'Where prayer brings us together';
}
