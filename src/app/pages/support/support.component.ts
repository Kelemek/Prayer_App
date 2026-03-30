import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
      <div class="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <a routerLink="/" class="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium mb-8">
          ← Back to app
        </a>

        <h1 class="text-3xl font-bold mb-2">Support</h1>
        <p class="text-gray-600 dark:text-gray-400 mb-8">
          Get help with the Prayer Community app.
        </p>

        <div class="prose prose-gray dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">Getting help</h2>
            <p>
              This app is run by your church or faith community. For help with your account, prayer requests,
              notifications, or any other questions, please contact your organization’s staff or the person who
              invited you to the app. They can assist with sign-in, approvals, and app settings.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">Common topics</h2>
            <ul class="list-disc pl-6 space-y-2">
              <li><strong>Sign-in:</strong> Use the email address your organization has on file. You’ll receive a verification code by email to sign in.</li>
              <li><strong>Prayer requests:</strong> Submit requests in the app; an administrator may need to approve them before they appear for the community.</li>
              <li><strong>Notifications:</strong> Turn email and push notifications on or off in Settings (gear icon) in the app.</li>
              <li><strong>Privacy:</strong> Read our <a routerLink="/privacy" class="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</a> for how we handle your data.</li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">Contact</h2>
            <p>
              For technical support or feedback, reach out through your church or ministry’s usual contact
              methods (website, office, or the contact information provided when you joined). If you’re an
              administrator and need help with the app itself, use the contact details provided to your
              organization when the app was set up.
            </p>
          </section>
        </div>

        <div class="mt-8 flex flex-wrap gap-4">
          <a routerLink="/privacy" class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">
            Privacy Policy
          </a>
          <a routerLink="/info" class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">
            About the app
          </a>
          <a routerLink="/" class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">
            Back to app
          </a>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class SupportComponent {}
