// main.js
// ... (otras importaciones)
import { createWorld, fieldSize } from './world.js'; // Asegúrate que fieldSize está exportado
import { updateGameplay } from './gameplay.js';
import { loadPlayerShip, updatePlayer, applyDamage, isDestroyed, getScaledShipSize, setVisualDamage, checkVisualDamage, revertDamageAppearance, playerShip } from './player.js'; // Añadir playerShip si no está ya exportado/accesible
import { createAsteroidField, updateAsteroids, handleAsteroidCollision } from './asteroids.js';
import { updateBullets, fireBullet } from './bullets.js';
import { createExplosion, updateExplosions } from './explosions.js';
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

// ... (resto de importaciones y código inicial)

/* ---------- Variables Globales del Juego ---------- */
let scene, camera, menuCamera, menuControls, renderer;
let clock = new THREE.Clock();
let playerShip = null; // Asegúrate de que playerShip sea accesible globalmente o pasado
let asteroids = [];
let bullets = [];
let enemyBullets = []; // Separar balas de enemigos (o usar userData)
let explosions = [];
let blackHole;
let stars; // Para el fondo de estrellas
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

// *** OTRAS VARIABLES GLOBALES ***
let keys = {}; // Para el input
let isBoosting = false;
let boostCooldown = 0;
const BOOST_DURATION = 0.3;
const BOOST_COOLDOWN_TIME = 2.0;
const boostCooldownInfo = document.getElementById('boost-cooldown-info');
let constantThrust = false;

// UI Elements
const mainMenu = document.getElementById('main-menu');
const gameOverMenu = document.getElementById('game-over-menu');
const playButton = document.getElementById('play-button');
const controlsButton = document.getElementById('controls-button');
const controlsInfo = document.getElementById('controls');
const tryAgainButton = document.getElementById('try-again-button');

// --- Inicialización ---
async function initGame() {
    // ... (código existente de initGame: renderer, menú cámara, mundo, luces, agujero negro, estrellas)
    ({ scene, blackHole, stars } = createWorld());
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Menu Camera Setup
    const menuCamData = createCamera(canvas); // Usar la función original para el menú
    menuCamera = menuCamData.camera;
    menuControls = menuCamData.controls;
    menuCamera.position.set(0, 50, 120); // Ajustar posición para ver la escena
    menuControls.target.set(0, 0, 0); // Apuntar al agujero negro

    initAudio(menuCamera); // Inicializar audio con la cámara del menú primero

    // Carga asíncrona de assets
    try {
        // Cargar nave del jugador Y modelos de enemigos en paralelo
        [playerShip] = await Promise.all([
            loadPlayerShip(),
            loadEnemyAssets() // *** CARGAR ENEMIGOS ***
        ]);

        if (playerShip) {
            // playerShip.position.set(0, 0, 50); // Posición inicial del jugador (ajustar si es necesario)
            // No añadir a la escena todavía, se hará en startGame
            console.log("Nave del jugador cargada.");
             // Inicializar hits en userData si no está
             if (playerShip.userData.hits === undefined) {
                 playerShip.userData.hits = 0;
             }
        } else {
             console.error("¡Fallo al cargar la nave del jugador!");
             // Manejar error - mostrar mensaje al usuario, etc.
             return; // Detener inicialización si falla
        }

        // Inicializar asteroides para el fondo del menú
        asteroids = createAsteroidField(scene, 20); // Menos asteroides para el menú

        // Setup UI Listeners
        setupUIListeners();

        // Iniciar loop de animación del menú
        menuAnimate();

    } catch (error) {
        console.error("Error durante la inicialización:", error);
        // Mostrar un mensaje de error en la interfaz
        document.getElementById('main-menu').innerHTML = `<h1>Error al cargar</h1><p>No se pudieron cargar los recursos del juego. Intenta refrescar la página.</p><p style="font-size:0.8em; color:#aaa;">${error}</p>`;
        mainMenu.classList.remove('hidden'); // Asegurar que el menú (con el error) sea visible
    }

    window.addEventListener('resize', onWindowResize, false);
    setupInputListeners(); // Configurar listeners de teclado/ratón
}

