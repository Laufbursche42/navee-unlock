# NAVEE XT5 Unlock

A small static web page that connects to a NAVEE XT5 scooter over Web Bluetooth and changes its **region/SKU**, which is what selects the speed cap - the same lever the paid "license" tuners use. Nothing to install, no account, no firmware flash, no server: everything runs locally in the browser. Works in Chrome (Android/desktop) or Bluefy (iOS).

## How it works

The scooter's speed cap follows its **region / SKU**. The official app sets that region **once, when you first bind the scooter** - from a value the server returns for your GPS location - and writes it to the scooter over Bluetooth. This page reproduces that single write, so you can set the region yourself.

**Persistent, not per-session.** The official app writes the region only at bind; a normal reconnect just reads it. So the change survives reopening the app. It reverts only if you unbind and rebind in the app, or manually pick a lower speed there.

## Status

This is **experimental and not yet verified on a physical XT5.** Use **Read status** to see what your scooter reports and **Scan** to find the region that lifts the cap, then report back what happens.

## Use it

1. Turn the scooter on and keep it close.
2. **Connect** and pick the scooter - it authenticates automatically.
3. **Read status** - shows the current region, SKU, max and limit speed, and the serial.
4. **Scan** to find the country value that raises the max speed, or type a known value and press **Unlock**.
5. **Read status** again to confirm the new cap.

## Disclaimer

This changes the scooter's approved configuration and removes the speed limit. Once unlocked the vehicle is no longer in its road-legal configuration, with the corresponding road-approval, insurance and warranty consequences - that is on you. Use only where permitted, at your own risk. This is independent, unofficial research and is not affiliated with NAVEE.
