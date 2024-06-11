require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const { exec } = require('child_process');
const { createHash } = require('crypto');

const OpenAI_Api = process.env.API_KEY;

const openai = new OpenAI({
  apiKey: OpenAI_Api
});

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Verzeichnis für gespeicherte Bilder und Beschreibungen
const imageDir = path.join(__dirname, 'public', 'images');
const descriptionFile = path.join(__dirname, 'public', 'lastDescription.json');

if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
}

// Hilfsfunktion zum Vergleichen der neuen Beschreibung mit der vorherigen
async function compareDescriptions(newDesc, oldDesc) {
    if (!oldDesc) return newDesc; // Falls keine alte Beschreibung vorhanden ist, neue Beschreibung verwenden

    // Verwende die OpenAI-API, um die Ähnlichkeit der Beschreibungen zu berechnen
    const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: [newDesc, oldDesc]
    });

    const newDescEmbedding = response.data[0].embedding;
    const oldDescEmbedding = response.data[1].embedding;

    // Berechne die Kosinusähnlichkeit der Embeddings
    const dotProduct = newDescEmbedding.reduce((sum, value, i) => sum + value * oldDescEmbedding[i], 0);
    const newDescMagnitude = Math.sqrt(newDescEmbedding.reduce((sum, value) => sum + value * value, 0));
    const oldDescMagnitude = Math.sqrt(oldDescEmbedding.reduce((sum, value) => sum + value * value, 0));

    const similarity = dotProduct / (newDescMagnitude * oldDescMagnitude);

    // Falls die Ähnlichkeit größer als 0.8 ist, als gleich behandeln
    if (similarity > 0.6) {
        return ''; // Keine signifikanten Änderungen
    }

    return newDesc; // Signifikante Änderungen vorhanden
}

// Hilfsfunktion zum Berechnen eines Hash-Werts für das Bild
function getImageHash(imageBuffer) {
    return createHash('sha256').update(imageBuffer).digest('hex');
}

// Warteschlange für Audio-Wiedergabe
let audioQueue = [];
let isPlaying = false;

function playAudioQueue() {
    if (audioQueue.length > 0 && !isPlaying) {
        isPlaying = true;
        const audioPath = audioQueue.shift();

        exec(`mpg321 ${audioPath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error playing audio: ${error.message}`);
            } else {
                console.log('Audio played successfully');
            }
            isPlaying = false;
            playAudioQueue();
        });
    }
}

// Endpunkt zum Empfangen und Speichern von Bildern
app.post('/upload', upload.single('image'), (req, res) => {
    const imagePath = path.join(imageDir, 'current.jpg');
    fs.writeFileSync(imagePath, req.file.buffer);
    console.log('Image received and saved at: ', imagePath);
    res.send('Image received and saved');
});

// Endpunkt zur Bildanalyse
app.post('/analyze', upload.single('frame'), async (req, res) => {
    try {
        const imageBuffer = req.file.buffer;
        const base64_image = imageBuffer.toString('base64');

        // Berechne den Hash-Wert des aktuellen Bildes
        const newImageHash = getImageHash(imageBuffer);

        let lastImageHash = '';
        let lastDescription = '';

        if (fs.existsSync(descriptionFile)) {
            const lastDescriptionData = JSON.parse(fs.readFileSync(descriptionFile, 'utf-8'));
            lastImageHash = lastDescriptionData.imageHash;
            lastDescription = lastDescriptionData.description;
        }

        // Prüfe, ob das Bild signifikant anders ist als das vorherige Bild
        if (newImageHash === lastImageHash) {
            console.log('No significant changes detected');
            return res.json({ description: 'No significant changes detected' });
        }

        // Erstelle eine vollständige Beschreibung für das erste Bild
        const gptResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `Schreibe die Antwort bitte so, dass sie blinden Menschen helfen kann, sich die Umgebung besser vorzustellen. Achte dabei auf eine Erklärung mit Details. Falls du kein Bild erreichst, antworte mit '{"error": "no image found"}'`
                },
                {
                    role: "user",
                    content: [
                        { "type": "text", "text": `Erkläre dem Blinden, was auf dem Bild zu sehen ist, um ihm dabei zu helfen, sich die Umgebung, in der er sich befindet, besser vorzustellen.` },
                        { "type": "image_url", "image_url": { "url": `data:image/jpeg;base64,${base64_image}` } }
                    ]
                }
            ],
        });

        const newDescription = gptResponse.choices[0].message.content;
        console.log('GPT Response: ', newDescription);

        // Vergleich der neuen Beschreibung mit der alten Beschreibung
        const changes = await compareDescriptions(newDescription, lastDescription);
        if (changes.trim()) {
            console.log('Neuer Inhalt. Vorlesen der neuen Informationen.');
        } else {
            console.log('Inhalt ist gleich. Keine Audio-Datei wird vorgelesen.');
            return res.json({ description: 'No significant changes detected' });
        }

        if (changes) {
            // TTS-Anfrage
            const ttsResponse = await openai.audio.speech.create({
                model: "tts-1",
                voice: "alloy",
                input: changes,
            });

            console.log('TTS Response: ', ttsResponse);

            if (ttsResponse && ttsResponse.body) {
                const audioPath = path.join(__dirname, 'public', 'speech.mp3');
                console.log('Audio Path:', audioPath);

                // Speichern der Audiodatei mit Error-Handling
                try {
                    const stream = ttsResponse.body;
                    const buffer = await new Promise((resolve, reject) => {
                        const chunks = [];
                        stream.on('data', chunk => chunks.push(chunk));
                        stream.on('end', () => resolve(Buffer.concat(chunks)));
                        stream.on('error', reject);
                    });

                    await fs.promises.writeFile(audioPath, buffer);
                    console.log('Audio saved at:', audioPath);

                    // Füge die Audiodatei zur Warteschlange hinzu und starte die Wiedergabe, falls noch nicht laufend
                    audioQueue.push(audioPath);
                    playAudioQueue();

                    // Speichern der neuen Beschreibung und des Bild-Hashes
                    const descriptionData = {
                        description: newDescription,
                        imageHash: newImageHash
                    };
                    fs.writeFileSync(descriptionFile, JSON.stringify(descriptionData));

                    res.json({ description: changes, audioPath: audioPath });
                } catch (err) {
                    console.error('Error writing file:', err);
                    res.status(500).send('Error writing audio file');
                }
            } else {
                console.error('TTS Response body is undefined or invalid');
                res.status(500).send('TTS Response body is undefined or invalid');
            }
        } else {
            res.json({ description: 'No significant changes detected' });
        }
    } catch (error) {
        console.error('Error processing the image: ', error);
        res.status(500).send('Error processing the image');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
