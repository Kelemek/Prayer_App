import { Component } from '@angular/core';

@Component({
  selector: 'app-login-page-layout',
  standalone: true,
  template: `
    <div
      class="min-h-screen w-full bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-700 flex items-center justify-center p-4"
    >
      <div class="max-w-md w-full">
        <ng-content />
      </div>
    </div>
  `,
})
export class LoginPageLayoutComponent {}
