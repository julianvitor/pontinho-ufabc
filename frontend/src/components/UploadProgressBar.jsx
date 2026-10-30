/**
 * Componente moderno e reutilizável de Barra de Progresso de Upload e Processamento de Mídia.
 * Exibe feedback visual detalhado durante a otimização no frontend e envio para o servidor.
 */

export function UploadProgressBar({ progress = 0, stage = 'Processando mídia...', isPrivate = false, className = '' }) {
  const clamped = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      class={`w-full rounded-2xl p-3.5 border transition-all duration-300 backdrop-blur-md shadow-lg ${
        isPrivate
          ? 'bg-gradient-to-r from-rose-950/80 via-slate-950/90 to-black border-rose-500/40 shadow-rose-950/50'
          : 'bg-gradient-to-r from-slate-950/90 via-slate-900/90 to-slate-950/95 border-emerald-500/40 shadow-emerald-950/40'
      } ${className}`}
    >
      {/* Top Header com Status e Porcentagem */}
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span
              class={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isPrivate ? 'bg-rose-400' : 'bg-emerald-400'
              }`}
            />
            <span
              class={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isPrivate ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
            />
          </span>
          <span class="text-xs font-bold text-slate-200 truncate">
            {stage}
          </span>
        </div>

        <span
          class={`text-xs font-mono font-extrabold px-2 py-0.5 rounded-full flex-shrink-0 border ${
            isPrivate
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          }`}
        >
          {clamped}%
        </span>
      </div>

      {/* Barra de Progresso com Gradiente e Brilho */}
      <div class="w-full h-2.5 bg-slate-950/80 rounded-full overflow-hidden p-0.5 border border-white/10 relative">
        <div
          class={`h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden ${
            isPrivate
              ? 'bg-gradient-to-r from-rose-600 via-pink-500 to-red-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]'
              : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_12px_rgba(16,185,129,0.6)]'
          }`}
          style={{ width: `${clamped}%` }}
        >
          {/* Shimmer de reflexo dinâmico */}
          <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
        </div>
      </div>

      {/* Subtexto Informativo de Performance */}
      <div class="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-0.5">
        <span>Otimização no navegador (WebP/GIF)</span>
        <span class="flex items-center gap-1 font-semibold text-slate-300">
          <span>⚡</span> Sem travar o servidor
        </span>
      </div>
    </div>
  );
}

export default UploadProgressBar;
