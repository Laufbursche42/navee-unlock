# Anleitung

Schritt für Schritt durch das Laufbursche NAVEE Tool. Die Seite spricht über Web Bluetooth mit deinem NAVEE-Scooter, komplett auf deinem Gerät. Es werden keine Daten an einen Server gesendet.

## Was du brauchst

- Einen NAVEE-Scooter (die Tretroller-Linie, zum Beispiel die XT5). Einschalten und in wenigen Metern Reichweite halten.
- Einen Browser mit Web Bluetooth: **Chrome** oder **Edge** auf Android bzw. Desktop. Auf iPhone/iPad **Bluefy**. Safari und Firefox unterstützen Web Bluetooth nicht.
- Bluetooth eingeschaltet. Auf Android braucht der Browser die Standortfreigabe für den Bluetooth-Scan.

## Mit welchen Geräten es funktioniert

Das Tool spricht das Standard-Scooter-Protokoll von NAVEE, dasselbe, das die offizielle App für die ganze Scooter-Linie nutzt. Die Auth-Schlüssel sind über diese Scooter hinweg gleich, deshalb redet das Tool mit jedem davon, nicht nur mit der XT5. Die NAVEE-E-Bikes und die Exo-Linie nutzen andere Bluetooth-Protokolle und werden **nicht** unterstützt.

## Einmalig: deine NAVEE Konto-userId finden

Dein Scooter ist an ein NAVEE-Konto gebunden. Zum Verbinden braucht das Tool die **numerische Konto-userId** dieses Kontos. Ein gebundener Scooter lehnt jede andere ID mit **Fehler 255** ab, noch bevor er überhaupt antwortet.

Wichtig:

- Das ist **nicht** die Navee-ID aus dem Konto-Screen (die ist alphanumerisch und oft 13-stellig). Gebraucht wird eine reine Zahl mit **höchstens 10 Stellen**.
- Die App zeigt diese Zahl nirgends an, du liest sie einmal aus. Danach merkt sich das Tool sie im Browser, du brauchst das also nur ein einziges Mal.
- Die Zahl **ändert sich nie**. Nur ein anderes NAVEE-Konto hat eine andere Zahl.

Gesucht ist in der Antwort des Login-Aufrufs das Feld userId, eine reine Zahl.

### iPhone (am einfachsten, ganz ohne Computer)

Die NAVEE-App hat kein Cert-Pinning und iOS vertraut einem selbst installierten Zertifikat.

1. Aus dem App Store eine On-Device-Mitschnitt-App laden, zum Beispiel Http Catcher oder Stream.
2. Deren Zertifikatsprofil installieren unter Einstellungen -> Allgemein -> VPN & Geräteverwaltung, danach unter Einstellungen -> Allgemein -> Info -> Zertifikatsvertrauenseinstellungen auf volles Vertrauen stellen.
3. In der Mitschnitt-App die Aufnahme starten, dann die NAVEE-App öffnen und dich einloggen (zur Not einmal abmelden plus neu anmelden).
4. Den Aufruf an lj.naveetech.com mit dem Namen login öffnen und in der Antwort das Feld userId ablesen.
5. Die Zahl im Tool oben ins Feld NAVEE Konto-userId eintragen. Tipp: Du kannst auch den ganzen kopierten Antworttext hier einfügen, das Tool zieht die userId automatisch heraus.

### Android (ohne Root braucht es einmal einen PC)

Auf Android vertraut die App nur System-Zertifikaten. Ein reiner Handy-Proxy wie PCAPdroid funktioniert deshalb nur mit Root.

Variante BLE (am robustesten, kein Root nötig):

1. In den Entwickleroptionen Bluetooth-HCI-Snoop-Log aktivieren, danach Bluetooth einmal aus- plus wieder einschalten.
2. Einmal mit der echten NAVEE-App zum Scooter verbinden.
3. Das Log holen: Entwickleroptionen -> Bugreport oder am PC per adb.
4. Das Log in Wireshark öffnen und den Write an Characteristic b002 suchen, der mit 55aa0030 beginnt. Kopiere den kompletten Hex-String bis fefd.
5. Im Tool unter Erweitert in das Feld Auth-Frame (Hex) einfügen. Der Frame enthält deine userId schon fertig gepackt, du musst die Zahl gar nicht entziffern.

Variante Netzwerk:

- Mit Root: PCAPdroid nutzen, sein Zertifikat als System-Zertifikat einspielen, einloggen und die userId in der Login-Antwort ablesen.
- Ohne Root, aber mit PC: HTTP Toolkit (kostenlos) nutzen, damit eine mitlesbare Version der App starten, einloggen und die userId ablesen.

## Schritt für Schritt

1. **Seite öffnen** in einem unterstützten Browser.
2. **userId eintragen plus Verbinden.** Trage oben deine numerische Konto-userId ein (siehe Abschnitt davor), dann wird *Verbinden* frei. Auf *Verbinden* tippen und deinen Scooter im Dialog auswählen. Er erscheint unter seinem Namen (NAVEE...), genau wie in der offiziellen App. Falls er nicht auftaucht, den Haken *Alle Bluetooth-Geräte zeigen* setzen und dort suchen. Das Tool authentifiziert sich direkt nach dem Verbinden automatisch.
3. **Werte erscheinen automatisch.** Gleich nach dem Verbinden liest das Tool den Status und zeigt Region, SKU, Max-Speed, Limit, die Seriennummer plus die Telemetrie. Die rohen Frames stehen zusätzlich als Hex im Log.
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