function setupUIListeners() {
    playButton.addEventListener('click', () => {
        mainMenu.classList.add('hidden');
        gameOverMenu.classList.add('hidden'); // Ocultar game over si estaba visible
        canvas.classList.remove('hidden');
        startGame();
    });

    controlsButton.addEventListener('click', () => {
        controlsInfo.classList.toggle('hidden');
    });

    tryAgainButton.addEventListener('click', () => {
        mainMenu.classList.add('hidden'); // Ocultar menú principal
        gameOverMenu.classList.add('hidden');
        canvas.classList.remove('hidden');
        // No reiniciar nivel aquí, startGame se encarga basado en si el jugador murió
        startGame(); // Llama a startGame para reiniciar el nivel actual o empezar de nuevo
    });
}

// --- Lógica de Inicio del Juego ---
function startGame() {
    console.log("Iniciando juego...");
    gameStarted = true;

    // Resetear estado del juego anterior (si existe)
    // Limpiar enemigos, balas, explosiones existentes de una partida anterior
    enemies.forEach(e => scene.remove(e));
    enemies = [];
    bullets.forEach(b => scene.remove(b));
    bullets = [];
    enemyBullets.forEach(b => scene.remove(b)); // Limpiar balas enemigas
    enemyBullets = [];
    explosions.forEach(ex => scene.remove(ex));
    explosions = [];

    // Limpiar asteroides existentes y crear nuevos para el juego
    asteroids.forEach(a => scene.remove(a));
    asteroids = createAsteroidField(scene, 50); // Número de asteroides para el juego

    // Resetear jugador (posición, vida, etc.)
    if (playerShip) {
        playerShip.position.set(0, 0, 70); // Posición inicial segura
        playerShip.rotation.set(0, -Math.PI / 2, 0); // Orientación inicial
         playerShip.rotation.order = 'YXZ'; // Asegurar orden correcto
        playerShip.userData.velocity = new THREE.Vector3(0, 0, 0);
        playerShip.userData.rotationVelocity = new THREE.Vector3(0, 0, 0);
        playerShip.userData.hits = 0; // Resetear golpes
        playerShip.visible = true; // Asegurar que sea visible
        revertDamageAppearance(playerShip); // Quitar apariencia de daño si la tenía
        scene.add(playerShip); // Añadir a la escena si no estaba
    } else {
        console.error("Intento de iniciar juego sin nave de jugador cargada.");
        return; // No continuar si no hay nave
    }


    // Resetear cámara del juego (asume que 'camera' es la cámara del juego, no la del menú)
     // Recrear cámara y controles para el juego, si es necesario, o reconfigurar la existente
     if (!camera) { // Si la cámara del juego no existe, créala
         const gameCamData = createCamera(canvas);
         camera = gameCamData.camera;
         // NO usamos OrbitControls para el juego, la cámara sigue a la nave
         // gameControls = gameCamData.controls; // No necesitaríamos estos controles en juego
         camera.position.set(0, 15, 100); // Posición inicial detrás de la nave
     }
     // Asociar listener de audio a la cámara del JUEGO
     if (listener && camera.children.indexOf(listener) === -1) {
         camera.add(listener);
     }


    // *** INICIAR ESTADO ARCADE ***
    // Leer nivel guardado o empezar desde el principio
     const savedLevel = localStorage.getItem('arcadeLevel');
     arcadeLevel = savedLevel ? parseInt(savedLevel, 10) : STARTING_LEVEL;
     if (arcadeLevel > MAX_LEVEL) arcadeLevel = STARTING_LEVEL; // Reiniciar si superó el máximo (o manejar victoria)
     console.log(`Starting at Level: ${arcadeLevel}`);

    currentWave = 'starting_wave'; // Estado inicial para generar la primera oleada
    enemiesRemaining = 0; // Se establecerá al generar la oleada

    // Cargar y reproducir música si no está sonando
    loadAndPlayMusic();

    // Detener animación del menú si está corriendo
    if (menuAnimationFrameId) {
        cancelAnimationFrame(menuAnimationFrameId);
        menuAnimationFrameId = null;
    }

    // Iniciar loop de animación del juego
    if (!gameAnimationFrameId) {
        animate();
    }
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

    const delta = clock.getDelta();
    const currentTime = performance.now(); // Tiempo actual para cooldowns, etc.

    // --- Actualización de Gameplay (Velocidad basada en Agujero Negro) ---
    let playerSpeedFactor = 1;
    let envSpeedFactor = 1;
    if (playerShip && blackHole) {
        const gameplayFactors = updateGameplay(playerShip, blackHole);
        playerSpeedFactor = gameplayFactors.playerSpeedFactor;
        envSpeedFactor = gameplayFactors.envSpeedFactor;
    }


    // --- Lógica del Estado Arcade ---
    if (currentWave === 'starting_wave') {
        enemiesRemaining = spawnWave(scene, arcadeLevel, enemies);
        currentWave = 'normal'; // Cambiar estado a oleada normal activa
        console.log(`Wave Started. Enemies: ${enemiesRemaining}`);
        // playSound('wave_start'); // Sonido de inicio de oleada
    } else if (currentWave === 'normal' && enemiesRemaining <= 0) {
        // Oleada normal completada, iniciar oleada de jefe
        currentWave = 'spawning_boss';
        enemiesRemaining = spawnBoss(scene, arcadeLevel, enemies);
         console.log(`Spawning Boss. Total Enemies (Boss + Escorts): ${enemiesRemaining}`);
        // playSound('boss_spawn');
         currentWave = 'boss'; // Cambiar estado a oleada de jefe activa
    } else if (currentWave === 'boss' && enemiesRemaining <= 0) {
        // Jefe derrotado, subir de nivel
        currentWave = 'level_up_transition'; // Estado transitorio
        // playSound('level_up');
        console.log(`Level ${arcadeLevel} Cleared!`);
        arcadeLevel++;
         localStorage.setItem('arcadeLevel', arcadeLevel); // Guardar progreso

         // Pequeña pausa antes de la siguiente oleada
         setTimeout(() => {
            if (arcadeLevel > MAX_LEVEL) {
                 console.log("¡Has ganado el modo Arcade!");
                 // Mostrar pantalla de victoria o volver al menú
                 showGameOverScreen("¡VICTORIA!", true); // Añadir un flag de victoria
            } else {
                 currentWave = 'starting_wave'; // Preparar para la siguiente oleada normal
            }
        }, 2000); // Pausa de 2 segundos

    }


    // --- Actualizaciones de Entidades (usando delta y factores de velocidad) ---
    if (playerShip && playerShip.visible) {
         updatePlayer(playerShip, keys, delta, playerSpeedFactor, constantThrust, isBoosting); // Pasar factores y estados
        // Lógica de disparo del jugador
         if (keys[' '] && playerShip.userData.canShoot) { // Asumiendo que tienes una lógica de cooldown de disparo en player.js o aquí
            const shipDirection = new THREE.Vector3();
            playerShip.getWorldDirection(shipDirection); // Obtener dirección hacia adelante
            const bullet = fireBullet(playerShip.position, shipDirection, playerShip.userData.velocity);
             if (bullet) {
                bullet.userData.isPlayerBullet = true; // Marcarla como del jugador
                scene.add(bullet);
                bullets.push(bullet);
                // playSound('laser');
                // Añadir cooldown de disparo aquí o en player.js
                // playerShip.userData.canShoot = false;
                // setTimeout(() => { playerShip.userData.canShoot = true; }, 200); // Ej: 200ms cooldown
            }
        }
         // Actualizar cámara para seguir al jugador
         updateFollowCamera(camera, playerShip); // Necesitamos crear esta función
         // Actualizar el listener de audio si la cámara se mueve
          if (listener) listener.position.copy(camera.position);

         // Revertir apariencia de daño del jugador
         if (checkVisualDamage(currentTime)) {
            revertDamageAppearance(playerShip);
         }
    }

    updateAsteroids(asteroids, delta, envSpeedFactor); // Mover asteroides
    updateBullets(bullets.concat(enemyBullets), delta); // Actualizar TODAS las balas juntas
    updateExplosions(explosions, delta);
    updateEnemies(enemies, playerShip, delta, envSpeedFactor, enemyBullets, scene); // *** ACTUALIZAR ENEMIGOS ***
    revertEnemyHitVisuals(enemies); // Revertir efecto visual de daño en enemigos

    // --- Rotación del Agujero Negro y Estrellas ---
    if (blackHole) {
        blackHole.rotation.y += 0.1 * delta * envSpeedFactor; // Rotación afectada por cercanía
        if (blackHole.children.length > 0) { // Si tiene disco de acreción
            blackHole.children[0].rotation.z -= 0.05 * delta * envSpeedFactor;
        }
    }
    // Podrías hacer que las estrellas roten lentamente también
    // if (stars) stars.rotation.y += 0.01 * delta;


    // --- Detección de Colisiones ---
    checkCollisions();


     // --- Actualizar UI (Boost Cooldown) ---
     updateBoostUI(delta);


    // --- Renderizar la escena ---
    renderer.render(scene, camera); // Usar la cámara del JUEGO
}

