import { useState, useEffect } from 'preact/hooks';
import { getCurrentUserId, logout } from '../services/api.js';
import { getStoredTheme, onThemeChange } from '../services/theme.js';
import { onBadgeCount } from '../services/notifications.js';

export function Navbar({ onOpenTheme, onOpenHelp }) {
  const [userId, setUserId] = useState(getCurrentUserId());
  const [theme, setTheme] = useState(getStoredTheme());
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsubTheme = onThemeChange(setTheme);
    const unsubBadge = onBadgeCount(setUnreadCount);
    const interval = setInterval(() => {
      setUserId(getCurrentUserId());
    }, 1000);

    return () => {
      unsubTheme();
      unsubBadge();
      clearInterval(interval);
    };
  }, []);

  const isPride = theme === 'pride';
  const isHalloween = theme === 'halloween';
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  async function handleLogout() {
    await logout();
    setUserId(null);
    window.location.href = '/';
  }

  return (
    <header class="bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-40 shadow-sm">
      <div class="max-w-5xl mx-auto px-4 h-[51px] flex items-center justify-between gap-4">
        {/* Marca */}
        <a href="/" class="flex items-center gap-1.5 group">
          <span class="font-black text-xl sm:text-2xl tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
            Pontinho
          </span>
          <span class="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 select-none">
            Beta
          </span>
          {isPride && (
            <span class="theme-pride-badge text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded-md bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white shadow-xs">
              PRIDE 🏳️‍🌈
            </span>
          )}
          {isHalloween && (
            <span class="theme-halloween-badge text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded-md bg-gradient-to-r from-orange-500 via-purple-600 to-amber-500 text-white shadow-xs border border-orange-500/40">
              HALLOWEEN 🎃
            </span>
          )}
        </a>

        {/* Navegação Desktop */}
        <nav id="navbar-nav-links" class="hidden md:flex items-center gap-1 sm:gap-2">
          <a
            href="/"
            class={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-sm transition ${
              currentPath === '/' || currentPath === '/index.html'
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30 shadow-xs'
                : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-900/60 font-medium'
            }`}
          >
            <span>🔥</span> <span class="hidden sm:inline">Swipes</span>
          </a>
          <a
            href="/events"
            class={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-sm transition ${
              currentPath.startsWith('/events')
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30 shadow-xs'
                : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-900/60 font-medium'
            }`}
          >
            <span>🎉</span> <span class="hidden sm:inline">Festas</span>
          </a>
          <a
            href="/matches"
            class={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-sm transition ${
              currentPath.startsWith('/matches')
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30 shadow-xs'
                : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-900/60 font-medium'
            }`}
          >
            <span>💬</span> <span class="hidden sm:inline">Conversas</span>
            {unreadCount > 0 && (
              <span
                id="nav-badge-desktop"
                class="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full min-w-[18px] text-center shadow-xs"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </a>
          <a
            href="/profile"
            class={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-sm transition ${
              currentPath.startsWith('/profile')
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30 shadow-xs'
                : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-900/60 font-medium'
            }`}
          >
            <span>👤</span> <span class="hidden sm:inline">Meu Perfil</span>
          </a>
        </nav>

        {/* Ações da Navbar */}
        <div class="flex items-center gap-1.5 sm:gap-2">
          {/* Seletor de Tema Visual */}
          <button
            type="button"
            onClick={onOpenTheme}
            class="theme-pill-btn px-2 sm:px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 rounded-xl border border-slate-700/70 transition flex items-center gap-1 shadow-xs"
            title="Escolher Tema Visual (UFABC / Pride / Halloween)"
          >
            <span class="theme-active-icon">
              {isHalloween ? '🎃' : isPride ? '🏳️‍🌈' : '🌿'}
            </span>{' '}
            <span class="hidden sm:inline font-bold theme-active-name">
              {isHalloween ? 'Halloween' : isPride ? 'Pride' : 'UFABC'}
            </span>
          </button>

          {/* Central de Ajuda */}
          <button
            type="button"
            onClick={onOpenHelp}
            class="px-2 sm:px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-950/50 hover:bg-emerald-900/60 rounded-xl border border-emerald-800/40 transition flex items-center gap-1.5"
            title="Central de Ajuda e Segurança"
          >
            <span>🛡️</span> <span class="hidden sm:inline">Ajuda</span>
          </button>

          {/* Usuário Conectado vs Desconectado */}
          {userId ? (
            <div id="navbar-user-box" class="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLogout}
                class="px-2.5 py-1 text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 rounded-xl border border-rose-800/40 transition"
                title="Sair da conta"
              >
                Sair
              </button>
            </div>
          ) : (
            <div id="navbar-auth-btn">
              <a
                href="/login"
                class="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition"
              >
                Entrar
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
