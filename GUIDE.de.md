# Anleitung

Schritt für Schritt durch das Laufbursche NAVEE Tool. Die Seite spricht über Web Bluetooth mit deinem NAVEE-Scooter, komplett auf deinem Gerät. Es werden keine Daten an einen Server gesendet.

## Was du brauchst

- Einen NAVEE-Scooter (die Tretroller-Linie, zum Beispiel die XT5). Einschalten und in wenigen Metern Reichweite halten.
- Einen Browser mit Web Bluetooth: **Chrome** oder **Edge** auf Android bzw. Desktop. Auf iPhone/iPad **Bluefy**. Safari und Firefox unterstützen Web Bluetooth nicht.
- Bluetooth eingeschaltet. Auf Android braucht der Browser die Standortfreigabe für den Bluetooth-Scan.

## Mit welchen Geräten es funktioniert

Das Tool spricht das Standard-Scooter-Protokoll von NAVEE, dasselbe, das die offizielle App für die ganze Scooter-Linie nutzt. Die Auth-Schlüssel sind über diese Scooter hinweg gleich, deshalb redet das Tool mit jedem davon, nicht nur mit der XT5. Die NAVEE-E-Bikes und die Exo-Linie nutzen andere Bluetooth-Protokolle und werden **nicht** unterstützt.

## Die numerische Konto-userId ermitteln (XT5 Ultra, XT5 Pro, XT5 Max)

### Worum es geht und warum es oft schiefgeht

Das Tool authentifiziert sich gegenüber dem Roller mit deiner **numerischen Konto-userId**. Diese Zahl ist Teil des Login-/Session-Paars, das die App beim Anmelden vom Server bekommt. In der App steckt sie im Feld `UserSession.userId` - einem echten Integer (Ganzzahl).

Die App zeigt dir auf dem Konto-Bildschirm aber eine **ganz andere** Kennung an: die sogenannte **NaveeID**. Das ist ein alphanumerischer String (Buchstaben und Ziffern gemischt) von rund 13 Zeichen Länge. Intern liegt sie im Feld `UserInfo.naveeId` - einer eigenen Klasse, die gar kein numerisches ID-Feld besitzt.

Kurz gesagt sitzen die beiden IDs auf zwei verschiedenen Objekten:

| Merkmal | Numerische userId | NaveeID |
|---|---|---|
| Klasse/Feld | `UserSession.userId` | `UserInfo.naveeId` |
| Typ | Integer (reine Zahl) | String (Buchstaben und Ziffern) |
| Länge | bis maximal 10 Ziffern | rund 13 Zeichen |
| Herkunft | Login-/Auth-Antwort (Token und userId als Session-Paar) | Nutzerprofil, Anzeige auf dem Konto-Bildschirm |
| Für das Tool | **das hier brauchst du** | **NICHT verwenden** |

> **Merksatz:** Was du in der App ablesen kannst, ist die **falsche** ID. Die richtige steht nirgends in der Oberfläche - sie kommt nur aus der Login-Antwort des Servers und muss aus dem Netzwerkverkehr oder dem BLE-Verkehr geholt werden.

Wenn du versehentlich die NaveeID (den ~13-stelligen Mischcode) einträgst, quittiert das Tool das mit **Fehler 255**. Details zu diesem Fehlerbild stehen in der Gesamtanalyse.

---

### Route A - iOS (Mitschnitt direkt auf dem iPhone)

Auf dem iPhone geht es ohne PC mit einer HTTPS-Mitschnitt-App wie **Http Catcher** oder **Stream** aus dem App Store.

1. **App installieren.** Http Catcher (oder Stream) aus dem App Store laden und öffnen.
2. **VPN-Profil erlauben.** Beim ersten Start richtet die App ein lokales VPN-Profil ein, über das der Verkehr läuft. Bestätige die Nachfrage mit "Erlauben" und deinem Code/Face ID.
3. **Root-Zertifikat installieren.** Die App bietet an, ihr CA-Zertifikat zu installieren. Folge dem Assistenten: `Einstellungen -> Profil geladen -> Installieren`.
4. **Zertifikat als vertrauenswürdig markieren (wichtig, sonst kein HTTPS-Klartext):** `Einstellungen -> Allgemein -> Info -> Zertifikatsvertrauens-Einstellungen` und dort den Schalter für das Zertifikat der Mitschnitt-App aktivieren.
5. **HTTPS-Entschlüsselung (SSL) in der App einschalten.** In Http Catcher unter den Einstellungen "SSL Proxying" (oder "HTTPS decryption") aktivieren.
6. **Mitschnitt starten.** In der Mitschnitt-App auf Aufnahme/Record tippen (rundes Symbol).
7. **NAVEE-App neu anmelden.** Die NAVEE-App öffnen und dich **komplett neu einloggen** (bei Bedarf vorher abmelden). Genau dieser Login erzeugt die Antwort mit der userId.
8. **Login-Aufruf finden.** Zurück in der Mitschnitt-App die Liste filtern nach dem Host **`lj.naveetech.com`**. Suche den POST-Aufruf, der zum Login/zur Anmeldung gehört (Pfad enthält typischerweise `login`, `auth` oder `token`).
9. **userId ablesen.** Diesen Eintrag antippen und zur **Response** (Antwort-Body, JSON) wechseln. Dort das Feld **`userId`** suchen - eine reine Zahl mit bis zu 10 Ziffern. Direkt daneben steht meist das Token. Diese Zahl ist dein Wert für das Tool.

