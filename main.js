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
  updateAsteroids,
  handleAsteroidCollision // Import the new collision handling function
} from './asteroids.js';

import {
  updateBullets,
  fireBullet // Ensure fireBullet is imported
} from './bullets.js';

import {
  createExplosion,
  updateExplosions
} from './explosions.js';

import { initAudio, loadAndPlayMusic /* , playSound */ } from './audio.js'; // Importar función para sonidos si la creas

// *** NUEVAS IMPORTACIONES DE ENEMIES.JS ***
import {
    loadEnemyAssets,
    spawnWave,
    spawnBoss,
    updateEnemies,
    handleEnemyHit,
    revertEnemyHitVisuals // Importar la nueva función
} from './enemies.js';


/* ---------- motor WebGL ---------- */
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); // Usamos 'canvas: canvas' o solo { canvas, ... }
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));


/* ---------- escena y cámara ---------- */
const clock = new THREE.Clock();
// Declara variables globales para los elementos del juego aquí, sin asignar valor inicial si no es necesario
let scene, camera, menuCamera, menuControls; // renderer ya se declaró con const arriba
let audioListener; // Declarada aquí para inicializarse en initGame

// *** Variables para los elementos del juego ***
let playerShip = null; // Inicializar a null es una buena práctica
let asteroids = [];
let bullets = [];
let enemyBullets = []; // Separar balas de enemigos (o usar userData)
let explosions = [];
let blackHole;
let stars; // Para el fondo de estrellas
let accretionDisk; // Añadir declaración para accretionDisk
let gameStarted = false;
let gameAnimationFrameId = null;
let menuAnimationFrameId = null; // Para el loop del menú

// *** NUEVAS VARIABLES DE ESTADO ARCADE ***
let arcadeLevel = 1;
const STARTING_LEVEL = 1; // Nivel inicial
let currentWave = 'none'; // 'normal', 'boss', 'levelup', 'gameover', 'none'
let enemiesRemaining = 0;
let enemies = []; // Array para los enemigos activos
const MAX_LEVEL = 10; // O el nivel máximo que quieras

// *** OTRAS VARIABLES GLOBALES DE JUEGO (Input, Boost, Disparo) ***
let keys = {}; // Para el input <--- ESTA ES LA DECLARACIÓN


const input = { // Usamos 'input' como objeto para agrupar los estados
    pitchUp: false, pitchDown: false,
    yawLeft: false, yawRight: false,
    rollLeft: false, rollRight: false,
    thrust: false,
    boost: false,
    shoot: false
};

const keyMap = {
    KeyW: 'pitchDown', KeyS: 'pitchUp',
    KeyA: 'yawLeft', KeyD: 'yawRight',
    KeyQ: 'rollLeft', KeyE: 'rollRight',
    KeyM: 'thrust',
    KeyN: 'boost',
    Space: 'shoot'
};

// --- Manejo de Input (nuevo simple) --- ← Ahora sí
window.addEventListener('keydown', (event) => {
    const action = keyMap[event.code];
    if (action !== undefined) {
        if (action === 'thrust' || action === 'boost' || action === 'shoot') {
            input[action] = true;
        } else {
            input[action] = 1;
        }
    }
});

window.addEventListener('keyup', (event) => {
    const action = keyMap[event.code];
    if (action !== undefined) {
        if (action === 'thrust' || action === 'boost' || action === 'shoot') {
            input[action] = false;
        } else {
            input[action] = 0;
        }
    }
});

let velocity = new THREE.Vector3(); // Velocidad de traslación del jugador
const damping = 0.98; // Factor de amortiguación
let thrustSpeed = 300; // Velocidad de propulsión
let boostSpeed = 1000; // Velocidad del boost
let boostCooldownTime = 5; // Tiempo de recarga del boost en segundos (Renombrado para no confundir con variable de countdown)
let lastBoostTime = -boostCooldownTime; // Inicializado para que el boost esté listo al inicio
let isBoostReady = true;
let isBoosting = false; // <-- ¡ASEGÚRATE DE QUE ESTA LÍNEA NO ESTÉ COMENTADA!
const boostCooldownInfo = document.getElementById('boost-cooldown-info'); // Referencia al elemento UI

let fireRate = 0.2; // Cadencia de disparo en segundos
let lastShotTime = 0; // Tiempo del último disparo

// *** Offset local de la cámara de juego ***
const gameCameraOffset = new THREE.Vector3(0.0, 5.0, -14.5);

// Define boundary limits based on fieldSize (Asegúrate que fieldSize viene de world.js)
const boundaryLimit = fieldSize / 2;


