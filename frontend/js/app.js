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

  // Resolve URLs de mídia (seja URL externa completa ou arquivo em /uploads /api/media)
  resolveMediaUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }
    let finalUrl = url;
    if (url.startsWith('/uploads/') || url.startsWith('/api/')) {
      const base = this.getApiBase();
      finalUrl = base ? `${base}${url}` : url;
    }
    if (finalUrl.includes('/api/media/private/') && !finalUrl.includes('token=')) {
      const token = this.getSessionToken();
      if (token) {
        const sep = finalUrl.includes('?') ? '&' : '?';
        finalUrl = `${finalUrl}${sep}token=${encodeURIComponent(token)}`;
      }
    }
    return finalUrl;
  },

  // Upload seguro de foto para a API com streaming e compressão WebP
  async uploadPhoto(file, isPrivate = false) {
    if (!file) throw new Error('Selecione uma imagem para enviar.');
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('A imagem selecionada ultrapassa o limite de 10 MB.');
    }

    const formData = new FormData();
    formData.append('file', file);

    const headers = {};
    const userId = this.getCurrentUserId();
    const token = this.getSessionToken();
    if (userId) {
      headers['X-User-Id'] = userId.toString();
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Session-Token'] = token;
    }

    const query = isPrivate ? '?is_private=true' : '';
    const targetUrl = `${this.getApiBase()}/api/upload/photo${query}`;
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

  // Obtém dados do usuário autenticado sem redirecionamento forçado
  async getMe() {
    const userId = this.getCurrentUserId();
    if (!userId) return null;

    try {
      const data = await this.apiFetch('/api/auth/me');
      if (data && data.authenticated && data.user) {
        return data.user;
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  // Validação de autenticação
  async requireAuth() {
    const isLoginPage = window.location.pathname.includes('login.html');
    const isIndexPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/') || window.location.pathname === '';
    const isEventsPage = window.location.pathname.includes('events.html');
    const isTermsPage = window.location.pathname.includes('terms.html');

    const userId = this.getCurrentUserId();
    if (!userId) {
      if (!isLoginPage && !isIndexPage && !isEventsPage && !isTermsPage) {
        window.location.href = './login.html';
      }
      return null;
    }

    try {
      const data = await this.apiFetch('/api/auth/me');
      if (!data || !data.authenticated) {
        this.setCurrentUserId(null);
        if (!isLoginPage && !isIndexPage && !isEventsPage && !isTermsPage) {
          window.location.href = './login.html';
        }
        return null;
      }
      return data.user;
    } catch (e) {
      if (!isLoginPage && !isIndexPage && !isEventsPage && !isTermsPage) {
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

      this.showToast(resp.message || 'Denúncia enviada.', 'success');
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
    if (!confirm(`Bloquear ${targetUserName || 'este perfil'}?`)) {
      return;
    }

    try {
      const resp = await this.apiFetch(`/api/users/${targetUserId}/block`, {
        method: 'POST'
      });
      this.showToast(resp.message || 'Usuário bloqueado.', 'success');
      if (typeof onComplete === 'function') {
        onComplete();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // Central de Ajuda, Descrição do App e Canal de Ouvidoria / Denúncias Pública
  async openHelpModal() {
    let modal = document.getElementById('global-help-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'global-help-modal';
      modal.className = 'fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 transition-opacity';
      
      // Fecha ao clicar fora do cartão
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          Pontinho.closeHelpModal();
        }
      });

      // Fecha ao pressionar ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
          Pontinho.closeHelpModal();
        }
      });

      document.body.appendChild(modal);
    }

    // Se o HTML do modal ainda não foi carregado, busca do arquivo próprio help-modal.html
    if (!modal.dataset.loaded) {
      modal.innerHTML = `
        <div class="flex items-center justify-center p-8 bg-slate-900 border border-slate-700/80 rounded-3xl text-emerald-400 gap-3 shadow-2xl">
          <svg class="animate-spin h-5 w-5 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-xs font-semibold text-slate-300">Carregando Central de Ajuda...</span>
        </div>
      `;
      modal.classList.remove('hidden');

      try {
        const response = await fetch('./help-modal.html');
        if (!response.ok) {
          throw new Error(`Erro ${response.status} ao carregar modal`);
        }
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const content = doc.getElementById('global-help-modal-content');

        if (content) {
          modal.innerHTML = '';
          modal.appendChild(document.importNode(content, true));
          modal.dataset.loaded = 'true';
        } else {
          modal.innerHTML = html;
          modal.dataset.loaded = 'true';
        }
      } catch (err) {
        console.error('Falha ao carregar help-modal.html:', err);
        this.showToast('Não foi possível carregar a Central de Ajuda.', 'error');
        modal.classList.add('hidden');
        return;
      }
    }

    modal.classList.remove('hidden');
  },

  closeHelpModal() {
    const modal = document.getElementById('global-help-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  },

  async _submitComplaint(e) {
    e.preventDefault();
    const complaint_type = document.getElementById('complaint-type').value;
    const target_description = document.getElementById('complaint-target').value;
    const details = document.getElementById('complaint-details').value;
    const reporter_contact = document.getElementById('complaint-contact').value;
    const reporter_name = document.getElementById('complaint-reporter-name').value;

    const btn = document.getElementById('btn-submit-complaint');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Enviando...';
    }

    try {
      const response = await fetch(`${this.getApiBase()}/api/help/complaint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          complaint_type,
          target_description,
          details,
          reporter_contact,
          reporter_name
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Erro ao registrar reclamação.');
      }

      this.showToast(data.message || 'Denúncia registrada com sucesso!', 'success');
      const form = document.getElementById('public-complaint-form');
      if (form) form.reset();
      this.closeHelpModal();
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>🛡️</span> <span>Enviar Reclamação</span>';
      }
    }
  },

  // ==========================================
  // GERENCIAMENTO DE TEMAS (PADRÃO UFABC / ORGULHO LGBT+)
  // ==========================================
  getTheme() {
    return localStorage.getItem('pontinho_theme') || 'default';
  },

  applyTheme(theme) {
    const isPride = theme === 'pride';
    const root = document.documentElement;
    const body = document.body;

    if (isPride) {
      root.classList.add('theme-pride');
      root.setAttribute('data-theme', 'pride');
      if (body) {
        body.classList.add('theme-pride');
        body.setAttribute('data-theme', 'pride');
      }
    } else {
      root.classList.remove('theme-pride');
      root.setAttribute('data-theme', 'default');
      if (body) {
        body.classList.remove('theme-pride');
        body.setAttribute('data-theme', 'default');
      }
    }

    // Atualiza favicons dinamicamente
    const faviconHref = isPride ? './favicon-pride.svg' : './favicon.svg';
    const iconLinks = document.querySelectorAll("link[rel*='icon']");
    iconLinks.forEach(link => {
      link.href = faviconHref;
    });

    // Atualiza botão de like dos cards
    const likeBtn = document.querySelector('button[onclick*="handleSwipe(\'like\')"]');
    if (likeBtn) {
      likeBtn.innerHTML = isPride ? '💖' : '💚';
      likeBtn.title = isPride ? 'Curtir (Orgulho LGBT+)' : 'Curtir';
    }

    // Atualiza indicadores e textos nos seletores de tema da interface
    document.querySelectorAll('.theme-active-icon').forEach(el => {
      el.textContent = isPride ? '🏳️‍🌈' : '🌿';
    });
    document.querySelectorAll('.theme-active-name').forEach(el => {
      el.textContent = isPride ? 'Pride' : 'UFABC';
    });
    document.querySelectorAll('.theme-pride-badge').forEach(el => {
      if (isPride) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });

    // Se o modal de temas estiver aberto, atualiza cards ativos
    const cardUfabc = document.getElementById('theme-card-default');
    const cardPride = document.getElementById('theme-card-pride');
    if (cardUfabc && cardPride) {
      if (isPride) {
        cardUfabc.classList.remove('active');
        cardPride.classList.add('active', 'active-pride');
        const checkUfabc = document.getElementById('theme-check-default');
        const checkPride = document.getElementById('theme-check-pride');
        if (checkUfabc) checkUfabc.classList.add('hidden');
        if (checkPride) checkPride.classList.remove('hidden');
      } else {
        cardPride.classList.remove('active', 'active-pride');
        cardUfabc.classList.add('active');
        const checkUfabc = document.getElementById('theme-check-default');
        const checkPride = document.getElementById('theme-check-pride');
        if (checkUfabc) checkUfabc.classList.remove('hidden');
        if (checkPride) checkPride.classList.add('hidden');
      }
    }
  },

  setTheme(theme, notify = true) {
    if (theme !== 'pride' && theme !== 'default') theme = 'default';
    localStorage.setItem('pontinho_theme', theme);
    this.applyTheme(theme);
    if (notify) {
      if (theme === 'pride') {
        this.showToast('Tema Dark Pride ativado! 🏳️‍🌈✨', 'success');
      } else {
        this.showToast('Tema UFABC Esmeralda ativado! 🌿', 'success');
      }
    }
  },

  toggleTheme() {
    const current = this.getTheme();
    const next = current === 'pride' ? 'default' : 'pride';
    this.setTheme(next, true);
  },

  initTheme() {
    const saved = this.getTheme();
    this.applyTheme(saved);
  },

  openThemeModal() {
    let modal = document.getElementById('global-theme-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'global-theme-modal';
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all';
      document.body.appendChild(modal);
    }

    const currentTheme = this.getTheme();
    const isPride = currentTheme === 'pride';

    modal.innerHTML = `
      <div class="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden animate-fade-in" onclick="event.stopPropagation()">
        <!-- Luz de fundo do modal -->
        <div class="absolute -top-10 -right-10 w-40 h-40 ${isPride ? 'bg-purple-600/15' : 'bg-emerald-500/20'} rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-10 -left-10 w-40 h-40 ${isPride ? 'bg-indigo-600/15' : 'bg-teal-500/20'} rounded-full blur-3xl pointer-events-none"></div>

        <div class="flex items-center justify-between pb-4 border-b border-slate-800 relative z-10">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-lg border border-slate-700">
              🎨
            </div>
            <div>
              <h3 class="font-black text-base text-white">Personalizar Tema</h3>
              <p class="text-xs text-slate-400">Escolha a identidade visual do Pontinho</p>
            </div>
          </div>
          <button type="button" onclick="Pontinho.closeThemeModal()" class="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm transition">
            ✕
          </button>
        </div>

        <div class="py-4 space-y-3 relative z-10">
          <!-- Opção 1: Tema UFABC (Padrão) -->
          <div id="theme-card-default" onclick="Pontinho.setTheme('default'); Pontinho.closeThemeModal();"
            class="theme-option-card flex items-center justify-between p-3.5 rounded-2xl border ${!isPride ? 'active border-emerald-500' : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'}">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-xl shadow-xs">
                🌿
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm text-white">Verde UFABC</span>
                  <span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800/40">Padrão</span>
                </div>
                <p class="text-xs text-slate-400 mt-0.5">Tons de verde esmeralda e teal originais da universidade</p>
                <div class="flex items-center gap-1.5 mt-2">
                  <span class="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white/20" title="#10b981"></span>
                  <span class="w-3.5 h-3.5 rounded-full bg-teal-600 border border-white/20" title="#0d9488"></span>
                  <span class="w-3.5 h-3.5 rounded-full bg-emerald-900 border border-white/20" title="#064e3b"></span>
                  <span class="w-3.5 h-3.5 rounded-full bg-[#090d16] border border-white/20" title="#090d16"></span>
                </div>
              </div>
            </div>
            <div id="theme-check-default" class="${!isPride ? '' : 'hidden'} text-emerald-400 text-lg font-black ml-2">
              ✓
            </div>
          </div>

          <!-- Opção 2: Tema Orgulho LGBT+ (Pride) -->
          <div id="theme-card-pride" onclick="Pontinho.setTheme('pride'); Pontinho.closeThemeModal();"
            class="theme-option-card flex items-center justify-between p-3.5 rounded-2xl border ${isPride ? 'active active-pride border-purple-500' : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'}">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500/20 via-pink-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center text-xl shadow-xs">
                🏳️‍🌈
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm text-white">Orgulho LGBT+</span>
                  <span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-800/40">Dark Pride</span>
                </div>
                <p class="text-xs text-slate-400 mt-0.5">Base dark profunda, gradientes cósmicos e toques holográficos</p>
                <div class="flex items-center gap-1.5 mt-2">
                  <span class="w-3.5 h-3.5 rounded-full bg-[#ff3366] border border-white/20" title="Vermelho"></span>
                  <span class="w-3.5 h-3.5 rounded-full bg-[#ff7a18] border border-white/20" title="Laranja"></span>
                  <span class="w-3.5 h-3.5 rounded-full bg-[#ffd200] border border-white/20" title="Amarelo"></span>
                  <span class="w-3.5 h-3.5 rounded-full bg-[#10b981] border border-white/20" title="Verde"></span>
                  <span class="w-3.5 h-3.5 rounded-full bg-[#06b6d4] border border-white/20" title="Azul"></span>
                  <span class="w-3.5 h-3.5 rounded-full bg-[#8b5cf6] border border-white/20" title="Violeta"></span>
                </div>
              </div>
            </div>
            <div id="theme-check-pride" class="${isPride ? '' : 'hidden'} text-purple-400 text-lg font-black ml-2">
              ✓
            </div>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 relative z-10">
          <span>Sua preferência fica salva no navegador</span>
          <button type="button" onclick="Pontinho.closeThemeModal()" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition">
            Fechar
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.onclick = (e) => {
      if (e.target === modal) Pontinho.closeThemeModal();
    };
  },

  closeThemeModal() {
    const modal = document.getElementById('global-theme-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }
};

// Inicialização automática do tema ao carregar
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Pontinho.initTheme());
  } else {
    Pontinho.initTheme();
  }
}

window.Pontinho = Pontinho;

