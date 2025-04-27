// enemies.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fireBullet } from './bullets.js'; // Asumimos que los enemigos dispararán
// Podríamos necesitar importar createExplosion si los enemigos explotan al morir
import { createExplosion } from './explosions.js';
// Importar funciones de audio si queremos sonidos específicos para enemigos
// import { playEnemyLaserSound, playEnemyExplosionSound } from './audio.js';

const loader = new GLTFLoader();
let enemyModel = null;
let bossModel = null;

// --- Carga de Modelos ---
export async function loadEnemyAssets() {
    try {
        const [enemyGltf, bossGltf] = await Promise.all([
            loader.loadAsync('Spaceshipenemy.glb'),
            loader.loadAsync('Flyingsaucer.glb')
        ]);

        enemyModel = enemyGltf.scene;
        bossModel = bossGltf.scene;

        // --- Ajustes iniciales de orientación/escala (¡IMPORTANTE!) ---
        // Es MUY probable que necesites ajustar la rotación aquí
        // si los modelos aparecen al revés o mirando en la dirección incorrecta.
        // Ejemplo: (Descomenta y ajusta los ejes y ángulos según sea necesario)
        // enemyModel.rotation.order = 'YXZ';
        // enemyModel.rotation.y = Math.PI; // Rotar 180 grados en Y si mira hacia atrás
        // enemyModel.rotation.x = Math.PI / 2; // Rotar 90 grados en X si está "acostado"

        // Lo mismo para el bossModel
        // bossModel.rotation.order = 'YXZ';
        // bossModel.rotation.y = Math.PI;

        // Escalar si son muy grandes o pequeños (opcional, ajustar valor)
        // const scale = 3;
        // enemyModel.scale.set(scale, scale, scale);
        // bossModel.scale.set(scale * 2, scale * 2, scale * 2); // Boss más grande

        console.log("Modelos de enemigos cargados.");

        // Pre-calcular bounding box para colisiones (después de escalar/rotar)
        // enemyModel.userData.boundingBox = new THREE.Box3().setFromObject(enemyModel);
        // bossModel.userData.boundingBox = new THREE.Box3().setFromObject(bossModel);

    } catch (error) {
        console.error("Error cargando modelos de enemigos:", error);
    }
}

// --- Creación de Enemigos ---
function createEnemyInstance(level) {
    if (!enemyModel) return null;

    const enemy = enemyModel.clone(); // Clonar el modelo base

    // --- Posición Inicial Aleatoria ---
    // Aparecerán en un anillo alrededor del centro (agujero negro)
    const spawnRadius = THREE.MathUtils.randFloat(150, 300); // Rango de aparición
    const angle = Math.random() * Math.PI * 2;
    const y = THREE.MathUtils.randFloatSpread(100); // Variación vertical
    enemy.position.set(
        Math.cos(angle) * spawnRadius,
        y,
        Math.sin(angle) * spawnRadius
    );

    // --- Propiedades del Enemigo (dependientes del nivel) ---
    enemy.userData = {
        type: 'normal',
        level: level,
        health: 50 + level * 10, // Salud aumenta con el nivel
        maxHealth: 50 + level * 10,
        speed: 5 + level * 0.5, // Velocidad aumenta
        fireRate: 0.8 - level * 0.05, // Tiempo entre disparos disminuye (más rápido)
        accuracy: 0.6 + level * 0.02, // Precisión aumenta (más difícil esquivar)
        lastShotTime: 0,
        moveTarget: new THREE.Vector3(), // Hacia dónde intenta moverse
        state: 'attacking', // 'attacking', 'evading', 'idle'
        // Guardar bounding box si se calculó antes
        // boundingBox: enemyModel.userData.boundingBox.clone()
    };
    // Asegurar que fireRate no sea demasiado bajo
    enemy.userData.fireRate = Math.max(0.15, enemy.userData.fireRate);

    // Clonar la bounding box si la pre-calculaste
    if (enemyModel.userData.boundingBox) {
         enemy.userData.boundingBox = enemyModel.userData.boundingBox.clone();
    } else { // Calcularla si no se pre-calculó (menos eficiente)
         enemy.userData.boundingBox = new THREE.Box3().setFromObject(enemy);
    }


    return enemy;
}

function createBossInstance(level) {
    if (!bossModel) return null;

    const boss = bossModel.clone();

    // --- Posición Inicial del Boss ---
    boss.position.set(0, 0, 150); // Aparece más lejos o en un punto fijo

    // --- Propiedades del Boss ---
    boss.userData = {
        type: 'boss',
        level: level,
        health: 200 + level * 50,
        maxHealth: 200 + level * 50,
        speed: 10 + level * 1.0,
        fireRate: 0.5 - level * 0.04,
        accuracy: 0.7 + level * 0.03,
        lastShotTime: 0,
        moveTarget: new THREE.Vector3(),
        state: 'attacking',
        // boundingBox: bossModel.userData.boundingBox.clone()
    };
    boss.userData.fireRate = Math.max(0.1, boss.userData.fireRate);

     if (bossModel.userData.boundingBox) {
         boss.userData.boundingBox = bossModel.userData.boundingBox.clone();
    } else {
         boss.userData.boundingBox = new THREE.Box3().setFromObject(boss);
    }


    // Considerar añadir enemigos normales acompañando al boss en niveles altos
    boss.userData.escorts = level > 2 ? Math.min(level - 1, 2) : 0; // Ej: 1 escolta en Nivel 3, 2 en Nivel 4+

    return boss;
}

