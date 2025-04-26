// asteroids.js
import * as THREE from 'three';
import { createExplosion } from './explosions.js'; // Import createExplosion

/* ---------- creación ---------- */
// Modified to create different size asteroids initially
export function createAsteroidField (scene, count = 50) { // Reduced initial count
  const asteroids = [];

  // Initial range for large asteroids
  const minInitialDistance = 200; // Start spawning further out
  const maxInitialDistance = 800; // Expand the orbit range

  for (let i = 0; i < count; i++) {
    const mat  = new THREE.MeshStandardMaterial({ color: 0x808080, flatShading: true });
    // Start with larger asteroids (base geometry size can be adjusted, or scale applied later)
    const baseGeom  = new THREE.IcosahedronGeometry(1, 0); // Start with a smaller base geometry and scale

    const mesh = new THREE.Mesh(baseGeom, mat);

    // Position in the expanded range
    const r     = THREE.MathUtils.randFloat(minInitialDistance, maxInitialDistance);
    const angle = Math.random() * Math.PI * 2;
    const y = THREE.MathUtils.randFloatSpread(maxInitialDistance / 4); // Limit vertical spread
    mesh.position.set(
      Math.cos(angle) * r,
      y,
      Math.sin(angle) * r
    );

    // Assign properties for a large asteroid
    const size = 'large';
    const radius = 15; // Radius for large asteroid (adjust as needed for collisions)
    const scale = radius / 1; // Scale factor based on base geometry size 1
    mesh.scale.set(scale, scale, scale);

    mesh.userData = {
        size: size, // 'large', 'medium', 'small'
        radius: radius, // Adjust radius based on size
        orbitSpeed: THREE.MathUtils.mapLinear(r, minInitialDistance, maxInitialDistance, 0.2, 0.05) // Adjusted speed range for expanded orbits
    };

    scene.add(mesh);
    asteroids.push(mesh);
  }
  return asteroids;
}

/* ---------- actualización cada frame ---------- */
export function updateAsteroids (asteroids, delta, envSpeedFactor) {
    if (!asteroids || asteroids.length === 0) {
        return;
    }

  asteroids.forEach(a => {
    // Mantener la influencia de envSpeedFactor, pero la base speed es menor ahora
    // Ensure asteroids orbit around (0,0,0) which is where the black hole is
    a.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), a.userData.orbitSpeed * envSpeedFactor * delta);

    // Add some self-rotation
    a.rotation.x += 0.3 * delta;
    a.rotation.y += 0.5 * delta;
    a.rotation.z += 0.2 * delta; // Add some rotation on Z

    // If you added velocity to fragments in handleAsteroidCollision, update here
     if (a.userData.velocity) {
         a.position.addScaledVector(a.userData.velocity, delta);
         // Optionally apply damping to fragment velocity
         a.userData.velocity.multiplyScalar(0.99);
     }
  });
}

// *** New function to handle asteroid collision and breaking ***
export function handleAsteroidCollision(scene, asteroids, asteroid, bullets, explosions, bullet) {
    const size = asteroid.userData.size;

    explosions.push(createExplosion(scene, asteroid.position));

    scene.remove(asteroid);
    const index = asteroids.indexOf(asteroid);
    if (index > -1) {
        asteroids.splice(index, 1);
    }

    if (size === 'large' || size === 'medium') {
        const newSize = size === 'large' ? 'medium' : 'small';
        const numNewAsteroids = 3;
        // Ajusta la velocidad inicial de los fragmentos si quieres que salgan disparados más rápido o lento
        const fragmentSpeed = size === 'large' ? 100 : 150;

        for (let i = 0; i < numNewAsteroids; i++) {
            // <<< Modificado: Aumentar estos radios para hacer los fragmentos más grandes
            const newRadius = size === 'large' ? 10 : 5; // Antes: 7 y 3. Ahora: 10 (medianos) y 5 (pequeños)
            const baseGeom  = new THREE.IcosahedronGeometry(1, 0); // Base geometry

            const mat = new THREE.MeshStandardMaterial({ color: 0x606060, flatShading: true });
            const newAsteroid = new THREE.Mesh(baseGeom, mat);
            // La escala se calcula en base al nuevo radio deseado y el tamaño de la geometría base (1)
            const scale = newRadius / 1;
            newAsteroid.scale.set(scale, scale, scale);

            newAsteroid.userData = {
                size: newSize,
                radius: newRadius,
                // Ajusta la velocidad de órbita de los fragmentos. Ligeramente más rápida que el padre.
                orbitSpeed: asteroid.userData.orbitSpeed * (size === 'large' ? 1.1 : 1.3)
            };

            // Posicionar los asteroides más pequeños alrededor de la posición original
            const offsetDirection = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5
            ).normalize();
            // Ajusta la distancia a la que aparecen los fragmentos del centro de la explosión
            const spawnOffsetDistance = asteroid.userData.radius + newRadius;
             const newPosition = asteroid.position.clone().add(offsetDirection.clone().multiplyScalar(spawnOffsetDistance * 0.6));
            newAsteroid.position.copy(newPosition);

            // Dar a los fragmentos una velocidad inicial lejos del punto de explosión, sumando la velocidad del padre
            const fragmentVelocity = offsetDirection.multiplyScalar(fragmentSpeed);
             if (asteroid.userData.velocity) { // Si el asteroide padre ya tenía velocidad (era un fragmento)
                  newAsteroid.userData.velocity = asteroid.userData.velocity.clone().add(fragmentVelocity);
             } else { // Si el asteroide padre era uno grande inicial (sin velocidad userData)
                  newAsteroid.userData.velocity = fragmentVelocity;
             }


            scene.add(newAsteroid);
            asteroids.push(newAsteroid);
        }
    }

     if (bullet && bullet.parent) { // Asegurarse de que la bala existe y todavía está en la escena antes de intentar removerla
         bullet.parent.remove(bullet);
         const bulletIndex = bullets.indexOf(bullet);
         if (bulletIndex > -1) {
             bullets.splice(bulletIndex, 1);
         }
     }
}
