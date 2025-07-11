// main.js
import * as THREE from 'three';
import { createCamera, updateCameraControls, setCameraTarget } from './camera.js'; // Mantener createCamera para el menú
// Import fieldSize from world.js
import { createWorld, fieldSize } from './world.js';
import { updateGameplay } from './gameplay.js';

import {
    loadPlayerShip,
    updatePlayer,
    applyDamage,
    isDestroyed,
    getScaledShipSize,
    // *** Añadir las nuevas funciones de daño visual aquí ***
    setVisualDamage,
    checkVisualDamage,
    revertDamageAppearance // Import revertDamageAppearance here
  } from './player.js';

import {
  createAsteroidField,
  updateAsteroids
} from './asteroids.js';

import {
  updateBullets
} from './bullets.js';

import {
  createExplosion,
  updateExplosions
} from './explosions.js';

import { initAudio, loadAndPlayMusic } from './audio.js';

// *** Importar la función fireBullet de bullets.js (la creamos allí) ***
import { fireBullet } from './bullets.js';

// Import background music variables from audio.js if you need to stop them
// Make sure these are exported from audio.js
// import { backgroundMusic1, backgroundMusic2 } from './audio.js';


/* ---------- motor WebGL ---------- */
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

/* ---------- escena y cámara ---------- */
const clock = new THREE.Clock();
const { camera: menuCamera, controls: menuControls } = createCamera(canvas);
const gameCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, fieldSize * 2); // Adjust far plane based on fieldSize

const { scene, blackHole, stars, accretionDisk } = createWorld();
const audioListener = initAudio(menuCamera);

// *** Variables para los elementos del juego (Declaradas al principio) ***
let gameStarted = false;
let playerShip;
let asteroids;
let bullets = [];
let explosions = [];

/* ---------- input WASD + M + N + Espacio ---------- */
const input = {
  thrust: false,
  boost: false,
  shoot: false
};

const keyMap = {
  KeyW: 'thrust',
  ShiftLeft: 'boost',
  Space: 'shoot'
};


// *** Variables para el manejo del movimiento ***
let velocity = new THREE.Vector3();
const damping = 0.98;
let thrustSpeed = 300;
let boostSpeed = 1000;
let boostCooldown = 5;
let lastBoostTime = -boostCooldown;
let isBoostReady = true;

// *** Variables para el manejo de disparo continuo ***
let fireRate = 0.2;
let lastShotTime = 0;

// *** Variables para rastrear los IDs de los animation frames ***
let menuAnimationFrameId = null;
let gameAnimationFrameId = null;

// Define boundary limits based on fieldSize
const boundaryLimit = fieldSize / 2;


window.addEventListener('keydown', e => {
  if (keyMap[e.code] !== undefined) {
    const action = keyMap[e.code];
    if (action === 'thrust' || action === 'boost' || action === 'shoot') {
       input[action] = true;
    } else {
       input[action] = 1;
    }
  }
});
window.addEventListener('keyup', e => {
  if (keyMap[e.code] !== undefined) {
    const action = keyMap[e.code];
     if (action === 'thrust' || action === 'boost' || action === 'shoot') {
       input[action] = false;
    } else {
       input[action] = 0;
    }
  }
});
const mouse = new THREE.Vector2(0, 0);

window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

/* ---------- Menu and Game Over Interaction ---------- */
const mainMenu = document.getElementById('main-menu');
const playButton = document.getElementById('play-button');
const controlsButton = document.getElementById('controls-button');
const controlsDiv = document.getElementById('controls');
const gameOverMenu = document.getElementById('game-over-menu'); // Get the game over menu div
const tryAgainButton = document.getElementById('try-again-button'); // Get the try again button

playButton.addEventListener('click', startGame);
controlsButton.addEventListener('click', toggleControls);
tryAgainButton.addEventListener('click', restartGame); // Add event listener for the try again button


// *** Offset local de la cámara de juego ***
const gameCameraOffset = new THREE.Vector3(0, 2.5, -8); // Más cercana, más arriba

