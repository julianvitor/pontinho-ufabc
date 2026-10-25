import { useState } from 'preact/hooks';
import { apiFetch, showToast } from '../services/api.js';

export function HelpModal({ isOpen, onClose }) {
  const [complaintType, setComplaintType] = useState('perfil');
  const [complaintTarget, setComplaintTarget] = useState('');
  const [complaintDetails, setComplaintDetails] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/help/complaint', {
        method: 'POST',
        body: JSON.stringify({
          complaint_type: complaintType,
          target_description: complaintTarget,
          details: complaintDetails,
          reporter_contact: reporterContact,
          reporter_name: reporterName
        })
      });
      showToast('Denúncia recebida com sucesso! Nossa equipe analisará.', 'success');
      onClose();
    } catch (err) {
      showToast(err.message || 'Erro ao enviar manifestação', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      id="global-help-modal"
      class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div class="bg-slate-900 border border-slate-700/80 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto space-y-4 relative z-10">
        {/* Cabeçalho */}
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div class="flex items-center gap-2.5">
            <span class="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-lg shadow-sm">
              🛡️
            </span>
            <div>
              <h3 class="font-black text-base text-white">Central de Ajuda & Segurança</h3>
              <p class="text-[11px] text-emerald-400 font-medium">Sobre o Pontinho e Canal de Ouvidoria</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            class="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center font-bold transition"
            title="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Seção: Sobre o App */}
        <div class="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2">
          <div class="flex items-center gap-2 text-emerald-300 font-bold text-xs uppercase tracking-wider">
            <span>✨</span> O que é o Pontinho?
          </div>
          <p class="text-xs text-slate-300 leading-relaxed">
            O <strong class="text-white">Pontinho</strong> é a plataforma de conexões, amizades e encontros desenvolvida para a comunidade universitária da <strong class="text-emerald-400">UFABC</strong>.
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-[11px] text-slate-400">
            <div class="flex items-start gap-1.5 p-2 bg-slate-900/80 rounded-xl border border-slate-800/80">
              <span class="text-emerald-400 font-bold">🔒</span>
              <span><strong>Comunidade Fechada:</strong> Perfis e listas de festas são restritos a estudantes conectados.</span>
            </div>
            <div class="flex items-start gap-1.5 p-2 bg-slate-900/80 rounded-xl border border-slate-800/80">
              <span class="text-teal-400 font-bold">🎉</span>
              <span><strong>Festas Universitárias:</strong> Divulgação pública de eventos e rolês de entidades e repúblicas.</span>
            </div>
          </div>
        </div>

        {/* Seção: Formulário de Denúncia */}
        <div class="bg-gradient-to-br from-rose-950/30 via-slate-950/80 to-slate-900 p-4 sm:p-5 rounded-2xl border border-rose-500/30 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase tracking-wider">
              <span>⚠️</span> Ouvidoria & Denúncias
            </div>
            <span class="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/60">Canal Seguro</span>
          </div>

          <p class="text-xs text-slate-300 leading-relaxed">
            Presenciou comportamento impróprio, assédio, perfil falso ou uso indevido de imagem? Envie sua manifestação:
          </p>

          <form onSubmit={handleSubmit} class="space-y-3">
            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">Tipo de Manifestação</label>
              <select
                value={complaintType}
                onChange={(e) => setComplaintType(e.target.value)}
                class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
              >
                <option value="perfil">Denúncia de Perfil / Usuário</option>
                <option value="conteudo">Conteúdo Impróprio / Explícito</option>
                <option value="evento">Problema com Festa ou Evento</option>
                <option value="seguranca">Falha de Segurança ou Privacidade</option>
                <option value="outro">Outra Manifestação</option>
              </select>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">Identificação do Alvo / Link (opcional)</label>
              <input
                type="text"
                value={complaintTarget}
                onInput={(e) => setComplaintTarget(e.target.value)}
                placeholder="Ex: Nome da pessoa, RA ou link do evento"
                class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-slate-300 mb-1">Descrição Detalhada *</label>
              <textarea
                required
                rows="3"
                value={complaintDetails}
                onInput={(e) => setComplaintDetails(e.target.value)}
                placeholder="Relate com clareza o ocorrido..."
                class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label class="block text-[11px] font-bold text-slate-300 mb-1">Seu Nome (opcional)</label>
                <input
                  type="text"
                  value={reporterName}
                  onInput={(e) => setReporterName(e.target.value)}
                  placeholder="Pode deixar em branco"
                  class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-300 mb-1">Contato para Retorno (opcional)</label>
                <input
                  type="text"
                  value={reporterContact}
                  onInput={(e) => setReporterContact(e.target.value)}
                  placeholder="E-mail ou WhatsApp"
                  class="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              class="w-full py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs rounded-xl shadow-lg transition active:scale-[0.99] disabled:opacity-50"
            >
              {submitting ? 'Enviando...' : 'Enviar Manifestação Segura'}
            </button>
          </form>
        </div>

        <div class="pt-2 border-t border-slate-800 text-center">
          <a href="/terms" class="text-[11px] text-slate-400 hover:text-emerald-400 underline">
            Termos de Uso & Política de Privacidade (LGPD)
          </a>
        </div>
      </div>
    </div>
  );
}