/* ---------- Menu and Game Over Interaction ---------- */
// Obtener referencias a los elementos del menú
const mainMenu = document.getElementById('main-menu');
const playButton = document.getElementById('play-button');
const controlsButton = document.getElementById('controls-button');
const controlsDiv = document.getElementById('controls');
const gameOverMenu = document.getElementById('game-over-menu');
const tryAgainButton = document.getElementById('try-again-button');


// --- Inicialización (Carga de Assets, Setup Inicial) ---
async function initGame() {
    console.log("Initializing game...");

    // Crear el mundo (escena, agujero negro, estrellas, disco)
    const worldData = createWorld();
    scene = worldData.scene;
    blackHole = worldData.blackHole;
    stars = worldData.stars;
    accretionDisk = worldData.accretionDisk;

    // Configurar cámara del menú
    const menuCamData = createCamera(canvas);
    menuCamera = menuCamData.camera;
    menuControls = menuCamData.controls;
    menuCamera.position.set(0, 50, 120);
    menuControls.target.set(0, 0, 0);

    // Configurar cámara del juego (inicialmente separada de la nave)
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, fieldSize * 2);
    camera.position.set(0, 15, 100);

    // Inicializar audio y asociarlo a una cámara (inicialmente la del menú)
    audioListener = initAudio(menuCamera);

    // Carga asíncrona de assets (nave del jugador y enemigos)
    try {
        [playerShip] = await Promise.all([
            loadPlayerShip(), // Cargar nave del jugador
            loadEnemyAssets() // Cargar modelos y datos de enemigos
        ]);

        // *** Mover estas dos líneas AQUÍ, DESPUÉS DEL AWAIT ***
        setupUIListeners(); // <-- Ahora se llama DESPUÉS de que playerShip se asigna
        // setupInputListeners(); // <-- Y input listeners también

        if (playerShip) {
            console.log("Nave del jugador cargada.");
            // Inicializar hits en userData si no está
            if (playerShip.userData.hits === undefined) {
                playerShip.userData.hits = 0;
            }
            revertDamageAppearance(playerShip); // Asegurar que la nave empiece sin daño visual
            // No añadir a la escena todavía, se hará en startGame
        } else {
            console.error("¡Fallo al cargar la nave del jugador!");
            // Mostrar un mensaje de error al usuario
            const mainMenuElement = document.getElementById('main-menu');
            if(mainMenuElement) {
                mainMenuElement.innerHTML = `<h1>Error al cargar</h1><p>No se pudieron cargar los recursos del juego.</p><p style="font-size:0.8em; color:#aaa;">${error}</p>`;
                mainMenuElement.classList.remove('hidden'); // Asegurar que el menú (con el error) sea visible
            } else {
                console.error("Main menu element not found to display error.");
            }
            return; // Detener inicialización si falla
        }

        // Inicializar asteroides para el fondo del menú (menos cantidad)
        asteroids = createAsteroidField(scene, 20);

        // Iniciar loop de animación del menú
        menuAnimate();

    } catch (error) {
        console.error("Error durante la inicialización de assets:", error);
        // Mostrar un mensaje de error en la interfaz
        const mainMenuElement = document.getElementById('main-menu');
        if(mainMenuElement) {
            mainMenuElement.innerHTML = `<h1>Error al cargar</h1><p>No se pudieron cargar los recursos del juego.</p><p style="font-size:0.8em; color:#aaa;">${error}</p>`;
            mainMenuElement.classList.remove('hidden'); // Asegurar que el menú (con el error) sea visible
        } else {
            console.error("Main menu element not found to display error.");
        }
    }

    // Listener para redimensionar la ventana
    window.addEventListener('resize', onWindowResize, false);

    console.log("Game initialization complete.");
}
// --- Configuración de Listeners de UI ---
function setupUIListeners() {
    // Asegurarse de que los botones existen antes de añadir listeners
    if(playButton) playButton.addEventListener('click', startGame);
    if(controlsButton) controlsButton.addEventListener('click', toggleControls);
    if(tryAgainButton) tryAgainButton.addEventListener('click', restartGame);
}

