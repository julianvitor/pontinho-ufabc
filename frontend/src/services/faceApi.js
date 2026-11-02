/**
 * Carregador sob demanda (lazy loading) para a biblioteca face-api.js.
 * Evita carregar 330KB de JavaScript bloqueador de renderização no carregamento inicial da página.
 */
let faceApiPromise = null;

export function loadFaceApiScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Ambiente sem suporte a window.'));
  }

  if (window.faceapi) {
    return Promise.resolve(window.faceapi);
  }

  if (!faceApiPromise) {
    faceApiPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[src*="face-api.js"]');
      if (existingScript) {
        if (window.faceapi) {
          resolve(window.faceapi);
          return;
        }
        existingScript.addEventListener('load', () => resolve(window.faceapi));
        existingScript.addEventListener('error', () => reject(new Error('Erro ao carregar face-api.js')));
        return;
      }

      const script = document.createElement('script');
      script.src = '/js/face-api.js';
      script.async = true;
      script.onload = () => {
        if (window.faceapi) {
          resolve(window.faceapi);
        } else {
          reject(new Error('Biblioteca faceapi não encontrada após carregamento do script.'));
        }
      };
      script.onerror = () => {
        faceApiPromise = null;
        reject(new Error('Falha ao carregar o script biométrico /js/face-api.js'));
      };
      document.head.appendChild(script);
    });
  }

  return faceApiPromise;
}
