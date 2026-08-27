# Guide

A step-by-step walkthrough of the Laufbursche NAVEE Tool. The page talks to your NAVEE scooter over Web Bluetooth, entirely on your device. Nothing is sent to any server.

## What you need

- A NAVEE scooter (the kick-scooter line, for example the XT5). Turn it on and keep it within a few meters.
- A browser with Web Bluetooth: **Chrome** or **Edge** on Android or desktop, or **Bluefy** on iPhone/iPad. Safari and Firefox do not support Web Bluetooth.
- Bluetooth switched on. On Android, location permission has to be granted to the browser for a Bluetooth scan.

## Which devices it works with

The tool speaks the standard NAVEE scooter protocol, the same one the official app uses for the whole scooter line. The authentication keys are shared across these scooters, so the tool talks to any of them, not only the XT5. NAVEE e-bikes and the Exo line use different Bluetooth protocols and are **not** covered.

## Step by step

1. **Open the page** in a supported browser.
2. **Connect.** Press *Connect* and pick your scooter from the chooser. It appears by name (NAVEE...), exactly as in the official app. If it is not listed, tick *Show all Bluetooth devices* and look for it there. The tool authenticates automatically right after connecting.
3. **Read status.** Press *Read status* to see the current region, SKU, max speed, limit and the serial number. The raw frames are also written to the log as hex.
4. **Set the speed.** Two independent ways:
   - **Direct (recommended):** type a value under *Set speed* and press *Set max speed*. This sends the same command the app's own Max-speed screen uses. *Set limit* writes the custom speed limit instead. Any value is allowed.
   - **Region route:** the region selects the SKU, which sets the default cap. *Scan values* tries the country values, reads the resulting max speed after each and fills in the best one; then press *Write region*.
5. **Read status again** to confirm what the scooter now reports.

## How far does it go

For an XT5 the official app itself offers up to **32 km/h**. The tool lets you enter higher values too, but whether the controller accepts them or caps itself is not known in advance. That is the part you test on your own scooter. Other scooter models in the line have higher ceilings in the app (up to 60 or 70 km/h), so the same command can go higher there.

## Is it permanent

The region write is persistent: the official app writes it only once at bind, a normal reconnect just reads it, so the change survives reopening the app. A direct speed write behaves like the app setting the value. Either can be changed back by writing a lower value or by rebinding in the app.

## Troubleshooting

- **The scooter is not in the chooser.** Make sure it is on and close, Bluetooth is on, and on Android the browser has location permission. Then tick *Show all Bluetooth devices*.
- **Connects but no values.** Press *Read status* once more. Check the log for RX frames. If authentication failed, the log says so.
- **A value does not stick.** The firmware may cap it to the current SKU. Set the region to a higher SKU first, then write the speed again.

## Privacy and legal

Everything runs locally over Bluetooth. See [Privacy](PRIVACY.md). Raising the speed removes the throttle limit, so the road approval lapses and public-road use is not allowed. Use only on your own vehicle on private ground. See the [Disclaimer](#) in the footer.
