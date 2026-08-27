# Anleitung

Schritt für Schritt durch das Laufbursche NAVEE Tool. Die Seite spricht über Web Bluetooth mit deinem NAVEE-Scooter, komplett auf deinem Gerät. Es werden keine Daten an einen Server gesendet.

## Was du brauchst

- Einen NAVEE-Scooter (die Tretroller-Linie, zum Beispiel die XT5). Einschalten und in wenigen Metern Reichweite halten.
- Einen Browser mit Web Bluetooth: **Chrome** oder **Edge** auf Android bzw. Desktop. Auf iPhone/iPad **Bluefy**. Safari und Firefox unterstützen Web Bluetooth nicht.
- Bluetooth eingeschaltet. Auf Android braucht der Browser die Standortfreigabe für den Bluetooth-Scan.

## Mit welchen Geräten es funktioniert

Das Tool spricht das Standard-Scooter-Protokoll von NAVEE, dasselbe, das die offizielle App für die ganze Scooter-Linie nutzt. Die Auth-Schlüssel sind über diese Scooter hinweg gleich, deshalb redet das Tool mit jedem davon, nicht nur mit der XT5. Die NAVEE-E-Bikes und die Exo-Linie nutzen andere Bluetooth-Protokolle und werden **nicht** unterstützt.

## Schritt für Schritt

1. **Seite öffnen** in einem unterstützten Browser.
2. **Verbinden.** Auf *Verbinden* tippen und deinen Scooter im Dialog auswählen. Er erscheint unter seinem Namen (NAVEE...), genau wie in der offiziellen App. Falls er nicht auftaucht, den Haken *Alle Bluetooth-Geräte zeigen* setzen und dort suchen. Das Tool authentifiziert sich direkt nach dem Verbinden automatisch.
3. **Status lesen.** Auf *Status lesen* tippen, dann siehst du Region, SKU, Max-Speed, Limit sowie die Seriennummer. Die rohen Frames stehen zusätzlich als Hex im Log.
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
- **Verbindet, aber keine Werte.** Noch einmal *Status lesen* drücken. Im Log auf RX-Frames achten. Wenn die Authentifizierung scheitert, steht das im Log.
- **Ein Wert bleibt nicht.** Die Firmware klemmt ihn eventuell auf die aktuelle SKU. Erst die Region auf eine höhere SKU setzen, dann die Geschwindigkeit erneut schreiben.

## Datenschutz und Recht

Alles läuft lokal über Bluetooth. Siehe [Datenschutz](PRIVACY.de.md). Das Anheben der Geschwindigkeit hebt die Drossel auf, damit erlischt die ABE und der Betrieb auf öffentlichen Wegen ist nicht erlaubt. Nutzung nur am eigenen Fahrzeug auf privatem Gelände. Siehe den [Haftungsausschluss](#) im Fuß der Seite.
