// audio.js
import * as THREE from 'three';

let listener;
let backgroundMusic1; // Declared
let backgroundMusic2; // Declared
let currentTrack = 1; // 1 o 2
let audioLoader;

const musicFiles = ['music.mp3', 'music2.mp3']; // Tus archivos de música

export function initAudio(camera) {
    listener = new THREE.AudioListener();
    camera.add(listener); // Asocia el listener a la cámara
    audioLoader = new THREE.AudioLoader();

    // **Instantiate Audio objects here so they are always defined**
    backgroundMusic1 = new THREE.Audio(listener);
    backgroundMusic2 = new THREE.Audio(listener);

    return listener;
}

export function loadAndPlayMusic() {
    if (!listener || !audioLoader || !backgroundMusic1 || !backgroundMusic2) {
        console.error("Audio not fully initialized.");
        return;
    }

    // Prevent trying to play if already playing
    if (backgroundMusic1.isPlaying || backgroundMusic2.isPlaying) {
        console.log("Music is already playing.");
        return;
    }

    // Function to load and play the next track
    const playNextTrack = () => {
        let trackToLoad = (currentTrack === 1) ? musicFiles[0] : musicFiles[1];
        let audioObject = (currentTrack === 1) ? backgroundMusic1 : backgroundMusic2;

        console.log(`Loading track ${currentTrack}: ${trackToLoad}`);
        audioLoader.load(trackToLoad, (buffer) => {
            console.log(`Track ${currentTrack} loaded. Playing.`);
            audioObject.setBuffer(buffer);
            audioObject.setLoop(false); // No queremos loop individual
            audioObject.setVolume(0.3); // Volumen moderado
            audioObject.play();

            // Cuando termine, preparar la siguiente pista
            audioObject.onEnded = () => {
                console.log(`Track ${currentTrack} ended.`);
                // audioObject.isPlaying = false; // No necesitas resetear manually, three.js does it

                 // Asegurarse de que no se solapen si la carga es muy rápida
                setTimeout(() => {
                    currentTrack = (currentTrack === 1) ? 2 : 1; // Cambiar de pista
                    playNextTrack(); // Llamar recursivamente para la siguiente
                }, 100); // Pequeña pausa

            };
        },
        (xhr) => {
            // console.log((xhr.loaded / xhr.total * 100) + '% loaded'); // Progreso (opcional)
        },
        (err) => {
            console.error('Error loading audio track:', err);
             // Intentar cargar la siguiente pista si falla una
             setTimeout(() => {
                    currentTrack = (currentTrack === 1) ? 2 : 1;
                    playNextTrack();
             }, 5000); // Reintentar tras 5 segundos
        });
    };

    // Empezar con la primera pista
    playNextTrack();
}

// You could add SFX functions here later
// export function playSound(soundName) { ... }