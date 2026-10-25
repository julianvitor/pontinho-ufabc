import { useState, useEffect } from 'preact/hooks';
import { apiFetch, getCurrentUserId, resolveMediaUrl, showToast } from '../services/api.js';

export function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(getCurrentUserId());

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

  async function handleRSVP(eventId, status) {
    if (!userId) {
      showToast('Faça login para confirmar sua presença!', 'info');
      return;
    }
    try {
      await apiFetch(`/api/events/${eventId}/attend`, {
        method: 'POST',
        body: JSON.stringify({ status })
      });
      showToast('Presença atualizada com sucesso!', 'success');
      loadEvents();
    } catch (err) {
      showToast(err.message || 'Erro ao atualizar presença', 'error');
    }
  }

  return (
    <main class="flex-1 w-full max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-6 relative z-10">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-black text-white flex items-center gap-2">
            <span>🎉</span> <span>Festas & Eventos</span>
          </h1>
          <p class="text-xs text-emerald-400 font-medium mt-0.5">
            Rolês universitários, cervejadas e integrações da UFABC
          </p>
        </div>
        <button
          type="button"
          onClick={loadEvents}
          class="text-xs text-slate-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
        >
          <span>🔄</span> Atualizar
        </button>
      </div>

      {loading && (
        <div class="flex flex-col items-center justify-center p-12 text-slate-400">
          <div class="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
          <p class="text-xs font-medium text-emerald-400">Buscando festas...</p>
        </div>
      )}

      {!loading && events.length === 0 && (
        <div class="p-8 text-center bg-slate-900/60 rounded-3xl border border-slate-800 text-slate-400">
          <span class="text-3xl block mb-2">🎈</span>
          <p class="text-sm font-bold text-white">Nenhum evento cadastrado no momento</p>
          <p class="text-xs text-slate-400 mt-1">Fique de olho! Novas festas serão publicadas em breve.</p>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div class="space-y-6">
          {events.map((ev) => {
            const dateObj = new Date(ev.event_date.replace(' ', 'T'));
            const day = isNaN(dateObj.getDate()) ? '--' : dateObj.getDate();
            const monthNames = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
            const month = isNaN(dateObj.getMonth()) ? 'MÊS' : monthNames[dateObj.getMonth()];
            const time = ev.event_date.split(' ')[1] || '22:00';
            const coverUrl = resolveMediaUrl(ev.image_url) || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800';

            return (
              <div
                key={ev.id}
                class="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl transition hover:border-slate-700/80"
              >
                {/* Imagem de Capa */}
                <div class="relative h-48 sm:h-56 w-full bg-slate-950 overflow-hidden">
                  <img src={coverUrl} alt={ev.title} class="w-full h-full object-cover" />
                  <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                  {/* Badge da Data */}
                  <div class="absolute top-4 left-4 bg-slate-950/80 backdrop-blur-md border border-slate-700/80 rounded-2xl p-2.5 text-center shadow-lg">
                    <span class="block text-xl font-black text-emerald-400 leading-none">{day}</span>
                    <span class="block text-[10px] font-black text-slate-300 uppercase tracking-wider">{month}</span>
                  </div>

                  {/* Badge de Horário */}
                  <div class="absolute top-4 right-4 bg-slate-950/80 backdrop-blur-md border border-slate-700/80 rounded-xl px-2.5 py-1 text-slate-300 text-xs font-bold shadow-lg">
                    ⏰ {time}h
                  </div>
                </div>

                {/* Conteúdo */}
                <div class="p-5 sm:p-6 space-y-4">
                  <div>
                    <h2 class="text-xl font-black text-white">{ev.title}</h2>
                    <p class="text-xs text-emerald-400 font-semibold mt-0.5">📍 {ev.location}</p>
                    <p class="text-xs text-slate-300 leading-relaxed mt-2.5 bg-slate-950/40 p-3 rounded-2xl border border-slate-800/80">
                      {ev.description}
                    </p>
                  </div>

                  {/* Presenças e Ações */}
                  <div class="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full">
                        🔥 {ev.attendees_count} {ev.attendees_count === 1 ? 'confirmado' : 'confirmados'}
                      </span>
                    </div>

                    <div class="flex items-center gap-2">
                      {/* Botoes de Presença */}
                      <button
                        type="button"
                        onClick={() => handleRSVP(ev.id, 'going')}
                        class={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          ev.user_status === 'going'
                            ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                            : 'bg-slate-800 text-slate-300 hover:bg-emerald-950 hover:text-emerald-300'
                        }`}
                      >
                        ✓ Vou
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRSVP(ev.id, 'maybe')}
                        class={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          ev.user_status === 'maybe'
                            ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                            : 'bg-slate-800 text-slate-300 hover:bg-amber-950 hover:text-amber-300'
                        }`}
                      >
                        ? Talvez
                      </button>

                      {ev.ticket_url && (
                        <a
                          href={ev.ticket_url}
                          target="_blank"
                          class="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-md transition ml-1"
                        >
                          Ingressos ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
