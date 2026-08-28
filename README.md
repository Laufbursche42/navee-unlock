# Laufbursche NAVEE unlock

A static web page that talks to NAVEE scooters over Web Bluetooth. Connect to your scooter, it authenticates itself, and depending on the model the page lifts the speed throttle, sets the region/SKU, locks and unlocks the immobilizer and flips the per-model switches the scooter supports, straight from the browser. Nothing to install: no app store, no signing, no developer account. It runs in **Bluefy** on iOS and in **Chrome** on Android or desktop. The page is bilingual (German/English, switch in the header).

> **This is a feasibility study.** It exists to show what NAVEE's Bluetooth protocol makes possible, not to be a finished product. The protocol was reconstructed from the official app (com.navee.ucaret 2.1.6) and is documented byte for byte. Error-free operation is not promised and there is no warranty of any kind. Whatever you do with it, you do at your own risk.

**Open the web app: [laufbursche42.github.io/navee-unlock](https://laufbursche42.github.io/navee-unlock/)**

Or run it yourself, no build step, no dependencies: clone the repo and serve the folder over a local HTTP server. Opening `index.html` directly as a `file://` URL will not work, the page fetches its own documents and browsers block that over `file://`.

```
git clone https://github.com/Laufbursche42/navee-unlock.git
cd navee-unlock
python -m http.server 8000
```

Any static server works. With Node installed, this does the same job:

```
npx serve .
```

Then open the printed address in a browser that supports Web Bluetooth.

**Guide: [Deutsch](GUIDE.de.md) | [English](GUIDE.en.md)** covers everything step by step, from the first connect to setting the speed.

## Which devices it works with

The page speaks the standard NAVEE scooter protocol, the one the official app uses for the whole kick-scooter line (GATT service `0000d0ff-...`, `55 AA` frames). The connection matches the scooter by its advertised name (NAVEE...), exactly like the official app, and the five authentication keys are shared across these scooters, so the tool talks to any of them, not only the XT5 (PID prefix 2782).

Not covered: NAVEE e-bikes (PID prefix 27361 and 27391) and the Exo line (27681). Those use different Bluetooth services and protocols and are out of scope for this page.

Not every model exposes every function over Bluetooth. The page reads the scooter's own parameter report after connecting and shows only the switches that model actually reports, each preset to its current value. Nothing model-irrelevant is shown.

## What it does

- **Connect by name and authenticate automatically.** The scooter shows up by its advertised name, the page runs the challenge-response auth (five built-in AES keys) and reads the status by itself.
- **Throttle lock/unlock in one button.** Enter an open value and a throttled value, both remembered by the browser; the single button applies the right one and shows the next action. This writes the maximum speed (opcode 0x6E), the same lever the app's own Max-speed screen uses. Any value is allowed, whether the firmware accepts a given value is the hardware test.
- **Region / SKU route** (opcode 0x6F, subcommand 08). The region selects the SKU and thus the default cap; a scan tries the country values and reads the resulting max speed back.
- **Per-model settings** where the scooter reports them: immobilizer lock (0x51), zero-start / start speed (0x6A), overspeed control OSC (0x82), traction control TCS (0x5F), slope assist (0x81), cruise control (0x52), long-range mode (0x6F/7), tail light (0x54), auto light (0x57), turn-signal sound (0x60), unit km/mph (0x55) and proximity key (0x61). Each row appears only if the model reports that field.
- **Read the telemetry** the scooter sends back (region, SKU, max and limit speed, serial) and keep the raw notifications in an on-screen diagnostic log as plain hex.
- **Help on every card** via the question-mark button, and a full guide in both languages.

## Encryption and authentication

The session is protected by a challenge-response handshake, byte-exact from the app:

- The app sends an auth-init frame (opcode 0x30) with a randomly chosen key index (0 to 4) and a packed user id.
- The scooter answers with a 16-byte challenge.
- The page encrypts the challenge with the selected key using **AES-128-ECB** and sends it back (opcode 0x31). On a zero error code the session is authenticated.

The five AES-128 keys are built into the app and are identical in 2.1.6; they are the same for every scooter of this line, not per device. The control commands themselves (speed, region, the switches) are framed in plain `55 AA` frames with an 8-bit checksum; the authentication gates the session, it does not encrypt each command. An AES self-test runs on load and is written to the diagnostic log.

## Browser support

- **iOS:** the **Bluefy** browser. Safari and every other iOS browser run on the Safari engine, which has no Web Bluetooth at all.
- **Android or desktop:** **Chrome** or another Chromium browser. Web Bluetooth is built in.

There is no OTA firmware flashing here. The official app updates firmware over Bluetooth (YModem), this page does not.

## Project structure

```
index.html                - the single page: cards, dialogs, the settings
app.js                    - all logic: AES-128-ECB auth, frame builders, connect,
                            decode, the report-gated settings and the diagnostic log
i18n.js                   - the German and English string table
styles.css                - theme and layout
GUIDE.de.md, GUIDE.en.md  - the step-by-step guide
scripts/                  - check-i18n.js and security-scan.py (run in CI and the git hooks)
.github/workflows/        - CI (JS lint plus security scan) and CodeQL
.githooks/                - pre-commit and pre-push checks
```

## How it works

- The page matches the scooter by its advertised name (`namePrefix: 'NAVEE'`) and declares the GATT service as optional, because the scooter does not advertise the 128-bit service UUID. A fallback switch lists all Bluetooth devices.
- After connecting it enables notifications, runs the 0x30/0x31 auth and reads the 0x70 parameter report automatically.
- Each per-model setting is bound to its offset in that report and is shown only when the scooter reports the byte, preset to the current value. So each model shows only the options it has.
- The full byte-level protocol and the reverse-engineering notes are in the analysis document that ships with the project.

## Development

No build step and no dependencies. Edit the files and reload the page. Serve locally, Web Bluetooth needs `https` or `localhost`:

```
python -m http.server 8000
```

Run the same checks as the CI and the hooks:

```
node scripts/check-i18n.js
python scripts/security-scan.py
```

Enable the git hooks with `git config core.hooksPath .githooks`. New user-facing strings go into both languages in `i18n.js`; `check-i18n.js` fails on a missing or unused key.

## Reporting

Found a problem or want to confirm what works on a real scooter? Send a DM to
[Laufbursche on escooter-stammtisch](https://www.escooter-stammtisch.de/index.php?user/6497-laufbursche/)
or open a [GitHub issue](https://github.com/Laufbursche42/navee-unlock/issues). The copy button under the log gives you the full diagnostic transcript to paste in.

## Legal

Raising the maximum speed lifts the factory limit. The operating permit (Betriebserlaubnis, ABE) is then void and riding the scooter in public traffic is no longer allowed, with the corresponding insurance and registration consequences. Use it on your own vehicle only. Everything you do with this page is at your own risk.

## License

Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 (CC BY-NC-ND 4.0), in full in [LICENSE.md](LICENSE.md).

## Privacy

Nothing leaves your device but the page load itself. The details are in [PRIVACY.md](PRIVACY.md).

## Trademarks

An independent project, not affiliated with NAVEE. "NAVEE" and other product names are trademarks of their respective owners and are used here only to say which scooters this page works with. See [TRADEMARKS.md](TRADEMARKS.md).
