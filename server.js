require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { OpenAIApi, Configuration } = require('openai');
const fs = require('fs');
const path = require('path');

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

app.post('/analyze', upload.single('frame'), async (req, res) => {
    try {
        const imageBuffer = req.file.buffer.toString('base64');
        const imageUrl = `data:image/jpeg;base64,${imageBuffer}`;

        const gptResponse = await openai.createChatCompletion({
            model: "gpt-4-turbo",
            messages: [
                {
                    role: "user",
                    content: `Describe the following image: ${imageUrl}`,
                },
            ],
            max_tokens: 150,
        });

        const description = gptResponse.data.choices[0].message.content;

        // Text-to-Speech request
        const ttsResponse = await openai.createChatCompletion({
            model: "gpt-4-turbo",
            messages: [
                {
                    role: "user",
                    content: `Convert the following text to speech: ${description}`,
                },
            ],
            max_tokens: 150,
        });

        const audioContent = ttsResponse.data.choices[0].message.content;
        const audioBuffer = Buffer.from(audioContent, 'base64');

        const audioPath = path.join(__dirname, 'output.mp3');
        fs.writeFileSync(audioPath, audioBuffer);

        res.json({ description, audioUrl: `http://localhost:3000/output.mp3` });
    } catch (error) {
        console.error('Error processing the image: ', error);
        res.status(500).send('Error processing the image');
    }
});

app.use('/output.mp3', express.static(path.join(__dirname, 'output.mp3')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
