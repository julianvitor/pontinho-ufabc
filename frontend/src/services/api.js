// Cliente HTTP e utilitários de comunicação para Pontinho (Preact SPA)
import { isVideoFile, convertVideoToGif } from './videoToGif.js';
import { isWebpOrGif, convertImageToWebp } from './imageToWebp.js';
export { isVideoFile, convertVideoToGif, isWebpOrGif, convertImageToWebp };

// Sistema leve de pub/sub para Toasts reativos no Preact
const toastListeners = new Set();

export function onToast(listener) {
  toastListeners.add(listener);
  return () => toastListeners.delete(listener);
}

export function showToast(message, type = 'info') {
  toastListeners.forEach((fn) => {
    try {
      fn(message, type);
    } catch (_) {}
  });
}

export function getCurrentUserId() {
  const id = localStorage.getItem('pontinho_user_id');
  return id ? parseInt(id, 10) : null;
}

export function getSessionToken() {
  return localStorage.getItem('pontinho_session_token') || null;
}

export function setCurrentUserId(id, token = null) {
  if (id === null || id === undefined) {
    localStorage.removeItem('pontinho_user_id');
    localStorage.removeItem('pontinho_session_token');
    document.cookie = 'pontinho_user_id=; path=/; max-age=0';
    document.cookie = 'pontinho_session=; path=/; max-age=0';
  } else {
    localStorage.setItem('pontinho_user_id', id.toString());
    if (token) {
      localStorage.setItem('pontinho_session_token', token);
    }
    document.cookie = `pontinho_user_id=${id}; path=/; max-age=31536000; SameSite=Lax`;
  }
}

export function getApiBase() {
  if (typeof window !== 'undefined') {
    if (window.PONTINHO_API_URL) {
      return window.PONTINHO_API_URL;
    }
    // Variável de ambiente do Vite para produção/build
    if (import.meta.env && import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
    // No modo dev do Vite com proxy, usa relativo
    if (window.location && (window.location.port === '3000' || window.location.port === '3001' || window.location.port === '5173')) {
      return '';
    }
    // Fallback dinâmico para domínios em nuvem sem porta explícita (deriva api-pontinho a partir de dev.pontinho ou pontinho)
    if (window.location && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      const host = window.location.hostname;
      if (host.includes('pontinho.')) {
        return `${window.location.protocol}//${host.replace(/^(dev\.)?pontinho\./, 'api-pontinho.')}`;
      }
    }
    if (window.location && window.location.port && window.location.port !== '8000') {
      return `${window.location.protocol}//${window.location.hostname}:8000`;
    }
  }
  return '';
}

export function resolveMediaUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  let finalUrl = url;
  if (url.startsWith('/uploads/') || url.startsWith('/api/')) {
    const base = getApiBase();
    finalUrl = base ? `${base}${url}` : url;
  }
  if (finalUrl.includes('/api/media/private/') && !finalUrl.includes('token=')) {
    const token = getSessionToken();
    if (token) {
      const sep = finalUrl.includes('?') ? '&' : '?';
      finalUrl = `${finalUrl}${sep}token=${encodeURIComponent(token)}`;
    }
  }
  return finalUrl;
}

/**
 * Upload seguro de qualquer mídia (fotos de perfil, bio secreta, eventos, propagandas)
 * com conversão automática no navegador: vídeos para GIF animado e imagens para WebP.
 * O backend aceita exclusivamente arquivos já convertidos em WebP ou GIFs animados.
 */
