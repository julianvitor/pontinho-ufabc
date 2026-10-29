import { useState, useEffect, useRef } from 'preact/hooks';
import { apiFetch, getCurrentUserId, resolveMediaUrl, showToast } from '../services/api.js';

export function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [currentPartner, setCurrentPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPrivateStatus, setCurrentPrivateStatus] = useState(null);
  const [unlockedModalOpen, setUnlockedModalOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);

  // Modal de denúncia
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBlockUser, setReportBlockUser] = useState(true);
  const [submittingReport, setSubmittingReport] = useState(false);

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const selectedMatchIdRef = useRef(selectedMatchId);
  selectedMatchIdRef.current = selectedMatchId;

  const currentUserId = getCurrentUserId();

  useEffect(() => {
    if (!currentUserId) {
      window.location.href = '/login';
      return;
    }

    loadMatches();

    const handleGlobalClick = () => {
      setOptionsMenuOpen(false);
    };
    window.addEventListener('click', handleGlobalClick);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      window.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  // Helper para normalizar item de match (caso venha do backend oficial ou mock legado de teste)
  function normalizeMatch(m) {
    const matchId = m.match_id || m.id;
    let partner = m.partner;
    if (!partner) {
      partner = {
        id: m.partner_id || m.user_id || m.id,
        name: m.name || 'Estudante',
        age: m.age || null,
        campus: m.campus || 'SA',
        course: m.course || '',
        specific_course: m.specific_course || '',
        photos: Array.isArray(m.photos) ? m.photos : (m.photo ? [m.photo] : [])
      };
    }
    const lastMsgText = m.last_message
      ? (typeof m.last_message === 'string' ? m.last_message : (m.last_message.text || ''))
      : '';

    return {
      match_id: matchId,
      match_date: m.match_date || null,
      partner,
      last_message_text: lastMsgText,
      unread_count: m.unread_count || 0,
      is_new: !!m.is_new
    };
  }

  async function loadMatches(autoSelectFirst = true) {
    setLoading(true);
    try {
      const data = await apiFetch('/api/matches');
      const list = Array.isArray(data) ? data : (data.matches || []);
      const normalizedList = list.map(normalizeMatch);
      setMatches(normalizedList);

      // Trata parâmetro na URL (?match_id=123) ou primeiro da lista no desktop
      const urlParams = new URLSearchParams(window.location.search);
      const matchParam = urlParams.get('match_id');

      if (matchParam) {
        selectMatch(parseInt(matchParam, 10), normalizedList);
      } else if (autoSelectFirst && !selectedMatchIdRef.current && normalizedList.length > 0 && window.innerWidth >= 768) {
        selectMatch(normalizedList[0].match_id, normalizedList);
      }
    } catch (err) {
      showToast(err.message || 'Erro ao carregar conversas', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function selectMatch(matchId, currentList = matches) {
    setSelectedMatchId(matchId);
    setOptionsMenuOpen(false);

    const found = currentList.find(m => m.match_id === matchId);
    if (found && found.partner) {
      setCurrentPartner(found.partner);
    }

    await fetchMessages(matchId, true);
    await loadPrivateStatus(matchId);

    // Inicia polling a cada 3 segundos
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(() => {
      const activeId = selectedMatchIdRef.current;
      if (activeId) {
        fetchMessages(activeId, false);
        loadPrivateStatus(activeId);
      }
    }, 3000);
  }

  function backToMatchesList() {
    setSelectedMatchId(null);
    setCurrentPartner(null);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  }

  async function fetchMessages(matchId, shouldScroll = false) {
    if (!matchId) return;
    try {
      const data = await apiFetch(`/api/matches/${matchId}/messages`);
      const msgList = Array.isArray(data) ? data : (data.messages || []);
      setMessages(msgList);

      if (data.partner) {
        setCurrentPartner(data.partner);
      }

      if (shouldScroll) {
        setTimeout(scrollToBottom, 60);
      }
    } catch (_) {}
  }

  async function loadPrivateStatus(matchId) {
    if (!matchId) return;
    try {
      const data = await apiFetch(`/api/matches/${matchId}/private-status`);
      setCurrentPrivateStatus(data);
    } catch (err) {
      setCurrentPrivateStatus(null);
    }
  }

  function scrollToBottom() {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    const activeId = selectedMatchIdRef.current;
    if (!activeId) return;

    const text = messageInput.trim();
    if (!text) return;

    setMessageInput('');

    try {
      await apiFetch(`/api/matches/${activeId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text })
      });

      await fetchMessages(activeId, true);
      loadMatches(false);
    } catch (err) {
      showToast(err.message || 'Erro ao enviar mensagem', 'error');
    }
  }

  async function requestPrivateAccess() {
    const activeId = selectedMatchIdRef.current;
    if (!activeId) return;
    try {
      await apiFetch(`/api/matches/${activeId}/request-private`, { method: 'POST' });
      showToast('Solicitação de fotos privadas enviada! 🔥', 'success');
      await loadPrivateStatus(activeId);
      await fetchMessages(activeId, true);
    } catch (err) {
      showToast(err.message || 'Erro ao solicitar acesso', 'error');
    }
  }

  async function respondPrivateAccess(action) {
    const activeId = selectedMatchIdRef.current;
    if (!activeId) return;
    try {
      await apiFetch(`/api/matches/${activeId}/respond-private`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      showToast(action === 'approve' ? 'Álbum privado liberado! 🔓' : 'Solicitação recusada.', 'success');
      await loadPrivateStatus(activeId);
      await fetchMessages(activeId, true);
    } catch (err) {
      showToast(err.message || 'Erro ao responder solicitação', 'error');
    }
  }

  function openUnlockedModal() {
    if (!currentPrivateStatus || !currentPrivateStatus.unlocked_content) return;
    setUnlockedModalOpen(true);
  }

  function closeUnlockedModal() {
    setUnlockedModalOpen(false);
  }

  async function handleConfirmUnmatch() {
    const activeId = selectedMatchIdRef.current;
    if (!activeId) return;
    setOptionsMenuOpen(false);

    const partnerName = currentPartner ? currentPartner.name : 'este perfil';
    if (!confirm(`Deseja desfazer o match com ${partnerName}? O histórico da conversa será apagado permanentemente para ambos.`)) {
      return;
    }

    try {
      await apiFetch(`/api/matches/${activeId}`, { method: 'DELETE' });
      showToast('Match desfeito com sucesso.', 'success');
      backToMatchesList();
      loadMatches(false);
    } catch (err) {
      showToast(err.message || 'Erro ao desfazer match', 'error');
    }
  }

  function handleOpenReportModal() {
    setOptionsMenuOpen(false);
    setReportReason('');
    setReportDetails('');
    setReportBlockUser(true);
    setReportModalOpen(true);
  }

  async function handleSubmitReport(e) {
    e.preventDefault();
    if (!currentPartner || !currentPartner.id) return;
    if (!reportReason) {
      showToast('Selecione um motivo para a denúncia.', 'error');
      return;
    }

    setSubmittingReport(true);
    try {
      await apiFetch(`/api/users/${currentPartner.id}/report`, {
        method: 'POST',
        body: JSON.stringify({
          reason: reportReason,
          details: reportDetails,
          block_user: reportBlockUser
        })
      });

      showToast('Denúncia enviada à moderação com sucesso. Agradecemos por manter o Pontinho seguro!', 'success');
      setReportModalOpen(false);
      backToMatchesList();
      loadMatches(false);
    } catch (err) {
      showToast(err.message || 'Erro ao enviar denúncia', 'error');
    } finally {
      setSubmittingReport(false);
    }
  }

  async function handleConfirmBlock() {
    setOptionsMenuOpen(false);
    if (!currentPartner || !currentPartner.id) return;

    const partnerName = currentPartner.name || 'este perfil';
    if (!confirm(`Deseja realmente bloquear ${partnerName}? Vocês não verão mais o perfil um do outro nem poderão trocar mensagens.`)) {
      return;
    }

    try {
      await apiFetch(`/api/users/${currentPartner.id}/block`, { method: 'POST' });
      showToast(`${partnerName} foi bloqueado com sucesso.`, 'success');
      backToMatchesList();
      loadMatches(false);
    } catch (err) {
      showToast(err.message || 'Erro ao bloquear usuário', 'error');
    }
  }

  // Foto do parceiro atual no chat
  const currentPartnerPhoto = (currentPartner?.photos && currentPartner.photos[0])
    ? resolveMediaUrl(currentPartner.photos[0])
    : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800';

  const currentPartnerCampus = (currentPartner?.campus === 'Santo André' || currentPartner?.campus === 'SA')
    ? 'SA'
    : (currentPartner?.campus === 'São Bernardo do Campo' || currentPartner?.campus === 'SBC' ? 'SBC' : (currentPartner?.campus || 'SA'));

  return (
    <main class="flex-1 min-h-0 max-w-5xl w-full mx-auto p-1.5 sm:p-3 md:p-4 pb-[calc(76px+var(--safe-bottom,0px))] md:pb-4 flex flex-col h-[calc(100dvh-51px)] overflow-hidden relative z-10">
      <div class="bg-slate-900/90 backdrop-blur-xl rounded-2xl md:rounded-3xl shadow-2xl border border-slate-800/90 overflow-hidden flex-1 min-h-0 flex flex-col md:flex-row">
        
        {/* COLUNA DA ESQUERDA: LISTA DE MATCHES */}
        <div
          class={`w-full md:w-80 border-r border-slate-800/80 flex flex-col bg-slate-950/60 min-h-0 h-full shrink-0 overflow-hidden ${
            selectedMatchId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div class="shrink-0 p-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/80">
            <h2 class="font-extrabold text-white text-base">Matches</h2>
            <span class="px-2 py-0.5 bg-emerald-950/70 text-emerald-300 border border-emerald-500/30 rounded-full font-bold text-xs">
              {matches.length}
            </span>
          </div>

          {/* Lista scrollável */}
          <div class="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
            {loading && (
              <div class="p-8 text-center text-slate-400 text-xs">Carregando...</div>
            )}
            {!loading && matches.length === 0 && (
              <div class="p-8 text-center text-slate-400 text-xs">
                <span class="text-3xl block mb-2">💔</span>
                Você ainda não tem nenhum match. Dê likes no feed de swipes para encontrar alguém!
              </div>
            )}
            {!loading &&
              matches.map((m) => {
                const partner = m.partner;
                const photo = (partner.photos && partner.photos[0])
                  ? resolveMediaUrl(partner.photos[0])
                  : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800';
                const lastMsg = m.last_message_text || 'Novo match! Diga um oi 👋';
                const isSelected = m.match_id === selectedMatchId;
                const campusCode = (partner.campus === 'Santo André' || partner.campus === 'SA') ? 'SA' : 'SBC';

                return (
                  <div
                    key={m.match_id}
                    onClick={() => selectMatch(m.match_id)}
                    class={`p-3 rounded-2xl cursor-pointer transition flex items-center gap-3 ${
                      isSelected
                        ? 'bg-emerald-950/50 border border-emerald-500/40 shadow-sm'
                        : 'hover:bg-slate-900/80 border border-transparent'
                    }`}
                  >
                    <div class="relative shrink-0">
                      <img src={photo} alt={partner.name} class="w-12 h-12 rounded-full object-cover border border-slate-700 shadow-sm" />
                      {m.unread_count > 0 && (
                        <span class="absolute top-0 right-0 w-3 h-3 bg-rose-500 border-2 border-slate-900 rounded-full"></span>
                      )}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <h4 class="font-bold text-white text-sm truncate">{partner.name}</h4>
                        <div class="flex items-center gap-1.5">
                          {m.unread_count > 0 ? (
                            <span class="bg-rose-500 text-white font-extrabold text-[10px] px-1.5 py-0.2 rounded-full shadow-xs animate-pulse">
                              {m.unread_count}
                            </span>
                          ) : m.is_new ? (
                            <span class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold text-[9px] px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                              Novo
                            </span>
                          ) : null}
                          <span class="text-[10px] text-emerald-400 font-semibold">{campusCode}</span>
                        </div>
                      </div>
                      <p class={`text-xs ${m.unread_count > 0 ? 'text-white font-semibold' : 'text-slate-400'} truncate mt-0.5`}>
                        {lastMsg}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* COLUNA DA DIREITA: JANELA DO CHAT */}
        {!selectedMatchId ? (
          <div class="flex-1 min-h-0 hidden md:flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-900/90">
            <div class="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-2xl mb-2.5">
              💬
            </div>
            <h3 class="font-bold text-slate-300 text-sm">Selecione uma conversa</h3>
          </div>
        ) : (
          <div class="flex-1 min-h-0 h-full flex flex-col bg-slate-900/90 min-w-0 overflow-hidden">
            {/* Cabeçalho do Chat (Sempre fixo no topo) */}
            <div class="shrink-0 px-4 py-2.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/90">
              <div class="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={backToMatchesList}
                  class="md:hidden text-slate-200 hover:text-white px-2 py-1 bg-slate-800 rounded-lg shadow-xs border border-slate-700 font-bold text-xs shrink-0"
                >
                  ←
                </button>
                <img
                  src={currentPartnerPhoto}
                  alt={currentPartner?.name || 'Avatar'}
                  class="w-9 h-9 rounded-full object-cover border-2 border-emerald-400 shadow-sm shrink-0"
                />
                <div class="min-w-0">
                  <h3 class="font-bold text-white text-sm leading-tight truncate">
                    {currentPartner?.name || 'Estudante'}
                  </h3>
                  <p class="text-[11px] text-emerald-400 font-medium truncate">
                    {currentPartner?.course || 'Curso'} • Campus {currentPartnerCampus}
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                {/* Menu de Opções */}
                <div class="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOptionsMenuOpen((prev) => !prev);
                    }}
                    class="text-xs text-slate-300 hover:text-white px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition flex items-center gap-1.5 font-bold shadow-xs"
                  >
                    <span>⋮</span> <span>Opções</span>
                  </button>

                  {optionsMenuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      class="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl py-1.5 z-40 text-xs"
                    >
                      <button
                        type="button"
                        onClick={handleConfirmUnmatch}
                        class="w-full text-left px-3.5 py-2 text-amber-400 hover:bg-slate-800 flex items-center gap-2 transition font-medium"
                      >
                        <span>💔</span> <span>Desfazer Match</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenReportModal}
                        class="w-full text-left px-3.5 py-2 text-rose-400 hover:bg-slate-800 flex items-center gap-2 transition font-medium"
                      >
                        <span>⚠️</span> <span>Denunciar Perfil</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmBlock}
                        class="w-full text-left px-3.5 py-2 text-rose-300 hover:bg-slate-800 flex items-center gap-2 transition font-medium"
                      >
                        <span>🚫</span> <span>Bloquear Usuário</span>
                      </button>
                    </div>
                  )}
                </div>

                <a
                  href="/"
                  class="text-xs text-slate-400 hover:text-emerald-400 font-semibold px-2 py-1 rounded-lg hover:bg-slate-800/60 transition hidden sm:inline-block"
                >
                  🔥 Feed
                </a>
              </div>
            </div>

            {/* BANNER DE CONTEÚDO PRIVADO & PICANTE */}
            {currentPrivateStatus && (
              <>
                {/* Caso 1: O parceiro pediu acesso aos meus conteúdos privados */}
                {currentPrivateStatus.their_request_status === 'pending' && (
                  <div class="shrink-0 px-4 py-2.5 bg-gradient-to-r from-rose-950 via-slate-950 to-rose-950 text-white border-b border-rose-500/30 text-xs flex flex-wrap items-center justify-between gap-2 shadow-inner">
                    <div class="flex items-center gap-2">
                      <span class="text-base">🔥</span>
                      <span>
                        <strong>{currentPrivateStatus.partner_name}</strong> pediu acesso às suas fotos e bio secretas!
                      </span>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => respondPrivateAccess('approve')}
                        class="px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-lg text-white font-bold text-xs shadow-sm"
                      >
                        Liberar 🔓
                      </button>
                      <button
                        type="button"
                        onClick={() => respondPrivateAccess('reject')}
                        class="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-slate-300 font-semibold text-xs"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                )}

                {/* Caso 2: O parceiro possui conteúdo privado cadastrado */}
                {currentPrivateStatus.partner_has_private && currentPrivateStatus.their_request_status !== 'pending' && (
                  <div class="shrink-0 px-4 py-2.5 bg-gradient-to-r from-rose-950 via-slate-950 to-rose-950 text-white border-b border-rose-500/30 text-xs flex flex-wrap items-center justify-between gap-2 shadow-inner">
                    {currentPrivateStatus.my_request_status === 'none' && (
                      <>
                        <div class="flex items-center gap-2">
                          <span class="text-base">🔥</span>
                          <span>
                            {currentPrivateStatus.partner_name} possui{' '}
                            <strong>{currentPrivateStatus.partner_private_count} foto(s) e bio secreta</strong>.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={requestPrivateAccess}
                          class="px-3 py-1 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs rounded-lg shadow-sm"
                        >
                          Solicitar Acesso 🔒
                        </button>
                      </>
                    )}

                    {currentPrivateStatus.my_request_status === 'pending' && (
                      <div class="flex items-center gap-2 text-rose-200">
                        <span class="text-base">⏳</span>
                        <span>Pedido enviado... Aguardando autorização de {currentPrivateStatus.partner_name}.</span>
                      </div>
                    )}

                    {currentPrivateStatus.my_request_status === 'rejected' && (
                      <>
                        <div class="flex items-center gap-2 text-slate-300">
                          <span class="text-base">🔒</span>
                          <span>{currentPrivateStatus.partner_name} preferiu manter o conteúdo privado.</span>
                        </div>
                        <button
                          type="button"
                          onClick={requestPrivateAccess}
                          class="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-200 text-xs rounded-lg font-semibold"
                        >
                          Pedir de novo
                        </button>
                      </>
                    )}

                    {currentPrivateStatus.my_request_status === 'approved' && (
                      <>
                        <div class="flex items-center gap-2 text-rose-300">
                          <span class="text-base">🔥</span>
                          <span>
                            Álbum Secreto & Bio Privada liberados por <strong>{currentPrivateStatus.partner_name}</strong>!
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={openUnlockedModal}
                          class="px-3 py-1 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs rounded-lg shadow-md flex items-center gap-1"
                        >
                          <span>🔥</span> Ver Fotos & Bio
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Mensagens de Texto (Scroll interno independente) */}
            <div ref={messagesContainerRef} class="flex-1 min-h-0 overflow-y-auto p-4 space-y-2.5 bg-slate-950/40">
              {messages.length === 0 ? (
                <div class="h-full flex flex-col items-center justify-center text-slate-400 text-xs py-10">
                  <p>Vocês deram match! Mande a primeira mensagem de texto.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === currentUserId;
                  const time = msg.created_at
                    ? new Date(
                        msg.created_at.includes('T')
                          ? msg.created_at
                          : msg.created_at.replace(' ', 'T') + (msg.created_at.includes('Z') ? '' : 'Z')
                      ).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div key={msg.id} class={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      <div
                        class={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm shadow-sm ${
                          isMine
                            ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 text-slate-950 font-medium rounded-br-xs'
                            : 'bg-slate-800/90 text-slate-100 rounded-bl-xs border border-slate-700/60'
                        }`}
                      >
                        <p class="leading-relaxed break-words">{msg.text || msg.content}</p>
                        <span class="text-[10px] block mt-1 opacity-70 text-right">{time}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Formulário de Envio (Fixo e sempre visível no rodapé do chat) */}
            <div class="shrink-0 p-2.5 sm:p-3 border-t border-slate-800/80 bg-slate-950/95 z-20">
              <form onSubmit={sendMessage} class="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Mensagem..."
                  required
                  maxLength={500}
                  value={messageInput}
                  onInput={(e) => setMessageInput(e.target.value)}
                  class="flex-1 bg-slate-900 border border-slate-700/80 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/60 transition"
                />
                <button
                  type="submit"
                  class="px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-emerald-950/60 transition hover:scale-105 active:scale-95 shrink-0"
                >
                  Enviar
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Rodapé LGPD */}
      <div class="shrink-0 hidden md:block text-center pt-1.5 pb-0.5">
        <a href="/terms" class="text-[11px] text-slate-500 hover:text-emerald-400 transition">
          Termos de Uso & Política de Privacidade (LGPD)
        </a>
      </div>

      {/* MODAL: ÁLBUM & BIO SECRETA DESBLOQUEADOS */}
      {unlockedModalOpen && currentPrivateStatus && currentPrivateStatus.unlocked_content && (
        <div class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div class="bg-gradient-to-b from-slate-950 via-slate-900 to-black text-white w-full max-w-lg rounded-3xl border border-rose-500/30 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header do Modal */}
            <div class="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div class="flex items-center gap-2">
                <span class="text-xl">🔥</span>
                <div>
                  <h3 class="font-black text-sm sm:text-base text-rose-300">
                    Álbum Secreto • {currentPrivateStatus.partner_name}
                  </h3>
                  <p class="text-[11px] text-slate-400">Liberado exclusivamente após match e autorização</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeUnlockedModal}
                class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold transition"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo do Modal (Scroll) */}
            <div class="p-4 sm:p-5 overflow-y-auto space-y-4">
              {/* Bio Secreta */}
              {currentPrivateStatus.unlocked_content.private_bio &&
                currentPrivateStatus.unlocked_content.private_bio.trim() && (
                  <div class="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-100">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-rose-400 block mb-1">
                      💋 Bio Privada
                    </span>
                    <p class="text-xs sm:text-sm leading-relaxed font-medium italic">
                      {currentPrivateStatus.unlocked_content.private_bio}
                    </p>
                  </div>
                )}

              {/* Galeria de Fotos Privadas */}
              <div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-rose-400 block mb-2">
                  📸 Fotos Secretas
                </span>
                {currentPrivateStatus.unlocked_content.private_photos &&
                currentPrivateStatus.unlocked_content.private_photos.length > 0 ? (
                  <div class="grid grid-cols-2 gap-2.5">
                    {currentPrivateStatus.unlocked_content.private_photos.map((p, idx) => (
                      <div
                        key={idx}
                        class="relative rounded-2xl overflow-hidden aspect-square border border-rose-500/40 shadow-lg group"
                      >
                        <img src={resolveMediaUrl(p)} alt="Foto Secreta" class="w-full h-full object-cover" />
                        <span class="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold">
                          #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p class="text-xs text-slate-400">Nenhuma foto adicionada.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DENÚNCIA & BLOQUEIO */}
      {reportModalOpen && currentPartner && (
        <div class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div class="bg-slate-900 border border-slate-700/80 w-full max-w-md rounded-3xl p-6 shadow-2xl text-slate-100 space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div class="flex items-center gap-2 text-rose-400 font-bold text-base">
                <span>⚠️</span>
                <span>Denunciar e Bloquear</span>
              </div>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                class="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <p class="text-xs text-slate-300">
              Você está denunciando o perfil de <strong class="text-white">{currentPartner.name}</strong>. Nossa moderação analisa cada caso com seriedade e sigilo.
            </p>

            <form onSubmit={handleSubmitReport} class="space-y-3.5">
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Motivo da denúncia</label>
                <select
                  required
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="">Selecione um motivo...</option>
                  <option value="Perfil Falso / Fake">Perfil Falso / Fake</option>
                  <option value="Comportamento Ofensivo ou Assédio">Comportamento Ofensivo ou Assédio</option>
                  <option value="Conteúdo Impróprio / Explícito não consentido">Conteúdo Impróprio / Explícito não consentido</option>
                  <option value="Spam / Comercial não solicitado">Spam / Comercial não solicitado</option>
                  <option value="Golpe ou Extorsão">Golpe ou Extorsão</option>
                  <option value="Menor de idade">Menor de idade</option>
                  <option value="Outro motivo">Outro motivo</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Detalhes adicionais (opcional)</label>
                <textarea
                  rows={3}
                  value={reportDetails}
                  onInput={(e) => setReportDetails(e.target.value)}
                  placeholder="Descreva brevemente o que aconteceu..."
                  class="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div class="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                <input
                  type="checkbox"
                  id="report-block-check"
                  checked={reportBlockUser}
                  onChange={(e) => setReportBlockUser(e.target.checked)}
                  class="w-4 h-4 rounded text-rose-500 focus:ring-rose-500 bg-slate-900 border-slate-700 cursor-pointer"
                />
                <label htmlFor="report-block-check" class="text-xs text-slate-300 cursor-pointer">
                  Bloquear este usuário imediatamente (ele não verá mais seu perfil nem conversas)
                </label>
              </div>

              <div class="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-950/60 transition disabled:opacity-50"
                >
                  {submittingReport ? 'Enviando...' : 'Enviar Denúncia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
