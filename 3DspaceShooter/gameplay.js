// gameplay.js
import * as THREE from 'three';

// Constantes (ajusta según sea necesario)
const BLACK_HOLE_RADIUS = 5;
const MIN_DISTANCE_FACTOR = 2.0; // Factor de seguridad antes de empujar
const MAX_DISTANCE = 300;
const MAX_ENV_SPEED_FACTOR = 15.0;
const MIN_PLAYER_SPEED_FACTOR = 0.1; // La nave se ralentizará mucho cerca

// Acepta playerShip en lugar de camera
export function updateGameplay(playerShip, blackHole) {
    if (!playerShip) return { playerSpeedFactor: 1, envSpeedFactor: 1 }; // Si no hay nave aún

    const distance = playerShip.position.distanceTo(blackHole.position);
    const effectiveMinDistance = BLACK_HOLE_RADIUS * MIN_DISTANCE_FACTOR;
    const clampedDistance = Math.max(effectiveMinDistance, Math.min(distance, MAX_DISTANCE));
    const normalizedDistance = (clampedDistance - effectiveMinDistance) / (MAX_DISTANCE - effectiveMinDistance);

    const envSpeedFactor = 1 + (MAX_ENV_SPEED_FACTOR - 1) * Math.pow(1 - normalizedDistance, 2);
    const playerSpeedFactor = MIN_PLAYER_SPEED_FACTOR + (1 - MIN_PLAYER_SPEED_FACTOR) * Math.pow(normalizedDistance, 0.5);

    // --- Lógica para empujar la NAVE si se acerca demasiado ---
    if (distance < effectiveMinDistance) {
        const direction = playerShip.position.clone().sub(blackHole.position).normalize();
        const pushBackAmount = (effectiveMinDistance - distance) * 1.05; // Empuja un poco
        playerShip.position.addScaledVector(direction, pushBackAmount);
    }

    return { playerSpeedFactor, envSpeedFactor };
}