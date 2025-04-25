// bullets.js
import * as THREE from 'three';
// Importar getScaledShipSize de player.js si la necesitas para el offset de spawn
import { getScaledShipSize } from './player.js';


// *** Parámetros de las balas (ajustables, o podrías usar sliders si los reintroduces) ***
const BULLET_BASE_SPEED = 500; // Velocidad base de la bala (ajusta si 500 no es suficiente con boost)
const BULLET_LIFE_TIME = 2.5; // segundos antes de autodestruirse
const BULLET_SIZE = 1.1; // Tamaño por defecto de la bala (ajustado a 1.1 según tu solicitud)


// *** Geometría y Material global para eficiencia ***
const bulletGeometry = new THREE.BoxGeometry(1, 1, 1); // Usar BoxGeometry como en la simulación
const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Material rojo


// *** Función para crear y disparar una bala (Adaptada de nuestra simulación) ***
// Recibe la posición, dirección hacia adelante y velocidad actual de la nave
export function fireBullet (shipPosition, shipForwardDirection, shipVelocity) {

  const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);

  // *** Ajustar el tamaño de la bala ***
  bullet.scale.set(BULLET_SIZE, BULLET_SIZE, BULLET_SIZE);


  // Posicionar la bala ligeramente en frente del centro de la nave
  // Usar un offset basado en el tamaño escalado de la nave
  const scaledShip = getScaledShipSize(); // Obtener el tamaño escalado
  const spawnOffsetDistance = scaledShip.z * 0.6; // Ajusta si la bala sale dentro de la nave
  const bulletSpawnPosition = shipPosition.clone().add(shipForwardDirection.clone().multiplyScalar(spawnOffsetDistance));
  bullet.position.copy(bulletSpawnPosition);


  // *** Calcular la velocidad de la bala sumando la velocidad de la nave y su propia velocidad base ***
  const currentBulletSpeed = BULLET_BASE_SPEED; // Usamos la constante aquí, o podrías leer de un slider si existiera
  // La velocidad final de la bala es la velocidad actual de la nave + la propia velocidad de la bala en su dirección
  bullet.velocity = shipVelocity.clone().add(shipForwardDirection.clone().multiplyScalar(currentBulletSpeed));

  // No necesitamos almacenar dirección y velocidad base por separado si usamos bullet.velocity


  // Devolvemos la bala creada para que main.js la añada a la escena y al array
  return bullet;
}

// *** Función para actualizar las balas (Adaptada de nuestra simulación) ***
export function updateBullets (bullets, delta) {
  // Iteramos al revés para poder eliminar balas de forma segura
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];

    // *** Mover bala usando su velocidad calculada al disparar ***
    // La velocidad ya incluye la velocidad de la nave + la velocidad base de la bala en su dirección
    b.position.addScaledVector(b.velocity, delta);

    // *** Lógica de tiempo de vida de la bala ***
    // Si quieres eliminar balas después de un tiempo, usa esta lógica
     b.userData.life = (b.userData.life || BULLET_LIFE_TIME) - delta; // Inicializar life si no existe
     if (b.userData.life <= 0) {
       b.parent.remove(b);
       bullets.splice(i, 1);
     }
    // Si prefieres eliminarlas por distancia (como en nuestra simulación),
    // necesitarías pasar la posición de la cámara o un punto de referencia para calcular la distancia.
    // Por ahora, mantengamos la eliminación por tiempo de vida como base.

    // Eliminación por distancia (alternativa o adicional):
    // const distance = b.position.distanceTo(camera.position); // Necesitarías pasar la cámara aquí
    // const maxDistance = 5000; // Ajusta según el tamaño de tu mundo visible
    // if (distance > maxDistance) {
    //     b.parent.remove(b);
    //     bullets.splice(i, 1);
    // }

  }
}