// --- Lógica de Inicio de una Nueva Partida ---
function startGame() {
    console.log("Starting new game...");
    if(gameStarted) return; // Prevenir inicio múltiple
    gameStarted = true;

    // Ocultar menús y mostrar canvas
    if(mainMenu) mainMenu.classList.add('hidden');
    if(gameOverMenu) gameOverMenu.classList.add('hidden');
    const gameCanvas = document.getElementById('game-canvas');
    if (gameCanvas) gameCanvas.classList.remove('hidden');
    const boostInfo = document.getElementById('boost-cooldown-info');
    if (boostInfo) boostInfo.classList.remove('hidden'); // Mostrar UI de Boost

    // Deshabilitar OrbitControls del menú y asociar audio a la cámara del JUEGO
    if (menuControls) menuControls.enabled = false;
    if (audioListener && camera && menuCamera) { // Asegurarse de que todos existen
        // Quitar listener de la cámara del menú si estaba ahí
        if (menuCamera.children.includes(audioListener)) {
            menuCamera.remove(audioListener);
        }
        // Añadir listener a la cámara del juego
        if (!camera.children.includes(audioListener)) {
            camera.add(audioListener);
        }
    }


    /* Cleanup previous game state */
    // Limpiar enemigos, balas, explosiones existentes
    if (scene) { // Asegurarse de que la escena existe antes de remover
        enemies.forEach(e => scene.remove(e));
        bullets.forEach(b => scene.remove(b));
        enemyBullets.forEach(b => scene.remove(b));
        explosions.forEach(ex => scene.remove(ex));
        // También remover asteroides viejos antes de crear nuevos
        asteroids.forEach(a => scene.remove(a));
    }
    enemies = [];
    bullets = [];
    enemyBullets = [];
    explosions = [];

    // Crear nuevos asteroides para el juego (más cantidad)
    if (scene) { // Asegurarse de que la escena existe
        asteroids = createAsteroidField(scene, 50);
    } else {
        console.error("Scene not defined when trying to create asteroid field.");
        asteroids = []; // Inicializar array vacío para evitar errores
    }


    // Resetear jugador (posición, vida, etc.)
   if (playerShip && scene) {
    // Asegurarse que la nave esté en la escena (por si la habían removido)
    if (!scene.children.includes(playerShip)) {
        scene.add(playerShip);
    }
    playerShip.visible = true;
    playerShip.position.set(22, 10, 500);
    playerShip.rotation.set(0, -Math.PI / 2, 0);
    playerShip.rotation.order = 'YXZ';
    playerShip.userData.velocity = new THREE.Vector3(0, 0, 0);
    playerShip.userData.hits = 0;
    revertDamageAppearance(playerShip);
} else {
    console.error("Intento de iniciar juego sin nave de jugador o escena definida.");
    showGameOverScreen("Error al iniciar");
    return;
}

    // Resetear estado del Boost y Disparo
    // Usar clock.getElapsedTime() sólo si clock está definido, aunque en initGame debería estar
    const currentTime = clock ? clock.getElapsedTime() : 0;
    lastBoostTime = currentTime - boostCooldownTime; // Boost listo al inicio
    isBoostReady = true;
    if(boostCooldownInfo) {
        boostCooldownInfo.textContent = 'Boost listo';
        boostCooldownInfo.classList.add('ready');
    }
    lastShotTime = currentTime;
    // playerShip.userData.canShoot = true; // Si manejas cooldown de disparo en player.js


    // *** INICIAR ESTADO ARCADE ***
    // Leer nivel guardado o empezar desde el principio
     const savedLevel = localStorage.getItem('arcadeLevel');
     arcadeLevel = savedLevel ? parseInt(savedLevel, 10) : STARTING_LEVEL;
     if (arcadeLevel > MAX_LEVEL) arcadeLevel = STARTING_LEVEL; // Reiniciar si superó el máximo (o manejar victoria)
     console.log(`Starting at Level: ${arcadeLevel}`);

    currentWave = 'starting_wave'; // Estado inicial para generar la primera oleada
    enemiesRemaining = 0; // Se establecerá al generar la oleada

    // Cargar y reproducir música si no está sonando o cambiar de pista
    loadAndPlayMusic(); // Implementa lógica dentro de loadAndPlayMusic para manejar cambios/reinicios

    // Detener animación del menú si está corriendo
    if (menuAnimationFrameId) {
        cancelAnimationFrame(menuAnimationFrameId);
        menuAnimationFrameId = null;
    }

    // Iniciar loop de animación del juego
    if (!gameAnimationFrameId) {
        animate();
    }
    console.log("Game started.");
}

// --- Reiniciar Partida (desde Game Over) ---
function restartGame() {
    console.log("Restarting game...");
    // La mayor parte del cleanup y setup se maneja dentro de startGame ahora
    // Solo nos aseguramos de que la bandera gameStarted esté correcta
    gameStarted = false; // Asegurar que startGame pueda ejecutarse
    // El cleanup de la escena se hace en startGame
    startGame(); // Llamar a startGame para re-inicializar y comenzar
}


