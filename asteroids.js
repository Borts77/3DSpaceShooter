import * as THREE from 'three';

/* ---------- creación ---------- */
export function createAsteroidField (scene, count = 150) {
  const asteroids = [];
  const baseGeom  = new THREE.IcosahedronGeometry(2, 0); // low-poly

  for (let i = 0; i < count; i++) {
    const mat  = new THREE.MeshStandardMaterial({ color: 0x808080, flatShading: true });
    const mesh = new THREE.Mesh(baseGeom, mat);

    const r     = THREE.MathUtils.randFloat(25, 140);
    const angle = Math.random() * Math.PI * 2;
    mesh.position.set(
      Math.cos(angle) * r,
      THREE.MathUtils.randFloatSpread(40),
      Math.sin(angle) * r
    );

    // Reducimos el rango de velocidades de órbita
    // Antes: de 1.8 (cerca) a 0.2 (lejos)
    // Ahora: de 0.8 (cerca) a 0.1 (lejos) - Ajusta estos valores según prefieras
    mesh.userData.orbitSpeed = THREE.MathUtils.mapLinear(r, 25, 140, 0.8, 0.1); // Adjusted speed range
    mesh.userData.radius     = 2;

    scene.add(mesh);
    asteroids.push(mesh);
  }
  return asteroids;
}

/* ---------- actualización cada frame ---------- */
export function updateAsteroids (asteroids, delta, envSpeedFactor) {
  asteroids.forEach(a => {
    // Mantener la influencia de envSpeedFactor, pero la base speed es menor ahora
    const speed = a.userData.orbitSpeed * envSpeedFactor * delta;
    a.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), speed);
    a.rotation.x += 0.3 * delta;
    a.rotation.y += 0.5 * delta;
  });
}