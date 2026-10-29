import { useState, useEffect } from 'preact/hooks';
import { apiFetch, showToast } from '../services/api.js';

export function AdminPage() {
  const [metrics, setMetrics] = useState(null);
  const [reports, setReports] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdminData();
  }, []);

  async function loadAdminData() {
    setLoading(true);
    try {
      const [m, r, c] = await Promise.all([
        apiFetch('/api/admin/metrics').catch(() => null),
        apiFetch('/api/admin/reports').catch(() => []),
        apiFetch('/api/admin/complaints').catch(() => [])
      ]);
      setMetrics(m);
      setReports(Array.isArray(r) ? r : []);
      setComplaints(Array.isArray(c) ? c : []);
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

  return (
    <main class="flex-1 w-full max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-6 relative z-10 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-black text-white flex items-center gap-2">
            <span>🛡️</span> <span>Painel Administrativo</span>
          </h1>
          <p class="text-xs text-slate-400">Moderação de conteúdo, denúncias e métricas da plataforma</p>
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
                <span class="text-2xl font-black text-purple-400 block">{metrics.total_messages || 0}</span>
                <span class="text-xs text-slate-400">Mensagens</span>
              </div>
              <div class="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center">
                <span class="text-2xl font-black text-rose-400 block">{reports.length}</span>
                <span class="text-xs text-slate-400">Denúncias Pendentes</span>
              </div>
            </div>
          )}

          {/* DENÚNCIAS */}
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
        </>
      )}
    </main>
  );
}
