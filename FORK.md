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
