// asteroids.js
import * as THREE from 'three';
import { createExplosion } from './explosions.js'; // <<< Import createExplosion

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
    // <<< Add a check if asteroids array exists and has elements to prevent TypeError
    if (!asteroids || asteroids.length === 0) {
        return; // If no asteroids, do nothing
    }

  asteroids.forEach(a => { // This is likely the line causing the TypeError if asteroids is undefined/null
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
// The createExplosion function is now available here due to the import
export function handleAsteroidCollision(scene, asteroids, asteroid, bullets, explosions, bullet) {
    const size = asteroid.userData.size;

    // Create explosion at the asteroid's position
    explosions.push(createExplosion(scene, asteroid.position)); // createExplosion is now imported and works

    // Remove the original asteroid from the scene and the array
    scene.remove(asteroid);
    const index = asteroids.indexOf(asteroid);
    if (index > -1) {
        asteroids.splice(index, 1);
    }

    // Divide asteroids large and medium
    if (size === 'large' || size === 'medium') {
        const newSize = size === 'large' ? 'medium' : 'small';
        const numNewAsteroids = 3;
        const fragmentSpeed = size === 'large' ? 100 : 200; // Speed of the fragments

        for (let i = 0; i < numNewAsteroids; i++) {
            const newRadius = size === 'large' ? 7 : 3; // Radius for medium and small fragments
             const baseGeom  = new THREE.IcosahedronGeometry(1, 0); // Base geometry

            const mat = new THREE.MeshStandardMaterial({ color: 0x606060, flatShading: true });
            const newAsteroid = new THREE.Mesh(baseGeom, mat);
             const scale = newRadius / 1;
             newAsteroid.scale.set(scale, scale, scale);

            newAsteroid.userData = {
                size: newSize,
                radius: newRadius,
                // Adjust orbit speed for fragments - could be faster or inherit/modify parent speed
                orbitSpeed: asteroid.userData.orbitSpeed * (size === 'large' ? 1.2 : 1.5) // Slightly faster than parent
            };

            // Position the smaller asteroids around the original
            const offsetDirection = new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() - 0.5,
                Math.random() - 0.5
            ).normalize();
            const spawnOffsetDistance = asteroid.userData.radius + newRadius; // Spawn slightly outside the original
             const newPosition = asteroid.position.clone().add(offsetDirection.clone().multiplyScalar(spawnOffsetDistance * 0.8)); // Adjust multiplier for spacing
            newAsteroid.position.copy(newPosition);

            // Give fragments an initial velocity away from the explosion point
            const fragmentVelocity = offsetDirection.multiplyScalar(fragmentSpeed);
            newAsteroid.userData.velocity = fragmentVelocity; // Store initial velocity

            scene.add(newAsteroid);
            asteroids.push(newAsteroid);
        }
    }

    // Remove the bullet that hit the asteroid (assuming this function is called after bullet collision detected)
     if (bullet && bullet.parent) { // Check if bullet exists and is still in scene
         bullet.parent.remove(bullet);
         const bulletIndex = bullets.indexOf(bullet);
         if (bulletIndex > -1) {
             bullets.splice(bulletIndex, 1);
         }
     }
}
