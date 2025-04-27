import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scaledShipSize = new THREE.Vector3();

// *** Variables para el control visual del daño ***
let isVisualDamaged = false;
let damageDisplayDuration = 1.0;
let lastDamageTime = 0;

/* ---------- carga del modelo GLB ---------- */
export async function loadPlayerShip() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('Spaceship.glb');
  const ship = gltf.scene;

  const bbox = new THREE.Box3().setFromObject(ship);
  const center = bbox.getCenter(new THREE.Vector3());
  ship.position.sub(center);

  const size = bbox.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const desiredSize = 5;
  const scale = desiredSize / maxDim;
  ship.scale.set(scale, scale, scale);

  bbox.setFromObject(ship);
  bbox.getSize(scaledShipSize);

  ship.rotation.order = 'YXZ';
  ship.rotation.y = -Math.PI / 2;

  ship.userData.hits = 0;

  // Reset visual damage
  isVisualDamaged = false;
  lastDamageTime = 0;
  revertDamageAppearance(ship);

  return ship;
}

export function getScaledShipSize() {
  return scaledShipSize;
}

/* ---------- control de movimiento (solo rotación) ---------- */
export function updatePlayer(ship, delta, speedFactor, input) {
  const rotSpeed = 1.6 * speedFactor;

  if (input.pitchUp)   ship.rotation.x += rotSpeed * delta;
  if (input.pitchDown) ship.rotation.x -= rotSpeed * delta;
  if (input.yawLeft)   ship.rotation.y += rotSpeed * delta;
  if (input.yawRight)  ship.rotation.y -= rotSpeed * delta;
  if (input.rollLeft)  ship.rotation.z += rotSpeed * delta;
  if (input.rollRight) ship.rotation.z -= rotSpeed * delta;
}

/* ---------- daño visual + temporización ---------- */
export function applyDamage(ship) {
  ship.userData.hits += 1;
  console.log('Nave golpeada. Hits:', ship.userData.hits);

  ship.traverse(child => {
    if (child.isMesh) {
      child.material.emissive.setHex(0xff3300);
      child.material.emissiveIntensity = child.userData.baseEmissiveIntensity + (0.5 * ship.userData.hits);
    }
  });

  isVisualDamaged = true;
  // lastDamageTime se establece desde main.js
}

export function revertDamageAppearance(ship) {
  ship.traverse(child => {
    if (child.isMesh && child.userData.baseEmissive) {
      child.material.emissive.copy(child.userData.baseEmissive);
      child.material.emissiveIntensity = child.userData.baseEmissiveIntensity;
    }
  });
  console.log('Apariencia de daño revertida.');
}

export function isDestroyed(ship) {
  const maxHits = 3;
  return ship.userData.hits >= maxHits;
}

export function setVisualDamage(time) {
  isVisualDamaged = true;
  lastDamageTime = time;
}

export function checkVisualDamage(currentTime) {
  if (isVisualDamaged && (currentTime - lastDamageTime >= damageDisplayDuration)) {
    isVisualDamaged = false;
    return true;
  }
  return false;
}
