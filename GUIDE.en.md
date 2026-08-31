# Guide

A step-by-step walkthrough of the Laufbursche NAVEE Tool. The page talks to your NAVEE scooter over Web Bluetooth, entirely on your device. Nothing is sent to any server.

## What you need

- A NAVEE scooter (the kick-scooter line, for example the XT5). Turn it on and keep it within a few meters.
- A browser with Web Bluetooth: **Chrome** or **Edge** on Android or desktop, or **Bluefy** on iPhone/iPad. Safari and Firefox do not support Web Bluetooth.
- Bluetooth switched on. On Android, location permission has to be granted to the browser for a Bluetooth scan.

## Which devices it works with

The tool speaks the standard NAVEE scooter protocol, the same one the official app uses for the whole scooter line. The authentication keys are shared across these scooters, so the tool talks to any of them, not only the XT5. NAVEE e-bikes and the Exo line use different Bluetooth protocols and are **not** covered.

## One time: find your NAVEE account userId

Your scooter is bound to a NAVEE account. To connect, the tool needs the **numeric account userId** of that account. A bound scooter rejects any other id with **error 255**, before it even answers.

Important:

- This is **not** the Navee ID from the account screen (that one is alphanumeric and often 13 digits). What is needed is a plain number of **at most 10 digits**.
- The app never shows this number, you read it once. After that the tool remembers it in the browser, so you only ever do this a single time.
- The number **never changes**. Only a different NAVEE account has a different number.

You are looking for the field userId, a plain number, in the response of the login call.

### iPhone (easiest, no computer at all)

The NAVEE app has no cert pinning and iOS trusts a self-installed certificate.

1. Install an on-device HTTPS capture app from the App Store, for example Http Catcher or Stream.
2. Install its certificate profile under Settings -> General -> VPN & Device Management, then set it to full trust under Settings -> General -> About -> Certificate Trust Settings.
3. Start the capture, then open the NAVEE app and log in (if needed, log out plus log back in once).
4. Open the call to lj.naveetech.com named login and read the field userId in its response.
5. Enter the number in the tool at the top in the NAVEE account userId field. Tip: you can also paste the whole copied response text here, the tool extracts the userId automatically.

### Android (without root you need a PC once)

On Android the app trusts only system certificates. A plain on-device proxy like PCAPdroid therefore needs root.

BLE variant (most robust, no root needed):

1. Enable the Bluetooth HCI snoop log in Developer options, then switch Bluetooth off plus on once.
2. Connect to the scooter once with the real NAVEE app.
3. Get the log: Developer options -> bug report, or via adb on a PC.
4. Open the log in Wireshark and find the write to characteristic b002 that starts with 55aa0030. Copy the full hex string up to fefd.
5. Paste it in the tool under Advanced into the Auth frame (hex) field. The frame already contains your userId, so you do not need to decode the number.

Network variant:

- With root: use PCAPdroid, install its certificate as a system certificate, log in and read the userId in the login response.
- Without root but with a PC: use HTTP Toolkit (free), start a readable build of the app with it, log in and read the userId.

## Step by step

1. **Open the page** in a supported browser.
2. **Enter userId plus connect.** Enter your numeric account userId at the top (see the section above), then *Connect* becomes available. Press *Connect* and pick your scooter from the chooser. It appears by name (NAVEE...), exactly as in the official app. If it is not listed, tick *Show all Bluetooth devices* and look for it there. The tool authenticates automatically right after connecting.
3. **Values appear automatically.** Right after connecting the tool reads the status and shows the region, SKU, max speed, limit, the serial number plus the telemetry. The raw frames are also written to the log as hex.
4. **Unlock the speed (XT5 Ultra, XT5 Pro, XT5 Max only).** Press *Unlock (up to 50.8 km/h)*. This sends the flash-free gear-4 command (BLE 0x58 = 4). On the XT5 Ultra it frees 50.8 km/h, on the XT5 Pro/Max about 40 km/h. *Lock* restores the normal mode (gear 3). The value is fixed by firmware, not adjustable, so there is no speed input field.
   - Behaviour on the device: the display stays in D and the boost button does nothing. Switching to mode S or a reboot cancels the trick and restores the normal modes, so resend each ride.
   - On every other model it does nothing: the controller re-clamps the command to its region limit or the meter has no gear-4 path. See the model list on the page.
5. **Read status again** to confirm what the scooter now reports.

## How far does it go

The gear-4 route is an XT5-family feature, proven across the whole firmware chain: XT5 Ultra reaches 50.8 km/h (confirmed on the device), XT5 Pro/Max about 40 km/h. The 50.8 is the firmware's hard ceiling, not settable higher. On every other model the trick has no effect, because the controller re-clamps the command to its region limit or the meter lacks the gear-4 path.

## Is it permanent

No, and that is the upside: the gear-4 trick changes one RAM byte, not flash. Switching to mode S or a reboot restores the normal state, so press *Unlock* again each ride. No brick risk, no flashing.

## Troubleshooting

- **The scooter is not in the chooser.** Make sure it is on and close, Bluetooth is on, and on Android the browser has location permission. Then tick *Show all Bluetooth devices*.
- **Error 255 in the log.** The scooter rejects the account id. Most likely the alphanumeric Navee ID was entered instead of the numeric userId. See the section *One time: find your NAVEE account userId*.
- **Connects but no values.** Check the log for RX frames. If authentication failed (error 255), the log says so.
- **Unlock does not add speed.** Then it is not an XT5 Ultra/Pro/Max. On other models the controller re-clamps the gear-4 command to its region limit, so the trick has no effect there.

## Privacy and legal

Everything runs locally over Bluetooth. See [Privacy](PRIVACY.md). Raising the speed removes the throttle limit, so the road approval lapses and public-road use is not allowed. Use only on your own vehicle on private ground. See the [Disclaimer](#) in the footer.
