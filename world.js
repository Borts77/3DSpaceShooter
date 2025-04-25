// world.js
import * as THREE from 'three';

// Export fieldSize so main.js can use it for boundaries
export const fieldSize = 4000; // Tamaño del área cúbica para los puntos

export function createWorld() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000005); // Fondo oscuro

    // --- Iluminación ---
    // Puedes ajustar las intensidades y posiciones de estas luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 5.0); // Luz general suave
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 500, 800); // Luz puntual 1
    pointLight.position.set(50, 50, 50);
    scene.add(pointLight);

    const pointLight2 = new THREE.PointLight(0xffffff, 400, 700); // Luz puntual 2
    pointLight2.position.set(-50, -50, -50);
    scene.add(pointLight2);

    // Optional: Add a hemisphere light for softer, overall illumination
    const hemisphereLight = new THREE.HemisphereLight(0xaaaaaa, 0x000000, 1.5); // Luz de hemisferio
    scene.add(hemisphereLight);


    // --- Agujero Negro ---
    // Mantuvimos el agujero negro y el disco de acreción de tu código
    const blackHoleGeometry = new THREE.SphereGeometry(5, 32, 32);
    const blackHoleMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const blackHole = new THREE.Mesh(blackHoleGeometry, blackHoleMaterial);
    blackHole.position.set(0, 0, 0);
    scene.add(blackHole);

    // --- Disco de Acreción Blanco ---
    const diskGeometry = new THREE.RingGeometry(
        7, // Radio interno (mayor que el agujero negro)
        12, // Radio externo
        64 // Segmentos radiales
    );
    const diskMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide, // Visible por ambos lados
        transparent: true,      // Hacerlo un poco transparente
        opacity: 0.7
    });
    const accretionDisk = new THREE.Mesh(diskGeometry, diskMaterial);
    accretionDisk.position.set(0, 0, 0); // Centrado con el agujero negro
    accretionDisk.rotation.x = Math.PI / 2; // Rotar para que quede plano en XZ
    scene.add(accretionDisk);


    // --- Fondo de Puntos (Grid Estrellas) ---
    // Parámetros para la grid de puntos (ajusta estos valores para el tamaño del mundo
    // y la densidad de puntos para el rendimiento y la sensación de velocidad)
    const numPoints = 4000; // Número de puntos (menos que en la simulación para empezar)
    // const fieldSize = 4000; // Moved fieldSize declaration and export above

    const pointsGeometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const color = new THREE.Color(0xaaaaaa); // Color de los puntos

    for (let i = 0; i < numPoints; i++) {
        // Distribución aleatoria dentro de un cubo
        positions.push((Math.random() - 0.5) * fieldSize);
        positions.push((Math.random() - 0.5) * fieldSize);
        positions.push((Math.random() - 0.5) * fieldSize);
        colors.push(color.r, color.g, color.b);
    }

    pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    pointsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const pointsMaterial = new THREE.PointsMaterial({
        size: 1.5, // Tamaño de cada punto
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true // Hace que los puntos lejanos se vean más pequeños (clave para la sensación de velocidad)
    });

    // Usamos 'stars' como nombre de la variable para que main.js la pueda usar
    const stars = new THREE.Points(pointsGeometry, pointsMaterial);
    scene.add(stars);

    // Devolvemos todos los elementos creados que necesitamos referenciar en main.js
    return { scene, blackHole, stars, accretionDisk };
}