async function startGame() {
  // Use a flag to prevent multiple game starts if it's already running
  if (gameStarted) return;
  gameStarted = true;

  // Cancel the menu animation loop before starting the game loop
  if (menuAnimationFrameId) {
      cancelAnimationFrame(menuAnimationFrameId);
      menuAnimationFrameId = null;
  }

  // Ocultar menús y mostrar canvas
  mainMenu.classList.add('hidden');
  gameOverMenu.classList.add('hidden'); // Hide game over menu
  canvas.classList.remove('hidden');

  // Deshabilitar OrbitControls del menú
  menuControls.enabled = false;

  // Reanudar contexto de audio y reproducir música tras gesto de usuario
   if (audioListener.context.state === 'suspended') {
     await audioListener.context.resume();
   }
   // Stop existing music before loading/playing again on restart if needed
   // You would need to export backgroundMusic1 and backgroundMusic2 from audio.js
   // if (backgroundMusic1 && backgroundMusic1.isPlaying) backgroundMusic1.stop();
   // if (backgroundMusic2 && backgroundMusic2.isPlaying) backgroundMusic2.stop();
   loadAndPlayMusic(); // Call this if you want music to restart on game start


  /* Cleanup previous game state */
  // Remove previous player ship if it exists
  if (playerShip) {
    scene.remove(playerShip);
    playerShip = null; // Ensure playerShip is null before loading
  }
  // Remove previous asteroids
  if (asteroids) {
      asteroids.forEach(a => scene.remove(a));
  }
  asteroids = createAsteroidField(scene); // Initialize asteroids

  // Clear bullets and explosions
  bullets.forEach(b => scene.remove(b));
  bullets = [];
  explosions.forEach(e => scene.remove(e));
  explosions = [];

  /* Jugador */
  playerShip = await loadPlayerShip(); // Cargar modelo usando nuestra función
  scene.add(playerShip);
  // Puedes establecer una posición inicial para la nave si no quieres que empiece en (0,0,0)
  playerShip.position.set(0, 0, 300); // Ejemplo: empezar un poco más adelante
  // Reset player hits and visual damage
  playerShip.userData.hits = 0;
  revertDamageAppearance(playerShip); // Ensure ship starts without visual damage


   // Reset player velocity
  velocity = new THREE.Vector3();

  // Reset boost cooldown
  lastBoostTime = clock.getElapsedTime() - boostCooldown; // Make boost ready at start
  isBoostReady = true;
  const boostCooldownInfoDiv = document.getElementById('boost-cooldown-info');
   if(boostCooldownInfoDiv) {
      boostCooldownInfoDiv.textContent = 'Boost listo';
      boostCooldownInfoDiv.classList.add('ready');
   }

   // Reset last shot time
   lastShotTime = clock.getElapsedTime();


  /* ----------- bucle principal ----------- */
  // Ensure animate loop is running
  // Avoid starting multiple animation loops by checking for an existing frame ID
   if (!gameAnimationFrameId) {
       animate();
   }
}

function restartGame() {
    // This function is called when the "Try Again" button is clicked
    console.log("Restarting game...");
    // Any cleanup needed before restarting is now primarily handled within startGame
    startGame(); // Call startGame to re-initialize and start a new game
}


function animate() {
    // Store the animation frame ID
    gameAnimationFrameId = requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const currentTime = clock.getElapsedTime();

     // If the game has ended or not started, return early and let menuAnimate handle rendering
     if (!gameStarted) {
         // This block should ideally not be reached if menuAnimate is handling rendering,
         // but for safety, stop the game loop if somehow still running
         if (gameAnimationFrameId) {
              cancelAnimationFrame(gameAnimationFrameId);
              gameAnimationFrameId = null;
         }
        return; // Stop the game logic updates
     }


    /* 1 — Gameplay base (velocidad según agujero negro) */
    const { playerSpeedFactor, envSpeedFactor } = updateGameplay(playerShip, blackHole);


    // Only update player and their related elements if playerShip exists (which it should if gameStarted is true)
    if (playerShip) {

        // CONTROL DE MOUSE Y MOVIMIENTO FLUIDO
// CONTROL SUAVE DE NAVE ESTILO ARCADE
// ROTACIÓN TOTAL estilo Ace Combat
const pitchAmount = -mouse.y * Math.PI; // arriba/abajo
const yawAmount = -mouse.x * Math.PI;   // izquierda/derecha
const turnSpeed = 1.5; // velocidad de giro

const deltaPitch = pitchAmount * delta * turnSpeed;
const deltaYaw   = yawAmount * delta * turnSpeed;

// Rotaciones independientes en eje local
const pitchQuat = new THREE.Quaternion();
const yawQuat = new THREE.Quaternion();

// Pitch (eje X local)
pitchQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), deltaPitch);
// Yaw (eje Y local)
yawQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaYaw);

