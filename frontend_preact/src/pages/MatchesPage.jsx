import { useState, useEffect, useRef } from 'preact/hooks';
import { apiFetch, getCurrentUserId, resolveMediaUrl, showToast } from '../services/api.js';

export function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [privateStatus, setPrivateStatus] = useState(null);
  const [secretGalleryOpen, setSecretGalleryOpen] = useState(false);
  const [secretPhotos, setSecretPhotos] = useState([]);

  const messagesEndRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const currentUserId = getCurrentUserId();

  useEffect(() => {
    if (!currentUserId) {
      window.location.href = '/login';
      return;
    }
    loadMatches();
  }, []);

  async function loadMatches() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/matches');
      const list = Array.isArray(data) ? data : (data.matches || []);
      setMatches(list);
      if (list.length > 0 && !activeMatch && window.innerWidth >= 768) {
        selectMatch(list[0]);
      }
    } catch (err) {
      showToast(err.message || 'Erro ao carregar conversas', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function selectMatch(match) {
    setActiveMatch(match);
    await loadMessages(match.id);
    await checkPrivateStatus(match.id);

    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(() => {
      loadMessages(match.id, false);
      checkPrivateStatus(match.id, false);
    }, 3500);
  }

  async function loadMessages(matchId, shouldScroll = true) {
    try {
      const data = await apiFetch(`/api/matches/${matchId}/messages`);
      const msgList = Array.isArray(data) ? data : (data.messages || []);
      setMessages(msgList);
      if (shouldScroll) {
        setTimeout(scrollToBottom, 100);
      }
    } catch (_) {}
  }

  async function checkPrivateStatus(matchId, showLoading = true) {
    try {
      const data = await apiFetch(`/api/matches/${matchId}/private-status`);
      setPrivateStatus(data);
    } catch (_) {}
  }

  function scrollToBottom() {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!messageInput.trim() || !activeMatch) return;

    const text = messageInput.trim();
    setMessageInput('');

    try {
      await apiFetch(`/api/matches/${activeMatch.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      loadMessages(activeMatch.id);
      loadMatches();
    } catch (err) {
      showToast(err.message || 'Erro ao enviar mensagem', 'error');
    }
  }

  async function handleRequestPrivate() {
    if (!activeMatch) return;
    try {
      await apiFetch(`/api/matches/${activeMatch.id}/request-private`, { method: 'POST' });
      showToast('Solicitação de álbum secreto enviada!', 'success');
      checkPrivateStatus(activeMatch.id);
    } catch (err) {
      showToast(err.message || 'Erro ao solicitar acesso', 'error');
    }
  }

  async function handleRespondPrivate(action) {
    if (!activeMatch) return;
    try {
      await apiFetch(`/api/matches/${activeMatch.id}/respond-private`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      showToast(action === 'approved' ? 'Acesso liberado!' : 'Acesso recusado.', 'info');
      checkPrivateStatus(activeMatch.id);
    } catch (err) {
      showToast(err.message || 'Erro ao responder solicitação', 'error');
    }
  }

  async function viewSecretAlbum() {
    if (!activeMatch) return;
    try {
      const data = await apiFetch(`/api/users/${activeMatch.partner_id || activeMatch.user_id}`);
      if (data && data.private_photos) {
        setSecretPhotos(data.private_photos);
        setSecretGalleryOpen(true);
      } else {
        showToast('Nenhuma foto secreta disponível.', 'info');
      }
    } catch (err) {
      showToast('Erro ao carregar álbum secreto', 'error');
    }
  }

  async function handleUnmatch() {
    if (!activeMatch) return;
    if (!confirm(`Deseja desfazer o match com ${activeMatch.name}? A conversa será excluída permanentemente.`)) {
      return;
    }
    try {
      await apiFetch(`/api/matches/${activeMatch.id}`, { method: 'DELETE' });
      showToast('Match desfeito com sucesso.', 'info');
      setActiveMatch(null);
      loadMatches();
    } catch (err) {
      showToast(err.message || 'Erro ao desfazer match', 'error');
    }
  }

  return (
    <main class="flex-1 max-w-5xl w-full mx-auto p-2 sm:p-6 pb-24 md:pb-6 flex flex-col h-[calc(100dvh-75px)] md:h-[620px] relative z-10">
      <div class="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex-1 flex flex-col md:flex-row min-h-0">
        {/* LISTA DE CONVERSAS */}
        <div
          class={`w-full md:w-80 border-r border-slate-800/80 flex flex-col bg-slate-950/40 ${
            activeMatch ? 'hidden md:flex' : 'flex flex-1'
          }`}
        >
          <div class="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 class="font-black text-white text-base flex items-center gap-2">
              <span>💬</span> <span>Conversas</span>
            </h2>
            <span class="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              {matches.length}
            </span>
          </div>

          <div class="flex-1 overflow-y-auto divide-y divide-slate-800/50">
            {loading && (
              <div class="p-8 text-center text-xs text-slate-400">Carregando conversas...</div>
            )}
            {!loading && matches.length === 0 && (
              <div class="p-8 text-center text-slate-400 space-y-2">
                <span class="text-3xl block">💌</span>
                <p class="text-xs font-bold text-white">Sem conversas ainda</p>
                <p class="text-[11px] text-slate-500">Continue swipando no feed para encontrar matches!</p>
              </div>
            )}
            {!loading &&
              matches.map((m) => {
                const partnerPhoto = (m.photos && m.photos[0]) || m.photo || '';
                const isSelected = activeMatch && activeMatch.id === m.id;

                return (
                  <div
                    key={m.id}
                    onClick={() => selectMatch(m)}
                    class={`p-3.5 flex items-center gap-3 cursor-pointer transition ${
                      isSelected
                        ? 'bg-emerald-950/40 border-l-4 border-emerald-500'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div class="relative w-12 h-12 rounded-full overflow-hidden shrink-0 border border-slate-700">
                      <img src={resolveMediaUrl(partnerPhoto)} alt={m.name} class="w-full h-full object-cover" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <h3 class="text-xs font-bold text-white truncate flex items-center gap-1">
                          <span>{m.name}</span>
                          {m.is_verified && <span class="text-[10px]">🔵</span>}
                        </h3>
                        {m.last_message_time && (
                          <span class="text-[10px] text-slate-500">{m.last_message_time}</span>
                        )}
                      </div>
                      <p class="text-[11px] text-slate-400 truncate mt-0.5">
                        {m.last_message || 'Novo match! Inicie o papo.'}
                      </p>
                    </div>
                    {m.unread_count > 0 && (
                      <span class="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                        {m.unread_count}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* JANELA DE CHAT */}
        {activeMatch ? (
          <div class="flex-1 flex flex-col h-full bg-slate-900/60 min-w-0">
            {/* Header do Chat */}
            <div class="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 backdrop-blur-md">
              <div class="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveMatch(null)}
                  class="md:hidden text-slate-400 hover:text-white text-base mr-1"
                >
                  ❮
                </button>
                <div class="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-emerald-500/50">
                  <img
                    src={resolveMediaUrl((activeMatch.photos && activeMatch.photos[0]) || activeMatch.photo || '')}
                    alt={activeMatch.name}
                    class="w-full h-full object-cover"
                  />
                </div>
                <div class="min-w-0">
                  <h3 class="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-1">
                    <span>{activeMatch.name}</span>
                    <span class="text-slate-400 font-normal">, {activeMatch.age}</span>
                  </h3>
                  <p class="text-[10px] text-emerald-400 truncate">
                    📍 {activeMatch.campus || 'UFABC'} • {activeMatch.specific_course || activeMatch.course || ''}
                  </p>
                </div>
              </div>

              {/* Ações: Álbum Secreto e Desfazer Match */}
              <div class="flex items-center gap-2">
                {/* Álbum Secreto */}
                {privateStatus && privateStatus.partner_approved ? (
                  <button
                    type="button"
                    onClick={viewSecretAlbum}
                    class="px-2.5 py-1 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-[11px] rounded-xl shadow-md transition flex items-center gap-1"
                    title="Ver Álbum Secreto Desbloqueado"
                  >
                    <span>🔓</span> <span class="hidden sm:inline">Álbum Secreto</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestPrivate}
                    disabled={privateStatus && privateStatus.requested_by_me}
                    class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-rose-300 font-semibold text-[11px] rounded-xl border border-rose-500/30 transition flex items-center gap-1 disabled:opacity-50"
                    title="Pedir acesso ao Álbum Secreto"
                  >
                    <span>🔒</span>{' '}
                    <span class="hidden sm:inline">
                      {privateStatus && privateStatus.requested_by_me ? 'Aguardando Aprovação' : 'Pedir Álbum Secreto'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleUnmatch}
                  class="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700 flex items-center justify-center transition"
                  title="Desfazer Match"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Banner de Solicitação de Álbum Secreto Pendente para Você Responder */}
            {privateStatus && privateStatus.requested_by_partner && !privateStatus.my_approved && (
              <div class="bg-rose-950/70 border-b border-rose-500/40 p-3 flex items-center justify-between gap-3 text-xs">
                <div class="text-rose-200">
                  <span class="font-bold text-white">{activeMatch.name}</span> pediu permissão para ver seu Álbum Secreto.
                </div>
                <div class="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleRespondPrivate('approved')}
                    class="px-2.5 py-1 bg-emerald-500 text-slate-950 font-bold rounded-lg hover:bg-emerald-400 transition"
                  >
                    Liberar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespondPrivate('rejected')}
                    class="px-2.5 py-1 bg-slate-800 text-slate-300 font-medium rounded-lg hover:bg-slate-700 transition"
                  >
                    Recusar
                  </button>
                </div>
              </div>
            )}

            {/* Mensagens */}
            <div class="flex-1 p-4 overflow-y-auto space-y-3">
              {messages.length === 0 && (
                <div class="p-8 text-center text-xs text-slate-500">
                  Vocês deram match! Mande um "Oi" para quebrar o gelo. 👋
                </div>
              )}
              {messages.map((msg) => {
                const isMe = msg.sender_id === currentUserId;
                return (
                  <div key={msg.id} class={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div
                      class={`max-w-[78%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm shadow-md leading-relaxed ${
                        isMe
                          ? 'bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-600 text-slate-950 font-medium rounded-br-none'
                          : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/60'
                      }`}
                    >
                      <p>{msg.text || msg.content}</p>
                      <span class={`block text-[9px] mt-1 ${isMe ? 'text-emerald-950 text-right' : 'text-slate-400'}`}>
                        {msg.created_at ? msg.created_at.split(' ')[1] || '' : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input de Envio */}
            <form onSubmit={handleSendMessage} class="p-3 border-t border-slate-800 bg-slate-950/80 flex gap-2">
              <input
                type="text"
                required
                value={messageInput}
                onInput={(e) => setMessageInput(e.target.value)}
                placeholder={`Mensagem para ${activeMatch.name}...`}
                class="flex-1 bg-slate-900 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
              <button
                type="submit"
                class="px-4 py-2.5 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold text-xs rounded-2xl shadow-md transition active:scale-95 flex items-center justify-center"
              >
                Enviar ➔
              </button>
            </form>
          </div>
        ) : (
          <div class="hidden md:flex flex-1 items-center justify-center text-slate-500 text-xs">
            Selecione uma conversa ao lado para bater papo.
          </div>
        )}
      </div>

      {/* MODAL DO ÁLBUM SECRETO DESBLOQUEADO */}
      {secretGalleryOpen && (
        <div
          class="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={() => setSecretGalleryOpen(false)}
        >
          <div
            class="bg-slate-900 border border-rose-500/40 w-full max-w-lg rounded-3xl p-6 text-white space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div class="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 class="font-black text-rose-400 text-base flex items-center gap-2">
                <span>🔥</span> <span>Álbum Secreto Desbloqueado</span>
              </h3>
              <button
                type="button"
                onClick={() => setSecretGalleryOpen(false)}
                class="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div class="grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
              {secretPhotos.map((photo, i) => (
                <div key={i} class="relative aspect-[3/4] rounded-2xl overflow-hidden border border-slate-700 bg-black">
                  <img src={resolveMediaUrl(photo)} alt="Foto Secreta" class="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
