import { useState, useEffect } from 'preact/hooks';
import { apiFetch, uploadMedia, resolveMediaUrl, showToast } from '../services/api.js';
import { UploadProgressBar } from '../components/UploadProgressBar.jsx';

export function AdminPage() {
  const [tab, setTab] = useState('reports'); // 'reports' | 'ads' | 'events'
  const [metrics, setMetrics] = useState(null);
  const [reports, setReports] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [ads, setAds] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Formulário Nova Propaganda (Ad)
  const [adTitle, setAdTitle] = useState('');
  const [adDescription, setAdDescription] = useState('');
  const [adButtonText, setAdButtonText] = useState('Conferir');
  const [adLinkUrl, setAdLinkUrl] = useState('');
  const [adFrequency, setAdFrequency] = useState(4);
  const [adImageUrl, setAdImageUrl] = useState('');
  const [uploadingAdImage, setUploadingAdImage] = useState(false);
  const [adUploadProgress, setAdUploadProgress] = useState(0);
  const [adUploadStage, setAdUploadStage] = useState('');
  const [savingAd, setSavingAd] = useState(false);

  // Formulário Nova Festa / Evento
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('Campus Santo André');
  const [eventDescription, setEventDescription] = useState('');
  const [eventTicketUrl, setEventTicketUrl] = useState('');
  const [eventImageUrl, setEventImageUrl] = useState('');
  const [uploadingEventImage, setUploadingEventImage] = useState(false);
  const [eventUploadProgress, setEventUploadProgress] = useState(0);
  const [eventUploadStage, setEventUploadStage] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData() {
    setLoading(true);
    try {
      const [m, r, c, a, e] = await Promise.all([
        apiFetch('/api/admin/metrics').catch(() => null),
        apiFetch('/api/admin/reports').catch(() => []),
        apiFetch('/api/admin/complaints').catch(() => []),
        apiFetch('/api/admin/ads').catch(() => []),
        apiFetch('/api/events').catch(() => [])
      ]);
      setMetrics(m);
      setReports(Array.isArray(r) ? r : []);
      setComplaints(Array.isArray(c) ? c : []);
      setAds(Array.isArray(a) ? a : []);
      setEvents(Array.isArray(e) ? e : []);
    } catch (err) {
      showToast('Acesso negado ou erro ao carregar dados de admin.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDismissReport(id) {
    try {
      await apiFetch(`/api/admin/reports/${id}/dismiss`, { method: 'POST' });
      showToast('Denúncia arquivada.', 'info');
      loadAdminData();
    } catch (_) {}
  }

  async function handleBanUser(userId) {
    if (!confirm('Deseja realmente banir este usuário?')) return;
    try {
      await apiFetch(`/api/admin/users/${userId}/ban`, { method: 'POST' });
      showToast('Usuário banido.', 'success');
      loadAdminData();
    } catch (_) {}
  }

  // --- UPLOAD DE PROPAGANDAS COM CONVERSÃO NO FRONTEND (WEBP/GIF) ---
  async function handleAdFileUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setUploadingAdImage(true);
    setAdUploadProgress(0);
    setAdUploadStage('Iniciando processamento...');
    try {
      const res = await uploadMedia(file, false, (pct, stage) => {
        setAdUploadProgress(pct);
        if (stage) setAdUploadStage(stage);
      });
      if (res && res.url) {
        setAdImageUrl(res.url);
        showToast('Banner da propaganda processado para WebP/GIF e enviado! 📢', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Erro ao enviar imagem da propaganda', 'error');
    } finally {
      setUploadingAdImage(false);
      e.target.value = '';
    }
  }

  async function handleCreateAd(e) {
    e.preventDefault();
    if (!adTitle.trim() || !adImageUrl.trim() || !adLinkUrl.trim()) {
      showToast('Título, imagem e link de destino são obrigatórios.', 'error');
      return;
    }

    setSavingAd(true);
    try {
      await apiFetch('/api/admin/ads', {
        method: 'POST',
        body: JSON.stringify({
          title: adTitle.trim(),
          description: adDescription.trim(),
          image_url: adImageUrl.trim(),
          button_text: adButtonText.trim() || 'Conferir',
          link_url: adLinkUrl.trim(),
          is_active: 1,
          frequency: parseInt(adFrequency, 10) || 4
        })
      });
      showToast('Propaganda cadastrada com sucesso! 🎉', 'success');
      setAdTitle('');
      setAdDescription('');
      setAdLinkUrl('');
      setAdImageUrl('');
      loadAdminData();
    } catch (err) {
      showToast(err.message || 'Erro ao salvar propaganda', 'error');
    } finally {
      setSavingAd(false);
    }
  }

  async function handleDeleteAd(id) {
    if (!confirm('Excluir esta propaganda?')) return;
    try {
      await apiFetch(`/api/admin/ads/${id}`, { method: 'DELETE' });
      showToast('Propaganda excluída.', 'info');
      loadAdminData();
    } catch (err) {
      showToast(err.message || 'Erro ao excluir propaganda', 'error');
    }
  }

  // --- UPLOAD DE EVENTOS COM CONVERSÃO NO FRONTEND (WEBP/GIF) ---
  async function handleEventFileUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    setUploadingEventImage(true);
    setEventUploadProgress(0);
    setEventUploadStage('Iniciando processamento...');
    try {
      const res = await uploadMedia(file, false, (pct, stage) => {
        setEventUploadProgress(pct);
        if (stage) setEventUploadStage(stage);
      });
      if (res && res.url) {
        setEventImageUrl(res.url);
        showToast('Flyer da festa processado para WebP/GIF e enviado! 🎉', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Erro ao enviar flyer do evento', 'error');
    } finally {
      setUploadingEventImage(false);
      e.target.value = '';
    }
  }

  async function handleCreateEvent(e) {
    e.preventDefault();
    const title = eventTitle.trim();
    if (!title || title.length < 2) {
      showToast('O título do evento deve ter pelo menos 2 caracteres.', 'error');
      return;
    }
    if (title.length > 25) {
      showToast('O título do evento deve ter no máximo 25 caracteres.', 'error');
      return;
    }
    if (!eventDate.trim() || !eventLocation.trim()) {
      showToast('Data e local do evento são obrigatórios.', 'error');
      return;
    }

    setSavingEvent(true);
    try {
      await apiFetch('/api/events', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: eventDescription.trim(),
          event_date: eventDate.trim(),
          location: eventLocation.trim(),
          image_url: eventImageUrl.trim(),
          ticket_url: eventTicketUrl.trim()
        })
      });
      showToast('Festa/evento cadastrado com sucesso! 🎉', 'success');
      setEventTitle('');
      setEventDate('');
      setEventDescription('');
      setEventTicketUrl('');
      setEventImageUrl('');
      loadAdminData();
    } catch (err) {
      showToast(err.message || 'Erro ao cadastrar evento', 'error');
    } finally {
      setSavingEvent(false);
    }
  }

  async function handleDeleteEvent(id) {
    if (!confirm('Deseja excluir esta festa?')) return;
    try {
      await apiFetch(`/api/events/${id}`, { method: 'DELETE' });
      showToast('Festa excluída.', 'info');
      loadAdminData();
    } catch (err) {
      showToast(err.message || 'Erro ao excluir evento', 'error');
    }
  }

  return (
    <main class="flex-1 w-full max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-6 relative z-10 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-black text-white flex items-center gap-2">
            <span>🛡️</span> <span>Painel Administrativo</span>
          </h1>
          <p class="text-xs text-slate-400">Moderação de conteúdo, denúncias, propagandas e eventos</p>
        </div>
      </div>

      {loading && (
        <div class="p-8 text-center text-xs text-slate-400">Carregando dados administrativos...</div>
      )}

      {!loading && (
        <>
          {metrics && (
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center">
                <span class="text-2xl font-black text-emerald-400 block">{metrics.total_users || 0}</span>
                <span class="text-xs text-slate-400">Estudantes</span>
              </div>
              <div class="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center">
                <span class="text-2xl font-black text-teal-400 block">{metrics.total_matches || 0}</span>
                <span class="text-xs text-slate-400">Matches Bilaterais</span>
              </div>
              <div class="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center">
                <span class="text-2xl font-black text-purple-400 block">{ads.length}</span>
                <span class="text-xs text-slate-400">Propagandas Ativas</span>
              </div>
              <div class="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center">
                <span class="text-2xl font-black text-rose-400 block">{reports.length}</span>
                <span class="text-xs text-slate-400">Denúncias Pendentes</span>
              </div>
            </div>
          )}

          {/* NAVEGAÇÃO POR ABAS */}
          <div class="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              type="button"
              id="tab-btn-reports"
              onClick={() => setTab('reports')}
              class={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                tab === 'reports'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>⚠️ Denúncias ({reports.length})</span>
            </button>

            <button
              type="button"
              id="tab-btn-ads"
              onClick={() => setTab('ads')}
              class={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                tab === 'ads'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>📢 Propagandas ({ads.length})</span>
            </button>

            <button
              type="button"
              id="tab-btn-events"
              onClick={() => setTab('events')}
              class={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                tab === 'events'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>🎉 Festas & Eventos ({events.length})</span>
            </button>
          </div>

          {/* ABA 1: DENÚNCIAS */}
          {tab === 'reports' && (
            <div class="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
              <h2 class="text-sm font-bold text-white flex items-center gap-2">
                <span>⚠️</span> <span>Denúncias de Perfis</span>
              </h2>

              {reports.length === 0 ? (
                <p class="text-xs text-slate-500">Nenhuma denúncia pendente de análise.</p>
              ) : (
                <div class="space-y-3">
                  {reports.map((rep) => (
                    <div key={rep.id} class="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="text-xs font-bold text-white">Alvo: {rep.reported_name} (ID #{rep.reported_id})</span>
                          <span class="text-[10px] font-bold text-rose-400 bg-rose-950/60 border border-rose-500/30 px-2 py-0.5 rounded-full">
                            {rep.reason}
                          </span>
                        </div>
                        <p class="text-xs text-slate-300 mt-1">{rep.details || 'Sem detalhes fornecidos.'}</p>
                      </div>

                      <div class="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleDismissReport(rep.id)}
                          class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                        >
                          Ignorar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBanUser(rep.reported_id)}
                          class="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl"
                        >
                          Banir Usuário
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ABA 2: PROPAGANDAS (ADS) COM PROCESSAMENTO NO FRONTEND */}
          {tab === 'ads' && (
            <div class="space-y-6">
              {/* FORMULÁRIO DE NOVA PROPAGANDA */}
              <div class="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
                <div class="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <span class="text-xl">📢</span>
                  <h2 class="text-sm font-bold text-white">Cadastrar Nova Propaganda (Feed)</h2>
                </div>

                <form onSubmit={handleCreateAd} class="space-y-3.5">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Título do Anúncio *
                      </label>
                      <input
                        type="text"
                        value={adTitle}
                        onInput={(e) => setAdTitle(e.target.value)}
                        placeholder="Ex: Cervejada da Atlética / Desconto Livraria"
                        class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Texto do Botão
                      </label>
                      <input
                        type="text"
                        value={adButtonText}
                        onInput={(e) => setAdButtonText(e.target.value)}
                        placeholder="Ex: Conferir / Comprar / Ver Mais"
                        class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Link de Destino *
                    </label>
                    <input
                      type="url"
                      value={adLinkUrl}
                      onInput={(e) => setAdLinkUrl(e.target.value)}
                      placeholder="https://..."
                      class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Descrição
                    </label>
                    <textarea
                      value={adDescription}
                      onInput={(e) => setAdDescription(e.target.value)}
                      placeholder="Breve texto promocional ou cupom..."
                      rows={2}
                      class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none resize-none"
                    />
                  </div>

                  {/* UPLOAD DE BANNER PROCESSADO NO FRONT */}
                  <div>
                    <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Banner da Propaganda (Convertido para WebP/GIF no Front) *
                    </label>
                    <div class="flex items-center gap-3">
                      <label class="cursor-pointer px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-2 transition">
                        <span>📷</span>
                        <span>{uploadingAdImage ? 'Convertendo e Enviando...' : 'Selecionar Imagem ou GIF'}</span>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          onChange={handleAdFileUpload}
                          disabled={uploadingAdImage}
                          class="hidden"
                        />
                      </label>
                      {adImageUrl && (
                        <span class="text-xs text-emerald-400 font-bold flex items-center gap-1">
                          <span>✓ Banner pronto</span>
                        </span>
                      )}
                    </div>

                    {uploadingAdImage && (
                      <UploadProgressBar
                        progress={adUploadProgress}
                        stage={adUploadStage}
                        className="mt-2.5 max-w-xs"
                      />
                    )}

                    {adImageUrl && (
                      <div class="mt-2.5 relative w-full max-w-xs h-36 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
                        <img
                          src={resolveMediaUrl(adImageUrl)}
                          alt="Banner Preview"
                          class="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setAdImageUrl('')}
                          class="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center text-xs font-bold"
                          title="Remover"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={savingAd || uploadingAdImage || !adImageUrl}
                    class="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition disabled:opacity-50"
                  >
                    {savingAd ? 'Salvando...' : 'Publicar Propaganda no Feed'}
                  </button>
                </form>
              </div>

              {/* LISTAGEM DE PROPAGANDAS */}
              <div class="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
                <h3 class="text-sm font-bold text-white">Propagandas Cadastradas ({ads.length})</h3>
                {ads.length === 0 ? (
                  <p class="text-xs text-slate-500">Nenhuma propaganda cadastrada.</p>
                ) : (
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ads.map((ad) => (
                      <div key={ad.id} class="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex gap-3 items-center">
                        <div class="w-16 h-16 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-800">
                          <img
                            src={resolveMediaUrl(ad.image_url)}
                            alt={ad.title}
                            class="w-full h-full object-cover"
                          />
                        </div>
                        <div class="flex-1 min-w-0">
                          <h4 class="text-xs font-bold text-white truncate">{ad.title}</h4>
                          <p class="text-[11px] text-slate-400 truncate">{ad.description || ad.link_url}</p>
                          <span class="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                            Frequência: a cada {ad.frequency || 4} cards
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAd(ad.id)}
                          class="p-2 text-rose-400 hover:bg-rose-950/40 rounded-lg text-xs"
                          title="Excluir"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA 3: FESTAS & EVENTOS COM PROCESSAMENTO NO FRONTEND */}
          {tab === 'events' && (
            <div class="space-y-6">
              {/* FORMULÁRIO DE NOVA FESTA */}
              <div class="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
                <div class="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <span class="text-xl">🎉</span>
                  <h2 class="text-sm font-bold text-white">Cadastrar Nova Festa / Evento Universitário</h2>
                </div>

                <form onSubmit={handleCreateEvent} class="space-y-3.5">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Nome da Festa (Máx 25 letras) *
                      </label>
                      <input
                        type="text"
                        maxLength={25}
                        value={eventTitle}
                        onInput={(e) => setEventTitle(e.target.value)}
                        placeholder="Ex: Cervejada Geral BC&T"
                        class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Data e Horário *
                      </label>
                      <input
                        type="text"
                        value={eventDate}
                        onInput={(e) => setEventDate(e.target.value)}
                        placeholder="Ex: 14 Nov • 22h00"
                        class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Local / Campus *
                      </label>
                      <input
                        type="text"
                        value={eventLocation}
                        onInput={(e) => setEventLocation(e.target.value)}
                        placeholder="Ex: Campus Santo André / Chácara"
                        class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Link de Ingressos (Opcional)
                      </label>
                      <input
                        type="url"
                        value={eventTicketUrl}
                        onInput={(e) => setEventTicketUrl(e.target.value)}
                        placeholder="https://blacktag.com.br/..."
                        class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Descrição da Festa
                    </label>
                    <textarea
                      value={eventDescription}
                      onInput={(e) => setEventDescription(e.target.value)}
                      placeholder="Atrações, open bar, regras e informações..."
                      rows={2}
                      class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none resize-none"
                    />
                  </div>

                  {/* UPLOAD DE FLYER PROCESSADO NO FRONT */}
                  <div>
                    <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Flyer da Festa (Convertido para WebP/GIF no Front)
                    </label>
                    <div class="flex items-center gap-3">
                      <label class="cursor-pointer px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-2 transition">
                        <span>🖼️</span>
                        <span>{uploadingEventImage ? 'Convertendo e Enviando...' : 'Selecionar Flyer ou GIF'}</span>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          onChange={handleEventFileUpload}
                          disabled={uploadingEventImage}
                          class="hidden"
                        />
                      </label>
                      {eventImageUrl && (
                        <span class="text-xs text-emerald-400 font-bold flex items-center gap-1">
                          <span>✓ Flyer carregado</span>
                        </span>
                      )}
                    </div>

                    {uploadingEventImage && (
                      <UploadProgressBar
                        progress={eventUploadProgress}
                        stage={eventUploadStage}
                        className="mt-2.5 max-w-xs"
                      />
                    )}

                    {eventImageUrl && (
                      <div class="mt-2.5 relative w-full max-w-xs h-36 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
                        <img
                          src={resolveMediaUrl(eventImageUrl)}
                          alt="Flyer Preview"
                          class="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setEventImageUrl('')}
                          class="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center text-xs font-bold"
                          title="Remover"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={savingEvent || uploadingEventImage}
                    class="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition disabled:opacity-50"
                  >
                    {savingEvent ? 'Salvando...' : 'Cadastrar Festa na Grade Oficial'}
                  </button>
                </form>
              </div>

              {/* LISTAGEM DE EVENTOS */}
              <div class="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
                <h3 class="text-sm font-bold text-white">Festas Cadastradas ({events.length})</h3>
                {events.length === 0 ? (
                  <p class="text-xs text-slate-500">Nenhuma festa cadastrada.</p>
                ) : (
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {events.map((ev) => (
                      <div key={ev.id} class="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex gap-3 items-center">
                        <div class="w-16 h-16 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-800">
                          <img
                            src={resolveMediaUrl(ev.image_url) || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=200'}
                            alt={ev.title}
                            class="w-full h-full object-cover"
                          />
                        </div>
                        <div class="flex-1 min-w-0">
                          <h4 class="text-xs font-bold text-white truncate">{ev.title}</h4>
                          <p class="text-[11px] text-slate-400 truncate">{ev.event_date} • {ev.location}</p>
                          <span class="text-[10px] text-emerald-400 font-semibold block mt-0.5">
                            {ev.attendees_count || 0} confirmados
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(ev.id)}
                          class="p-2 text-rose-400 hover:bg-rose-950/40 rounded-lg text-xs"
                          title="Excluir"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