// Aplicamos yaw y luego pitch al quaternion actual de la nave
playerShip.quaternion.multiply(yawQuat);
playerShip.quaternion.multiply(pitchQuat);
playerShip.quaternion.normalize();




        // *** Lógica de Traslación con Velocidad y Damping ***
        const invertThrust = true;
        const forwardDirectionFactor = invertThrust ? 1 : -1;
        const thrustDirectionWorld = new THREE.Vector3(0, 0, forwardDirectionFactor).applyQuaternion(playerShip.quaternion).normalize();

        if (input.thrust) {
            velocity.addScaledVector(thrustDirectionWorld, thrustSpeed * delta * playerSpeedFactor);
        }

        if (input.boost && isBoostReady) {
            // input.boost = false; // Let keyup handle setting input.boost to false

            velocity.addScaledVector(thrustDirectionWorld, boostSpeed * playerSpeedFactor);

            isBoostReady = false;
            lastBoostTime = currentTime;
            const boostCooldownInfoDiv = document.getElementById('boost-cooldown-info');
            if(boostCooldownInfoDiv) {
                boostCooldownInfoDiv.textContent = `Recarga Boost: ${boostCooldown.toFixed(1)}s`;
                boostCooldownInfoDiv.classList.remove('ready');
            }
        }

        // Actualizar estado de recarga Boost
        if (!isBoostReady) {
            const remaining = boostCooldown - (currentTime - lastBoostTime);
            const boostCooldownInfoDiv = document.getElementById('boost-cooldown-info');
            if (remaining <= 0) {
                isBoostReady = true;
                 if(boostCooldownInfoDiv) {
                    boostCooldownInfoDiv.textContent = 'Boost listo';
                    boostCooldownInfoDiv.classList.add('ready');
                 }
            } else {
                 if(boostCooldownInfoDiv) {
                   boostCooldownInfoDiv.textContent = `Recarga Boost: ${remaining.toFixed(1)}s`;
                 }
            }
        }

        velocity.multiplyScalar(damping);
        playerShip.position.addScaledVector(velocity, delta);

        // *** Boundary Checking and Response ***
        if (playerShip.position.x > boundaryLimit) {
            playerShip.position.x = boundaryLimit;
            velocity.x *= -0.8; // Reverse and slightly dampen velocity
        } else if (playerShip.position.x < -boundaryLimit) {
            playerShip.position.x = -boundaryLimit;
            velocity.x *= -0.8;
        }

        if (playerShip.position.y > boundaryLimit) {
            playerShip.position.y = boundaryLimit;
            velocity.y *= -0.8;
        } else if (playerShip.position.y < -boundaryLimit) {
            playerShip.position.y = -boundaryLimit;
            velocity.y *= -0.8;
        }

        if (playerShip.position.z > boundaryLimit) {
            playerShip.position.z = boundaryLimit;
            velocity.z *= -0.8;
        } else if (playerShip.position.z < -boundaryLimit) {
            playerShip.position.z = -boundaryLimit;
            velocity.z *= -0.8;
        }


        /* 3 — Disparo continuo (Espacio) */
        const visualForwardDirection = new THREE.Vector3();
        playerShip.getWorldDirection(visualForwardDirection);

        if (input.shoot && (currentTime - lastShotTime >= fireRate)) {
            const bullet = fireBullet(playerShip.position, visualForwardDirection, velocity);
            scene.add(bullet);
            bullets.push(bullet);
            lastShotTime = currentTime;
        }


        /* 5 — Colisiones bala–asteroide */
        const bulletRadius = 1.1;
        for (let i = asteroids.length - 1; i >= 0; i--) {
          const a = asteroids[i];
          for (let j = bullets.length - 1; j >= 0; j--) {
            const b = bullets[j];
            if (a.position.distanceToSquared(b.position) < (a.userData.radius + bulletRadius) ** 2) {
              explosions.push(createExplosion(scene, a.position));
              scene.remove(a);
              asteroids.splice(i, 1);
              scene.remove(b);
              bullets.splice(j, 1);
              break;
            }
          }
        }


        /* 6 — Colisión asteroide–jugador */
        const playerRadius = 3;
         for (let i = asteroids.length - 1; i >= 0; i--) {
          const a = asteroids[i];
          if (playerShip && a.position.distanceToSquared(playerShip.position) < (a.userData.radius + playerRadius) ** 2) {
            applyDamage(playerShip);
            setVisualDamage(currentTime);
            explosions.push(createExplosion(scene, playerShip.position));
            const dir = playerShip.position.clone().sub(a.position).normalize();
            playerShip.position.addScaledVector(dir, 5);
            scene.remove(a);
            asteroids.splice(i, 1);
            // Don't break here, a single asteroid could potentially cause multiple hits in one frame if not handled carefully,
            // but for simplicity and to ensure the damaged appearance is applied, we can let the inner loop continue.
            // A more robust solution might involve checking for collision once per frame per asteroid.
          }
        }

        // Lógica para revertir la apariencia de daño después de un tiempo
        if (playerShip) { // Check if playerShip still exists after collision checks
            if (checkVisualDamage(currentTime)) {
                revertDamageAppearance(playerShip);
            }
        }

         /* 7 — ¿Game Over? */
        if (playerShip && isDestroyed(playerShip)) {
          explosions.push(createExplosion(scene, playerShip.position));
          scene.remove(playerShip);
          playerShip = null; // Set playerShip to null *before* calling showGameOverScreen
          console.log('GAME OVER');
          showGameOverScreen(); // Call the show game over screen function
          // The state will be set to gameStarted = false, and the return at the start of animate will stop game logic
        }


        /* 8 — Cámara y efectos de fondo */
        const desiredOffset = gameCameraOffset.clone().applyQuaternion(playerShip.quaternion);
