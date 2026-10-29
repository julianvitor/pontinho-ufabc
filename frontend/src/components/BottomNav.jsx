import { useState, useEffect } from 'preact/hooks';
import { onBadgeCount } from '../services/notifications.js';

export function BottomNav() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsub = onBadgeCount(setUnreadCount);
    return unsub;
  }, []);

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  return (
    <nav class="md:hidden fixed bottom-0 inset-x-0 bg-slate-950/90 backdrop-blur-md border-t border-slate-800/80 z-40 mobile-bottom-nav flex items-center justify-around py-2.5 shadow-lg">
      <a
        href="/"
        class={`flex flex-col items-center gap-1 font-bold text-[11px] transition ${
          currentPath === '/' || currentPath === '/index.html' ? 'text-emerald-400' : 'text-slate-400 hover:text-emerald-400'
        }`}
      >
        <span class="text-xl">🔥</span>
        <span>Swipes</span>
      </a>

      <a
        href="/events"
        class={`flex flex-col items-center gap-1 font-semibold text-[11px] transition ${
          currentPath.startsWith('/events') ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-emerald-400'
        }`}
      >
        <span class="text-xl">🎉</span>
        <span>Festas</span>
      </a>

      <a
        href="/matches"
        class={`relative flex flex-col items-center gap-1 font-semibold text-[11px] transition ${
          currentPath.startsWith('/matches') ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-emerald-400'
        }`}
      >
        <div class="relative">
          <span class="text-xl">💬</span>
          {unreadCount > 0 && (
            <span
              id="nav-badge-mobile"
              class="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-extrabold px-1 py-0 rounded-full min-w-[16px] text-center leading-tight shadow-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <span>Conversas</span>
      </a>

      <a
        href="/profile"
        class={`flex flex-col items-center gap-1 font-semibold text-[11px] transition ${
          currentPath.startsWith('/profile') ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-emerald-400'
        }`}
      >
        <span class="text-xl">👤</span>
        <span>Perfil</span>
      </a>
    </nav>
  );
}
