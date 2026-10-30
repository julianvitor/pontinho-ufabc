import { useEffect } from 'preact/hooks';
import { createPortal } from 'preact/compat';

/**
 * Modal de confirmação para alterações não salvas no perfil.
 * Exibe opções para Salvar, Descartar ou Continuar Editando,
 * adaptando toda a identidade visual de acordo com o tema selecionado (UFABC, Pride, Halloween).
 */
export function UnsavedChangesModal({
  isOpen,
  theme = 'ufabc',
  isSaving = false,
  onSave,
  onDiscard,
  onCancel
}) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape' && !isSaving) {
        onCancel();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, onCancel]);

  if (!isOpen) return null;

  const isPride = theme === 'pride';
  const isHalloween = theme === 'halloween';

  // Configurações específicas de cada tema
  const themeConfig = isHalloween
    ? {
        borderClass: 'border-orange-500/40 shadow-[0_0_45px_-10px_rgba(249,115,22,0.35)]',
        headerEmoji: '🎃',
        titleGradient: 'from-orange-400 via-purple-400 to-amber-400',
        badgeBg: 'bg-orange-950/60 border-orange-500/30 text-orange-200',
        badgeIcon: '🦇',
        saveBtnClass:
          'bg-gradient-to-r from-orange-500 via-purple-600 to-amber-500 hover:opacity-95 text-white font-black shadow-lg shadow-orange-950/60 border border-orange-400/40'
      }
    : isPride
    ? {
        borderClass: 'border-purple-500/40 shadow-[0_0_45px_-10px_rgba(236,72,153,0.35)]',
        headerEmoji: '🏳️‍🌈',
        titleGradient: 'from-pink-400 via-purple-400 to-indigo-400',
        badgeBg: 'bg-purple-950/60 border-purple-500/30 text-purple-200',
        badgeIcon: '✨',
        saveBtnClass:
          'bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:opacity-95 text-white font-black shadow-lg shadow-purple-950/60'
      }
    : {
        borderClass: 'border-emerald-500/30 shadow-[0_0_45px_-10px_rgba(16,185,129,0.3)]',
        headerEmoji: '🌿',
        titleGradient: 'from-emerald-400 via-teal-300 to-emerald-500',
        badgeBg: 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300',
        badgeIcon: '💾',
        saveBtnClass:
          'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black shadow-lg shadow-emerald-950/50'
      };

  const modalElement = (
    <div
      id="unsaved-changes-modal-backdrop"
      class="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-modal-title"
    >
      <div
        id="unsaved-changes-modal"
        class={`bg-slate-900/95 border ${themeConfig.borderClass} w-full max-w-md rounded-3xl p-6 shadow-2xl text-slate-100 space-y-4 relative overflow-hidden animate-in zoom-in-95 duration-200`}
      >
        {/* Cabeçalho */}
        <div class="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl animate-bounce duration-1000">{themeConfig.headerEmoji}</span>
            <div>
              <h3
                id="unsaved-modal-title"
                class={`font-extrabold text-base bg-gradient-to-r ${themeConfig.titleGradient} bg-clip-text text-transparent`}
              >
                Alterações Não Salvas
              </h3>
              <p class="text-[11px] text-slate-400">Você fez alterações no seu perfil</p>
            </div>
          </div>
          <button
            type="button"
            id="unsaved-modal-close-btn"
            onClick={onCancel}
            disabled={isSaving}
            class="w-8 h-8 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center font-bold text-xs transition disabled:opacity-40"
            title="Fechar e continuar editando"
          >
            ✕
          </button>
        </div>

        {/* Mensagem explicativa */}
        <div class="space-y-3">
          <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Existem modificações recentes de dados ou mídias que ainda não foram salvas. Se você sair agora, as novas alterações serão perdidas.
          </p>

          <div class={`px-3.5 py-2.5 rounded-2xl border ${themeConfig.badgeBg} flex items-center gap-2.5 text-xs`}>
            <span class="text-base">{themeConfig.badgeIcon}</span>
            <span class="font-medium">O que você deseja fazer antes de sair?</span>
          </div>
        </div>

        {/* Ações */}
        <div class="pt-2 space-y-2.5">
          {/* 1. Salvar alterações */}
          <button
            type="button"
            id="unsaved-modal-save-btn"
            onClick={onSave}
            disabled={isSaving}
            class={`w-full py-3.5 px-4 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed ${themeConfig.saveBtnClass}`}
          >
            {isSaving ? (
              <>
                <div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Salvando Perfil...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>Salvar Alterações e Sair</span>
              </>
            )}
          </button>

          {/* 2. Descartar alterações */}
          <button
            type="button"
            id="unsaved-modal-discard-btn"
            onClick={onDiscard}
            disabled={isSaving}
            class="w-full py-3 px-4 rounded-2xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 border border-rose-800/50 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
          >
            <span>🗑️</span>
            <span>Descartar Alterações</span>
          </button>

          {/* 3. Continuar editando */}
          <button
            type="button"
            id="unsaved-modal-cancel-btn"
            onClick={onCancel}
            disabled={isSaving}
            class="w-full py-2.5 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-xs transition flex items-center justify-center gap-1.5"
          >
            <span>Continuar Editando o Perfil</span>
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalElement, document.body) : modalElement;
}
