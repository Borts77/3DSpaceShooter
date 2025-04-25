// camera.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createCamera(canvas) {
    const camera = new THREE.PerspectiveCamera(
        75, window.innerWidth / window.innerHeight, 0.1, 2000 // Aumentado el far plane por las estrellas
    );
    camera.position.set(0, 30, 60); // Posición inicial para ver bien el menú

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.maxDistance = 500;
    // controls.minDistance = 10; // Quitamos min distance por ahora

    // Importante: Inicialmente apunta al centro (0,0,0) donde está el agujero negro
    controls.target.set(0, 0, 0);

    return { camera, controls };
}

export function updateCameraControls(controls, delta) {
    controls.update(delta); // Necesario para el damping
}

// Nueva función para cambiar el objetivo de los controles
export function setCameraTarget(controls, targetPosition) {
    controls.target.copy(targetPosition);
}

// Podrías añadir aquí una función para una cámara de seguimiento más adelante
// export function updateFollowCamera(camera, playerShip) { ... }