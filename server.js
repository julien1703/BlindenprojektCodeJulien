require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const { exec } = require('child_process'); // Zum Abspielen der Audiodatei
const axios = require('axios');

const OpenAI_Api = process.env.API_KEY;

const openai = new OpenAI({
  apiKey: OpenAI_Api
});

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

app.post('/analyze', upload.single('frame'), async (req, res) => {
    try {
        const base64_image = req.file.buffer.toString('base64');
        const descriptionLength = req.body.descriptionLength;
        const descriptionSpeed = req.body.descriptionSpeed;

        // let max_tokens;
        // switch(descriptionLength) {
        //     case 'long':
        //         max_tokens = 200;
        //         break;
        //     case 'medium':
        //         max_tokens = 100;
        //         break;
        //     case 'short':
        //         max_tokens = 50;
        //         break;
        // }

        const gptResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `Schreibe die Antwort bitte so, dass sie blinden Menschen helfen kann, sich die Umgebung besser vorzustellen. Achte dabei auf eine Erklärung mit  Details. falls du kein Bild erreichst antworte mit "{"error": "no image found"}`
                },
                {
                    role: "user",
                    content: 
                    [
                        {"type": "text", "text": `Erkläre dem Blinden, was auf dem Bild zu sehen ist, um ihm dabei zu helfen, sich die Umgebung in die er sich befindet, besser vorzustellen.`},
                        {"type": "image_url", "image_url": 
                            {
                                "url": `data:image/jpeg;base64,${base64_image}`
                            }
                        }
                    ]
                }
            ],
            // max_tokens: max_tokens
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

                // Audio abspielen
                exec(`mpg321 ${audioPath}`, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Error playing audio: ${error.message}`);
                        return;
                    }
                    console.log(`Audio played successfully`);
                });

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
