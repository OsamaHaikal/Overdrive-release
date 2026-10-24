# OverDrive fork — BYD Seal 05 (China-market car used in Germany)

Personal fork of [yash-srivastava/Overdrive-release](https://github.com/yash-srivastava/Overdrive-release).
Upstream is MIT; this fork keeps the licence and credits.

## What this fork changes

| Area | Change | Files |
|------|--------|-------|
| BYD China cloud | Brand identity (`targetBrand`, `vehicleBrand`, `BrandFlag`, MQTT prefix/topic) is configurable via `bydCloud.cnBrand` instead of hardcoded Dynasty. Values: `dynasty`, `ocean`, `denza`, `yangwang`, `fangchengbao` (or codes 1–5). Default stays `dynasty`. | `byd/cloud/BydCloudConfig.java`, `BydCloudClient.java`, `BydCloudTransport.java`, `server/BydCloudApiHandler.java` |
| Web UI | "China app brand" selector on the BYD Cloud page, shown only when the server region is China. | `web/local/byd-cloud.html`, `web/shared/surveillance.js`, `web/i18n/{en,ar,zh-CN}.json` |
| Updater | In-app updater points at this fork's releases. | `updater/AppUpdater.java` |
| Build | opencv-mobile download URL fixed (upstream URL 404s on a clean clone). | `app/build.gradle.kts` |
| CI | Signed release build + GitHub release on every push to `main`. | `.github/workflows/build.yml` |
| My Car page | Phone-first premium control page (Tesla-app style): 3D hero, lock/climate/flash/find/trunk quick actions, windows/sunshade/sunroof, climate steppers, location, charging. Uses only existing endpoints. Sidebar entry "My Car". | `web/local/car.html`, `web/shared/fork/car.css`, `web/shared/fork/car.js`, `web/shared/app-shell.js` (one nav line), `web/i18n/{en,ar}.json` |
| Resources | Vector placeholders for the four `google_maps_logo_*` drawables upstream references but never committed (`*.png` is gitignored); without them `processReleaseResources` fails on a clean clone. | `res/drawable/google_maps_logo_*.xml` |

Unverified assumption: for Ocean cars the BrandFlag header and MQTT prefix are
literally `ocean` (mirroring the `oceanEmqBroker` field BYD's API returns).
If login works but MQTT pushes never arrive, this is the first place to look.

## Build pipeline

Every push to `main` runs `.github/workflows/build.yml`, which:

1. installs JDK 17, Android SDK 36, NDK 26.1.10909125, CMake 3.22.1;
2. runs `./gradlew :app:assembleRelease` with version `<year>.<MMDD>.<run>`;
3. publishes `overdrive-release-alpha-v<version>.apk` as release `alpha-v<version>`.

The in-app updater lists these under the **alpha** channel, newest first, so
any earlier build can be re-installed from the car if a new one misbehaves.

Secrets (Settings → Secrets → Actions): `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`,
`KEY_PASSWORD`, `KEY_ALIAS`.

Signing key: the keystore is **not** in the repo. Losing it means the car must
uninstall/reinstall instead of updating in place. Keep a backup. Because the
key differs from upstream's, the closed `libod.so` blind-spot view renders
black; everything else works.

## My Car page notes

- Hero title defaults to "BYD Seal 05" when the selected 3D model is `seal`; override it from the browser console with
  `localStorage.setItem('od.car.name', 'Your name')`.
- Trunk on the quick row needs a second tap within 3 s (it physically opens the car). Everything else fires on one tap.
- Location opens Google Maps at the head unit's last GPS fix (from `/status.gps`).
- Preview without a car: serve `app/src/main/assets/web` with any static server and stub the `/api/*` and `/status`
  endpoints (a mock used during development lives outside the repo).

## Syncing with upstream

```bash
git fetch upstream
git merge upstream/main      # resolve conflicts in the files listed above
git push                     # CI builds and publishes
```

## First install on the car

1. Enable wireless ADB on the head unit (dialer `*#91532547#*` + IMEI password, or Restore ×10).
2. `adb connect <car-ip>:5555 && adb install -r overdrive-release-alpha-v*.apk`
3. Open OverDrive → BYD Cloud → country **China**, brand **Ocean** (Seal family), account + control PIN.
