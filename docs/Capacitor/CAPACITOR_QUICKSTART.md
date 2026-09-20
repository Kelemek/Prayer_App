# Quick Start: Running Your Prayer App on iOS & Android

## What's Ready

✅ Capacitor framework installed
✅ iOS and Android projects created  
✅ Push notifications configured
✅ Angular build synced to native platforms
✅ CapacitorService for handling push notifications
✅ PushNotificationService for backend integration

## Next Steps

### 1. Web deploy vs native sync (hybrid shell)

**Most UI changes:** deploy to Vercel (`https://prayerapp.romans8.net`). Online native users load the live site automatically — no Xcode/Android rebuild.

**Offline fallback:** the store binary still contains a snapshot from the last `npm run cap:sync:prod` (bundled `webDir`). Refresh it when cutting a store release or when offline users must not lag too far behind.

**Native rebuild required for:** Capacitor plugins, icons/splash, permissions, `allowNavigation`, and refreshing the offline bundle (`cap:sync:prod`).

```bash
# Refresh offline bundle + copy config into ios/android (store builds)
npm run cap:sync:prod

# Config/plugins only (no Angular rebuild)
npm run cap:dev
```

**Device live-reload (optional):** copy `.env.capacitor.example` → `.env.capacitor`, set `CAPACITOR_SERVER_URL` to your `ng serve` URL, run `npm run start:lan`, then `npm run cap:dev` once and run from Xcode/Android Studio.

### 2. Test on iOS (Xcode)

```bash
# Open in Xcode
npx cap open ios
```

Then:
1. Select your iPhone or simulator from the device dropdown
2. Press the Play button to build and run
3. Click through the notification permission popup

**Wireless Debugging (Connect iPhone without USB):**
1. Connect iPhone via USB initially
2. In Xcode: Window → Devices and Simulators
3. Select your device → "Connect via Network"  
4. Disconnect USB - now it will connect wirelessly

### 3. Test on Android (Android Studio)

```bash
# Open in Android Studio
npx cap open android
```

Then:
1. Select an emulator or connected device
2. Press the Play button to build and run
3. Grant notification permission when prompted

### 4. Check Logs

**iOS Logs:**
- In Xcode: View → Debug Area → Show Debug Area (⌘⇧Y)
- Look for "Initializing Capacitor" messages

**Android Logs:**
- In Android Studio: View → Tool Windows → Logcat
- Filter by "prayerapp"

## Development Workflow

```bash
# 1. Change Angular code
# 2. Verify in browser: npm start (or deploy to Vercel for native online testing)
# 3. When you need a newer offline snapshot or native project updates:
npm run cap:sync:prod
# 4. Open IDE and run (Play)
npx cap open ios   # or npx cap open android
```

## Key Files

- `capacitor.config.ts` - Main configuration
- `src/app/services/capacitor.service.ts` - Push notification handling
- `src/app/services/push-notification.service.ts` - Backend token storage
- `ios/App/` - Xcode project
- `android/app/` - Android Studio project
- [CAPACITOR_SETUP.md](CAPACITOR_SETUP.md) - Full detailed guide

## Testing Push Notifications

Right now, push notifications require backend setup. For testing:

1. **Get device token:**
   - Check browser console for "Push token received: ..."
   - This is logged when app first runs

2. **Backend setup needed:**
   - Create `device_tokens` table in Supabase (see [../migrations/device_tokens_schema.sql](../migrations/device_tokens_schema.sql))
   - Create Supabase Edge Function to send via FCM (see supabase/functions/send-push-notification/)
   - Set up Firebase Cloud Messaging account

3. **Send test notification:**
   ```typescript
   // Once backend is ready
   const result = await supabase.functions.invoke('send-push-notification', {
     body: {
       emails: ['user@example.com'],
       title: 'Test',
       body: 'Testing push notifications',
       data: { type: 'test' }
     }
   });
   ```

## Troubleshooting

**"Could not find the web assets directory"**
```bash
npm run cap:sync:prod
```

**Build fails in Xcode**
- Product → Clean Build Folder
- Delete `ios/Pods` and `ios/Podfile.lock`
- Product → Build

**Build fails in Android Studio**
- File → Invalidate Caches
- Build → Clean Project
- Build → Rebuild Project

**Notifications not showing**
- Check that permissions were granted
- Look at service logs (Xcode/Android Studio)
- Verify `CapacitorService` initialized (see logs)

## What Happens When You Launch Native

1. **Cold start** loads bundled assets from `dist/prayerapp/browser/` (offline-capable UI snapshot).
2. **If online**, the app probes `https://prayerapp.romans8.net` and navigates there so users get the latest Vercel deploy.
3. **Capacitor plugins** (push, badge, print, browser) work on both bundled and live origins when `allowNavigation` includes the production host.
4. **Supabase** still requires network for live data either way.

## Next: Add Backend for Notifications

To actually send push notifications, you need:

1. **Set up Supabase edge function** (see `supabase/functions/send-push-notification/index.ts`)
2. **Create device_tokens table** (see [../migrations/device_tokens_schema.sql](../migrations/device_tokens_schema.sql))
3. **Configure Firebase** (for Android) or APNs (for iOS)
4. **Update admin interface** to send notifications to users

See [CAPACITOR_SETUP.md](CAPACITOR_SETUP.md) for complete details.

## Resources

- [Capacitor Docs](https://capacitorjs.com)
- [Xcode Documentation](https://developer.apple.com/xcode/)
- [Android Studio Guide](https://developer.android.com/studio/intro)
- Your local guides: [CAPACITOR_SETUP.md](CAPACITOR_SETUP.md), [NATIVE_IDENTITY.md](NATIVE_IDENTITY.md)
