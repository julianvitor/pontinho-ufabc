import { useState, useEffect } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { apiFetch, getCurrentUserId, resolveMediaUrl, showToast } from '../services/api.js';

export function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'going'
  const [userId, setUserId] = useState(getCurrentUserId());

  // Modal de confirmados
  const [attendeesModalOpen, setAttendeesModalOpen] = useState(false);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [modalEventTitle, setModalEventTitle] = useState('');
  const [attendeesList, setAttendeesList] = useState([]);
  const [attendeesLocked, setAttendeesLocked] = useState(false);
  const [attendeesMessage, setAttendeesMessage] = useState('');

  // Modal de preview de usuário
  const [userPreview, setUserPreview] = useState(null);

  useEffect(() => {
    setUserId(getCurrentUserId());
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/events');
      if (Array.isArray(data)) {
        setEvents(data);
      }
    } catch (err) {
      showToast(err.message || 'Erro ao carregar festas', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function toggleRsvp(eventId) {
    if (!userId) {
      showToast('Faça login com seu e-mail institucional para confirmar presença!', 'error');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1000);
      return;
    }

    try {
      const res = await apiFetch(`/api/events/${eventId}/rsvp`, {
        method: 'POST'
      });

      showToast(res.message, res.is_attending ? 'success' : 'info');

      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? { ...e, is_attending: res.is_attending, attendees_count: res.attendees_count }
            : e
        )
      );
    } catch (err) {
      showToast(err.message || 'Erro ao marcar presença.', 'error');
    }
  }

  async function openAttendeesModal(eventId, eventTitle) {
    setModalEventTitle(eventTitle);
    setAttendeesModalOpen(true);
    setAttendeesLoading(true);
    setAttendeesLocked(false);
    setAttendeesList([]);

    try {
      const details = await apiFetch(`/api/events/${eventId}`);
      if (details.attendees_locked) {
        setAttendeesLocked(true);
        setAttendeesMessage(
          details.attendees_message ||
            'Apenas membros da UFABC conectados podem ver a lista de confirmados nesta festa.'
        );
      } else {
        setAttendeesList(details.attendees || []);
      }
    } catch (err) {
      showToast(err.message || 'Erro ao carregar lista de confirmados', 'error');
    } finally {
      setAttendeesLoading(false);
    }
  }

  const filteredEvents =
    filter === 'going' ? events.filter((e) => e.is_attending) : events;

  return (
    <>
      <main class="flex-1 max-w-5xl w-full mx-auto p-3 sm:p-6 pb-24 md:pb-8 space-y-6 relative">
      {/* HERO / APRESENTAÇÃO DA ABA FESTAS */}
      <div class="relative bg-gradient-to-r from-slate-900/90 via-slate-900/95 to-emerald-950/60 p-5 sm:p-7 rounded-3xl border border-slate-800/80 shadow-2xl overflow-hidden">
        <div class="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div class="space-y-1">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-bold mb-1">
              <span>🎉</span>
              <span>Integração UFABC</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Festas & Eventos Universitários
            </h1>
            <p class="text-xs sm:text-sm text-slate-400 max-w-xl">
              Descubra os melhores rolês da comunidade UFABC, confirme sua presença e veja quem dos seus matches e crushes vai colar!
            </p>
          </div>

          {/* Filtros Rápidos */}
          <div class="flex items-center gap-1.5 flex-wrap self-start sm:self-auto bg-slate-950/80 p-1 rounded-2xl border border-slate-800">
            <button
              type="button"
              id="filter-btn-all"
              onClick={() => setFilter('all')}
              class={`px-3 py-1.5 rounded-xl text-xs transition ${
                filter === 'all'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'font-medium text-slate-400 hover:text-white'
              }`}
            >
              Todas as Festas
            </button>
            <button
              type="button"
              id="filter-btn-going"
              onClick={() => setFilter('going')}
              class={`px-3 py-1.5 rounded-xl text-xs transition ${
                filter === 'going'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                  : 'font-medium text-slate-400 hover:text-white'
              }`}
            >
              Vou Colar ✅
            </button>
          </div>
        </div>
      </div>

      {/* LISTAGEM DE EVENTOS */}
      {loading && (
        <div class="py-16 text-center text-slate-400 text-xs">
          <div class="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Carregando as festas mais quentes da UFABC...
        </div>
      )}

      {!loading && filteredEvents.length === 0 && (
        <div class="col-span-full py-16 text-center text-slate-400 text-xs bg-slate-900/50 rounded-3xl border border-slate-800/80 p-8">
          <span class="text-4xl block mb-2">🎈</span>
          <p class="font-bold text-white text-sm">Nenhuma festa encontrada para este filtro.</p>
          <p class="text-slate-500 mt-1">Fique de olho! Novas integrações são cadastradas semanalmente.</p>
        </div>
      )}

      {!loading && filteredEvents.length > 0 && (
        <div id="events-grid" class="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {filteredEvents.map((ev) => {
            const dateObj = new Date(ev.event_date.replace(' ', 'T'));
            const day = isNaN(dateObj.getDate()) ? '--' : dateObj.getDate();
            const monthNames = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
            const month = isNaN(dateObj.getMonth()) ? 'MÊS' : monthNames[dateObj.getMonth()];
            const time = ev.event_date.split(' ')[1] || '22:00';
            const coverUrl = resolveMediaUrl(ev.image_url) || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1000';
            const isGoing = ev.is_attending;

            return (
              <div
                key={ev.id}
                class={`bg-slate-900/90 backdrop-blur-md rounded-3xl border ${
                  isGoing ? 'border-emerald-500/40 shadow-emerald-950/40' : 'border-slate-800/80'
                } shadow-xl overflow-hidden flex flex-col transition hover:border-slate-700`}
              >
                {/* CAPA DA FESTA */}
                <div class="relative h-48 sm:h-52 bg-slate-950 overflow-hidden group">
                  <img
                    src={coverUrl}
                    alt={ev.title}
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                  {/* BADGE DE DATA NO TOPO ESQUERDO */}
                  <div class="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md border border-slate-700/80 rounded-2xl px-3 py-1.5 text-center shadow-lg">
                    <span class="block text-xs font-black text-emerald-400 uppercase tracking-wider">{month}</span>
                    <span class="block text-lg font-black text-white leading-none">{day}</span>
                  </div>

                  {/* BADGE DE CONFIRMAÇÃO SE JÁ ESTIVER INDO */}
                  {isGoing && (
                    <div class="absolute top-3 right-3 bg-emerald-500 text-slate-950 font-black text-[11px] px-3 py-1 rounded-full shadow-md flex items-center gap-1 animate-pulse">
                      <span>✓</span> Presença Confirmada
                    </div>
                  )}

                  {/* HORÁRIO E LOCAL NA IMAGEM */}
                  <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-slate-300">
                    <span class="flex items-center gap-1 font-semibold text-emerald-300 bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-800">
                      <span>⏰</span> {time}h
                    </span>
                    <span class="flex items-center gap-1 font-medium bg-slate-950/70 backdrop-blur-md px-2.5 py-1 rounded-xl border border-slate-800 truncate max-w-[200px]">
                      <span>📍</span> {ev.location}
                    </span>
                  </div>
                </div>

                {/* DETALHES DA FESTA */}
                <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 class="text-lg font-extrabold text-white tracking-tight leading-snug hover:text-emerald-300 transition">
                      {ev.title}
                    </h3>
                    <p class="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                      {ev.description || 'Integração universitária aberta para a comunidade UFABC.'}
                    </p>
                  </div>

                  {/* ÁREA SOCIAL: QUEM VAI */}
                  <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                      <div class="flex items-center">
                        {ev.attendees_locked ? (
                          <span class="text-[11px] text-slate-400 font-medium flex items-center gap-1 bg-slate-950/60 px-2 py-0.5 rounded-lg border border-slate-800/80">
                            🔒 <span class="hidden sm:inline">Faça login para ver quem vai</span>
                            <span class="sm:hidden">Confirmados restritos</span>
                          </span>
                        ) : ev.attendees_sample && ev.attendees_sample.length > 0 ? (
                          ev.attendees_sample.map((s) => (
                            <img
                              key={s.id || s.name}
                              src={resolveMediaUrl(s.avatar) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
                              alt={s.name}
                              title={`${s.name} (${s.course})`}
                              class="w-7 h-7 rounded-full object-cover ring-2 ring-slate-900 -ml-2 first:ml-0 shadow-sm"
                            />
                          ))
                        ) : (
                          <span class="text-xs text-slate-500">Seja o primeiro a confirmar!</span>
                        )}
                      </div>

                      {ev.attendees_count > 0 && (
                        <button
                          type="button"
                          onClick={() => openAttendeesModal(ev.id, ev.title)}
                          class="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition hover:underline"
                        >
                          {ev.attendees_count} {ev.attendees_count === 1 ? 'vai colar' : 'confirmados'}
                        </button>
                      )}
                    </div>

                    {ev.ticket_url && (
                      <a
                        href={ev.ticket_url}
                        target="_blank"
                        rel="noreferrer"
                        class="text-xs font-bold text-amber-300 bg-amber-950/50 hover:bg-amber-900/60 border border-amber-500/40 px-3 py-1 rounded-xl transition flex items-center gap-1"
                      >
                        <span>🎟️</span> Ingressos
                      </a>
                    )}
                  </div>

                  {/* BOTÕES DE AÇÃO */}
                  <div class="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => toggleRsvp(ev.id)}
                      class={`w-full py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 ${
                        isGoing
                          ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40 hover:bg-rose-900/70'
                          : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 shadow-emerald-950/50'
                      }`}
                    >
                      <span>{isGoing ? '✕ Desmarcar' : '🎉 Vou Colar!'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openAttendeesModal(ev.id, ev.title)}
                      class="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <span>👥 Ver Quem Vai</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>

    {attendeesModalOpen &&
      (typeof document !== 'undefined'
        ? createPortal(
            <div
              class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setAttendeesModalOpen(false);
              }}
            >
              <div class="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col text-slate-100">
                <div class="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
                  <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                      Estudantes Confirmados
                    </span>
                    <h3 class="text-lg font-black text-white truncate max-w-sm">{modalEventTitle}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttendeesModalOpen(false)}
                    class="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Barra de contagem e busca */}
                <div class="px-5 py-3 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between">
                  <span class="text-xs font-bold text-slate-300">
                    {attendeesLocked
                      ? 'Lista privada'
                      : `${attendeesList.length} ${attendeesList.length === 1 ? 'estudante confirmado' : 'estudantes confirmados'}`}
                  </span>
                  <span class="text-[11px] text-emerald-400 font-semibold">Dica: clique no perfil para ver detalhes</span>
                </div>

                {/* Lista de confirmados */}
                <div class="p-4 overflow-y-auto space-y-3 flex-1 divide-y divide-slate-800/60">
                  {attendeesLoading && (
                    <div class="p-8 text-center text-slate-400 text-xs">
                      <div class="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Carregando lista de confirmados...
                    </div>
                  )}

                  {!attendeesLoading && attendeesLocked && (
                    <div class="py-10 px-6 text-center space-y-3">
                      <div class="w-14 h-14 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-2xl mx-auto shadow-xl">
                        🔒
                      </div>
                      <h4 class="text-base font-black text-white">Lista de Confirmados Privada</h4>
                      <p class="text-xs text-slate-300 max-w-xs mx-auto">
                        {attendeesMessage || 'Apenas membros da UFABC conectados podem ver a lista de confirmados nesta festa.'}
                      </p>
                      <a
                        href="/login"
                        class="inline-block mt-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition"
                      >
                        Entrar com e-mail institucional
                      </a>
                    </div>
                  )}

                  {!attendeesLoading && !attendeesLocked && attendeesList.length === 0 && (
                    <div class="p-8 text-center text-slate-400 text-xs">
                      Ninguém confirmou presença ainda. Seja a primeira pessoa!
                    </div>
                  )}

                  {!attendeesLoading &&
                    !attendeesLocked &&
                    attendeesList.map((u) => {
                      const avatarUrl =
                        resolveMediaUrl(u.avatar) ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200';
                      return (
                        <div
                          key={u.id || u.name}
                          class="flex items-center justify-between gap-3 pt-3 first:pt-0"
                        >
                          <div
                            class="flex items-center gap-3 cursor-pointer"
                            onClick={() => setUserPreview(u)}
                          >
                            <img
                              src={avatarUrl}
                              alt={u.name}
                              class="w-12 h-12 rounded-2xl object-cover ring-2 ring-emerald-500/30 shadow-md"
                            />
                            <div>
                              <div class="flex items-baseline gap-1.5">
                                <h4 class="text-sm font-bold text-white hover:text-emerald-400 transition">
                                  {u.name}
                                </h4>
                                <span class="text-xs text-slate-400">{u.age} anos</span>
                              </div>
                              <p class="text-xs text-emerald-300/90 font-medium">🎓 {u.course}</p>
                              <p class="text-[11px] text-slate-500">📍 {u.campus}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setUserPreview(u)}
                            class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1"
                          >
                            Ver perfil
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>,
            document.body
          )
        : null)}

    {userPreview &&
      (typeof document !== 'undefined'
        ? createPortal(
            <div
              class="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setUserPreview(null);
              }}
            >
              <div class="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div class="relative h-72 bg-slate-950">
                  <img
                    src={
                      resolveMediaUrl(userPreview.avatar || (userPreview.photos && userPreview.photos[0])) ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600'
                    }
                    alt={userPreview.name || 'Foto'}
                    class="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setUserPreview(null)}
                    class="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center font-bold backdrop-blur-md hover:bg-black/80"
                  >
                    ✕
                  </button>
                  <div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                  <div class="absolute bottom-3 left-4 right-4">
                    <div class="flex items-baseline gap-2">
                      <h3 class="text-2xl font-black text-white">{userPreview.name || 'Estudante'}</h3>
                      <span class="text-xl font-light text-slate-300">{userPreview.age || ''}</span>
                    </div>
                    <p class="text-xs text-emerald-300 font-semibold">
                      🎓 {userPreview.course} • {userPreview.campus}
                    </p>
                  </div>
                </div>

                <div class="p-5 overflow-y-auto space-y-4">
                  <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Sobre mim
                    </span>
                    <p class="text-xs text-slate-200 leading-relaxed bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                      {userPreview.bio || 'Sem bio cadastrada no perfil.'}
                    </p>
                  </div>

                  <div class="pt-2">
                    <a
                      href="/"
                      class="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition shadow-md active:scale-98"
                    >
                      <span>🔥</span> Encontrar no Swipe
                    </a>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null)}
  </>
);
}
