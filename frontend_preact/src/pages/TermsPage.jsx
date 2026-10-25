export function TermsPage() {
  return (
    <main class="flex-1 w-full max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-8 relative z-10 text-slate-200 space-y-6">
      <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div>
          <h1 class="text-2xl sm:text-3xl font-black text-white">Termos de Uso & Privacidade (LGPD)</h1>
          <p class="text-xs text-emerald-400 font-medium mt-1">Pontinho • Universidade Federal do ABC</p>
        </div>

        <section class="space-y-2">
          <h2 class="text-base font-bold text-white">1. Propósito e Elegibilidade</h2>
          <p class="text-xs text-slate-300 leading-relaxed">
            O Pontinho é uma plataforma de conexões sociais e divulgação de eventos universitários desenvolvida para membros da UFABC. O acesso é restrito exclusivamente a pessoas maiores de 18 anos portadoras de e-mail institucional ou autorizadas pela administração.
          </p>
        </section>

        <section id="lgpd" class="space-y-2 pt-2 border-t border-slate-800">
          <h2 class="text-base font-bold text-emerald-400">2. Privacidade e Conformidade com a LGPD (Lei nº 13.709/2018)</h2>
          <p class="text-xs text-slate-300 leading-relaxed">
            Em total respeito à Lei Geral de Proteção de Dados (LGPD), asseguramos:
          </p>
          <ul class="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
            <li><strong>Finalidade e Não Compartilhamento:</strong> Seus dados não são vendidos ou compartilhados com terceiros anunciantes.</li>
            <li><strong>Álbum Secreto e Consentimento:</strong> Fotos confidenciais só podem ser vistas por matches que você aprovou ativamente.</li>
            <li><strong>Portabilidade (Art. 18, V):</strong> Você pode baixar uma cópia completa de todos os seus dados a qualquer momento na aba Meu Perfil.</li>
            <li><strong>Eliminação Definitiva (Art. 18, VI):</strong> Ao optar por excluir sua conta, todos os registros, mensagens, fotos e biometrias são apagados permanentemente do servidor.</li>
          </ul>
        </section>

        <section class="space-y-2 pt-2 border-t border-slate-800">
          <h2 class="text-base font-bold text-white">3. Diretrizes da Comunidade</h2>
          <p class="text-xs text-slate-300 leading-relaxed">
            É estritamente proibido o uso de fotos de terceiros sem consentimento, assédio, preconceito ou qualquer forma de discriminação. Infrações resultarão no banimento definitivo da conta.
          </p>
        </section>

        <div class="pt-4 border-t border-slate-800 text-center">
          <a href="/" class="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold rounded-xl transition inline-block">
            Voltar ao Início
          </a>
        </div>
      </div>
    </main>
  );
}
