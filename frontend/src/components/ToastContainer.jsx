import { useState, useEffect } from 'preact/hooks';
import { onToast } from '../services/api.js';

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsub = onToast((message, type = 'info') => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    });

    return unsub;
  }, []);

  return (
    <div id="toast-container" class="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          class={`px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-bold text-white transition-all transform duration-300 pointer-events-auto backdrop-blur-md flex items-center gap-2 border animate-fade-in ${
            t.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
              : t.type === 'info'
              ? 'bg-cyan-950/90 border-cyan-500/50 text-cyan-200'
              : 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
          }`}
        >
          <span>{t.type === 'error' ? '❌' : t.type === 'info' ? 'ℹ️' : '✓'}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