// --- Bucle Principal del Juego ---
function animate() {
    if (!gameStarted) {
        // Si el juego se detuvo (ej. Game Over), no continuar el bucle de juego
        gameAnimationFrameId = null; // Limpiar el ID
        return;
    }

    // Solicitar el próximo frame
    gameAnimationFrameId = requestAnimationFrame(animate);

    // Asegurarse de que clock está definido antes de usarlo
    const delta = clock ? clock.getDelta() : 0;
    const currentTime = clock ? clock.getElapsedTime() : performance.now(); // Usar performance.now como fallback


    // --- Actualización de Gameplay (Velocidad basada en Agujero Negro) ---
    let playerSpeedFactor = 1;
    let envSpeedFactor = 1;
    if (playerShip && blackHole) { // Asegurarse de que existen
        const gameplayFactors = updateGameplay(playerShip, blackHole);
        playerSpeedFactor = gameplayFactors.playerSpeedFactor;
        envSpeedFactor = gameplayFactors.envSpeedFactor;
    }


    // --- Lógica del Estado Arcade ---
    if (currentWave === 'starting_wave') {
        console.log(`Generating Wave for Level ${arcadeLevel}`);
        if (scene && enemies) { // Asegurarse de que existen
            enemiesRemaining = spawnWave(scene, arcadeLevel, enemies); // Esta función debe devolver el número de enemigos
            currentWave = 'normal'; // Cambiar estado a oleada normal activa
            console.log(`Wave Started. Enemies: ${enemiesRemaining}`);
            // playSound('wave_start'); // Sonido de inicio de oleada si lo implementas
        } else {
            console.error("Scene or enemies array not defined when trying to spawn wave.");
            currentWave = 'none'; // Evitar loop infinito de starting_wave si hay error
        }

    } else if (currentWave === 'normal' && enemiesRemaining <= 0) {
        // Oleada normal completada, iniciar oleada de jefe
        currentWave = 'spawning_boss'; // Estado transitorio
        console.log(`Normal wave cleared. Spawning Boss for Level ${arcadeLevel}`);
        if (scene && enemies) { // Asegurarse de que existen
            enemiesRemaining = spawnBoss(scene, arcadeLevel, enemies); // Esta función debe devolver el número de enemigos
            console.log(`Boss Spawning. Total Enemies (Boss + Escorts): ${enemiesRemaining}`);
            // playSound('boss_spawn');
            currentWave = 'boss'; // Cambiar estado a oleada de jefe activa
        } else {
            console.error("Scene or enemies array not defined when trying to spawn boss.");
            currentWave = 'none';
        }

    } else if (currentWave === 'boss' && enemiesRemaining <= 0) {
        // Jefe derrotado, subir de nivel
        currentWave = 'level_up_transition'; // Estado transitorio
        // playSound('level_up');
        console.log(`Level ${arcadeLevel} Cleared!`);

        // Lógica de subida de nivel
        arcadeLevel++;
        localStorage.setItem('arcadeLevel', arcadeLevel.toString()); // Guardar progreso como string

        // Pequeña pausa antes de la siguiente oleada o victoria
        setTimeout(() => {
            if (arcadeLevel > MAX_LEVEL) {
                console.log("¡Has ganado el modo Arcade!");
                // Mostrar pantalla de victoria o volver al menú
                showGameOverScreen("¡VICTORIA!", true); // Añadir un flag de victoria
            } else {
                currentWave = 'starting_wave'; // Preparar para la siguiente oleada normal
                console.log(`Proceeding to Level ${arcadeLevel}`);
            }
        }, 4000); // Pausa de 4 segundos entre niveles

    }


   // --- Actualizaciones de Entidades (usando delta y factores de velocidad) ---
if (playerShip && playerShip.visible) {
    // --- Mover y Rotar la nave ---
updatePlayer(playerShip, delta, playerSpeedFactor, input);

// --- Aplicar traslación ---
const invertThrust = true;
const forwardDirectionFactor = invertThrust ? 1 : -1;
const thrustDirectionWorld = new THREE.Vector3(0, 0, forwardDirectionFactor)
    .applyQuaternion(playerShip.quaternion)
    .normalize();

if (input.thrust) {
    velocity.addScaledVector(thrustDirectionWorld, thrustSpeed * delta * playerSpeedFactor);
}

if (input.boost && isBoostReady) {
    velocity.addScaledVector(thrustDirectionWorld, boostSpeed * playerSpeedFactor);
    isBoostReady = false;
    lastBoostTime = currentTime;
}

velocity.multiplyScalar(damping);
playerShip.position.addScaledVector(velocity, delta);

// --- Disparo continuo ---
if (input.shoot && (currentTime - lastShotTime >= fireRate) && scene && bullets && playerShip) {
    const shipDirection = new THREE.Vector3();
    playerShip.getWorldDirection(shipDirection);
    const bullet = fireBullet(playerShip.position, shipDirection, velocity);
    if (bullet) {
        bullet.userData.isPlayerBullet = true;
        scene.add(bullet);
        bullets.push(bullet);
        lastShotTime = currentTime;
    }
}

// --- Actualizar Cámara ---
updateFollowCamera(camera, playerShip);

// --- Listener de Audio (para que el sonido siga la cámara) ---
if (audioListener && camera) {
    audioListener.position.copy(camera.position);
}

// --- Verificar daño visual ---
if (checkVisualDamage(currentTime)) {
    revertDamageAppearance(playerShip);
}

} // <-- AQUÍ termina el if (playerShip && playerShip.visible)

    // Update bullets and explosions regardless of playerShip existence
    updateBullets(bullets.concat(enemyBullets), delta); // Actualizar TODAS las balas
    updateExplosions(explosions, delta);

        // Actualizar enemigos (movimiento, disparo, etc.)
    updateEnemies(enemies, playerShip, delta, envSpeedFactor, enemyBullets, scene, explosions, currentTime);

    // Revertir efecto visual de daño en enemigos
    revertEnemyHitVisuals(enemies, currentTime);

    // Actualizar asteroides
    updateAsteroids(asteroids, delta, envSpeedFactor);

    // --- Detección de Colisiones ---
    checkCollisions(playerShip, asteroids, bullets, enemyBullets, enemies, scene, explosions);

    // --- Renderizar la escena ---
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    } else {
        console.error("Renderer, Scene, or Camera not defined for rendering.");
    }
}


