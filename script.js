const video = document.getElementById('video');
const analyzeButton = document.getElementById('analyzeButton');
const stopButton = document.getElementById('stopButton');

navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
    })
    .catch(error => {
        console.error('Error accessing the camera: ', error);
    });

analyzeButton.addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
        const formData = new FormData();
        formData.append('frame', blob, 'frame.png');

        axios.post('http://localhost:3001/analyze', formData)
            .then(response => {
                const description = response.data.description;
                const audioUrl = response.data.audioUrl;
                console.log('Analysis result: ', description);
                alert('Analysis result: ' + description);

                const audio = new Audio(audioUrl);
                audio.play();
            })
            .catch(error => {
                console.error('Error analyzing the frame: ', error);
            });
    }, 'image/png');
});

stopButton.addEventListener('click', () => {
    const stream = video.srcObject;
    const tracks = stream.getTracks();

    tracks.forEach(track => track.stop());
    video.srcObject = null;
});
