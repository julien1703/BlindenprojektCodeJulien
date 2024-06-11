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

const imageDir = path.join(__dirname, 'public', 'images');
const descriptionFile = path.join(__dirname, 'public', 'lastDescription.json');

if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
}

function compareDescriptions(newDesc, oldDesc) {
    if (!oldDesc) return newDesc;

    const changes = [];
    const newSentences = newDesc.split('. ');
    const oldSentences = oldDesc.split('. ');

    newSentences.forEach(sentence => {
        if (!oldSentences.includes(sentence)) {
            changes.push(sentence);
        }
    });

    return changes.join('. ');
}

function getImageHash(imageBuffer) {
    return createHash('sha256').update(imageBuffer).digest('hex');
}

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

app.post('/upload', upload.single('image'), (req, res) => {
    const imagePath = path.join(imageDir, 'current.jpg');
    fs.writeFileSync(imagePath, req.file.buffer);
    console.log('Image received and saved at: ', imagePath);
    res.send('Image received and saved');
});

app.post('/analyze', upload.single('frame'), async (req, res) => {
    try {
        const imageBuffer = req.file.buffer;
        const base64_image = imageBuffer.toString('base64');
        const newImageHash = getImageHash(imageBuffer);

        let lastImageHash = '';
        let lastDescription = '';

        if (fs.existsSync(descriptionFile)) {
            const lastDescriptionData = JSON.parse(fs.readFileSync(descriptionFile, 'utf-8'));
            lastImageHash = lastDescriptionData.imageHash;
            lastDescription = lastDescriptionData.description;
        }

        if (newImageHash === lastImageHash) {
            console.log('No significant changes detected');
            return res.json({ description: 'No significant changes detected' });
        }

        const gptResponse = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: `Describe the image in a way that helps visually impaired individuals imagine their surroundings in detail. Ensure to include as many details as possible to enhance their understanding of the environment. If no image is found, respond with '{"error": "no image found"}'.`
                },
                {
                    role: "user",
                    content: [
                        { "type": "text", "text": `Please describe the image to help a visually impaired person understand their surroundings better.` },
                        { "type": "image_url", "image_url": { "url": `data:image/jpeg;base64,${base64_image}` } }
                    ]
                }
            ],
        });

        const newDescription = gptResponse.choices[0].message.content;
        console.log('GPT Response: ', newDescription);

        const changes = compareDescriptions(newDescription, lastDescription);
        console.log('Changes: ', changes);

        if (changes) {
            const ttsResponse = await openai.audio.speech.create({
                model: "tts-1",
                voice: "alloy",
                input: changes,
            });

            console.log('TTS Response: ', ttsResponse);

            if (ttsResponse && ttsResponse.body) {
                const audioPath = path.join(__dirname, 'public', 'speech.mp3');
                console.log('Audio Path:', audioPath);

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

                    audioQueue.push(audioPath);
                    playAudioQueue();

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
