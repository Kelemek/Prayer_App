import { Component, ChangeDetectionStrategy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";

@Component({
  selector: "app-terms",
  standalone: true,
  imports: [CommonModule, RouterModule],
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

        <h1 class="text-3xl font-bold mb-2">Terms of Service</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Last updated: September 2026
        </p>

        <div class="prose prose-gray dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">1. Agreement</h2>
            <p>
              These Terms of Service ("Terms") govern your use of the Prayer App
              ("we," "our," or "the app"). The legal name of the operating
              entity will be stated here before public paid launch. By accessing
              or using the app, you agree to these Terms. If you do not agree,
              do not use the app.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">2. The Service</h2>
            <p>
              Prayer App is a multi-church and personal prayer software service
              that helps faith communities manage prayer requests, notifications,
              and related features. We offer plans such as Church and Pro with
              different capabilities. We may add, change, or discontinue features
              over time. We will try to give reasonable notice when changes
              materially affect how you use the service.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">3. Accounts</h2>
            <p>
              You must provide accurate account information and keep your sign-in
              credentials secure. You are responsible for activity under your
              account. Organization administrators (for example, church staff)
              may manage members, approvals, and organization data according to
              their role. Notify your organization or us promptly if you believe
              your account has been compromised.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">4. Acceptable Use</h2>
            <p class="mb-2">You agree not to:</p>
            <ul class="list-disc pl-6 space-y-1">
              <li>
                Use the app for illegal purposes or to post illegal, harmful, or
                harassing content.
              </li>
              <li>
                Attempt to access another tenant’s data, scrape the service, or
                bypass security or access controls.
              </li>
              <li>
                Send spam, abuse notifications, or overload our systems.
              </li>
              <li>
                Misrepresent your identity or affiliation when using the app.
              </li>
            </ul>
            <p class="mt-2">
              We may suspend or terminate access if we reasonably believe you
              have violated these Terms or put the service or others at risk.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">5. User Content</h2>
            <p>
              You retain ownership of prayer requests, updates, and other content
              you submit. You grant us a limited license to host, store, display,
              and process that content solely to operate and improve the service.
              Church prayers you submit (after approval) may be visible to other
              logged-in users in your community according to app settings and
              your choices (for example, anonymous requests). Personal prayers
              remain private to you unless you share them through the app’s
              features. How we handle personal data is described in our
              <a
                routerLink="/privacy"
                class="text-blue-600 dark:text-blue-400 hover:underline"
                >Privacy Policy</a
              >.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">
              6. Subscriptions and Billing
            </h2>
            <p>
              Church and Pro subscriptions are purchased and managed on the web
              through Stripe Checkout and the Stripe Customer Portal. The native
              mobile app does not offer in-app purchase for these plans. On
              native devices, “Manage billing” may open your system browser to
              the Stripe portal. Fees, billing periods, and plan details are
              shown at purchase. You authorize us and Stripe to charge your
              payment method for recurring subscriptions until you cancel through
              the Customer Portal or as otherwise described at checkout. Refunds
              are provided only where required by law or as explicitly stated at
              the time of purchase.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">7. Privacy</h2>
            <p>
              Our
              <a
                routerLink="/privacy"
                class="text-blue-600 dark:text-blue-400 hover:underline"
                >Privacy Policy</a
              >
              explains how we collect, use, and protect information. It is
              incorporated into these Terms by reference.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">8. Account Deletion</h2>
            <p>
              You may delete your account in Settings using the self-serve account
              deletion flow. Deletion is permanent and signs you out. Some
              information may be retained as needed for legal, security, fraud
              prevention, or billing obligations, as described in the Privacy
              Policy. Organization administrators may also manage member access
              according to their policies.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">
              9. Intellectual Property
            </h2>
            <p>
              We own the Prayer App software, branding, and related materials,
              except for content you and other users provide. We grant you a
              limited, non-exclusive license to use the app for its intended
              purpose while you comply with these Terms. You may not copy,
              modify, distribute, or reverse engineer the app except where
              applicable law allows.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">
              10. Third-Party Services
            </h2>
            <p class="mb-2">
              The app relies on third-party providers, which may process data
              according to their own terms and policies, including:
            </p>
            <ul class="list-disc pl-6 space-y-1">
              <li>
                <strong>Hosting and database</strong> (for example, Supabase)
              </li>
              <li><strong>Payments</strong> (Stripe)</li>
              <li>
                <strong>Email</strong> (for example, Resend) and
                <strong>push notifications</strong> (Apple APNs, Google FCM)
              </li>
              <li>
                <strong>Analytics and product insights</strong> (for example,
                PostHog) and hosting performance tools
              </li>
              <li>
                <strong>Bible and reference content</strong> from third-party
                APIs used for memorization and scripture features
              </li>
            </ul>
            <p class="mt-2">
              Your use of those services may be subject to their terms. We are
              not responsible for third-party services we do not control.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">11. Disclaimers</h2>
            <p>
              The app is provided "as is" and "as available." Prayer App content
              and features are for community prayer management and spiritual
              support tools; they are not pastoral, medical, legal, or other
              professional advice. We do not guarantee uninterrupted or
              error-free operation, though we use reasonable efforts to keep
              the service available and secure.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">
              12. Limitation of Liability
            </h2>
            <p>
              <em class="text-gray-600 dark:text-gray-400"
                >Draft pending legal review.</em
              >
              To the fullest extent permitted by law, we and our suppliers will
              not be liable for indirect, incidental, special, consequential, or
              punitive damages, or for lost profits or data, arising from your
              use of the app. Our total liability for claims relating to the
              service will be limited to the amount you paid us for the service
              in the twelve months before the claim, or another cap as counsel
              may specify.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">13. Indemnity</h2>
            <p>
              <em class="text-gray-600 dark:text-gray-400"
                >Draft pending legal review.</em
              >
              You agree to defend and indemnify us and our affiliates against
              claims arising from your misuse of the app, your content, or your
              violation of these Terms, to the extent permitted by law.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">14. Governing Law</h2>
            <p>
              <em class="text-gray-600 dark:text-gray-400"
                >Draft pending legal review.</em
              >
              These Terms are governed by the laws of the State of Minnesota,
              USA, without regard to conflict-of-law rules, except where
              mandatory consumer protections in your jurisdiction apply.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">15. Changes</h2>
            <p>
              We may update these Terms from time to time. We will post the
              updated Terms in the app and update the "Last updated" date.
              Continued use after changes constitutes acceptance of the updated
              Terms. If changes are material, we may provide additional notice
              where appropriate.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">16. Contact</h2>
            <p>
              For questions about these Terms, visit our
              <a
                routerLink="/support"
                class="text-blue-600 dark:text-blue-400 hover:underline"
                >Support</a
              >
              page. You can also contact the organization that operates this
              Prayer App (for example, your church or ministry) through the
              contact information provided in the app or on your organization’s
              website.
            </p>
          </section>

          <section>
            <p class="text-sm text-gray-600 dark:text-gray-400 italic">
              This document is a product draft and is not legal advice. Have
              counsel review before public paid launch.
            </p>
          </section>
        </div>

        <a
          routerLink="/"
          class="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium mt-10"
        >
          ← Back to app
        </a>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [],
})
export class TermsComponent {}
