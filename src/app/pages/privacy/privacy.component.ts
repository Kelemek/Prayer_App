import { Component, ChangeDetectionStrategy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";

@Component({
  selector: "app-privacy",
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

        <h1 class="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Last updated: September 2026
        </p>

        <div class="prose prose-gray dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">1. Introduction</h2>
            <p>
              This Privacy Policy describes how the Prayer App ("we," "our," or
              "the app") collects, uses, and protects your information when you
              use our multi-tenant prayer software on the web and in our native
              mobile app (bundle ID <code>com.churchprayer.app</code>). The
              service is used by churches, ministries, and individuals to manage
              prayer requests, groups, memorization, and related features. The
              legal name of the operating entity will be stated here before
              public paid launch. By using the app, you agree to this policy.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">
              2. Information We Collect
            </h2>
            <p class="mb-2">We collect the following types of information:</p>
            <ul class="list-disc pl-6 space-y-1">
              <li>
                <strong>Account and identity:</strong> Email address, name (or
                display name), and short-lived verification codes sent to your
                email for sign-in.
              </li>
              <li>
                <strong>Organization membership and roles:</strong> Which
                communities (tenants) you belong to and your role (for example
                member, leader, or organization administrator). Platform operators
                may also assign a super-admin role for support and operations.
              </li>
              <li>
                <strong>Prayer content:</strong> Church prayer requests (who or
                what the prayer is for, details, updates), personal prayers,
                group prayers, anonymity choices, and related metadata such as
                approval status.
              </li>
              <li>
                <strong>Preferences:</strong> Notification settings (email and
                push), theme, default views, memorization practice settings, and
                similar in-app choices.
              </li>
              <li>
                <strong>Push notifications (mobile app):</strong> If you enable
                push notifications, we store a device token and associate it with
                your account so we can deliver notifications. You can turn this
                off in Settings.
              </li>
              <li>
                <strong>Billing metadata:</strong> When you subscribe to paid
                plans on the web, Stripe processes payment. We store identifiers
                such as Stripe customer and subscription IDs and plan status—not
                your full payment card number.
              </li>
              <li>
                <strong>Product analytics:</strong> When enabled, PostHog may set
                cookies and collect usage data (including session replay when
                enabled). We also store some first-party usage events (for
                example page views and last activity) in our database for
                logged-in users.
              </li>
              <li>
                <strong>Feedback:</strong> If you submit in-app feedback, we store
                your contact details and message in our database and create a
                related task in Notion using a submission ID (not your email or
                name on the Notion page).
              </li>
              <li>
                <strong>Memorization recite (when used):</strong> If your
                organization enables recite mode with server-side speech
                recognition, audio you record may be sent to OpenAI (Whisper or
                a similar transcription model) for transcription. We log usage
                metrics (such as duration and estimated cost) but do not retain
                the audio file after transcription. If the app uses your
                browser’s built-in speech recognition instead, that processing
                stays on your device and does not go through OpenAI.
              </li>
              <li>
                <strong>Scripture lookups:</strong> When you use memorization or
                scripture features, we send passage requests to third-party Bible
                providers (API.Bible and/or ESV). Passage text may be cached on
                our servers without tying the cache to your identity.
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">
              3. How We Use Your Information
            </h2>
            <p>We use the information to:</p>
            <ul class="list-disc pl-6 space-y-1 mt-2">
              <li>
                Provide and operate the prayer app (display prayers, groups,
                memorization, notifications, and billing features you use).
              </li>
              <li>Authenticate you and manage your account, roles, and preferences.</li>
              <li>
                Send email and push notifications you have opted into (for
                example new prayers, approvals, reminders, or admin messages).
              </li>
              <li>
                Support organization administrators with moderation and admin
                tools (approvals, member management, and tenant settings).
              </li>
              <li>
                Process subscriptions and billing through Stripe on the web.
              </li>
              <li>
                Improve the product, troubleshoot issues, and protect security
                (including analytics described below).
              </li>
              <li>Comply with legal obligations where required.</li>
            </ul>
            <p class="mt-2">
              We do not sell your personal information.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">
              4. Who Has Access / Multi-Tenant
            </h2>
            <p>
              Your data is stored in our database and scoped by organization
              (tenant). Organization administrators and leaders can access the
              data they need to run the app for their community (for example
              approving prayers, managing members, and sending notifications).
              Church prayers you submit (after approval) are visible to other
              logged-in users in that community according to app settings. Group
              prayers are visible to members of that group. Personal prayers are
              visible only to you unless you share them through the app’s
              features. Platform operators may access data as needed for support,
              abuse response, billing operations, and keeping the service secure.
              We do not sell your personal information.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">
              5. Third-Party Services
            </h2>
            <p class="mb-2">
              The app relies on third-party providers that process data according
              to their own policies, including:
            </p>
            <ul class="list-disc pl-6 space-y-1">
              <li>
                <strong>Supabase:</strong> Database, authentication, and backend
                functions.
              </li>
              <li>
                <strong>Vercel:</strong> Web hosting and a first-party geo cookie
                used to decide whether to show analytics consent in your region.
              </li>
              <li>
                <strong>Stripe:</strong> Web checkout, subscriptions, and the
                customer portal for Church and Pro plans.
              </li>
              <li>
                <strong>Resend:</strong> Transactional email (for example
                verification codes and notifications).
              </li>
              <li>
                <strong>PostHog:</strong> Product analytics and session replay
                when enabled (see Analytics / cookies below).
              </li>
              <li>
                <strong>Apple (APNs) and Google (FCM):</strong> Push notification
                delivery on mobile devices.
              </li>
              <li>
                <strong>OpenAI:</strong> Speech-to-text for memorization recite
                when that feature is configured to use Whisper on the server.
              </li>
              <li>
                <strong>API.Bible and ESV:</strong> Scripture text and passage
                audio for memorization and reference features.
              </li>
              <li>
                <strong>Notion:</strong> In-app feedback tasks (linked by
                submission ID; submitter email and name are not stored on the
                Notion page).
              </li>
              <li>
                <strong>Planning Center (optional):</strong> When a church
                enables this integration, member lookup may send names and email
                addresses to Planning Center under that church&apos;s own account.
              </li>
            </ul>
            <p class="mt-2">
              Each provider has its own privacy policy. We choose providers that
              are committed to protecting user data.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">
              6. Analytics / Cookies
            </h2>
            <p class="mb-2">
              In the European Union, the United Kingdom, and the EEA (Iceland,
              Liechtenstein, and Norway), we ask for your consent before
              analytics cookies run. When you accept, we use PostHog, which may
              set cookies and collect usage data (and session replay when
              enabled). You can accept or reject analytics via the in-app banner
              or in Settings under <strong>Analytics cookies</strong> when those
              controls are shown for your region. Elsewhere, we may use PostHog
              for similar product analytics without a prior consent banner.
              California residents may have additional privacy rights regarding
              this data—contact us as described below.
            </p>
            <p class="mb-2">
              We use an approximate country or region (for example from your IP
              address or a first-party cookie set by our host) to decide whether
              consent controls apply. A VPN or proxy may report a different
              country than where you are physically located.
            </p>
            <p>
              Separately from PostHog, we store some first-party usage events in
              our <strong>analytics</strong> table (for example logged-in page
              views and activity timestamps) to support basic product metrics
              within the app.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">
              7. Data Retention and Security
            </h2>
            <p class="mb-2">
              While your account is active, we retain the data needed to provide
              the service. Examples of routine retention and cleanup:
            </p>
            <ul class="list-disc pl-6 space-y-1 mb-2">
              <li>
                Sign-in verification codes are short-lived (about 15 minutes).
              </li>
              <li>
                Outbound email queue rows are removed after successful delivery
                or after maximum send retries.
              </li>
              <li>
                Unused push device tokens (about 30 days without use) and old push
                log entries (about 7 days) are cleaned up on a schedule.
              </li>
              <li>
                PostHog data is retained according to our PostHog project
                settings.
              </li>
            </ul>
            <p class="mb-2">
              You can permanently delete your account yourself in Settings using
              <strong>Delete your account</strong>. You choose whether to keep
              your prayers (they stay in the community with anonymized author
              information) or delete your account and all prayers you authored.
              Deletion removes your login and most personal data we hold; it does
              not delete your church’s organization, other people’s prayers, or
              church billing records in Stripe. Some information may remain in
              third-party systems (for example typed text in old Notion feedback
              descriptions or historical GitHub issues if any were created
              outside the current in-app flow).
            </p>
            <p class="mb-2">
              Church administrators (or platform support) may delete a church
              organization from Admin settings. That removes the church’s shared
              prayer wall, settings, and church billing in Stripe; it does not
              delete members’ login accounts or their personal prayers and
              prayer groups. Members who pay for Pro individually keep Pro;
              others return to free platform limits when they no longer belong to
              a paid church.
            </p>
            <p>
              We use industry-standard security measures (for example encryption
              in transit and at rest and access controls) to protect your data.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">
              8. Your Choices and Rights
            </h2>
            <ul class="list-disc pl-6 space-y-1">
              <li>
                You can turn off <strong>email notifications</strong> and
                <strong>push notifications</strong> in Settings.
              </li>
              <li>
                Where shown for your region, you can change
                <strong>Analytics cookies</strong> (PostHog) in Settings or via
                the banner. Rejecting analytics does not block core prayer
                features.
              </li>
              <li>
                You can make church prayer requests <strong>anonymous</strong> or
                use <strong>personal prayers</strong> for private requests.
              </li>
              <li>
                You can <strong>delete your account</strong> in Settings (keep
                prayers anonymized or wipe prayers you authored). This is
                permanent and signs you out.
              </li>
              <li>
                There is no self-serve data export in the app today. For access,
                correction, export, or other privacy requests, contact us through
                <a
                  routerLink="/support"
                  class="text-blue-600 dark:text-blue-400 hover:underline"
                  >Support</a
                >
                or your organization’s administrators.
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">9. Children</h2>
            <p>
              The app is not directed at children under 13. We do not knowingly
              collect personal information from children under 13. If you
              believe we have collected such information, please contact us so
              we can delete it.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">
              10. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will post
              the updated policy in the app and update the "Last updated" date.
              Continued use of the app after changes constitutes acceptance of
              the updated policy.
            </p>
          </section>

          <section>
            <h2 class="text-xl font-semibold mt-6 mb-2">11. Contact</h2>
            <p>
              For privacy-related questions or requests, visit our
              <a
                routerLink="/support"
                class="text-blue-600 dark:text-blue-400 hover:underline"
                >Support</a
              >
              page. You can also contact the organization that operates this
              Prayer App (for example your church or ministry) through the
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
export class PrivacyComponent {}
