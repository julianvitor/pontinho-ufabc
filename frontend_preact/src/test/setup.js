// Setup de testes unitários e de componentes para Preact
import { afterEach } from 'vitest';

// Limpa o localStorage e DOM após cada teste
afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

// Polyfill para matchMedia se não existir no jsdom
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// Polyfill para scrollIntoView no jsdom
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}
