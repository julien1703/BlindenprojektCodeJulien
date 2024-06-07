require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { OpenAIApi, Configuration } = require('openai'); // Stellen Sie sicher, dass diese Reihenfolge korrekt ist

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const configuration = new Configuration({
    apiKey: process.env.API_KEY,
});
const openai = new OpenAIApi(configuration);

// Verzeichnis für gespeicherte Bilder
const imageDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
}

// Endpunkt zum Empfangen und Speichern von Bildern
app.post('/upload', upload.single('image'), (req, res) => {
    const imagePath = path.join(imageDir, 'current.jpg');
    fs.writeFileSync(imagePath, req.file.buffer);
    console.log('Image received and saved');
    res.send('Image received and saved');
});

app.post('/analyze', upload.single('frame'), async (req, res) => {
    try {
        const base64_image = req.file.buffer.toString('base64');
        const descriptionLength = req.body.descriptionLength;
        const descriptionSpeed = req.body.descriptionSpeed;

        let max_tokens;
        switch(descriptionLength) {
            case 'long':
                max_tokens = 200;
                break;
            case 'medium':
                max_tokens = 100;
                break;
            case 'short':
                max_tokens = 50;
                break;
        }

        const gptResponse = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: `You are an assistant providing detailed descriptions of images for visually impaired individuals. Please provide a ${descriptionSpeed} description with ${descriptionLength} detail.`,
                },
                {
                    role: "user",
                    content: "Describe the following image:",
                },
                {
                    role: "user",
                    content: `data:image/jpeg;base64,${base64_image}`
                }
            ],
            max_tokens: max_tokens
        });

        const analysisResult = gptResponse.data.choices[0].message.content;
        console.log('GPT Response: ', analysisResult);

        // Text-to-Speech request
        const ttsResponse = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: "You are a text-to-speech converter.",
                },
                {
                    role: "user",
                    content: analysisResult,
                },
            ],
            max_tokens: 150,
        });

        const audioContent = ttsResponse.data.choices[0].message.content;
        const audioBuffer = Buffer.from(audioContent, 'base64');

        const audioPath = path.join(__dirname, 'public', 'speech.mp3');
        console.log('Audio Path:', audioPath);  // Debugging-Log

        try {
            await fs.promises.writeFile(audioPath, audioBuffer);
        } catch (err) {
            console.error('Error writing file:', err);
        }

        res.json({ description: analysisResult, audioUrl: '/speech.mp3' });
    } catch (error) {
        console.error('Error processing the image: ', error);
        res.status(500).send('Error processing the image');
    }
});

app.post('/speak', async (req, res) => {
    try {
        const text = req.body.text;

        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: text,
        });

        const buffer = Buffer.from(await mp3.arrayBuffer());
        const audioPath = path.join(__dirname, 'public', 'speech.mp3');
        console.log('Audio Path:', audioPath);  // Debugging-Log

        try {
            await fs.promises.writeFile(audioPath, buffer);
        } catch (err) {
            console.error('Error writing file:', err);
        }

        res.json({ audioUrl: '/speech.mp3' });
    } catch (error) {
        console.error('Error with TTS:', error);
        res.status(500).send('Error with TTS');
    }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