// --- Spawning (Generación de Oleadas) ---
export function spawnWave(scene, level, enemiesArray) {
    console.log(`Spawning Wave for Level ${level}`);
    const enemiesToSpawn = 3;
    const minR = 150, maxR = 300;
    const safeR = 180; // distancia mínima a la nave

    for (let i = 0; i < enemiesToSpawn; i++) {
        const enemy = createEnemyInstance(level);
        if (!enemy) continue;

        // generar r entre minR y maxR, pero forzar r ≥ safeR
        let r = THREE.MathUtils.randFloat(minR, maxR);
        if (r < safeR) r = safeR + THREE.MathUtils.randFloat(0, maxR - safeR);

        const angle = Math.random() * Math.PI * 2;
        const y     = THREE.MathUtils.randFloatSpread(100);
        enemy.position.set(
            Math.cos(angle) * r,
            y,
            Math.sin(angle) * r
        );

        scene.add(enemy);
        enemiesArray.push(enemy);

        // efecto de aparición
        enemy.scale.set(0.1, 0.1, 0.1);
        enemy.userData.spawnTime = performance.now();
    }
    return enemiesToSpawn;
}


export function spawnBoss(scene, level, enemiesArray) {
    console.log(`Spawning Boss for Level ${level}`);
    const boss = createBossInstance(level);
    let spawnedCount = 0;
    if (boss) {
        scene.add(boss);
        enemiesArray.push(boss);
        spawnedCount++;
         // Efecto de aparición para el boss
         boss.scale.set(0.1, 0.1, 0.1);
         boss.userData.spawnTime = performance.now();

        // Añadir escoltas si corresponde
        for (let i = 0; i < boss.userData.escorts; i++) {
            const escort = createEnemyInstance(level); // Escoltas del mismo nivel
            if (escort) {
                // Posicionar cerca del boss
                const offset = new THREE.Vector3(
                    (Math.random() - 0.5) * 40,
                    (Math.random() - 0.5) * 20,
                    (Math.random() - 0.5) * 40
                );
                escort.position.copy(boss.position).add(offset);
                scene.add(escort);
                enemiesArray.push(escort);
                spawnedCount++;
                 // Efecto de aparición
                 escort.scale.set(0.1, 0.1, 0.1);
                 escort.userData.spawnTime = performance.now();
            }
        }
    }
     // Devolver el número total de enemigos (boss + escoltas)
     return spawnedCount;
}


