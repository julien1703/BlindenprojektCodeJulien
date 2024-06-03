require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { OpenAIApi, Configuration } = require('openai');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
}));

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
                    content: {
                        type: "image",
                        image: {
                            base64: base64_image
                        }
                    }
                }
            ],
            max_tokens: max_tokens
        });

        const analysisResult = gptResponse.data.choices[0].message.content;
        console.log('GPT Response: ', analysisResult);
        res.json({ description: analysisResult });
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
        await fs.promises.writeFile(audioPath, buffer);

        res.json({ audioUrl: '/speech.mp3' });
    } catch (error) {
        console.error('Error with TTS: ', error);
        res.status(500).send('Error with TTS');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