// --- Detección de Colisiones (Función que recibe arrays) ---
// Recibe todos los elementos que pueden colisionar
function checkCollisions(playerShip, asteroids, playerBullets, enemyBullets, enemies, scene, explosions) {
    if (!playerShip || !playerShip.visible) return; // No hacer nada si el jugador no está activo

    // Re-crear Bounding Box del jugador aquí si updatePlayer no la actualiza
    const playerBoundingBox = new THREE.Box3().setFromObject(playerShip); // Puede ser costoso, considerar optimizar si es un cuello de botella

    // 1. Balas del Jugador vs Enemigos
    // Iterar al revés para eliminar de forma segura
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const bullet = playerBullets[i];
        // Asumiendo que marcas las balas del jugador con una propiedad userData { isPlayerBullet: true }
        // if (!bullet.userData || !bullet.userData.isPlayerBullet) continue; // Ya filtraremos por el array

        if (!bullet || !bullet.parent) { // Verificar que la bala todavía existe y está en la escena
            playerBullets.splice(i, 1); // Si no existe, removerla del array
            continue;
        }

        const bulletBoundingBox = new THREE.Box3().setFromObject(bullet);

        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            // Asegurarse de que el enemigo tiene bounding box precalculada y está visible/activo
            if (!enemy || !enemy.parent || !enemy.userData || !enemy.userData.boundingBox) continue;
            const enemyBoundingBox = enemy.userData.boundingBox.clone().applyMatrix4(enemy.matrixWorld);


            if (bulletBoundingBox.intersectsBox(enemyBoundingBox)) {
                console.log("Player bullet hit enemy!");
                // Crear explosión pequeña en el punto de impacto
                explosions.push(createExplosion(scene, bullet.position.clone())); // Añadir a la lista global
                // playSound('hit'); // Sonido de impacto

                // Aplicar daño y manejar destrucción del enemigo
                // handleEnemyHit debe manejar la remoción del enemigo de la escena y el array 'enemies'
                const enemyDestroyed = handleEnemyHit(enemy, 25, enemies, scene, explosions); // Asumir 25 de daño por bala

                if (enemyDestroyed) {
                    // enemiesRemaining--; // Esto debe actualizarse en handleEnemyHit si se destruye un enemigo que cuenta para la oleada
                    console.log(`Enemy destroyed. Remaining: ${enemiesRemaining}`);
                    // ¿Soltar power-up? (Lógica futura aquí)
                }

                // Eliminar la bala del array de balas del jugador y de la escena
                scene.remove(bullet);
                playerBullets.splice(i, 1); // Eliminar de playerBullets
                break; // Salir del loop de enemigos, la bala ya impactó
            }
        }
    }

    // 2. Balas Enemigas vs Jugador
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        // Asumiendo que marcas las balas enemigas { isEnemyBullet: true }
        // if (!bullet.userData || !bullet.userData.isEnemyBullet) continue; // Ya filtraremos por el array

        if (!bullet || !bullet.parent) { // Verificar que la bala todavía existe y está en la escena
            enemyBullets.splice(i, 1); // Si no existe, removerla del array
            continue;
        }


        const bulletBoundingBox = new THREE.Box3().setFromObject(bullet);

        if (playerBoundingBox.intersectsBox(bulletBoundingBox)) {
            console.log("Player hit by enemy bullet!");
            explosions.push(createExplosion(scene, bullet.position.clone())); // Añadir a la lista global
            scene.remove(bullet);
            enemyBullets.splice(i, 1); // Eliminar de enemyBullets
            // playSound('player_hit');

            // Aplicar daño al jugador
            applyDamage(playerShip, 1); // Daño = 1 golpe
            // isVisualDamaged = true; // Establecer flag en main.js o player.js
            setVisualDamage(clock.getElapsedTime()); // Activar efecto visual de daño usando el tiempo actual

            if (isDestroyed(playerShip)) {
                handlePlayerDeath(); // Manejar muerte del jugador
                // No need to break here, the death handler will stop the game loop
            }
        }
    }


    // 3. Jugador vs Asteroides
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const asteroid = asteroids[i];
        if (!asteroid || !asteroid.parent) { // Verificar que el asteroide todavía existe y está en la escena
            asteroids.splice(i, 1); // Si no existe, removerlo del array
            continue;
        }

        // Usar la bounding box del asteroide (asegurarse de que existe o usar una esfera de colisión aproximada)
        const asteroidBoundingBox = new THREE.Box3().setFromObject(asteroid); // O usar radio: asteroid.userData.radius

        // Una simple comprobación de distancia al centro puede ser suficiente y más rápida si el asteroide es esférico
        // const distance = playerShip.position.distanceTo(asteroid.position); // Necesitarías pasar la cámara aquí
        // const collisionDistance = getScaledShipSize().length() / 2 + asteroid.userData.radius; // Suma de radios aproximada
        // if (distance < collisionDistance) { ... colisión ... }

        if (playerBoundingBox.intersectsBox(asteroidBoundingBox)) {
            console.log("Player hit asteroid!");
            explosions.push(createExplosion(scene, asteroid.position.clone())); // Añadir a la lista global
            // playSound('collision'); // Sonido de colisión

            // Manejar colisión del asteroide (destruir, romper) - Pasar null como bala porque no fue una bala
            handleAsteroidCollision(scene, asteroids, asteroid, playerBullets, explosions, null); // Pasar playerBullets o solo [] si handleAsteroidCollision necesita un array de balas


            // Aplicar daño al jugador
            applyDamage(playerShip, 1);
            setVisualDamage(clock.getElapsedTime());

            if (isDestroyed(playerShip)) {
                handlePlayerDeath();
                // No need to break here
            }
        }
    }

    // 4. Jugador vs Enemigos (Colisión física)
    //  for (let i = enemies.length - 1; i >= 0; i--) {
     //    const enemy = enemies[i];
        // Asegurarse de que el enemigo tiene bounding box precalculada y está visible/activo
    //     if (!enemy || !enemy.parent || !enemy.userData || !enemy.userData.boundingBox) continue;
     //    const enemyBoundingBox = enemy.userData.boundingBox.clone().applyMatrix4(enemy.matrixWorld);


     //    if (playerBoundingBox.intersectsBox(enemyBoundingBox)) {
     //        console.log("Player collided with enemy!");
          //   explosions.push(createExplosion(scene, playerShip.position.clone())); // Añadir a la lista global
      //       explosions.push(createExplosion(scene, enemy.position.clone())); // Explosión también para el enemigo
            // playSound('collision_heavy'); // Sonido de colisión fuerte

            // Aplicar daño significativo a ambos
       //      applyDamage(playerShip, 2); // Más daño al jugador
      //       setVisualDamage(clock.getElapsedTime());
            // handleEnemyHit debe manejar la remoción del enemigo
       //      const enemyDestroyed = handleEnemyHit(enemy, 100, enemies, scene, explosions); // Mucho daño al enemigo

      //       if (enemyDestroyed) {
      //           // enemiesRemaining--; // Esto debe actualizarse en handleEnemyHit
          //       console.log(`Enemy destroyed on collision. Remaining: ${enemiesRemaining}`);
      //       }


          //   if (isDestroyed(playerShip)) {
          //       handlePlayerDeath();
                // No need to break here
       //      }
            // Si el enemigo no fue destruido, podrías añadir lógica de rebote o impulso
            // if (!enemyDestroyed && playerShip.userData.velocity && enemy.userData.velocity) { ... }
       //  }
   //  }

     // 5. Balas vs Asteroides (Si quieres que las balas destruyan asteroides)
      // Esta lógica está en una función separada ahora para mayor claridad
     // checkBulletAsteroidCollisions(bullets.concat(enemyBullets), asteroids, scene, bullets, enemyBullets, explosions); // Ya se llama desde animate
}

