// Setup de testes unitários e de componentes para Preact
import { afterEach, beforeEach, vi } from 'vitest';

// URL base para jsdom resolver URLs relativas
if (typeof window !== 'undefined' && (!window.location.origin || window.location.origin === 'null')) {
  try {
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost:3000'),
      writable: true,
      configurable: true
    });
  } catch (_) {}
}

// Mock padrão para fetch evitando exceções de URLs relativas não tratadas
const defaultMockResponse = {
  ok: true,
  status: 200,
  json: async () => ([]),
  text: async () => '',
};

beforeEach(() => {
  if (typeof globalThis.fetch === 'undefined' || !globalThis.fetch._isMockFunction) {
    globalThis.fetch = vi.fn().mockResolvedValue(defaultMockResponse);
  }
});

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

