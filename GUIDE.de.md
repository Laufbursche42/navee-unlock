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
4. **Geschwindigkeit setzen.** Zwei getrennte Wege:
   - **Direkt (empfohlen):** einen Wert unter *Geschwindigkeit setzen* eintragen und *Max-Speed setzen* drücken. Das sendet denselben Befehl wie der Max-Speed-Screen der App. *Limit setzen* schreibt stattdessen das Custom-Limit. Jeder Wert ist erlaubt.
   - **Region-Weg:** Die Region bestimmt die SKU und damit die Default-Obergrenze. *Werte durchprobieren* testet die Ländercodes, liest nach jedem die Max-Speed und trägt den besten ein, dann *Region schreiben*.
5. **Erneut Status lesen** und prüfen, was der Scooter jetzt meldet.

## Wie weit geht es

Wie weit es geht, hängt vom Modell und der Firmware ab. Die offizielle App bietet je nach Modell unterschiedliche Obergrenzen an, von rund 32 bis 70 km/h. Das Tool lässt jeden Wert zu, auch höhere. Ob der Controller einen Wert übernimmt oder selbst abriegelt, ist vorher nicht bekannt. Probier verschiedene Werte aus und lies danach den Status, um zu sehen was hängen bleibt.

## Ist es dauerhaft

Das Region-Schreiben ist persistent: Die offizielle App schreibt es nur einmal beim Binden, ein normaler Neustart liest es nur, also übersteht die Änderung das erneute Öffnen der App. Ein direktes Speed-Schreiben verhält sich wie das Setzen des Wertes in der App. Beides lässt sich durch einen niedrigeren Wert oder erneutes Binden in der App zurücksetzen.

## Fehlersuche

- **Der Scooter fehlt im Dialog.** Sicherstellen, dass er an und nah ist, Bluetooth aktiv ist und der Browser auf Android die Standortfreigabe hat. Dann *Alle Bluetooth-Geräte zeigen* anhaken.
- **Fehler 255 im Log.** Der Scooter lehnt die Konto-ID ab. Meist wurde die alphanumerische Navee-ID statt der numerischen userId eingetragen. Siehe den Abschnitt *Einmalig: deine NAVEE Konto-userId finden*.
- **Verbindet, aber keine Werte.** Im Log auf RX-Frames achten. Wenn die Authentifizierung scheitert (Fehler 255), steht das im Log.
- **Ein Wert bleibt nicht.** Die Firmware klemmt ihn eventuell auf die aktuelle SKU. Erst die Region auf eine höhere SKU setzen, dann die Geschwindigkeit erneut schreiben.

## Datenschutz und Recht

Alles läuft lokal über Bluetooth. Siehe [Datenschutz](PRIVACY.de.md). Das Anheben der Geschwindigkeit hebt die Drossel auf, damit erlischt die ABE und der Betrieb auf öffentlichen Wegen ist nicht erlaubt. Nutzung nur am eigenen Fahrzeug auf privatem Gelände. Siehe den [Haftungsausschluss](#) im Fuß der Seite.