// --- Función separada para Colisiones de Balas vs Asteroides ---
// Recibe todos los elementos necesarios para manejar la colisión
function checkBulletAsteroidCollisions(allBullets, asteroids, scene, playerBulletsArray, enemyBulletsArray, explosions) {
    // Iterar al revés para eliminar balas de forma segura
    for (let i = allBullets.length - 1; i >= 0; i--) {
        const bullet = allBullets[i];

        if (!bullet || !bullet.parent) { // Verificar que la bala existe y todavía está en la escena
            // Si la bala ya no está en la escena, removerla del array correspondiente si es necesario
            // Esto es un poco complejo si allBullets es una concatenación. Es mejor manejar la remoción
            // del array dentro de handleAsteroidCollision.
            continue; // Saltar esta bala si no es válida
        }

        const bulletBoundingBox = new THREE.Box3().setFromObject(bullet);

        // Iterar al revés para eliminar asteroides de forma segura
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const asteroid = asteroids[j];

            if (!asteroid || !asteroid.parent) { // Verificar que el asteroide existe y todavía está en la escena
                // Si el asteroide ya no está en la escena (ej: destruido por otra cosa), removerlo del array
                asteroids.splice(j, 1);
                continue;
            }

            const asteroidBoundingBox = new THREE.Box3().setFromObject(asteroid); // O usar radio

            if (bulletBoundingBox.intersectsBox(asteroidBoundingBox)) {
                console.log("Bullet hit asteroid!");
                // Determinar a qué array pertenece la bala para eliminarla correctamente
                const sourceBulletArray = bullet.userData.isPlayerBullet ? playerBulletsArray : enemyBulletsArray;

                // Manejar colisión del asteroide (destruir, romper) - handleAsteroidCollision debe encargarse de remover el asteroide y la bala
                handleAsteroidCollision(scene, asteroids, asteroid, sourceBulletArray, explosions, bullet);

                // Si handleAsteroidCollision removió la bala, need to adjust loop index or break
                // bullet is removed inside handleAsteroidCollision, so we break inner loop
                break; // Salir del loop de asteroides para esta bala
            }
        }
    }
}


