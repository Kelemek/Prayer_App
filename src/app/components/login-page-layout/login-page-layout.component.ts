import { Component } from '@angular/core';

@Component({
  selector: 'app-login-page-layout',
  standalone: true,
  template: `
    <div
      class="w-full min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors p-4"
    >
      <div class="max-w-md w-full">
        <ng-content />
      </div>
    </div>
  `,
})
export class LoginPageLayoutComponent {}
