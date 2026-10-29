import { useState, useEffect } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { apiFetch, showToast } from '../services/api.js';

export function HelpModal({ isOpen, onClose }) {
  const [complaintType, setComplaintType] = useState('');
  const [complaintTarget, setComplaintTarget] = useState('');
  const [complaintDetails, setComplaintDetails] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function resetForm() {
    setComplaintType('');
    setComplaintTarget('');
    setComplaintDetails('');
    setReporterContact('');
    setReporterName('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await apiFetch('/api/help/complaint', {
        method: 'POST',
        body: JSON.stringify({
          complaint_type: complaintType,
          target_description: complaintTarget,
          details: complaintDetails,
          reporter_contact: reporterContact,
          reporter_name: reporterName
        })
      });
      showToast(data?.message || 'Denúncia registrada com sucesso!', 'success');
      resetForm();
      onClose();
    } catch (err) {
      showToast(err.message || 'Erro ao registrar reclamação.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const modalContent = (
    <div
      id="global-help-modal"
      class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* CONTEÚDO PRINCIPAL DO MODAL DE AJUDA */}
      <div
        id="global-help-modal-content"
        class="bg-slate-900 border border-slate-700/80 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto space-y-4 relative z-10"
      >
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

        {/* Seção: Formulário de Reclamação / Denúncia para Qualquer Pessoa */}
        <div class="bg-gradient-to-br from-rose-950/30 via-slate-950/80 to-slate-900 p-4 sm:p-5 rounded-2xl border border-rose-500/30 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase tracking-wider">
              <span>⚠️</span> Ouvidoria & Denúncias
            </div>
            <span class="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded-full border border-rose-500/30">
              Aberto a todos
            </span>
          </div>

          <p class="text-xs text-slate-300 leading-relaxed">
            Mesmo que você <strong class="text-white">não possua uma conta no app</strong>, utilize este canal seguro para relatar perfis falsos, perseguição (stalking), assédio ou uso não consentido de fotos. Nossa moderação analisa cada caso com máxima prioridade e sigilo.
          </p>

          <form id="public-complaint-form" onSubmit={handleSubmit} class="space-y-3 pt-1">
            <div>
              <label class="block text-xs font-bold text-slate-200 mb-1">
                Tipo da Ocorrência <span class="text-rose-400">*</span>
              </label>
              <select
                id="complaint-type"
                required
                value={complaintType}
                onChange={(e) => setComplaintType(e.target.value)}
                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              >
                <option value="">Selecione o problema...</option>
                <option value="fake_profile">👤 Perfil Falso / Fake (alguém usando minhas fotos ou dados)</option>
                <option value="stalking">👀 Perseguição / Stalking</option>
                <option value="harassment">🚫 Assédio ou Comportamento Ofensivo</option>
                <option value="image_misuse">📸 Uso Não Autorizado de Imagens / Fotos</option>
                <option value="defamation">📢 Difamação ou Exposição Indevida</option>
                <option value="other">⚠️ Outro tipo de violação de segurança</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-200 mb-1">
                Quem está envolvido? <span class="text-rose-400">*</span>
              </label>
              <input
                type="text"
                id="complaint-target"
                required
                value={complaintTarget}
                onInput={(e) => setComplaintTarget(e.target.value)}
                placeholder="Nome, e-mail institucional, link ou descrição do perfil acusado"
                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-200 mb-1">
                O que aconteceu? <span class="text-rose-400">*</span>
              </label>
              <textarea
                id="complaint-details"
                rows="3"
                required
                value={complaintDetails}
                onInput={(e) => setComplaintDetails(e.target.value)}
                placeholder="Descreva os fatos detalhadamente para que nossa equipe possa apurar com rapidez..."
                class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-bold text-slate-200 mb-1">
                  Seu Contato (E-mail ou WhatsApp) <span class="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  id="complaint-contact"
                  required
                  value={reporterContact}
                  onInput={(e) => setReporterContact(e.target.value)}
                  placeholder="contato@exemplo.com ou telefone"
                  class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-200 mb-1">
                  Seu Nome (opcional)
                </label>
                <input
                  type="text"
                  id="complaint-reporter-name"
                  value={reporterName}
                  onInput={(e) => setReporterName(e.target.value)}
                  placeholder="Seu nome ou apelido"
                  class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div class="flex items-center justify-between pt-2">
              <a href="/terms" class="text-[11px] text-slate-400 hover:text-emerald-300 underline transition">
                Termos & LGPD
              </a>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  id="btn-submit-complaint"
                  disabled={submitting}
                  class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-950/60 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>🛡️</span> <span>{submitting ? 'Enviando...' : 'Enviar Reclamação'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