// --- Manejo Muerte del Jugador ---
function handlePlayerDeath() {
    console.log("Player Destroyed!");
    gameStarted = false;

    if (playerShip && scene) {
        explosions.push(createExplosion(scene, playerShip.position.clone()));
        scene.remove(playerShip); // Solo lo sacamos de la escena, NO lo anulamos
    } else {
        console.error("PlayerShip or Scene not defined when handling player death.");
    }

    showGameOverScreen("GAME OVER");
}


// --- Mostrar Pantalla Game Over / Victoria ---
function showGameOverScreen(message = "GAME OVER", isVictory = false) {
    console.log("Showing Game Over screen with message:", message);
    // gameStarted = false; // Ya se hizo en handlePlayerDeath

    // Cancelar el frame de animación del JUEGO
    if (gameAnimationFrameId) {
        cancelAnimationFrame(gameAnimationFrameId);
        gameAnimationFrameId = null;
    }

    // Configurar y mostrar el menú apropiado
    const gameOverTitle = gameOverMenu ? gameOverMenu.querySelector('h1') : null;
    if (gameOverTitle) gameOverTitle.textContent = message;
    if (tryAgainButton) tryAgainButton.textContent = isVictory ? "Volver al Menú" : "Intentar de Nuevo";

    if (gameOverMenu) gameOverMenu.classList.remove('hidden');
    const gameCanvas = document.getElementById('game-canvas');
    if (gameCanvas) gameCanvas.classList.add('hidden');
    const boostInfo = document.getElementById('boost-cooldown-info');
    if (boostInfo) boostInfo.classList.add('hidden'); // Ocultar UI de Boost


    // Si es victoria, podrías querer resetear el nivel guardado o no
     if (isVictory) {
         localStorage.setItem('arcadeLevel', STARTING_LEVEL.toString()); // Reiniciar al nivel 1 tras victoria
         arcadeLevel = STARTING_LEVEL; // Resetear también la variable interna
     } else {
         // Opcional: podrías guardar el nivel en el que falló si quieres
         // localStorage.setItem('lastFailedLevel', arcadeLevel.toString());
     }


    // Reiniciar la animación del MENÚ para el fondo
    if (!menuAnimationFrameId) {
        menuAnimate(); // Usar el loop del menú para el fondo de Game Over
    }
    console.log("Game Over screen displayed.");
}


