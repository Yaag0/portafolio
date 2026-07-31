const musicToggle = document.getElementById('musicToggle');
const ambientAudio = document.getElementById('ambientAudio');

let isPlaying = false;

ambientAudio.volume = 0.5;

ambientAudio.play().then(() => {
    isPlaying = true;
    musicToggle.classList.add('playing');
}).catch(err => {
    console.log("Autoplay bloqueado por el navegador. Esperando interacción.");
});

musicToggle.addEventListener('click', () => {
    if (!isPlaying) {
        ambientAudio.play().then(() => {
            musicToggle.classList.add('playing');
            isPlaying = true;
        }).catch(err => {
            console.log("Interacción requerida por el navegador:", err);
        });
    } else {
        ambientAudio.pause();
        musicToggle.classList.remove('playing');
        isPlaying = false;
    }
});

document.addEventListener('click', () => {
    if (ambientAudio.muted) {
        ambientAudio.muted = false;
        ambientAudio.play().then(() => {
            isPlaying = true;
            musicToggle.classList.add('playing');
        });
    }
}, { once: true });