---

### Route B - Android

#### B1) Ohne Root - PC und HTTP Toolkit

Der bequemste Weg ohne Root. Du brauchst einen PC im selben WLAN und das kostenlose **HTTP Toolkit**.

1. **HTTP Toolkit auf dem PC installieren** und starten (Windows/macOS/Linux).
2. Im Startbildschirm die Kachel **"Android device via ADB"** wählen (Telefon per USB anstecken, USB-Debugging in den Entwickleroptionen aktiv). Alternativ "Android device via WiFi", wenn du den QR-Code und die App auf dem Telefon nutzt.
3. HTTP Toolkit richtet den Proxy und - über ADB - sein Zertifikat automatisch ein. Bestätige am Telefon die Nachfragen (VPN-Erlaubnis und Zertifikat).
4. **Wichtig bei aktuellem Android:** Apps vertrauen von Haus aus nur System-Zertifikaten. HTTP Toolkit umgeht das bei per ADB verbundenen Geräten automatisch (Frida-basiert) für die meisten Apps. Falls der NAVEE-Verkehr nicht im Klartext erscheint, hilft nur der Root-Weg B2.
5. **Aufnahme läuft automatisch.** Jetzt die NAVEE-App öffnen und dich **neu einloggen**.
6. In HTTP Toolkit links nach dem Host **`lj.naveetech.com`** filtern, den Login-POST anklicken und im **Response-Body** das Feld **`userId`** ablesen (Zahl, bis 10 Ziffern).

#### B2) Mit Root - PCAPdroid mit System-Zertifikat

Direkt auf dem Telefon, ohne PC, aber Root nötig. **PCAPdroid** aus F-Droid oder Play Store.

1. **PCAPdroid installieren** und öffnen.
2. In den Einstellungen **"TLS decryption"** aktivieren. PCAPdroid installiert dafür ein eigenes CA (mitmproxy-basiert).
3. Da du Root hast, das PCAPdroid-CA **als System-Zertifikat** setzen: PCAPdroid bietet dazu den Punkt "Install certificate -> as system CA" an (nutzt Root, um das Zertifikat in den System-Store zu schreiben). Bestätigen und danach einmal neu starten, falls verlangt.
4. In PCAPdroid als **"Target app"** die NAVEE-App auswählen, damit nur deren Verkehr gefiltert wird.
5. Auf **Start** tippen (VPN-Nachfrage erlauben) und dann in der NAVEE-App **neu einloggen**.
6. Aufnahme stoppen und die HTTP(S)-Verbindungen durchsehen. Den Aufruf zu **`lj.naveetech.com`** öffnen und im Antwort-JSON das Feld **`userId`** ablesen.

#### B3) Ohne mitmproxy - BLE-HCI-Snoop-Log (liefert fertigen Auth-Frame)

Dieser Weg umgeht die HTTPS-Mitschnitt ganz. Statt die userId als Zahl zu holen, ziehst du den **fertigen Auth-Frame** aus dem Bluetooth-Verkehr zwischen App und Roller und fügst ihn direkt in das Tool ein. Praktisch, wenn TLS-Pinning den HTTPS-Weg blockiert.

1. **Entwickleroptionen öffnen** (`Einstellungen -> Über das Telefon -> 7x auf die Build-Nummer tippen`).
2. In den Entwickleroptionen **"Bluetooth-HCI-Snoop-Log aktivieren"** einschalten.
3. **Bluetooth aus- und wieder einschalten**, damit das Log-Mitschreiben startet.
4. Die NAVEE-App öffnen, dich einloggen und dich **normal mit dem Roller verbinden**, sodass die App die Authentifizierung über BLE durchführt. Kurz warten, bis die Verbindung steht.
5. **Log auslesen.** Je nach Gerät liegt die Datei unter `btsnoop_hci.log` (per `adb pull` oder über ein Bug-Report-Log: `adb bugreport`). Die Datei mit **Wireshark** öffnen.
6. In Wireshark nach dem BLE-Schreibvorgang der App auf die NAVEE-Characteristic filtern (ATT `Write` bzw. `Write Command`). Der **Auth-Frame** ist genau das Datenpaket, das die App kurz nach dem Verbindungsaufbau schreibt - er enthält bereits die userId in kodierter Form.
7. Die Roh-Bytes dieses Frames als Hex kopieren und im Tool in das Feld **"Auth-Frame"** einfügen. Damit brauchst du die Zahl selbst nicht mehr separat.

> Welche Characteristic und welcher Frame-Aufbau das genau sind, steht im BLE-Protokoll-Kapitel der Gesamtanalyse.

---

### Verifikation - habe ich die richtige ID

