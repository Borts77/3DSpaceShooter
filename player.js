// player.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scaledShipSize = new THREE.Vector3();

// *** Variables para el control visual del daño ***
let isVisualDamaged = false; // Flag para saber si la nave está mostrando daño visual
let damageDisplayDuration = 1.0; // Duración en segundos que la nave se queda roja (ajusta este valor)
let lastDamageTime = 0; // Tiempo en que se recibió el último golpe


/* ---------- carga del modelo GLB ---------- */
export async function loadPlayerShip () {
  const loader = new GLTFLoader();
  const gltf   = await loader.loadAsync('Spaceship.glb');
  const ship   = gltf.scene;

  const bbox = new THREE.Box3().setFromObject(ship);
  const center = bbox.getCenter(new THREE.Vector3());
  ship.position.sub(center);

  let size = bbox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const desiredSize = 5;
  const scale = desiredSize / maxDim;
  ship.scale.set(scale, scale, scale);

  bbox.setFromObject(ship);
  bbox.getSize(scaledShipSize);

  ship.rotation.order = 'YXZ';
  ship.rotation.y = -Math.PI / 2;

  ship.userData.hits = 0;

  /* --- Modify Materials for better appearance --- */
  ship.traverse(child => {
    if (child.isMesh) {
      const originalMaterial = child.material;
      const newMaterial = new THREE.MeshStandardMaterial({
          color: originalMaterial.color || new THREE.Color(0xaaaaaa),
          metalness: 0.9,
          roughness: 0.3,
          emissive: originalMaterial.emissive || new THREE.Color(0x333333),
          emissiveIntensity: 5.0,
          map: originalMaterial.map
      });

      if (originalMaterial.transparent !== undefined) newMaterial.transparent = originalMaterial.transparent;
      if (originalMaterial.opacity !== undefined) newMaterial.opacity = originalMaterial.opacity;
      if (originalMaterial.side !== undefined) newMaterial.side = originalMaterial.side;

      child.material = newMaterial;

      child.userData.baseEmissive = newMaterial.emissive.clone();
      child.userData.baseEmissiveIntensity = newMaterial.emissiveIntensity;
    }
  });

   // *** Asegurarse de que la nave empiece sin daño visual ***
   isVisualDamaged = false;
   lastDamageTime = 0;
   // Llama a revertDamageAppearance al cargar para asegurar el color base
   revertDamageAppearance(ship);


  return ship;
}

export function getScaledShipSize() {
    return scaledShipSize;
}


/* ---------- control de movimiento (Adaptado a nuestra lógica) ---------- */
export function updatePlayer (ship, delta, speedFactor, input) {
  const rotSpeed = 1.6 * speedFactor;

  if (input.pitchUp)   ship.rotation.x += rotSpeed * delta;
  if (input.pitchDown) ship.rotation.x -= rotSpeed * delta;
  if (input.yawLeft)   ship.rotation.y += rotSpeed * delta;
  if (input.yawRight)  ship.rotation.y -= rotSpeed * delta;
  if (input.rollLeft)  ship.rotation.z += rotSpeed * delta; // Añadido Roll
  if (input.rollRight) ship.rotation.z -= rotSpeed * delta; // Añadido Roll
}

/* ---------- daño visual + contador ---------- */
// Esta función se llama cuando la nave recibe un golpe
export function applyDamage (ship) {
  ship.userData.hits += 1;
  console.log("Nave golpeada. Hits:", ship.userData.hits); // Para depurar

  ship.traverse(child => {
    if (child.isMesh) {
      // Aplicar color rojo de daño
      child.material.emissive.setHex(0xff3300);
      // La intensidad puede seguir aumentando con cada golpe para un efecto más visible si quieres
       child.material.emissiveIntensity = child.userData.baseEmissiveIntensity + (0.5 * ship.userData.hits);
    }
  });

  // *** Activar el flag de daño visual y registrar el tiempo del golpe ***
  isVisualDamaged = true;
  // Necesitamos el tiempo actual, pero player.js no tiene acceso directo al reloj de main.js
  // Vamos a manejar la lógica de temporización en main.js.
  // applyDamage solo aplicará el efecto visual INMEDIATO.
}

// Esta función revierte el color al estado normal
export function revertDamageAppearance(ship) {
     ship.traverse(child => {
        if (child.isMesh && child.userData.baseEmissive) {
             // Revertir al color base y intensidad base
             child.material.emissive.copy(child.userData.baseEmissive);
             child.material.emissiveIntensity = child.userData.baseEmissiveIntensity;
        }
     });
     //ship.userData.hits = 0; // No resetear hits aquí, solo la apariencia
     console.log("Apariencia de daño revertida."); // Para depurar
}

export function isDestroyed (ship) {
  // Si quieres que se destruya después de un número específico de golpes
  const maxHits = 3; // Ajusta cuántos golpes aguanta la nave
  return ship.userData.hits >= maxHits;
}

// ... (código anterior en player.js)

// *** Nuevas funciones para controlar el estado visual del daño (Exportar) ***
export function setVisualDamage(time) {
    isVisualDamaged = true;
    lastDamageTime = time;
}

export function checkVisualDamage(currentTime) {
    if (isVisualDamaged && (currentTime - lastDamageTime >= damageDisplayDuration)) {
        isVisualDamaged = false; // Reset the flag when duration is over
        return true; // Indica que es hora de revertir la apariencia
    }
    return false; // Indica que no es hora de revertir
}

// ... (resto del código en player.js)