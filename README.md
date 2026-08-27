# Laufbursche NAVEE Tool

**Live page: https://laufbursche42.github.io/navee-unlock/** - open it in Chrome (Android/desktop) or Bluefy (iOS), no install needed. The page is bilingual (German/English, switch in the header).

A small static web page that connects to a NAVEE scooter over Web Bluetooth and changes its speed cap. It can set the max speed **directly** (the same 0x6E / 0x6B commands the official app's own Max-speed and Speed-limit screens use) or go the **region/SKU** route - the same lever the paid "license" tuners use. Nothing to install, no account, no firmware flash, no server: everything runs locally in the browser.

**Which devices.** It speaks the standard NAVEE scooter protocol, the one the official app uses for the whole kick-scooter line (for example the XT5). The authentication keys are shared across these scooters, so the tool talks to any of them, not only the XT5. NAVEE e-bikes and the Exo line use different Bluetooth protocols and are not covered. Full walkthrough in the [guide](GUIDE.en.md).

## How it works

The scooter's speed cap follows its **region / SKU**. The official app sets that region **once, when you first bind the scooter** - from a value the server returns for your GPS location - and writes it to the scooter over Bluetooth. This page reproduces that single write, so you can set the region yourself.

**Persistent, not per-session.** The official app writes the region only at bind; a normal reconnect just reads it. So the change survives reopening the app. It reverts only if you unbind and rebind in the app, or manually pick a lower speed there.

## Status

This is **experimental and not yet verified on a physical XT5.** Use **Read status** to see what your scooter reports and **Scan** to find the region that lifts the cap, then report back what happens.

## Use it

1. Turn the scooter on and keep it close.
2. **Connect** and pick the scooter from the list - it shows up by name (NAVEE...), same as in the official app, and authenticates automatically. If it is not listed, tick "show all Bluetooth devices".
3. **Read status** - shows the current region, SKU, max and limit speed, and the serial.
4. Set the speed. Two ways:
   - **Direct:** type a value under "Direct speed" and press **Set max speed (0x6E)** or **Set limit (0x6B)**. Any value is allowed, not just what the app offers.
   - **Region route:** **Scan** to find the country value that raises the cap, or type a known value and press **Unlock**.
5. **Read status** again to confirm the new cap.

## Disclaimer

This changes the scooter's approved configuration and removes the speed limit. Once unlocked the vehicle is no longer in its road-legal configuration, with the corresponding road-approval, insurance and warranty consequences - that is on you. Use only where permitted, at your own risk. This is independent, unofficial research and is not affiliated with NAVEE.