// --- Detección de Colisiones ---
function checkCollisions() {
    if (!playerShip || !playerShip.visible) return; // No hacer nada si el jugador no está activo

    const playerBox = new THREE.Box3().setFromObject(playerShip); // Podrías optimizar no creando la caja cada frame

    // 1. Balas del Jugador vs Enemigos
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        if (!bullet.userData.isPlayerBullet) continue; // Ignorar balas enemigas aquí

        const bulletBox = new THREE.Box3().setFromObject(bullet);

        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
             // Usar la bounding box precalculada del enemigo
            const enemyBox = enemy.userData.boundingBox.clone().applyMatrix4(enemy.matrixWorld);


            if (bulletBox.intersectsBox(enemyBox)) {
                console.log("Bullet hit enemy!");
                // Crear explosión pequeña en el punto de impacto
                 createExplosion(scene, bullet.position.clone());
                 // playSound('hit');

                // Aplicar daño al enemigo y ver si muere
                const enemyDestroyed = handleEnemyHit(enemy, 25, enemies, scene); // Asumir 25 de daño por bala
                if (enemyDestroyed) {
                     enemiesRemaining--; // Reducir contador si fue destruido
                     console.log(`Enemy destroyed. Remaining: ${enemiesRemaining}`);
                     // ¿Soltar power-up? (Lógica futura aquí)
                }

                // Eliminar la bala
                scene.remove(bullet);
                bullets.splice(i, 1);
                break; // Salir del loop de enemigos, la bala ya impactó
            }
        }
    }

    // 2. Balas Enemigas vs Jugador
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
         if (!bullet.userData.isEnemyBullet) continue; // Seguridad extra

        const bulletBox = new THREE.Box3().setFromObject(bullet);

        if (playerBox.intersectsBox(bulletBox)) {
            console.log("Player hit by enemy bullet!");
             createExplosion(scene, bullet.position.clone());
            scene.remove(bullet);
            enemyBullets.splice(i, 1);

             // Aplicar daño al jugador
             applyDamage(playerShip, 1); // Daño = 1 golpe
             setVisualDamage(performance.now()); // Activar efecto visual de daño
             // playSound('player_hit');

             if (isDestroyed(playerShip)) {
                 handlePlayerDeath();
                 break; // Salir del loop, el jugador murió
             }
        }
    }


    // 3. Jugador vs Asteroides
    for (let i = asteroids.length - 1; i >= 0; i--) {
        const asteroid = asteroids[i];
        const asteroidBox = new THREE.Box3().setFromObject(asteroid);

        if (playerBox.intersectsBox(asteroidBox)) {
            console.log("Player hit asteroid!");
            // Crear explosión donde estaba el asteroide
            createExplosion(scene, asteroid.position.clone());
            // playSound('collision');

            // Eliminar asteroide (o romperlo si es grande - usar handleAsteroidCollision)
            handleAsteroidCollision(asteroid, null, asteroids, scene, bullets, explosions); // Pasamos null como bala

            // Aplicar daño al jugador
             applyDamage(playerShip, 1);
             setVisualDamage(performance.now());

             if (isDestroyed(playerShip)) {
                 handlePlayerDeath();
                 break;
             }
        }
    }

    // 4. Jugador vs Enemigos (Colisión física)
     for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const enemyBox = enemy.userData.boundingBox.clone().applyMatrix4(enemy.matrixWorld);

        if (playerBox.intersectsBox(enemyBox)) {
            console.log("Player collided with enemy!");
             // Explosiones para ambos
            createExplosion(scene, playerShip.position.clone());
            createExplosion(scene, enemy.position.clone());
            // playSound('collision_heavy');

             // Daño significativo a ambos
             applyDamage(playerShip, 2); // Más daño por colisión directa
             setVisualDamage(performance.now());
             const enemyDestroyed = handleEnemyHit(enemy, 100, enemies, scene); // Mucho daño al enemigo
             if (enemyDestroyed) enemiesRemaining--;


             if (isDestroyed(playerShip)) {
                 handlePlayerDeath();
                 break;
             }
             // Si el enemigo no fue destruido, podría rebotar o algo similar (física simple)
             // ...
        }
    }

     // 5. Balas vs Asteroides (si quieres que las balas destruyan asteroides)
      for (let i = bullets.concat(enemyBullets).length - 1; i >= 0; i--) {
        const bullet = bullets.concat(enemyBullets)[i];
        if (!bullet || !bullet.parent) continue; // Asegurarse que la bala existe

        const bulletBox = new THREE.Box3().setFromObject(bullet);

        for (let j = asteroids.length - 1; j >= 0; j--) {
            const asteroid = asteroids[j];
            const asteroidBox = new THREE.Box3().setFromObject(asteroid);

            if (bulletBox.intersectsBox(asteroidBox)) {
                 // Llamar a la función de asteroids.js para manejar la colisión
                 // Necesitamos pasar el array correcto (bullets o enemyBullets) para eliminar la bala
                 const bulletArray = bullet.userData.isPlayerBullet ? bullets : enemyBullets;
                 const bulletIndex = bulletArray.indexOf(bullet);

                handleAsteroidCollision(asteroid, bullet, asteroids, scene, bulletArray, explosions);

                 // Asegurarse de que la bala fue eliminada por handleAsteroidCollision
                 // (El código actual en asteroids.js debería hacerlo)
                 // if (bulletIndex > -1) {
                 //    bulletArray.splice(bulletIndex, 1);
                 // }

                // Salir del loop de asteroides para esta bala
                break;
            }
        }
    }

}

