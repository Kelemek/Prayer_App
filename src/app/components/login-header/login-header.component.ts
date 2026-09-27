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
        <img
          src="/icons/icon-192.webp"
          alt="Prayer App Icon"
          class="h-28 w-28 sm:h-32 sm:w-32 mx-auto rounded-3xl object-contain shadow-lg mb-4"
        />
      }
      <h1 class="text-4xl font-bold text-[#2F5F54] dark:text-gray-100">{{ tenantName || 'Prayer Community' }}</h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ subtitle }}</p>
    </div>
  `,
})
export class LoginHeaderComponent {
  @Input() tenantName = 'Prayer Community';
  @Input() logoUrl: string | null = null;
  @Input() subtitle = 'Where prayer brings us together';
}
