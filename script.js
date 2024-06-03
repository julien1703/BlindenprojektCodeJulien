const video = document.getElementById('video');
const analyzeButton = document.getElementById('analyzeButton');
const descriptionLength = document.getElementById('descriptionLength');
const descriptionSpeed = document.getElementById('descriptionSpeed');

// Bild vom Server abrufen und anzeigen
function fetchImage() {
    video.src = '/images/current.jpg';
}

setInterval(fetchImage, 10000); // Alle 10 Sekunden das Bild aktualisieren

analyzeButton.addEventListener('click', () => {
    axios.get('/images/current.jpg', { responseType: 'blob' })
        .then(response => {
            const formData = new FormData();
            formData.append('frame', response.data, 'frame.jpg');
            formData.append('descriptionLength', descriptionLength.value);
            formData.append('descriptionSpeed', descriptionSpeed.value);

            return axios.post('/analyze', formData);
        })
        .then(response => {
            const analysisResult = response.data.description;
            console.log('Analyseergebnis: ', analysisResult);
            alert('Analyseergebnis: ' + analysisResult);
            speakText(analysisResult);
        })
        .catch(error => {
            console.error('Fehler bei der Analyse des Frames: ', error);
        });
});

function speakText(text) {
    axios.post('/speak', { text: text })
        .then(response => {
            const audio = new Audio(response.data.audioUrl);
            audio.play();
        })
        .catch(error => {
            console.error('Fehler bei der TTS-Wiedergabe: ', error);
        });
}
