require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');


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

        const gptResponse = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: `Schreibe die Antwort bitte so, dass sie blinden Menschen helfen kann, sich die Umgebung besser vorzustellen. Achte dabei auf eine ${descriptionSpeed}-Erklärung mit ${descriptionLength} Details.`
                },
                {
                    role: "user",
                    content: `Erkläre dem Blinden, was auf dem Bild zu sehen ist, um ihm dabei zu helfen, sich die Umgebung in die er sich befindet, besser vorzustellen.`,
                    image: `data:image/jpeg;base64,${base64_image}`
                }
            ],
            max_tokens: max_tokens
        });

        const description = gptResponse.choices[0].message.content;
        console.log('GPT Response: ', description); // Print response to terminal
        res.json({ description: description });
    } catch (error) {
        console.error('Error processing the image: ', error);
        res.status(500).send('Error processing the image');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