// --- Función Cámara de Seguimiento ---
function updateFollowCamera(camera, target) {
    if (!camera || !target) return;

    const offset = new THREE.Vector3(0, 12, -45); // Arriba y atrás
    const desiredPosition = target.localToWorld(offset.clone());

    const minDistance = 30; // 🚀 <- Distancia mínima SEGURA

    // Calculamos la distancia real
    const currentDistance = camera.position.distanceTo(target.position);

    if (currentDistance < minDistance) {
        // Si está demasiado cerca, ponemos la cámara directamente donde queremos
        camera.position.copy(desiredPosition);
    } else {
        // Si todo bien, suavizamos el movimiento normal
        camera.position.lerp(desiredPosition, 0.08);
    }

    const lookAtOffset = new THREE.Vector3(0, 3, 50); // Punto hacia donde mira
    const lookAtPoint = target.localToWorld(lookAtOffset.clone());

    camera.lookAt(lookAtPoint);
}

// --- Actualizar UI del Boost (basado en tiempo transcurrido) ---
function updateBoostUI(delta) {
    // Esta función se llama en el loop animate
    if (!isBoostReady) {
        // Usar clock.getElapsedTime() sólo si clock está definido
        const currentTime = clock ? clock.getElapsedTime() : performance.now();
        const elapsed = currentTime - lastBoostTime;
        const remaining = boostCooldownTime - elapsed;

        if (remaining <= 0) {
            isBoostReady = true;
            if(boostCooldownInfo) {
                boostCooldownInfo.textContent = 'Boost Listo';
                boostCooldownInfo.classList.add('ready'); // Clase CSS para ocultar/styling
            }
        } else {
            if(boostCooldownInfo) {
                boostCooldownInfo.textContent = `Boost en: ${remaining.toFixed(1)}s`;
                boostCooldownInfo.classList.remove('ready');
            }
        }
    } else {
        // Asegurarse de que el texto sea "Boost Listo" si ya está ready
        if(boostCooldownInfo && boostCooldownInfo.textContent !== 'Boost Listo') {
            boostCooldownInfo.textContent = 'Boost Listo';
            boostCooldownInfo.classList.add('ready');
        }
    }
    // Asegurarse de que la info de boost se oculte si el juego no ha empezado
     if (!gameStarted && boostCooldownInfo && !boostCooldownInfo.classList.contains('hidden')) {
        boostCooldownInfo.classList.add('hidden');
     }
}


// --- Alternar visibilidad de Controles ---
function toggleControls() {
    // Asegurarse de que controlsDiv existe
    if(controlsDiv) {
        controlsDiv.classList.toggle('hidden');
    }
}


// --- Redimensionar Ventana ---
function onWindowResize() {
    const currentCamera = gameStarted ? camera : menuCamera; // Usar la cámara activa (juego o menú)
    if (currentCamera) {
        currentCamera.aspect = window.innerWidth / window.innerHeight;
        currentCamera.updateProjectionMatrix();
    }
    if (renderer) { // Asegurarse de que renderer existe
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
}


// --- Loop de Animación del Menú (y Game Over) ---
function menuAnimate() {
    if (gameStarted) {
        // Si el juego ha comenzado, detener este loop del menú
        menuAnimationFrameId = null;
        return;
    }

    menuAnimationFrameId = requestAnimationFrame(menuAnimate);
    // Asegurarse de que clock está definido
    const delta = clock ? clock.getDelta() : 0;

    // Rotar agujero negro y asteroides en el fondo del menú/game over
    if (blackHole) { // Asegurarse de que existen
        blackHole.rotation.y += 0.05 * delta; // Rotación más lenta para el menú
        if (accretionDisk) { // Asegurarse de que existe
            accretionDisk.rotation.z -= 0.02 * delta;
        }
    }
    if (stars) stars.rotation.y += 0.01 * delta; // Rotación de estrellas

    // Actualizar explosiones y asteroides (si hubiera remanentes)
    updateExplosions(explosions, delta);
    updateAsteroids(asteroids, delta, 0.1); // Mover asteroides lentamente

    // Actualizar controles de la cámara del menú (OrbitControls)
    if(menuControls) menuControls.update();

    // Renderizar con la cámara del menú
    if(renderer && scene && menuCamera) { // Asegurarse de que existen
        renderer.render(scene, menuCamera);
    } else {
        console.error("Renderer, Scene, or MenuCamera not defined for menu rendering.");
    }
}


// --- Iniciar todo el proceso al cargar la página ---
initGame();
