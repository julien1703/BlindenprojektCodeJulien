# Blindenbrille Projekt

Dieses Projekt implementiert eine intelligente Blindenbrille, die mithilfe eines Raspberry Pi 4 und OpenAI blinden Menschen hilft, ihre Umgebung besser wahrzunehmen. Die Brille nimmt kontinuierlich Bilder der Umgebung auf und sendet diese an einen Server, der die Bilder analysiert und detaillierte Beschreibungen zurücksendet. Diese Beschreibungen können dem Benutzer in einer geeigneten Form, beispielsweise über eine Sprachausgabe, vorgelesen werden.

## Inhaltsverzeichnis

1. [Hauptkomponenten](#hauptkomponenten)
2. [Funktionsweise](#funktionsweise)
3. [Installation](#installation)
4. [Verwendung](#verwendung)
5. [Projektstruktur](#projektstruktur)
6. [API-Endpunkte](#api-endpunkte)
7. [Systemübersicht](#systemübersicht)

## Hauptkomponenten

1. **Raspberry Pi 4**:
   - Der Raspberry Pi 4 dient als zentrale Steuerungseinheit für die Blindenbrille. Er übernimmt die Bildaufnahme, die Kommunikation mit dem Server und die Verarbeitung von Sensordaten.

2. **Kamera**:
   - Eine Raspberry Pi Camera 2, die an den Raspberry Pi 4 angeschlossen ist, nimmt in regelmäßigen Abständen Bilder der Umgebung auf.

3. **Kapazitiver Sensor**:
   - Ein kapazitiver Sensor wird verwendet, um den Modus der Beschreibung zu wechseln. Der Benutzer kann zwischen zwei Modi wählen: eine kurze Beschreibung (10-15 Wörter) und eine detaillierte Beschreibung (50-70 Wörter).

4. **OpenAI API**:
   - Die Bilder werden an die OpenAI API gesendet, um eine detaillierte Beschreibung der Umgebung zu erhalten. Die API nutzt fortschrittliche KI-Modelle, um die Inhalte der Bilder zu analysieren und zu beschreiben.

## Funktionsweise

1. **Bildaufnahme**:
   - Das System verwendet die Kamera, um Bilder aufzunehmen und an den Server zu senden. Der Server speichert die Bilder temporär und verarbeitet sie weiter.

2. **Bildanalyse und Beschreibung**:
   - Der Node.js-Server empfängt die Bilder und verwendet die OpenAI API, um die Inhalte der Bilder zu analysieren und eine Beschreibung zu generieren. Die Länge der Beschreibung hängt vom aktuellen Modus ab, der durch den kapazitiven Sensor bestimmt wird.

3. **Moduswechsel**:
   - Der kapazitive Sensor ermöglicht es dem Benutzer, zwischen zwei Modi zu wechseln. Dies geschieht durch Berühren des Sensors. Der aktuelle Modus wird an den Server gesendet, der dann die entsprechende Beschreibungslänge verwendet.

4. **Ergebnisse anzeigen**:
   - Die vom Server generierten Beschreibungen können auf verschiedene Weise angezeigt oder wiedergegeben werden, z.B. durch eine Sprachausgabe.

## Installation

### Installieren der Abhängigkeiten:
    npm install

### Umgebungsvariablen einrichten:
 - Erstelle eine .env-Datei im Projektverzeichnis und füge deinen OpenAI API-Schlüssel hinzu:
 - API_KEY=dein_openai_api_schluessel
### Installieren der Python-Abhängigkeiten:
 - pip install RPi.GPIO requests picamera2

## Verwendung

### Starten des Projekts:
 - Verwende das Startskript start.sh, um alle notwendigen Prozesse zu starten. Wir nutzen    Termius, um eine Verbindung zum Raspberry Pi herzustellen, der als unser Server fungiert.
 - ./start.sh
- Dieses Skript führt folgende Aktionen aus:
    - Navigiert zum Projektverzeichnis und zieht die neuesten Änderungen vom GitHub-Repository.
    - Installiert die notwendigen Node.js-Abhängigkeiten.
    - Startet den Node.js-Server.
    - Startet das Python-Skript für die Kamera.
    - Startet das Python-Skript für den kapazitiven Sensor.
    - Stellt sicher, dass alle Prozesse bei einem Abbruchsignal sauber beendet werden.

## Projektstruktur

- ├── public
- │   └── images
    - │       └── current.jpg
- ├── server.js
- ├── sensor.py
- ├── capture_and_send_image.py
- ├── start.sh
- ├── .env
- ├── package.json
- └── README.md

## API-Endpunkte
- POST /upload: Empfängt und speichert ein Bild.
- POST /mode: Wechselt den Modus zwischen 1 (kurze Beschreibung) und 2 (detaillierte Beschreibung).
- POST /analyze: Analysiert das hochgeladene Bild und gibt eine Beschreibung zurück.

## Systemübersicht
- Das folgende Diagramm zeigt die Verbindungen und die Datenflüsse in unserem Projekt:


### Beschreibung des Systems

Edge-System: Geräte
- Kamera: Nimmt Bilder der Umgebung auf und sendet sie an den Raspberry Pi.
- Kapazitiver Sensor: Ermöglicht den Moduswechsel durch Berührung, sendet den aktuellen Modus an den Raspberry Pi.

Netzwerk
- Raspberry Pi 4: Verarbeitet die Daten von der Kamera und dem kapazitiven Sensor und sendet sie über das Netzwerk an den Server.

Cloud-System: IoT-Plattform
- Node.js Server: Empfängt die Bilder, analysiert sie mithilfe der OpenAI API und generiert die Beschreibungen.
- OpenAI API: Analysiert die Bilder und liefert detaillierte Beschreibungen zurück an den Node.js Server.

## Anwendungen
 - Ausgabe: Die generierten Beschreibungen werden zur Ausgabe bereitgestellt, z.B. durch Sprachausgabe, um blinden Menschen zu helfen, sich ihre Umgebung besser vorzustellen.

