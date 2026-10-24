# CLAUDE.md — OverDrive fork for a BYD Seal 05 DM-i

Read `FORK.md` first; it lists every fork change and the build pipeline. This file holds the working rules.

## What this repo is
Personal fork of yash-srivastava/Overdrive-release (MIT) by OsamaHaikal. The car is a China-market
2025 BYD Seal 05 DM-i (Ocean series, PHEV, silver-grey). Goal: control the car from an Android phone
(Galaxy S26 Ultra) through OverDrive's web dashboard, with the BYD China cloud as the remote path.

## Build and release
- Push to `main` → `.github/workflows/build.yml` builds `assembleRelease`, signs it with the repo secrets
  (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_PASSWORD`, `KEY_ALIAS`) and publishes release `alpha-v<year>.<MMDD>.<run>`.
  Markdown-only pushes do not build. A newer push cancels an in-progress build.
- The in-app updater (`updater/AppUpdater.java`, `GITHUB_REPO`) lists these releases on the alpha channel.
- Never commit the keystore. Never regenerate it: a new key breaks in-place updates on the car.
- No local toolchain is required; CI is the compile check. Expect ~8 minutes per build.

## Conventions for fork changes
- Keep new code in fork-owned files: `app/src/main/assets/web/local/car.html`, `app/src/main/assets/web/shared/fork/*`.
  Touch upstream files only with one-line hooks (an `@import`, a nav entry, a default value) and mark them `// fork:`.
- Theme lives in `web/shared/fork/theme.css` (neutral zinc palette, blue accent, no green, light default, compact tokens).
  It uses `html:root` selectors on purpose so it outranks `revamp.css`. Bump `styles.css?v=` in `web/local/*.html`
  whenever `styles.css` or its imports change, or phones keep the cached theme.
- i18n: add new keys to `web/i18n/en.json` (and `ar.json` when easy); missing keys fall back to English.
- Design direction (owner's stated taste): light, compact, rounded, minimal, Tesla-app feel, no green accents.
- BYD China cloud: brand comes from `bydCloud.cnBrand` (dynasty|ocean|denza|yangwang|fangchengbao). Ocean is the
  value for this car. The `ocean` BrandFlag/MQTT prefix is unverified against the real server.

## Known upstream quirks (already patched here)
- opencv-mobile download URL pointed at a tag that 404s (fixed to `v31`).
- `drawable/google_maps_logo_*` PNGs are gitignored upstream; vector placeholders live in `res/drawable/`.

## Syncing upstream
`git fetch upstream && git merge upstream/main` (or GitHub's "Sync fork"). Conflicts are expected only in the
files named in `FORK.md`; resolve by keeping the fork hook and taking upstream's surrounding code.