// --- Manejo Muerte del Jugador ---
function handlePlayerDeath() {
    console.log("Player Destroyed!");
    // playSound('game_over'); // O un sonido de explosión grande

    createExplosion(scene, playerShip.position.clone()); // Explosión grande
    playerShip.visible = false; // Ocultar nave

    // Detener el juego y mostrar pantalla de Game Over
    showGameOverScreen("GAME OVER");
}

// --- Mostrar Pantalla Game Over / Victoria ---
function showGameOverScreen(message = "GAME OVER", isVictory = false) {
    gameStarted = false; // Detener lógica del juego en animate()

    // Cancelar el frame de animación del JUEGO
    if (gameAnimationFrameId) {
        cancelAnimationFrame(gameAnimationFrameId);
        gameAnimationFrameId = null;
    }

    // Configurar y mostrar el menú apropiado
    gameOverMenu.querySelector('h1').textContent = message;
    // Podrías cambiar el texto del botón si es victoria
    tryAgainButton.textContent = isVictory ? "Volver al Menú" : "Intentar de Nuevo";

    gameOverMenu.classList.remove('hidden');
    canvas.classList.add('hidden'); // Ocultar canvas

    // Si es victoria, podrías querer resetear el nivel guardado o no
     if (isVictory) {
         localStorage.setItem('arcadeLevel', STARTING_LEVEL); // Reiniciar al nivel 1 tras victoria
     }

    // Reiniciar la animación del MENÚ para el fondo
    if (!menuAnimationFrameId) {
        menuAnimate(); // Usar el loop del menú para el fondo de Game Over
    }
}


