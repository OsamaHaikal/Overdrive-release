# Setup guide — Seal 05 DM-i, OverDrive fork, Galaxy S26 Ultra (hotspot only)

The car has no SIM, so it gets internet and talks to your phone through the phone's hotspot.
You use the app from the phone whenever the car's screen is awake and you are within Wi-Fi range.
Far away or car asleep: use the key fob (lock, unlock, windows, 2-second remote start).
Data (trips, battery history, parking) is stored on the car and shows up whenever you reconnect.

Follow in order. Stop and note what you see whenever a step does not match. About one hour.

## Before going to the car (10 min)

1. Put the APK on the USB stick you used for YouTube:
   https://github.com/OsamaHaikal/Overdrive-release/releases/latest → `overdrive-release-alpha-v….apk`.
2. Phone: Settings → Connections → Mobile Hotspot:
   - Band: **2.4 GHz** (the car cannot see 5 GHz).
   - ⋮ → Configure → turn **off** "Turn off when no devices connected".
3. Phone: turn **off** wireless Android Auto for this car (it steals the car's Wi-Fi from the hotspot).

## At the car, part A — fob tests (2 min, risk-free)

4. Car off, in P, doors closed, stand outside. Hold the fob's **start/stop** button 2 s → indicators flash 3× → car is on.
   Is the AC running? Hold 2 s again to switch off.
5. Hold **lock** → all windows close. Hold **unlock** → all windows open.
   If nothing: screen → 设置 → 门窗与锁 → 车窗设置 → enable long-press window control.

## Part B — facts to write down (2 min)

6. Screen → Settings → About / 系统信息: photograph the **system version** (e.g. 23.x.x) and **Android version**.

Keep the car switched on for the rest of the setup.

## Part C — install OverDrive (5 min)

7. Install the APK exactly as you installed YouTube. Accept any "unknown source" prompt.
8. Open OverDrive once so it registers. Don't configure yet.

## Part D — enable wireless debugging (5–15 min)

9. Pair the phone to the car by Bluetooth (the car's Phone app needs a paired phone).
10. In the car's **Phone app** dial `*#91532547#*` and press call. It opens BYD's hidden engineering menu. One of three things happens:
    - **A password box showing an IMEI** → generate the code at https://ahmada3mar.github.io/BYD/ (car clock must show the correct date)
      or https://modhub24.com/tools, enter it, then in TestTools switch on **Wireless ADB debug** and **USB debugging**.
    - **A QR code** → newer firmware. Photograph it and stop here.
    - **Nothing** → Settings → DiLink → Software and tap the "Reset to factory settings" *text* 8–10 times (do NOT confirm a reset).
      If a hidden Debug page opens, enable wireless ADB there. Otherwise stop and report.
11. Never touch: factory reset, firmware/USB update, partition, modem or boot options.

## Part E — OverDrive first run (10 min)

12. Turn on the phone hotspot and connect the car's Wi-Fi to it.
13. Open OverDrive. When the car shows **"Allow USB debugging?"** tick *Always allow* and accept.
14. In OverDrive: autostart **on** ("Disable Autostart" unchecked); run mode **On & Off**; cameras and sentry **off** for now.
15. Set a **dashboard password**.
16. Hard-reboot the screen: hold **volume down ~5 s**. When OverDrive is back, check its Daemons page shows services running.

## Part F — phone (5 min)

17. Find the car's address: phone Settings → Connections → Mobile Hotspot → Connected devices → tap the car → `192.168.x.x`
    (OverDrive also shows it on the car's screen).
18. Chrome → `http://192.168.x.x:8080/local/car.html` → log in → ⋮ → **Add to Home screen** → Install.
19. Skip the BYD Cloud page (no account). Check battery and range appear, then try AC on/off and a window.
    Try lock/unlock last; keep the fob as the real lock.
20. If the shortcut stops working one day, the car got a new address: look it up again (step 17).

## If anything fails, send

- The photo from step 6, what step 10 showed, and a screenshot of OverDrive's Daemons page.

## Later, optional: reach the car from anywhere

Only useful if the car gets its own internet (parked within home Wi-Fi, a data SIM, or a 4G router).
Then install Tailscale on the phone and sign in to it in OverDrive → Remote access, and open the dashboard at the car's
Tailscale address (100.x.y.z) instead of 192.168.x.x.
