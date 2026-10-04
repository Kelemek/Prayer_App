# Cold boot performance (dev)

Measure cold startup without changing the web-first update model.

## Enable marks

- Query param: `?cold_boot_perf=1` on any URL
- Or `localStorage.setItem('cold_boot_perf', '1')` then reload

With perf enabled, the console logs `[ColdBoot]` measures between named phases.

## Web (cold cache)

1. Open DevTools → Network → disable cache.
2. Hard reload (or empty cache and hard reload).
3. Note time until the boot spinner clears and Home shell appears.
4. Count Supabase RPCs before first navigation completes.

## Native (cold)

1. Build or use a device with online connectivity.
2. Force-quit the app.
3. Relaunch and confirm the WebView loads the live site (not only bundled `webDir`).
4. Compare spinner duration with `cold_boot_perf` enabled via live URL query param if needed.

## After perf changes

Confirm deploy + restart still picks up feature changes without a store build. On dev, `?force_upgrade=1` should still show the force-upgrade flow once the version gate RPC completes.