// --- Función Cámara de Seguimiento --- (NUEVA)
function updateFollowCamera(camera, target) {
    if (!target) return;

    const offset = new THREE.Vector3(0, 8, -25); // Distancia detrás y arriba de la nave
    const desiredPosition = target.localToWorld(offset.clone()); // Calcular posición deseada en coordenadas del mundo

    // Suavizar movimiento de la cámara (Lerp)
    camera.position.lerp(desiredPosition, 0.08); // Ajusta el valor 0.08 para más/menos suavidad

    // Hacer que la cámara mire un punto ligeramente delante de la nave
    const lookAtOffset = new THREE.Vector3(0, 3, 50); // Punto delante de la nave
    const lookAtPoint = target.localToWorld(lookAtOffset.clone());

    // Suavizar el punto de mira (Lerp) - Opcional, puede ser más directo
    // camera.userData.currentLookAt = camera.userData.currentLookAt || target.position.clone();
    // camera.userData.currentLookAt.lerp(lookAtPoint, 0.1);
    // camera.lookAt(camera.userData.currentLookAt);
    camera.lookAt(lookAtPoint); // Mirada más directa


    // Asegurar que la cámara no atraviese el "suelo" (si tuvieras uno)
    // camera.position.y = Math.max(camera.position.y, 1.0);
}


