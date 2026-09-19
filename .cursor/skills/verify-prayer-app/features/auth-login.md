# Sign in

Sign in lets a visitor open the public login page, request a verification code, enter the code (or the platform app-tester code), and reach the home prayer list — or complete registration / wait for approval when the email is new.

## Sub-features

- `login-open` shows the email form on `/login` without a session.
- `login-info-link` opens the public info page from login.
- `login-send-code` requests a code and shows the OTP field.
- `login-test-account` completes sign-in with the platform tester email and 6-digit code (no mailbox).
- `login-home` lands on `/` with home chrome after a valid code.
- `login-register` shows first/last name (and affiliation when required) for an unknown email.
- `login-guard` redirects an anonymous `/` visit to `/login?returnUrl=/`.

## How to get to it (user POV)

- Open `/login` directly.
- Open `/` while signed out (redirects to login).
- Open `/info` and choose `Web Site` (goes to `/`, then login if unauthenticated).
- Choose `Learn more about this app` on the login page to reach `/info`.

## Driving it with Playwright

Preconditions:

- Prayer App is healthy at `http://127.0.0.1:4200`.
- `bin/doctor --instance` is READY.
- Browser width ≥ 640px.
- For `login-test-account` / `login-home`: `PRAYER_APP_VERIFY_EMAIL` and `PRAYER_APP_VERIFY_OTP` are the platform test-account values. Skip those bullets if unset.

- **Open login.** Go to `/login`. Run `page.goto(base + '/login')`. Heading `Prayer Community` is visible and the email textbox is labelled `Email Address`.
- **Guard redirect.** Go to `/` signed out. Run `page.goto(base + '/')`. The URL contains `/login` and `returnUrl`.
- **Info link.** From login, choose `Learn more about this app`. Run `page.getByRole('link', { name: /Learn more about this app/i }).click()`. The heading includes `Prayer Community` and `Manager`, and `Web Site` is visible.
- **Return to login.** Go to `/login` again. Run `page.goto(base + '/login')`. Button `Send Verification Code` is visible and disabled until the email is valid.
- **Send code.** Fill the test-account email and send. Run `page.getByLabel('Email Address').fill(email)` and `page.getByRole('button', { name: 'Send Verification Code' }).click()`. Heading `App Tester Sign In` or `Check Your Email` appears and `#mfa-code-input` is shown. For the tester email the copy is `Enter your app tester code below (no email sent):`.
- **Enter code.** Fill the 6-digit code. Run `page.locator('#mfa-code-input').fill(otp)`. The page leaves `/login` (the field auto-submits when complete).
- **Home chrome.** After login, assert home. The header includes `Request` (`#tour-btn-new-prayer-request-desktop`) and `Settings` (`#tour-btn-settings-desktop`).
- **Helper.** Prefer `bin/drive public` for the unauthenticated bullets and `bin/drive login` for the OTP bullets.
- **Proof.** Save `artifacts/<run-id>/login.png` (email form) and `home-after-login.png` (header `Request` visible). Both text dumps include `Prayer Community` or home chrome.

## Gotchas

- `/login` HTML from `curl` is the SPA shell. The heading and button exist only after the client render. HTTP 200 alone is not `login-open`.
- The OTP field auto-submits when the digit count is complete. Do not also press a missing Verify button.
- A normal mailbox needs a real email. Do not poll production Resend. Use the test account.
- New emails can show `Complete Registration` or a pending-approval message instead of home. That is `login-register`, not a failed login.
- Offline copy `You're offline. Connect to the internet to sign in.` blocks send. Doctor the network, do not retry blindly.
- `npm test` watches. Use `npx vitest --run src/app/pages/login/login.component.spec.ts` for the unit stand-in when the browser cannot run.
