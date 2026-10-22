// Utilitários compartilhados do Pontinho UFABC

const Pontinho = {
  getCurrentUserId() {
    const id = localStorage.getItem('pontinho_user_id');
    return id ? parseInt(id, 10) : 2; // Padrão de fallback: 2 (Mariana)
  },

  setCurrentUserId(id) {
    localStorage.setItem('pontinho_user_id', id);
    document.cookie = `pontinho_user_id=${id}; path=/; max-age=31536000`;
  },

  async apiFetch(url, options = {}) {
    const headers = options.headers || {};
    const userId = this.getCurrentUserId();
    if (userId) {
      headers['X-User-Id'] = userId.toString();
    }
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (response.status === 401 && !window.location.pathname.includes('login.html')) {
      window.location.href = '/login.html';
      throw new Error('Sessão expirada. Faça login com seu e-mail institucional.');
    }

    if (!response.ok) {
      let errorMsg = 'Ocorreu um erro na requisição.';
      try {
        const errorData = await response.json();
        errorMsg = errorData.detail || errorData.message || errorMsg;
      } catch (e) {
        // Ignora erro de parse
      }
      throw new Error(errorMsg);
    }

    return response.json();
  },

  async requireAuth() {
    if (window.location.pathname.includes('login.html')) return;

    try {
      const data = await this.apiFetch('/api/auth/me');
      if (!data || !data.authenticated) {
        window.location.href = '/login.html';
      }
      return data.user;
    } catch (e) {
      window.location.href = '/login.html';
    }
  },

  async logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    localStorage.removeItem('pontinho_user_id');
    document.cookie = 'pontinho_user_id=; path=/; max-age=0';
    window.location.href = '/login.html';
  },

  showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-emerald-600 text-white' : type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white';
    toast.className = `${bgClass} px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 transition-all duration-300 transform translate-y-4 opacity-0 text-sm font-medium`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
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
        <option value="${u.id}" ${u.id === currentId ? 'selected' : ''}>
          ${u.name} (RA: ${u.ra || u.id})
        </option>
      `).join('');

      select.addEventListener('change', (e) => {
        this.setCurrentUserId(e.target.value);
        this.showToast(`Conectado como ${select.options[select.selectedIndex].text}`);
        setTimeout(() => window.location.reload(), 400);
      });
    } catch (e) {
      console.error('Falha ao carregar lista de usuários:', e);
    }
  }
};

window.Pontinho = Pontinho;