// --- Manejo de Input --- (Asegúrate de tener esto)
function setupInputListeners() {
     document.addEventListener('keydown', (event) => keys[event.key.toLowerCase()] = true);
     document.addEventListener('keyup', (event) => {
         keys[event.key.toLowerCase()] = false;
         // Resetear flags de acción única al soltar tecla
         if (event.key.toLowerCase() === 'm') constantThrust = !constantThrust; // Toggle M
         if (event.key.toLowerCase() === 'n') { /* Boost se activa en keydown */ }

     });

     // Boost en keydown (para que se active una vez)
      document.addEventListener('keydown', (event) => {
         if (event.key.toLowerCase() === 'n' && boostCooldown <= 0) {
             isBoosting = true;
             boostCooldown = BOOST_COOLDOWN_TIME; // Iniciar cooldown
              // Aplicar impulso inicial aquí o en updatePlayer
               const boostForce = 250; // Ajusta la fuerza del impulso
               const boostDirection = new THREE.Vector3();
               playerShip.getWorldDirection(boostDirection);
               playerShip.userData.velocity.addScaledVector(boostDirection, boostForce);

              // Pequeño timeout para desactivar el estado 'isBoosting' después de la duración del efecto
              setTimeout(() => {
                  isBoosting = false;
              }, BOOST_DURATION * 1000); // Convertir a ms
              // playSound('boost'); // Sonido de boost
         }
      });
}

// --- Actualizar UI del Boost --- (NUEVA o Modificada)
function updateBoostUI(delta) {
     if (boostCooldown > 0) {
        boostCooldown -= delta;
        boostCooldownInfo.textContent = `Boost en: ${boostCooldown.toFixed(1)}s`;
        boostCooldownInfo.classList.remove('ready');
     } else {
        boostCooldown = 0; // Asegurar que no sea negativo
        boostCooldownInfo.textContent = 'Boost Listo';
        boostCooldownInfo.classList.add('ready'); // Clase 'ready' podría ocultarlo vía CSS
     }
}


// --- Redimensionar Ventana --- (Asegúrate de tener esto)
function onWindowResize() {
    const currentCamera = gameStarted ? camera : menuCamera; // Usar la cámara activa
    if (currentCamera) {
        currentCamera.aspect = window.innerWidth / window.innerHeight;
        currentCamera.updateProjectionMatrix();
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
}


// --- Loop de Animación del Menú --- (Modificado para usar menuCamera/controls)
function menuAnimate() {
    if (gameStarted) {
        // Si el juego ha comenzado mientras el menú estaba activo, detener este loop
        menuAnimationFrameId = null;
        return;
    }

    menuAnimationFrameId = requestAnimationFrame(menuAnimate);
    const delta = clock.getDelta();

    // Rotar agujero negro y asteroides en el fondo del menú/game over
    if (blackHole) {
        blackHole.rotation.y += 0.05 * delta; // Rotación más lenta para el menú
         if (blackHole.children.length > 0) {
            blackHole.children[0].rotation.z -= 0.02 * delta;
         }
    }
    updateAsteroids(asteroids, delta, 0.2); // Mover asteroides lentamente
    updateExplosions(explosions, delta); // Actualizar explosiones si las hubiera

    // Actualizar controles de la cámara del menú
     if(menuControls) menuControls.update(); // Importante para OrbitControls

    // Renderizar con la cámara del menú
    renderer.render(scene, menuCamera);
}


// --- Iniciar todo ---
initGame();
