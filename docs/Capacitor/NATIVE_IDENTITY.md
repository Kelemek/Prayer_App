# Native identity (SaaS vs Cross Pointe)

This repo (`Kelemek/Prayer_App`) is the **multi-church SaaS** native app. Cross Pointe’s native app lives in `Kelemek/angular_prayerapp` and must keep a different store identity.

## Dual-app IDs

| Product | Repo | Capacitor `appId` / iOS bundle ID / Android `applicationId` |
| --- | --- | --- |
| Cross Pointe | `Kelemek/angular_prayerapp` | `com.prayerapp.mobile` — **do not change** |
| SaaS | `Kelemek/Prayer_App` | `com.churchprayer.app` |

`com.churchprayer.app` is reverse-DNS of churchprayer.com so a future sale does not leave `romans8` in the store identity. Display name can stay **Prayer App** (home-screen label is currently **Prayer**). Web hosting can stay [prayerapp.romans8.net](https://prayerapp.romans8.net) until a public domain move.

Do **not** reuse Cross Pointe’s URL scheme (`com.prayerapp.mobile://`). SaaS uses `com.churchprayer.app` as the Capacitor custom URL scheme.

Associated Domains are **not** configured on this app today (`App.entitlements` is Push only). If Universal Links are added later, the AASA file must list `TEAMID.com.churchprayer.app` separately from Cross Pointe’s `TEAMID.com.prayerapp.mobile`.

## Reinstall note

Any device that ran a **SaaS** build while this repo still used `com.prayerapp.mobile` must **uninstall that build** before installing Cross Pointe or a new SaaS build.

- iOS and Android treat bundle ID / application ID as the app identity. Two apps cannot share it.
- A leftover SaaS install under `com.prayerapp.mobile` collides with Cross Pointe’s production ID.

After this change, SaaS and Cross Pointe can be installed side by side.

## Push (Firebase / APNs)

Register **this** app as `com.churchprayer.app` in Firebase (Android package + iOS bundle ID) and as an Apple App ID with Push enabled.

If Firebase is shared with Cross Pointe, **add** a second iOS/Android app. Do not retarget Cross Pointe’s existing `com.prayerapp.mobile` apps.

`android/app/google-services.json` is gitignored. Add it locally after creating the Firebase Android app.

The Edge Function `send-push-notification` falls back to `APNS_BUNDLE_ID=com.churchprayer.app` when the secret is unset. Hosted secrets are **not** rotated from this repo change — set `APNS_BUNDLE_ID` in the SaaS Supabase project when the Apple App ID exists (see checklist below).

## Billing (no IAP)

Subscriptions are **web Stripe only** (Checkout + Customer Portal). Native apps must not offer In-App Purchase.

- Church checkout and Pro upgrade UI are hidden on native.
- **Manage billing** on native opens the system browser (`@capacitor/browser`).
- Creating a church on native skips Checkout and tells the admin to finish billing on the web.

## App Review notes (draft)

Paste into App Store Connect when you submit (after the public marketing name is ready):

> This app provides access to a multi-church prayer service that is also available on the web. Church and Pro subscriptions are purchased and managed on the web via Stripe Checkout and the Stripe Customer Portal. The app does not offer In-App Purchase. The same account and features are available at the website. On native devices, “Manage billing” opens the system browser to the Stripe portal. Privacy policy: /privacy. Support: /support. Users can delete their account in Settings.

## Later steps (not done in repo config)

Do these in Apple / Google / Firebase / Supabase consoles when ready to ship. Do **not** submit until the public marketing name is chosen.

- [ ] Register or renew **churchprayer.com** if you want the public domain to match the bundle ID
- [ ] Apple Developer: create App ID `com.churchprayer.app` and enable **Push Notifications**
- [ ] Xcode: let it create a provisioning profile for the new bundle (or create one in the Developer portal)
- [ ] App Store Connect: create the app listing when the marketing name is ready — do not submit yet
- [ ] Google Play Console: create an app with application ID `com.churchprayer.app`
- [ ] Firebase: add iOS + Android apps for `com.churchprayer.app`; download `google-services.json` into `android/app/` locally
- [ ] SaaS Supabase: `supabase secrets set APNS_BUNDLE_ID 'com.churchprayer.app'` then redeploy `send-push-notification`
- [ ] When listings exist: point `/info` Play URL at `https://play.google.com/store/apps/details?id=com.churchprayer.app` and fill in the App Store URL (until then, store CTAs stay “Coming soon”)
- [ ] Store screenshots, privacy URLs, and the review notes above when the product is named
