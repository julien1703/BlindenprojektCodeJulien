const video = document.getElementById('video');
const analyzeButton = document.getElementById('analyzeButton');
const descriptionLength = document.getElementById('descriptionLength');
const descriptionSpeed = document.getElementById('descriptionSpeed');
const ttsSpeed = document.getElementById('descriptionSpeed');

// Bild vom Server abrufen und anzeigen
function fetchImage() {
    const timestamp = new Date().getTime(); // Zeitstempel hinzufügen, um Caching zu vermeiden
    video.src = `/images/current.jpg?timestamp=${timestamp}`;
}

setInterval(fetchImage, 10000); // Alle 10 Sekunden das Bild aktualisieren

analyzeButton.addEventListener('click', () => {
    axios.get('/images/current.jpg', { responseType: 'blob' })
        .then(response => {
            const formData = new FormData();
            const file = new File([response.data], 'frame.jpg', { type: 'image/jpeg' });
            formData.append('frame', file);
            formData.append('descriptionLength', descriptionLength.value);
            formData.append('descriptionSpeed', descriptionSpeed.value);

            return axios.post('/analyze', formData);
        })
        .then(response => {
            const analysisResult = response.data.description;
            console.log('Analyseergebnis: ', analysisResult);
            alert('Analyseergebnis: ' + analysisResult);
            speakText(analysisResult, ttsSpeed.value);
        })
        .catch(error => {
            console.error('Fehler bei der Analyse des Frames: ', error);
        });
});

function speakText(text, speed) {
    const speechSynthesis = window.speechSynthesis;
    if (speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'de-DE'; // Sprache auf Deutsch setzen

        // Setze die Geschwindigkeit basierend auf der Auswahl
        switch (speed) {
            case 'very_fast':
                utterance.rate = 2; // sehr schnell
                break;
            case 'fast':
                utterance.rate = 1.5; // schnell
                break;
            case 'medium':
                utterance.rate = 1; // normal
                break;
            default:
                utterance.rate = 1; // falls etwas anderes gewählt wird, auf normal setzen
        }

        speechSynthesis.speak(utterance);
    } else {
        console.error('Text-to-Speech wird in diesem Browser nicht unterstützt.');
    }
}
