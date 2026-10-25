import { useState, useEffect } from 'preact/hooks';
import { getStoredTheme, applyTheme } from '../services/theme.js';
import { showToast } from '../services/api.js';

export function ThemeModal({ isOpen, onClose }) {
  const [currentTheme, setCurrentTheme] = useState('ufabc');

  useEffect(() => {
    if (isOpen) {
      setCurrentTheme(getStoredTheme());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function selectTheme(theme) {
    applyTheme(theme);
    setCurrentTheme(theme);
    if (theme === 'pride') {
      showToast('Tema Dark Pride ativado! 🏳️‍🌈✨', 'success');
    } else {
      showToast('Tema UFABC Esmeralda ativado! 🌿', 'success');
    }
    onClose();
  }

  const isPride = currentTheme === 'pride';

  return (
    <div
      id="global-theme-modal"
      class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div class="bg-slate-900 border border-slate-700/80 w-full max-w-md rounded-3xl p-6 shadow-2xl text-slate-100 space-y-4 relative overflow-hidden">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800 relative z-10">
          <div class="flex items-center gap-2">
            <span class="text-xl">🎨</span>
            <h3 class="font-extrabold text-white text-base">Identidade Visual & Tema</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            class="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        <div class="py-4 space-y-3 relative z-10">
          {/* Opção 1: Tema UFABC */}
          <div
            id="theme-card-default"
            onClick={() => selectTheme('ufabc')}
            class={`theme-option-card flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition ${
              !isPride ? 'active border-emerald-500 bg-emerald-950/20' : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
            }`}
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-xl shadow-xs">
                🌿
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm text-white">Verde UFABC</span>
                  <span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                    Padrão
                  </span>
                </div>
                <p class="text-xs text-slate-400 mt-0.5">Tons de verde esmeralda e teal originais da universidade</p>
                <div class="flex items-center gap-1.5 mt-2">
                  <span class="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white/20" title="#10b981" />
                  <span class="w-3.5 h-3.5 rounded-full bg-teal-600 border border-white/20" title="#0d9488" />
                  <span class="w-3.5 h-3.5 rounded-full bg-emerald-900 border border-white/20" title="#064e3b" />
                  <span class="w-3.5 h-3.5 rounded-full bg-[#090d16] border border-white/20" title="#090d16" />
                </div>
              </div>
            </div>
            {!isPride && (
              <div class="text-emerald-400 text-lg font-black ml-2">✓</div>
            )}
          </div>

          {/* Opção 2: Tema Orgulho LGBT+ */}
          <div
            id="theme-card-pride"
            onClick={() => selectTheme('pride')}
            class={`theme-option-card flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition ${
              isPride ? 'active active-pride border-purple-500 bg-purple-950/20' : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'
            }`}
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500/20 via-pink-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center text-xl shadow-xs">
                🏳️‍🌈
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm text-white">Orgulho LGBT+</span>
                  <span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-800/40">
                    Dark Pride
                  </span>
                </div>
                <p class="text-xs text-slate-400 mt-0.5">Base dark profunda, gradientes cósmicos e toques holográficos</p>
                <div class="flex items-center gap-1.5 mt-2">
                  <span class="w-3.5 h-3.5 rounded-full bg-[#ff3366] border border-white/20" title="Vermelho" />
                  <span class="w-3.5 h-3.5 rounded-full bg-[#ff7a18] border border-white/20" title="Laranja" />
                  <span class="w-3.5 h-3.5 rounded-full bg-[#ffd200] border border-white/20" title="Amarelo" />
                  <span class="w-3.5 h-3.5 rounded-full bg-[#10b981] border border-white/20" title="Verde" />
                  <span class="w-3.5 h-3.5 rounded-full bg-[#06b6d4] border border-white/20" title="Azul" />
                  <span class="w-3.5 h-3.5 rounded-full bg-[#8b5cf6] border border-white/20" title="Violeta" />
                </div>
              </div>
            </div>
            {isPride && (
              <div class="text-purple-400 text-lg font-black ml-2">✓</div>
            )}
          </div>
        </div>

        <div class="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 relative z-10">
          <span>Sua preferência fica salva no navegador</span>
          <button
            type="button"
            onClick={onClose}
            class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
