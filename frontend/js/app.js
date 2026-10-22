// Utilitários de comunicação e sessão do Pontinho (Consumo 100% via API Backend)

const Pontinho = {
  getCurrentUserId() {
    const id = localStorage.getItem('pontinho_user_id');
    return id ? parseInt(id, 10) : null;
  },

  getSessionToken() {
    return localStorage.getItem('pontinho_session_token') || null;
  },

  setCurrentUserId(id, token = null) {
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
  },

  // Retorna a URL base da API quando o frontend for servido em porta desacoplada (ex: 3000 com live reload)
  getApiBase() {
    if (window.PONTINHO_API_URL) {
      return window.PONTINHO_API_URL;
    }
    if (window.location.port && window.location.port !== '8000') {
      return `${window.location.protocol}//${window.location.hostname}:8000`;
    }
    return '';
  },

  // Resolve URLs de mídia (seja URL externa completa ou arquivo em /uploads)
  resolveMediaUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }
    if (url.startsWith('/uploads/')) {
      const base = this.getApiBase();
      return base ? `${base}${url}` : url;
    }
    return url;
  },

  // Upload seguro de foto para a API com streaming e compressão WebP
  async uploadPhoto(file) {
    if (!file) throw new Error('Selecione uma imagem para enviar.');
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('A imagem selecionada ultrapassa o limite de 10 MB.');
    }

    const formData = new FormData();
    formData.append('file', file);

    const headers = {};
    const userId = this.getCurrentUserId();
    if (userId) {
      headers['X-User-Id'] = userId.toString();
    }

    const targetUrl = `${this.getApiBase()}/api/upload/photo`;
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
      } catch (e) {}
      throw new Error(errorMsg);
    }

    return await response.json();
  },

  // Realiza requisição para a API FastAPI no backend
  async apiFetch(url, options = {}) {
    const headers = options.headers || {};
    const userId = this.getCurrentUserId();
    const token = this.getSessionToken();
    if (userId) {
      headers['X-User-Id'] = userId.toString();
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Session-Token'] = token;
    }
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';

    const targetUrl = url.startsWith('http') ? url : `${this.getApiBase()}${url}`;

    try {
      const response = await fetch(targetUrl, {
        ...options,
        headers,
        credentials: 'include'
      });

      if (response.status === 401 && !window.location.pathname.includes('login.html')) {
        this.setCurrentUserId(null);
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '') {
          return { authenticated: false };
        }
        window.location.href = './login.html';
        throw new Error('Sessão expirada. Faça login com seu e-mail institucional.');
      }

      if (!response.ok) {
        let errorMsg = 'Ocorreu um erro na requisição.';
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || errorData.message || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      return await response.json();
    } catch (err) {
      console.error(`[Pontinho API Error] ${url}:`, err);
      throw err;
    }
  },

  // Validação de autenticação
  async requireAuth() {
    const isLoginPage = window.location.pathname.includes('login.html');
    const isIndexPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/') || window.location.pathname === '';

    const userId = this.getCurrentUserId();
    if (!userId) {
      if (!isLoginPage && !isIndexPage) {
        window.location.href = './login.html';
      }
      return null;
    }

    try {
      const data = await this.apiFetch('/api/auth/me');
      if (!data || !data.authenticated) {
        this.setCurrentUserId(null);
        if (!isLoginPage && !isIndexPage) {
          window.location.href = './login.html';
        }
        return null;
      }
      return data.user;
    } catch (e) {
      if (!isLoginPage && !isIndexPage) {
        window.location.href = './login.html';
      }
      return null;
    }
  },

  // Login rápido como conta de teste demo
  loginAsDemo(userId, reload = true) {
    this.setCurrentUserId(userId);
    this.showToast('Conectando como conta de demonstração...', 'success');
    if (reload) {
      setTimeout(() => {
        window.location.href = './index.html';
      }, 300);
    }
  },

  async logout() {
    try {
      await this.apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    this.setCurrentUserId(null);
    window.location.href = './index.html';
  },

  // Extrai ID direto de URL ou código do YouTube
  extractYouTubeId(query) {
    if (!query) return null;
    const q = query.trim();
    const ytMatch = q.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/);
    if (ytMatch && ytMatch[1]) return ytMatch[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(q)) return q;
    return null;
  },

  // Resolução dinâmica de músicas via backend API
  async resolveYouTubeId(query) {
    if (!query) return null;
    const directId = this.extractYouTubeId(query);
    if (directId) return directId;

    try {
      const data = await this.apiFetch('/api/youtube/search?q=' + encodeURIComponent(query.trim()));
      return data && data.videoId ? data.videoId : null;
    } catch (e) {
      console.warn('Erro ao resolver áudio no backend:', e);
      return null;
    }
  },

  // Compatibilidade com chamadas existentes
  resolveLocalYouTubeId(query) {
    return this.extractYouTubeId(query);
  },

  showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colorClasses = type === 'success' 
      ? 'bg-slate-900/95 text-emerald-300 border-emerald-500/40 shadow-emerald-950/60' 
      : type === 'error' 
        ? 'bg-slate-900/95 text-rose-300 border-rose-500/40 shadow-rose-950/60' 
        : 'bg-slate-900/95 text-teal-300 border-teal-500/40 shadow-teal-950/60';
        
    toast.className = `${colorClasses} backdrop-blur-md px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 transition-all duration-300 transform translate-y-4 opacity-0 text-xs sm:text-sm font-semibold pointer-events-auto border`;
    toast.innerHTML = `
      <span class="text-base font-black">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span class="flex-1">${message}</span>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-4', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  async initNavbarUserSwitcher(selector = '#user-switcher-select') {
    const select = document.querySelector(selector);
    if (!select) return;

    try {
      const users = await this.apiFetch('/api/users/list');
      const currentId = this.getCurrentUserId();

      select.innerHTML = users.map(u => `
        <option value="${u.id}" class="bg-slate-900 text-slate-100" ${u.id === currentId ? 'selected' : ''}>
          ${u.name} (${u.ra || u.email})
        </option>
      `).join('');

      select.addEventListener('change', (e) => {
        this.setCurrentUserId(parseInt(e.target.value, 10));
        this.showToast(`Perfil alternado para ${select.options[select.selectedIndex].text}`);
        setTimeout(() => window.location.reload(), 400);
      });
    } catch (e) {
      console.error('Falha ao carregar lista de usuários:', e);
    }
  },

  async updateUnreadBadges() {
    const userId = this.getCurrentUserId();
    if (!userId) return;

    try {
      const data = await this.apiFetch('/api/matches/unread-count');
      const count = (data && data.total) || 0;

      const badgeDesktop = document.getElementById('nav-badge-desktop');
      const badgeMobile = document.getElementById('nav-badge-mobile');

      if (badgeDesktop) {
        if (count > 0) {
          badgeDesktop.textContent = count > 99 ? '99+' : count;
          badgeDesktop.classList.remove('hidden');
        } else {
          badgeDesktop.classList.add('hidden');
        }
      }

      if (badgeMobile) {
        if (count > 0) {
          badgeMobile.textContent = count > 99 ? '99+' : count;
          badgeMobile.classList.remove('hidden');
        } else {
          badgeMobile.classList.add('hidden');
        }
      }
    } catch (e) {
      // Ignora erro silenciosamente
    }
  },

  startBadgePolling(intervalMs = 12000) {
    this.updateUnreadBadges();
    if (window._pontinhoBadgeInterval) clearInterval(window._pontinhoBadgeInterval);
    window._pontinhoBadgeInterval = setInterval(() => this.updateUnreadBadges(), intervalMs);
  },

  openReportModal(targetUserId, targetUserName, onComplete = null) {
    let modal = document.getElementById('global-report-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'global-report-modal';
      modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-opacity';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="bg-slate-900 border border-slate-700/80 w-full max-w-md rounded-3xl p-6 shadow-2xl text-slate-100 space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div class="flex items-center gap-2 text-rose-400 font-bold text-base">
            <span>⚠️</span>
            <span>Denunciar e Bloquear</span>
          </div>
          <button onclick="document.getElementById('global-report-modal').classList.add('hidden')" class="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold">✕</button>
        </div>

        <p class="text-xs text-slate-300">
          Você está denunciando o perfil de <strong class="text-white">${targetUserName || 'Usuário'}</strong>. Nossa moderação analisa cada caso com seriedade e sigilo.
        </p>

        <form id="global-report-form" onsubmit="Pontinho._submitReport(event, ${targetUserId})" class="space-y-3.5">
          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">Motivo da denúncia</label>
            <select id="report-reason" required class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500">
              <option value="">Selecione um motivo...</option>
              <option value="Perfil Falso / Fake">Perfil Falso / Fake</option>
              <option value="Comportamento Ofensivo ou Assédio">Comportamento Ofensivo ou Assédio</option>
              <option value="Conteúdo Impróprio / Explícito não consentido">Conteúdo Impróprio / Explícito não consentido</option>
              <option value="Spam / Comercial não solicitado">Spam / Comercial não solicitado</option>
              <option value="Golpe ou Extorsão">Golpe ou Extorsão</option>
              <option value="Menor de idade">Menor de idade</option>
              <option value="Outro motivo">Outro motivo</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">Detalhes adicionais (opcional)</label>
            <textarea id="report-details" rows="3" placeholder="Descreva brevemente o que aconteceu..." class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"></textarea>
          </div>

          <div class="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <input type="checkbox" id="report-block-check" checked class="w-4 h-4 rounded text-rose-500 focus:ring-rose-500 bg-slate-900 border-slate-700 cursor-pointer">
            <label for="report-block-check" class="text-xs text-slate-300 cursor-pointer">
              Bloquear este usuário imediatamente (ele não verá mais seu perfil nem conversas)
            </label>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button type="button" onclick="document.getElementById('global-report-modal').classList.add('hidden')" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition">
              Cancelar
            </button>
            <button type="submit" id="btn-submit-report" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-950/60 transition">
              Enviar Denúncia
            </button>
          </div>
        </form>
      </div>
    `;

    modal.classList.remove('hidden');
    window._onReportComplete = onComplete;
  },

  async _submitReport(e, targetUserId) {
    e.preventDefault();
    const reason = document.getElementById('report-reason').value;
    const details = document.getElementById('report-details').value;
    const block_user = document.getElementById('report-block-check').checked;

    const btn = document.getElementById('btn-submit-report');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
      const resp = await this.apiFetch(`/api/users/${targetUserId}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason, details, block_user })
      });

      this.showToast(resp.message || 'Denúncia enviada à moderação com sucesso!', 'success');
      document.getElementById('global-report-modal').classList.add('hidden');
      if (typeof window._onReportComplete === 'function') {
        window._onReportComplete();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enviar Denúncia';
    }
  },

  async blockUser(targetUserId, targetUserName, onComplete = null) {
    if (!confirm(`Deseja realmente bloquear ${targetUserName || 'este usuário'}? Vocês não verão mais os perfis um do outro.`)) {
      return;
    }

    try {
      const resp = await this.apiFetch(`/api/users/${targetUserId}/block`, {
        method: 'POST'
      });
      this.showToast(resp.message || 'Usuário bloqueado com sucesso.', 'success');
      if (typeof onComplete === 'function') {
        onComplete();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }
};

window.Pontinho = Pontinho;
