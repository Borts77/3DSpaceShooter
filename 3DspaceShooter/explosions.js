import * as THREE from 'three';

export function createExplosion (scene, position) {
  const geom = new THREE.SphereGeometry(0.5, 8, 8);
  const mat  = new THREE.MeshBasicMaterial({
    color: 0xff7733,
    transparent: true,
    opacity: 0.9
  });
  const sphere = new THREE.Mesh(geom, mat);

  sphere.position.copy(position);
  sphere.userData.life = 0.6;      // duración en segundos
  scene.add(sphere);
  return sphere;
}

export function updateExplosions (explosions, delta) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const e = explosions[i];
    e.userData.life -= delta;
    e.scale.multiplyScalar(1 + delta * 4);          // agrandarse
    e.material.opacity = e.userData.life / 0.6;     // desvanecer

    if (e.userData.life <= 0) {
      e.parent.remove(e);
      explosions.splice(i, 1);
    }
  }
}
