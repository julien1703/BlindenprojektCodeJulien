require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const { exec } = require('child_process'); // Zum Abspielen der Audiodatei

const OpenAI_Api = process.env.API_KEY;

const openai = new OpenAI({
  apiKey: OpenAI_Api
});

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let currentMode = 1; // Initial mode
const audioQueue = []; // Warteschlange für Audio-Beschreibungen
let isPlaying = false; // Status, ob gerade eine Audio-Datei abgespielt wird

// Verzeichnis für gespeicherte Bilder
const imageDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
}

// Endpunkt zum Empfangen und Speichern von Bildern
app.post('/upload', upload.single('image'), (req, res) => {
    const imagePath = path.join(imageDir, 'current.jpg');
    fs.writeFileSync(imagePath, req.file.buffer);
    console.log('Image received and saved at: ', imagePath);
    res.send('Image received and saved');
});

// Endpunkt zum Wechseln des Modus
app.post('/mode', (req, res) => {
    currentMode = req.body.mode;
    res.json({ mode: currentMode });
    console.log(`Mode switched to: ${currentMode}`);
});

app.post('/analyze', upload.single('frame'), async (req, res) => {
    try {
        const base64_image = req.file.buffer.toString('base64');

        let prompt;
        switch(currentMode) {
            case 1:
                prompt = "french";
                break;
            case 2:
                prompt = "spanish";
                break;
        }

        const gptResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `du bist ein hilfsystem welches blinde menschen unterstützt sich in ihrer umgebung besser zurechtzufinden`
                },
                {
                    role: "user",
                    content: [
                        { "type": "text", "text": `in 1 senetence describe the picture in the following language ${prompt}` },
                        { "type": "image_url", "image_url": { "url": `data:image/jpeg;base64,${base64_image}` } }
                    ]
                }
            ],
        });

        const description = gptResponse.choices[0].message.content;
        console.log('GPT Response: ', description);

        // TTS-Anfrage
        const ttsResponse = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: description,
        });

        console.log('TTS Response: ', ttsResponse);

        // Verarbeitung der Antwort als Stream
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

                // Füge die Datei zur Warteschlange hinzu und starte die Wiedergabe, falls keine Datei abgespielt wird
                audioQueue.push(audioPath);
                if (!isPlaying) {
                    playNextInQueue();
                }

                res.json({ description: description, audioPath: audioPath });
            } catch (err) {
                console.error('Error writing file:', err);
                res.status(500).send('Error writing audio file');
            }
        } else {
            console.error('TTS Response body is undefined or invalid');
            res.status(500).send('TTS Response body is undefined or invalid');
        }
    } catch (error) {
        console.error('Error processing the image: ', error);
        res.status(500).send('Error processing the image');
    }
});

// Funktion zur Wiedergabe der nächsten Audiodatei in der Warteschlange
function playNextInQueue() {
    if (audioQueue.length === 0) {
        isPlaying = false;
        return;
    }

    isPlaying = true;
    const audioPath = audioQueue.shift();
    exec(`mpg321 ${audioPath}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error playing audio: ${error.message}`);
            isPlaying = false;
            return;
        }
        console.log('Audio played successfully');
        // Rufe die Funktion erneut auf, um die nächste Datei in der Warteschlange abzuspielen
        playNextInQueue();
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