// --- Actualización de Comportamiento ---
export function updateEnemies(enemies, playerShip, delta, envSpeedFactor, bulletsArray, scene) {
    const currentTime = performance.now();

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        // --- Efecto de aparición ---
        if (enemy.userData.spawnTime) {
            const timeSinceSpawn = (currentTime - enemy.userData.spawnTime) / 1000; // en segundos
            const spawnDuration = 0.5; // Duración del efecto de escalado
            if (timeSinceSpawn < spawnDuration) {
                const scaleProgress = timeSinceSpawn / spawnDuration;
                const currentScale = 0.1 + scaleProgress * ( (enemy.userData.type === 'boss' ? 6 : 3) - 0.1); // Escala final depende del tipo
                enemy.scale.set(currentScale, currentScale, currentScale);
            } else {
                // Una vez terminado, asegurar escala final y quitar spawnTime
                 const finalScale = (enemy.userData.type === 'boss' ? 6 : 3); // Asumiendo escala base 1 y factor 3 o 6
                 enemy.scale.set(finalScale, finalScale, finalScale);
                delete enemy.userData.spawnTime; // Elimina la propiedad para no recalcular
                 // Recalcular bounding box una vez que la escala es final
                 enemy.userData.boundingBox.setFromObject(enemy);
            }
            // No hacer nada más mientras aparece
            continue;
        }


        // --- Lógica de Movimiento Simple (Ej: Acercarse y orbitar un poco) ---
        if (playerShip && playerShip.visible) { // Solo si el jugador existe y es visible
            const directionToPlayer = playerShip.position.clone().sub(enemy.position);
            const distanceToPlayer = directionToPlayer.length();

            // Mirar hacia el jugador (suavizado)
             const targetQuaternion = new THREE.Quaternion();
             const lookAtMatrix = new THREE.Matrix4();
             lookAtMatrix.lookAt(enemy.position, playerShip.position, enemy.up);
             targetQuaternion.setFromRotationMatrix(lookAtMatrix);
             enemy.quaternion.slerp(targetQuaternion, 0.05); // Ajusta la velocidad de giro

            // Moverse hacia una posición cerca del jugador
            const desiredDistance = enemy.userData.type === 'boss' ? 100 : 60; // Los normales se acercan más
            if (distanceToPlayer > desiredDistance + 10) {
                // Moverse hacia adelante
                enemy.translateZ(enemy.userData.speed * delta * envSpeedFactor); // Usar envSpeedFactor
            } else if (distanceToPlayer < desiredDistance - 10) {
                 // Moverse hacia atrás (o frenar)
                 enemy.translateZ(-enemy.userData.speed * delta * envSpeedFactor * 0.5);
            } else {
                 // Orbitar un poco (movimiento lateral simple)
                 enemy.translateX(enemy.userData.speed * delta * envSpeedFactor * 0.3 * Math.sin(currentTime * 0.001 * enemy.userData.speed)); // Usa seno para ir y venir
            }


             // --- Lógica de Disparo Simple ---
             const timeSinceLastShot = (currentTime - enemy.userData.lastShotTime) / 1000;
             if (timeSinceLastShot > enemy.userData.fireRate) {
                 // Calcular dirección de disparo (con algo de imprecisión)
                 const fireDirection = playerShip.position.clone().sub(enemy.position).normalize();

                 // Añadir imprecisión basada en 'accuracy'
                 const spread = (1 - enemy.userData.accuracy) * 0.5; // Mayor spread si accuracy es baja
                 fireDirection.x += THREE.MathUtils.randFloatSpread(spread);
                 fireDirection.y += THREE.MathUtils.randFloatSpread(spread);
                 fireDirection.z += THREE.MathUtils.randFloatSpread(spread);
                 fireDirection.normalize();

                 // Obtener velocidad actual del enemigo para añadirla a la bala (opcional)
                 // Necesitaríamos calcularla o almacenarla si queremos balas relativas
                 const enemyVelocity = new THREE.Vector3(0,0,0); // Simplificación por ahora

                  // Usar la función de bullets.js para disparar
                  const bullet = fireBullet(enemy.position, fireDirection, enemyVelocity);
                  if(bullet) {
                     bullet.material.color.set(0x00ff00); // Balas enemigas verdes
                     bullet.userData.isEnemyBullet = true; // Marcarla
                     scene.add(bullet);
                     bulletsArray.push(bullet);
                     enemy.userData.lastShotTime = currentTime;
                     // playEnemyLaserSound(); // Reproducir sonido de disparo enemigo
                  }
             }
        }

        // --- Actualizar Bounding Box (si no se precalculó o si la escala cambia) ---
        // Descomentar si no precalculaste o si la escala/rotación puede cambiar dinámicamente
        // enemy.userData.boundingBox.setFromObject(enemy);

        // --- Lógica de Límites del Mundo (Simple) ---
        // Podríamos añadir aquí la lógica de la barrera invisible del agujero negro
        // const boundaryRadius = 2000; // Ejemplo
        // if (enemy.position.length() > boundaryRadius) {
        //     // Reposicionar, destruir o hacer que vuelva
        //     scene.remove(enemy);
        //     enemies.splice(i, 1);
        // }
    }
}

// --- Manejo de Daño y Destrucción ---
export function handleEnemyHit(enemy, damage, enemiesArray, scene) {
    enemy.userData.health -= damage;
    console.log(`Enemy Hit! Type: ${enemy.userData.type}, Health: ${enemy.userData.health}/${enemy.userData.maxHealth}`);

    // Efecto visual de daño (parpadeo rojo?) - Simple: cambiar color emisivo
    if (enemy.material && enemy.material.emissive) { // Comprobar si tiene material emisivo
        const originalEmissive = enemy.userData.originalEmissive || enemy.material.emissive.getHex();
        enemy.userData.originalEmissive = originalEmissive; // Guardar original si no existe
        enemy.material.emissive.setHex(0xff0000); // Rojo
        enemy.userData.hitTime = performance.now(); // Marcar cuándo fue golpeado
    }


    if (enemy.userData.health <= 0) {
        console.log(`Enemy Destroyed! Type: ${enemy.userData.type}`);
        // Crear explosión
        const explosion = createExplosion(scene, enemy.position);
        // playEnemyExplosionSound();

        // Eliminar enemigo de la escena y del array
        scene.remove(enemy);
        const index = enemiesArray.indexOf(enemy);
        if (index > -1) {
            enemiesArray.splice(index, 1);
        }
        // Devolver true para indicar que un enemigo fue destruido
        return true;
    }
     // Devolver false si el enemigo sobrevivió
     return false;
}

// Función para revertir el efecto visual de daño después de un tiempo
export function revertEnemyHitVisuals(enemies) {
    const currentTime = performance.now();
    const hitDuration = 150; // Milisegundos que dura el parpadeo rojo

     enemies.forEach(enemy => {
        if (enemy.userData.hitTime && (currentTime - enemy.userData.hitTime > hitDuration)) {
             if (enemy.material && enemy.material.emissive && enemy.userData.originalEmissive !== undefined) {
                 enemy.material.emissive.setHex(enemy.userData.originalEmissive);
             }
            delete enemy.userData.hitTime; // Quitar la marca de tiempo
            delete enemy.userData.originalEmissive; // Limpiar el color guardado
        }
    });
}
