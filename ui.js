// ui.js

export function setupMenu(startGameCallback) {
    const menu = document.getElementById('main-menu');
    const startButton = document.getElementById('start-button');

    if (!menu || !startButton) {
        console.error("Menu elements not found!");
        return;
    }

    startButton.addEventListener('click', () => {
        menu.classList.add('hidden'); // Oculta el menú
        startGameCallback();        // Llama a la función para iniciar el juego
    });
}

export function showMenu() {
     const menu = document.getElementById('main-menu');
     if (menu) {
        menu.classList.remove('hidden');
     }
}

export function hideMenu() {
      const menu = document.getElementById('main-menu');
     if (menu) {
        menu.classList.add('hidden');
     }
}