Prüfe die eingetragene ID an diesen Merkmalen, bevor du das Tool startest:

- Sie besteht **ausschließlich aus Ziffern** - keine Buchstaben, kein Bindestrich, kein Doppelpunkt.
- Sie ist **höchstens 10 Ziffern** lang.
- Sie stammt aus dem **Response-Body** des Login-Aufrufs an `lj.naveetech.com` (Feld `userId`), **nicht** vom Konto-Bildschirm.

Zeigt das Tool **Fehler 255**, hast du mit hoher Wahrscheinlichkeit die falsche Kennung erwischt - meist die alphanumerische ~13-stellige **NaveeID** vom Konto-Bildschirm statt der reinen Zahl aus der Login-Antwort. Trage in dem Fall die numerische `userId` ein und wiederhole den Versuch.

## Schritt für Schritt

1. **Seite öffnen** in einem unterstützten Browser.
2. **userId eintragen und Verbinden.** Trage oben deine numerische Konto-userId ein (siehe Abschnitt davor), dann wird *Verbinden* frei. Auf *Verbinden* tippen und deinen Scooter im Dialog auswählen. Er erscheint unter seinem Namen (NAVEE...), genau wie in der offiziellen App. Falls er nicht auftaucht, den Haken *Alle Bluetooth-Geräte zeigen* setzen und dort suchen. Das Tool authentifiziert sich direkt nach dem Verbinden automatisch.
3. **Werte erscheinen automatisch.** Gleich nach dem Verbinden liest das Tool den Status und zeigt Region, SKU, Max-Speed, Limit, die Seriennummer und die Telemetrie. Die rohen Frames stehen zusätzlich als Hex im Log.
4. **Geschwindigkeit entsperren (nur XT5 Ultra, XT5 Pro, XT5 Max).** Auf *Entsperren (bis 50,8 km/h)* tippen. Das sendet den flash-freien Gang-4-Befehl (BLE 0x58 = 4). Am XT5 Ultra gibt das 50,8 km/h frei, am XT5 Pro/Max rund 40 km/h. *Sperren* stellt den Normalmodus wieder her (Gang 3). Der Wert ist fest von der Firmware vorgegeben, nicht einstellbar, deshalb gibt es kein Speed-Eingabefeld.
   - Verhalten am Gerät: Das Display bleibt in D, die Boost-Taste ist ohne Funktion. Ein Wechsel in Modus S oder ein Neustart hebt den Trick auf und stellt die normalen Modi wieder her, also je Fahrt neu senden.
   - Bei allen anderen Modellen bringt der Befehl nichts: der Controller riegelt den Befehl auf sein Region-Limit ab oder der Meter hat den Gang-4-Weg nicht. Siehe die Modell-Liste auf der Seite.
5. **Erneut Status lesen** und prüfen, was der Scooter jetzt meldet.

## Wie weit geht es

Der Gang-4-Weg ist ein reines XT5-Familien-Feature, über die ganze Firmware-Kette code-belegt: XT5 Ultra erreicht 50,8 km/h (am Gerät bestätigt), XT5 Pro/Max rund 40 km/h. Die 50,8 sind die feste Obergrenze der Firmware, nicht höher setzbar. Bei allen anderen Modellen wirkt der Trick nicht, weil der Controller den Befehl auf sein Region-Limit abriegelt oder der Meter den Gang-4-Weg nicht hat.

## Ist es dauerhaft

Nein - das ist sogar der Vorteil: der Gang-4-Trick ändert nur ein RAM-Byte, kein Flash. Ein Wechsel in Modus S oder ein Neustart stellt den Normalzustand wieder her, also je Fahrt neu *Entsperren* drücken. Kein Brick-Risiko, kein Flashen.

## Fehlersuche

- **Der Scooter fehlt im Dialog.** Sicherstellen, dass er an und nah ist, Bluetooth aktiv ist und der Browser auf Android die Standortfreigabe hat. Dann *Alle Bluetooth-Geräte zeigen* anhaken.
- **Fehler 255 im Log.** Der Scooter lehnt die Konto-ID ab. Meist wurde die alphanumerische Navee-ID statt der numerischen userId eingetragen. Siehe den Abschnitt *Einmalig: deine NAVEE Konto-userId finden*.
- **Verbindet, aber keine Werte.** Im Log auf RX-Frames achten. Wenn die Authentifizierung scheitert (Fehler 255), steht das im Log.
- **Entsperren bringt kein Tempo.** Dann ist es kein XT5 Ultra/Pro/Max. Bei anderen Modellen riegelt der Controller den Gang-4-Befehl auf sein Region-Limit ab, der Trick wirkt dort nicht.

## Datenschutz und Recht

Alles läuft lokal über Bluetooth. Siehe [Datenschutz](PRIVACY.de.md). Das Anheben der Geschwindigkeit hebt die Drossel auf, damit erlischt die ABE und der Betrieb auf öffentlichen Wegen ist nicht erlaubt. Nutzung nur am eigenen Fahrzeug auf privatem Gelände. Siehe den [Haftungsausschluss](#) im Fuß der Seite.
