import { Component, ChangeDetectionStrategy } from "@angular/core";
import { RouterModule } from "@angular/router";

@Component({
  selector: "app-support",
  standalone: true,
  imports: [RouterModule],
  template: `
    <div
      class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors"
    >
      <div class="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <a
          routerLink="/"
          class="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium mb-8"
        >
          ← Back to app
        </a>

        <h1 class="text-3xl font-bold mb-2">Support</h1>
        <p class="text-gray-600 dark:text-gray-400 mb-8">
          Help for members and church admins using the Prayer app.
        </p>

        <div class="prose prose-gray dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">Start in the app</h2>
            <ul class="list-disc pl-6 space-y-2">
              <li>
                <strong>Help:</strong> Tap the ? button in the header. It has a
                first-week guide, Show me tours of each screen, and a topic for
                every feature.
              </li>
              <li>
                <strong>Send feedback:</strong> Open Settings (the gear) and
                use Send Feedback to report a bug or ask for a feature. Church
                admins can also use Admin, then Tools, then Send Feedback.
              </li>
              <li>
                <strong>About the app:</strong> See what the app does and how
                churches use it on the
                <a
                  routerLink="/info"
                  class="text-blue-600 dark:text-blue-400 hover:underline"
                  >About the app</a
                >
                page.
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">Members</h2>
            <p>
              Your church runs its own copy of this app. Church staff can add
              you to the church, approve your account, and approve prayer
              requests. Contact them for anything about your church account.
            </p>
            <ul class="list-disc pl-6 space-y-2">
              <li>
                <strong>Sign-in:</strong> Use the email address your church has
                on file. We email you a code to sign in. There is no password.
              </li>
              <li>
                <strong>Prayer requests:</strong> Tap Request in the header.
                Church requests wait for an admin to approve them. Personal
                prayers are private and need no approval.
              </li>
              <li>
                <strong>Notifications:</strong> Turn email, push, and hourly
                reminders on or off in Settings.
              </li>
              <li>
                <strong>Your data:</strong> Settings has Download my data and
                Delete your account.
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">Church admins</h2>
            <ul class="list-disc pl-6 space-y-2">
              <li>
                <strong>Approvals:</strong> Open Admin from the Settings footer.
                Approvals holds new requests and updates. Deletions and
                Accounts have their own tiles.
              </li>
              <li>
                <strong>Invite members:</strong> Admin, then Settings, then
                Security, then Invite members. Enter an email and tap Create
                invite. Share the backup link if the email does not arrive.
              </li>
              <li>
                <strong>More admins:</strong> Admin User Management on the same
                Security tab.
              </li>
              <li>
                <strong>Billing:</strong> Use Billing & invoices in the Admin
                banner. Native apps cannot take payment, so finish checkout on
                the web.
              </li>
              <li>
                <strong>Stuck:</strong> Use Send Feedback in Settings or under
                Admin, then Tools. Include your church name and what you
                expected to happen.
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">Privacy and terms</h2>
            <p>
              Read the
              <a
                routerLink="/privacy"
                class="text-blue-600 dark:text-blue-400 hover:underline"
                >Privacy Policy</a
              >
              and
              <a
                routerLink="/terms"
                class="text-blue-600 dark:text-blue-400 hover:underline"
                >Terms of Service</a
              >
              for how we handle your data and your use of the app.
            </p>
          </section>
        </div>

        <div class="mt-8 flex flex-wrap gap-4">
          <a
            routerLink="/privacy"
            class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
          >
            Privacy Policy
          </a>
          <a
            routerLink="/terms"
            class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
          >
            Terms of Service
          </a>
          <a
            routerLink="/info"
            class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
          >
            About the app
          </a>
          <a
            routerLink="/"
            class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
          >
            Back to app
          </a>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class SupportComponent {}