export async function uploadPhoto(file, isPrivate = false, onProgress = null) {
  if (!file) throw new Error('Selecione uma foto ou vídeo para enviar.');

  const report = (pct, stage) => {
    if (typeof onProgress === 'function') {
      try { onProgress(pct, stage); } catch (_) {}
    }
  };

  let fileToUpload = file;
  const isVid = isVideoFile(file);
  const isAlreadyOptimized = isWebpOrGif(file);

  let startUploadPct = 40;

  if (isVid) {
    report(5, 'Convertendo vídeo para GIF no navegador...');
    showToast('Convertendo vídeo para GIF no navegador...', 'info');
    fileToUpload = await convertVideoToGif(file, (p, text) => {
      const overall = Math.min(50, Math.round((p / 100) * 50));
      report(overall, text || `Processando vídeo: ${p}%`);
    });
    startUploadPct = 50;
  } else if (!isAlreadyOptimized) {
    report(10, 'Otimizando imagem para WebP...');
    showToast('Convertendo imagem para WebP no navegador...', 'info');
    fileToUpload = await convertImageToWebp(file, 0.92, (p, text) => {
      const overall = Math.min(45, Math.round((p / 100) * 45));
      report(overall, text || `Otimizando imagem: ${p}%`);
    });
    startUploadPct = 45;
  } else {
    report(20, 'Preparando arquivo para upload...');
    startUploadPct = 20;
  }

  if (fileToUpload.size > 40 * 1024 * 1024) {
    throw new Error('O arquivo selecionado ultrapassa o limite de 40 MB.');
  }

  report(startUploadPct, 'Iniciando envio para o servidor...');

  const formData = new FormData();
  formData.append('file', fileToUpload);

  const headers = {};
  const userId = getCurrentUserId();
  const token = getSessionToken();
  if (userId) {
    headers['X-User-Id'] = userId.toString();
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Session-Token'] = token;
  }

  const query = isPrivate ? '?is_private=true' : '';
  const targetUrl = `${getApiBase()}/api/upload/photo${query}`;

  // Se o navegador suporta XMLHttpRequest com upload progress (fora de testes JSDOM), usa para rastreio exato de bytes
  const isJsdom = typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('jsdom');
  if (!isJsdom && typeof XMLHttpRequest !== 'undefined' && typeof window !== 'undefined' && window.XMLHttpRequest) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', targetUrl);
      xhr.withCredentials = true;

      for (const [k, v] of Object.entries(headers)) {
        xhr.setRequestHeader(k, v);
      }

      if (xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            const fraction = e.loaded / e.total;
            const currentTotal = Math.min(98, Math.round(startUploadPct + fraction * (98 - startUploadPct)));
            const uploadOnlyPct = Math.round(fraction * 100);
            report(currentTotal, `Enviando para o servidor: ${uploadOnlyPct}%`);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            report(100, 'Upload concluído com sucesso!');
            resolve(res);
          } catch (_) {
            report(100, 'Upload concluído com sucesso!');
            resolve({});
          }
        } else {
          let errorMsg = 'Erro ao enviar imagem.';
          try {
            const err = JSON.parse(xhr.responseText);
            errorMsg = err.detail || errorMsg;
          } catch (_) {}
          reject(new Error(errorMsg));
        }
      };

      xhr.onerror = () => reject(new Error('Erro de conexão ao enviar imagem.'));
      xhr.send(formData);
    });
  }

  // Fallback seguro usando fetch (ex: ambiente de testes Vitest/Node)
  report(Math.min(90, startUploadPct + 30), 'Enviando para o servidor...');
  const response = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: formData,
    credentials: 'include'
  });

  if (!response.ok) {
    let errorMsg = 'Erro ao enviar imagem.';
    try {
      const err = await response.json();
      errorMsg = err.detail || errorMsg;
    } catch (_) {}
    throw new Error(errorMsg);
  }

  report(100, 'Upload concluído com sucesso!');
  return await response.json();
}

export const uploadMedia = uploadPhoto;

export async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const userId = getCurrentUserId();
  const token = getSessionToken();
  if (userId) {
    headers['X-User-Id'] = userId.toString();
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Session-Token'] = token;
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const targetUrl = url.startsWith('http') ? url : `${getApiBase()}${url}`;

  try {
    const response = await fetch(targetUrl, {
      ...options,
      headers,
      credentials: 'include'
    });

    if (response.status === 401) {
      setCurrentUserId(null);
      return { authenticated: false };
    }

    if (!response.ok) {
      let errorMsg = 'Ocorreu um erro na requisição.';
      try {
        const errorData = await response.json();
        errorMsg = errorData.detail || errorData.message || errorMsg;
      } catch (_) {}
      throw new Error(errorMsg);
    }

    return await response.json();
  } catch (err) {
    console.error(`[Pontinho API Error] ${url}:`, err);
    throw err;
  }
}

export async function getMe() {
  const userId = getCurrentUserId();
  if (!userId) return null;
  try {
    const data = await apiFetch('/api/auth/me');
    if (data && data.authenticated && data.user) {
      return data.user;
    }
    return null;
  } catch (_) {
    return null;
  }
}

export async function checkAuthStatus() {
  try {
    const data = await apiFetch('/api/auth/me');
    if (data && data.authenticated && data.user) {
      const uid = data.user_id || data.user.id || data.user.user_id;
      if (uid) {
        localStorage.setItem('pontinho_user_id', String(uid));
      }
      return data.user;
    }
    return null;
  } catch (_) {
    return null;
  }
}

export async function logout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (_) {}
  setCurrentUserId(null);
}

export function extractYouTubeId(query) {
  if (!query) return null;
  const q = query.trim();
  const ytMatch = q.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
  if (ytMatch && ytMatch[1]) return ytMatch[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(q)) return q;
  return null;
}

export async function resolveYouTubeId(query) {
  if (!query) return null;
  const directId = extractYouTubeId(query);
  if (directId) return directId;

  try {
    const data = await apiFetch('/api/youtube/search?q=' + encodeURIComponent(query.trim()));
    return data && data.videoId ? data.videoId : null;
  } catch (_) {
    return null;
  }
}