const desiredCameraPosition = playerShip.position.clone().add(desiredOffset);
gameCamera.position.lerp(desiredCameraPosition, 0.1); // cámara suave
gameCamera.lookAt(playerShip.position);


        // Rotar fondo de puntos y disco de acreción (si aplica)
        stars.rotation.y += 0.01 * envSpeedFactor * delta;
        accretionDisk.rotation.z -= 0.1 * envSpeedFactor * delta;

    } // End of playerShip exists block

    // Update bullets and explosions regardless of playerShip existence
    updateBullets(bullets, delta);
    updateExplosions(explosions, delta);

    // Update asteroids ONLY in the game loop with the current envSpeedFactor
    // The asteroid rotation in the menu/game over will be handled by menuAnimate
    if (playerShip) { // Only update asteroids with envFactor when game is active
        updateAsteroids(asteroids, delta, envSpeedFactor);
    }


     // Render the scene with the game camera when the game is active
    renderer.render(scene, gameCamera);
  } // End of animate function


// Toggle visibility of the controls div
function toggleControls() {
    const controlsDiv = document.getElementById('controls'); // Asegurarse de obtener la referencia
    if(controlsDiv) {
        controlsDiv.classList.toggle('hidden');
    }
}


// Handles animation for the menu and game over screens
function menuAnimate() {
    // Store the animation frame ID
    menuAnimationFrameId = requestAnimationFrame(menuAnimate);

    // This function is called in a loop while gameStarted is false
    if (!gameStarted) {
        const delta = clock.getDelta();
        // Animar fondo más lento en el menú/game over screen
        stars.rotation.y += 0.005 * delta;
        accretionDisk.rotation.z -= 0.05 * delta;

        // Update explosions and asteroids even when in menu/game over
        updateExplosions(explosions, delta);
        // Update asteroids at a minimal speed when in menu/game over
        updateAsteroids(asteroids, delta, 0.1); // Use a small factor for background rotation

        renderer.render(scene, menuCamera); // Render with the menu camera
        menuControls.update(); // Update menu controls
    } else {
       // If the game has started, cancel this animation loop
       cancelAnimationFrame(menuAnimationFrameId);
       menuAnimationFrameId = null; // Clear the stored frame id
    }
}

function showGameOverScreen() {
    gameStarted = false; // Set gameStarted to false to stop the game loop

    // Cancel the game animation loop
    if (gameAnimationFrameId) {
        cancelAnimationFrame(gameAnimationFrameId);
        gameAnimationFrameId = null;
    }

    // Show the game over menu and hide the canvas
    gameOverMenu.classList.remove('hidden');
    canvas.classList.add('hidden');

    // Start the menu animation loop to render the game over screen background
    if (!menuAnimationFrameId) {
        menuAnimate();
    }

    // You might want to stop the music or play a game over sound here
    // If you want to stop music on game over, you'd need to export backgroundMusic1/2 from audio.js
}


// Start the menu animation loop initially to show the main menu
menuAnimate();
