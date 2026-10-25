import { useState, useEffect } from 'preact/hooks';
import { apiFetch, getCurrentUserId, uploadPhoto, resolveMediaUrl, showToast } from '../services/api.js';

export function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [age, setAge] = useState(20);
  const [campus, setCampus] = useState('Santo André');
  const [course, setCourse] = useState('BC&T - Bacharelado em Ciência e Tecnologia');
  const [specificCourse, setSpecificCourse] = useState('Ciência da Computação');
  const [entity, setEntity] = useState('Nenhuma / Foco nos Estudos');
  const [lookingFor, setLookingFor] = useState('Algo casual');
  const [gender, setGender] = useState('Mulher');
  const [targetGender, setTargetGender] = useState('Todos');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState([]);
  const [newInterest, setNewInterest] = useState('');
  const [photos, setPhotos] = useState([]);
  const [privatePhotos, setPrivatePhotos] = useState([]);
  const [privateBio, setPrivateBio] = useState('');
  const [songs, setSongs] = useState([]);
  const [newSong, setNewSong] = useState('');

  // Prompts
  const [prompt1_q, setPrompt1_q] = useState("O melhor lugar para relaxar e fugir da rotina é...");
  const [prompt1_a, setPrompt1_a] = useState("");
  const [prompt2_q, setPrompt2_q] = useState("Minha opinião impopular sobre primeiro encontro...");
  const [prompt2_a, setPrompt2_a] = useState("");
  const [prompt3_q, setPrompt3_q] = useState("No intervalo entre as obrigações você me encontra...");
  const [prompt3_a, setPrompt3_a] = useState("");

  const currentUserId = getCurrentUserId();

  useEffect(() => {
    if (!currentUserId) {
      window.location.href = '/login';
      return;
    }
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/users/me');
      setUser(data);
      setName(data.name || '');
      setAge(data.age || 20);
      setCampus(data.campus || 'Santo André');
      setCourse(data.course || 'BC&T - Bacharelado em Ciência e Tecnologia');
      setSpecificCourse(data.specific_course || 'Ciência da Computação');
      setEntity(data.entity || 'Nenhuma / Foco nos Estudos');
      setLookingFor(data.looking_for || 'Algo casual');
      setGender(data.gender || 'Mulher');
      setTargetGender(data.target_gender || 'Todos');
      setBio(data.bio || '');
      setInterests(Array.isArray(data.interests) ? data.interests : []);
      setPhotos(Array.isArray(data.photos) ? data.photos : []);
      setPrivatePhotos(Array.isArray(data.private_photos) ? data.private_photos : []);
      setPrivateBio(data.private_bio || '');
      setSongs(Array.isArray(data.songs) ? data.songs : []);
      setPrompt1_q(data.prompt1_q || "O melhor lugar para relaxar e fugir da rotina é...");
      setPrompt1_a(data.prompt1_a || "");
      setPrompt2_q(data.prompt2_q || "Minha opinião impopular sobre primeiro encontro...");
      setPrompt2_a(data.prompt2_a || "");
      setPrompt3_q(data.prompt3_q || "No intervalo entre as obrigações você me encontra...");
      setPrompt3_a(data.prompt3_a || "");
    } catch (err) {
      showToast(err.message || 'Erro ao carregar perfil', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          age: parseInt(age, 10),
          campus,
          course,
          specific_course: specificCourse,
          entity,
          looking_for: lookingFor,
          gender,
          target_gender: targetGender,
          bio,
          interests,
          photos,
          private_photos: privatePhotos,
          private_bio: privateBio,
          songs,
          prompt1_q,
          prompt1_a,
          prompt2_q,
          prompt2_a,
          prompt3_q,
          prompt3_a
        })
      });
      showToast('Perfil atualizado com sucesso! ✨', 'success');
    } catch (err) {
      showToast(err.message || 'Erro ao salvar perfil', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadPhoto(e, isPrivate) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      showToast('Enviando e otimizando imagem...', 'info');
      const res = await uploadPhoto(file, isPrivate);
      if (res && res.url) {
        if (isPrivate) {
          setPrivatePhotos((prev) => [...prev, res.url]);
        } else {
          setPhotos((prev) => [...prev, res.url]);
        }
        showToast('Foto adicionada com sucesso!', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Erro ao enviar foto', 'error');
    }
  }

  function removePhoto(index, isPrivate) {
    if (isPrivate) {
      setPrivatePhotos((prev) => prev.filter((_, i) => i !== index));
    } else {
      setPhotos((prev) => prev.filter((_, i) => i !== index));
    }
  }

  function addInterest(e) {
    e.preventDefault();
    const tag = newInterest.trim().replace(/^#/, '');
    if (tag && !interests.includes(tag)) {
      setInterests((prev) => [...prev, tag]);
      setNewInterest('');
    }
  }

  function removeInterest(tag) {
    setInterests((prev) => prev.filter((t) => t !== tag));
  }

  function addSong(e) {
    e.preventDefault();
    const song = newSong.trim();
    if (song && !songs.includes(song)) {
      setSongs((prev) => [...prev, song]);
      setNewSong('');
    }
  }

  function removeSong(song) {
    setSongs((prev) => prev.filter((s) => s !== song));
  }

  async function handleExportData() {
    try {
      const data = await apiFetch('/api/users/me/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pontinho-meus-dados-lgpd-${Date.now()}.json`;
      a.click();
      showToast('Download dos seus dados iniciado!', 'success');
    } catch (_) {
      showToast('Erro ao exportar dados.', 'error');
    }
  }

  async function handleDeleteAccount() {
    const confirmName = prompt(`Para confirmar a exclusão definitiva da sua conta e de todos os seus dados conforme a LGPD, digite seu nome exato: "${name}"`);
    if (confirmName !== name) {
      showToast('Confirmação incorreta. Ação cancelada.', 'info');
      return;
    }
    try {
      await apiFetch('/api/users/me', { method: 'DELETE' });
      localStorage.clear();
      showToast('Conta excluída com sucesso.', 'info');
      window.location.href = '/';
    } catch (err) {
      showToast(err.message || 'Erro ao excluir conta', 'error');
    }
  }

  return (
    <main class="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-20 md:pb-8 relative z-10">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-black text-white flex items-center gap-2">
            <span>👤</span> <span>Editar Perfil</span>
          </h1>
          <p class="text-xs text-emerald-400 font-medium mt-0.5">
            Personalize suas fotos, músicas e preferências
          </p>
        </div>
      </div>

      {loading && (
        <div class="p-12 text-center text-slate-400">
          <div class="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p class="text-xs text-emerald-400">Carregando seu perfil...</p>
        </div>
      )}

      {!loading && (
        <form onSubmit={handleSaveProfile} class="space-y-6">
          {/* 1. GALERIA DE FOTOS PÚBLICAS */}
          <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>📸</span> <span>Fotos do Perfil</span>
                </h3>
                <p class="text-[11px] text-slate-400">A primeira foto será a principal exibida no feed.</p>
              </div>
              <label class="px-3 py-1.5 bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl cursor-pointer hover:bg-emerald-400 transition shadow-md">
                + Foto
                <input type="file" accept="image/*,.gif" class="hidden" onChange={(e) => handleUploadPhoto(e, false)} />
              </label>
            </div>

            <div class="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {photos.map((url, i) => (
                <div key={i} class="relative aspect-[3/4] rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 group">
                  <img src={resolveMediaUrl(url)} alt={`Foto ${i + 1}`} class="w-full h-full object-cover" />
                  {i === 0 && (
                    <span class="absolute top-1 left-1 bg-emerald-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-md">
                      Principal
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(i, false)}
                    class="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-950/80 text-rose-400 border border-rose-500/50 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 2. ÁLBUM SECRETO PROTEGIDO */}
          <div class="bg-gradient-to-br from-rose-950/20 via-slate-900/90 to-slate-900 border border-rose-500/30 rounded-3xl p-5 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-bold text-rose-300 flex items-center gap-1.5">
                  <span>🔒</span> <span>Álbum Secreto 🔥</span>
                </h3>
                <p class="text-[11px] text-rose-200/80">Fotos liberadas apenas após seu consentimento mútuo no chat.</p>
              </div>
              <label class="px-3 py-1.5 bg-rose-600 text-white font-bold text-xs rounded-xl cursor-pointer hover:bg-rose-500 transition shadow-md">
                + Secreta
                <input type="file" accept="image/*,.gif" class="hidden" onChange={(e) => handleUploadPhoto(e, true)} />
              </label>
            </div>

            <div class="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {privatePhotos.map((url, i) => (
                <div key={i} class="relative aspect-[3/4] rounded-2xl overflow-hidden border border-rose-500/40 bg-slate-950 group">
                  <img src={resolveMediaUrl(url)} alt={`Secreta ${i + 1}`} class="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i, true)}
                    class="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-950/80 text-rose-400 border border-rose-500/50 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div>
              <label class="block text-xs font-bold text-rose-200 mb-1">Bio Secreta (Visível apenas após permissão)</label>
              <textarea
                rows="2"
                value={privateBio}
                onInput={(e) => setPrivateBio(e.target.value)}
                placeholder="Conte algo que só seus matches autorizados poderão ler..."
                class="w-full bg-slate-950/80 border border-rose-500/30 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
              />
            </div>
          </div>

          {/* 3. DADOS BÁSICOS */}
          <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4">
            <h3 class="text-sm font-bold text-white flex items-center gap-1.5">
              <span>📝</span> <span>Dados Acadêmicos & Pessoais</span>
            </h3>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Nome</label>
                <input
                  type="text"
                  required
                  value={name}
                  onInput={(e) => setName(e.target.value)}
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Idade</label>
                <input
                  type="number"
                  min="18"
                  max="99"
                  required
                  value={age}
                  onInput={(e) => setAge(e.target.value)}
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Campus</label>
                <select
                  value={campus}
                  onChange={(e) => setCampus(e.target.value)}
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Santo André">Santo André</option>
                  <option value="São Bernardo do Campo">São Bernardo do Campo</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Entidade Estudantil</label>
                <select
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Atlética Geral">Atlética Geral</option>
                  <option value="Bateria Universitária">Bateria Universitária</option>
                  <option value="Caiás">Caiás</option>
                  <option value="Baja">Baja</option>
                  <option value="Enactus">Enactus</option>
                  <option value="GPDA">GPDA</option>
                  <option value="Rocket Design">Rocket Design</option>
                  <option value="IEEE Student Branch">IEEE Student Branch</option>
                  <option value="Nenhuma / Foco nos Estudos">Nenhuma / Foco nos Estudos</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Gênero</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Mulher">Mulher</option>
                  <option value="Homem">Homem</option>
                  <option value="Não-binário">Não-binário</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Interesse (Ver no Feed)</label>
                <select
                  value={targetGender}
                  onChange={(e) => setTargetGender(e.target.value)}
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Todos">Todos</option>
                  <option value="Mulheres">Mulheres</option>
                  <option value="Homens">Homens</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">Bio Pública</label>
              <textarea
                rows="3"
                value={bio}
                onInput={(e) => setBio(e.target.value)}
                placeholder="Conte sobre sua rotina, o que curte fazer na UFABC..."
                class="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* 4. INTERESSES */}
          <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-3">
            <h3 class="text-sm font-bold text-white flex items-center gap-1.5">
              <span>🏷️</span> <span>Tags de Interesses</span>
            </h3>
            <div class="flex flex-wrap gap-2">
              {interests.map((tag) => (
                <span key={tag} class="px-3 py-1 bg-slate-800 text-emerald-300 text-xs rounded-xl flex items-center gap-1.5 border border-slate-700">
                  #{tag}
                  <button type="button" onClick={() => removeInterest(tag)} class="text-slate-400 hover:text-white">✕</button>
                </span>
              ))}
            </div>
            <div class="flex gap-2">
              <input
                type="text"
                value={newInterest}
                onInput={(e) => setNewInterest(e.target.value)}
                placeholder="Nova tag (Ex: Vôlei, Anime, Café)"
                class="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={addInterest}
                class="px-4 py-2 bg-slate-800 text-emerald-400 font-bold text-xs rounded-xl hover:bg-slate-700"
              >
                + Adicionar
              </button>
            </div>
          </div>

          {/* 5. MÚSICAS FAVORITAS */}
          <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-3">
            <h3 class="text-sm font-bold text-purple-300 flex items-center gap-1.5">
              <span>🎵</span> <span>Trilha Sonora do Perfil</span>
            </h3>
            <div class="space-y-1.5">
              {songs.map((song) => (
                <div key={song} class="p-2.5 bg-purple-950/30 rounded-xl border border-purple-500/20 text-xs text-purple-200 flex items-center justify-between">
                  <span>{song}</span>
                  <button type="button" onClick={() => removeSong(song)} class="text-slate-400 hover:text-white">✕</button>
                </div>
              ))}
            </div>
            <div class="flex gap-2">
              <input
                type="text"
                value={newSong}
                onInput={(e) => setNewSong(e.target.value)}
                placeholder="Artista - Música ou link do YouTube"
                class="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={addSong}
                class="px-4 py-2 bg-purple-900 text-purple-200 font-bold text-xs rounded-xl hover:bg-purple-800"
              >
                + Adicionar
              </button>
            </div>
          </div>

          {/* 6. PERGUNTINHAS DO PERFIL */}
          <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4">
            <h3 class="text-sm font-bold text-white flex items-center gap-1.5">
              <span>💬</span> <span>Perguntinhas de Perfil</span>
            </h3>

            <div class="space-y-2">
              <label class="block text-xs font-bold text-emerald-400">{prompt1_q}</label>
              <input
                type="text"
                value={prompt1_a}
                onInput={(e) => setPrompt1_a(e.target.value)}
                placeholder="Sua resposta..."
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div class="space-y-2">
              <label class="block text-xs font-bold text-emerald-400">{prompt2_q}</label>
              <input
                type="text"
                value={prompt2_a}
                onInput={(e) => setPrompt2_a(e.target.value)}
                placeholder="Sua resposta..."
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div class="space-y-2">
              <label class="block text-xs font-bold text-emerald-400">{prompt3_q}</label>
              <input
                type="text"
                value={prompt3_a}
                onInput={(e) => setPrompt3_a(e.target.value)}
                placeholder="Sua resposta..."
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* BOTÃO SALVAR */}
          <button
            type="submit"
            disabled={saving}
            class="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-sm rounded-2xl shadow-xl transition active:scale-[0.99] disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>

          {/* SEÇÃO LGPD */}
          <div class="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <button
              type="button"
              onClick={handleExportData}
              class="hover:text-emerald-400 underline transition"
            >
              Exportar Meus Dados (Art. 18 LGPD)
            </button>
            <button
              type="button"
              onClick={handleDeleteAccount}
              class="text-rose-400 hover:text-rose-300 underline transition"
            >
              Excluir Conta Definitivamente
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
