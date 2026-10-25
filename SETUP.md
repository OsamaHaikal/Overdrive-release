# Setup guide — Seal 05 DM-i, OverDrive fork, Galaxy S26 Ultra

Follow in order. Stop and note what you see whenever a step does not match.

## Before going to the car

1. Phone: install **Tailscale** from the Play Store and sign in (Google, Microsoft or GitHub login). Open it once so it shows "Connected".
2. Get the APK onto whatever you used to install YouTube (USB stick, FAT32):
   https://github.com/OsamaHaikal/Overdrive-release/releases/latest → `overdrive-release-alpha-v….apk`.
3. Phone: Settings → Connections → Mobile Hotspot → **Band: 2.4 GHz**. The car only sees 2.4 GHz.
4. Phone: turn **off** wireless Android Auto for this car (it steals the car's Wi-Fi link from the hotspot).

## At the car, part A — fob tests (2 minutes, risk-free)

5. Car off, in P, doors closed, stand outside. Hold the fob's **start/stop** button 2 s → indicators flash 3× → car is on. Is the AC running? Hold 2 s again to switch off.
6. Hold **lock** → all windows close. Hold **unlock** → all windows open. If nothing: screen → 设置 → 门窗与锁 → 车窗设置 → enable long-press window control.

## Part B — facts to write down (2 minutes)

7. Screen → Settings → About / 系统信息: **system version** (e.g. 23.x.x) and **Android version**. Photograph it.

## Part C — install OverDrive (5 minutes)

8. Install the APK exactly as you installed YouTube. Accept any "unknown source" prompt.
9. Open OverDrive once so it registers. Don't configure yet.

## Part D — enable wireless debugging (5–15 minutes)

10. Pair the phone to the car by Bluetooth (the car's Phone app needs a paired phone).
11. In the car's **Phone app** dial `*#91532547#*` and press call. One of three things happens:
    - **A password box showing an IMEI** → generate the code at https://ahmada3mar.github.io/BYD/ (car clock must show the correct date) or https://modhub24.com/tools, enter it, then in TestTools switch on **Wireless ADB debug** and **USB debugging**.
    - **A QR code** → newer firmware. Photograph it and stop here; send it to me.
    - **Nothing** → try Settings → DiLink → Software and tap the "Reset to factory settings" *text* 8–10 times (do NOT confirm a reset). If a hidden Debug page opens, enable wireless ADB there. Otherwise stop and report.
12. Never touch: factory reset, firmware/USB update, partition, modem or boot options.

## Part E — OverDrive first run (10 minutes)

13. Connect the car's Wi-Fi to your phone hotspot.
14. Open OverDrive. When the car shows **"Allow USB debugging?"** tick *Always allow* and accept.
15. In OverDrive: autostart **on** ("Disable Autostart" unchecked); run mode **On & Off**; cameras and sentry **off** for now.
16. Remote access → **Tailscale** → sign in (open the shown link on the phone, approve). Write down the car's Tailscale address (100.x.y.z).
17. Set a **dashboard password**.
18. Hard-reboot the screen: hold **volume down ~5 s**. Wait for OverDrive to come back; check its Daemons page shows services running.

## Part F — phone

19. Chrome → `http://100.x.y.z:8080/local/car.html` (Tailscale address) → log in → ⋮ → **Add to Home screen** → Install.
20. Skip the BYD Cloud page (no account). On the My Car page check battery and range appear, then try AC on/off and a window. Try lock/unlock last; keep the fob as the real lock.

## If anything fails, send me

- The photo from step 7, what step 11 showed, and a screenshot of OverDrive's Daemons page.
