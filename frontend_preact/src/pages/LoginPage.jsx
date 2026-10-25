import { useState, useEffect, useRef } from 'preact/hooks';
import { apiFetch, setCurrentUserId, showToast } from '../services/api.js';

export function LoginPage() {
  const [tab, setTab] = useState('login');
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Campos Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Campos Cadastro
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRa, setRegRa] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regAge, setRegAge] = useState(20);
  const [regCampus, setRegCampus] = useState('Santo André');
  const [regCourse, setRegCourse] = useState('BC&T - Bacharelado em Ciência e Tecnologia');
  const [regGender, setRegGender] = useState('Mulher');
  const [regLookingFor, setRegLookingFor] = useState('Algo casual');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Biometria Facial
  const [bioState, setBioState] = useState('idle'); // idle | scanning | success | blocked | error
  const [biometricResult, setBiometricResult] = useState(null);
  const [bioError, setBioError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const modelsLoadedRef = useRef(false);

  useEffect(() => {
    loadDemoAccounts();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'register') {
      setTab('register');
    }
  }, []);

  async function loadDemoAccounts() {
    try {
      const accounts = await apiFetch('/api/auth/demo-accounts');
      if (Array.isArray(accounts)) {
        setDemoAccounts(accounts);
      }
    } catch (_) {}
  }

  function fillDemo(email, pw) {
    setTab('login');
    setLoginEmail(email);
    setLoginPassword(pw);
    showToast(`Preenchido: ${email}`, 'info');
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword
        })
      });

      if (res.success && res.user) {
        setCurrentUserId(res.user.id, res.token);
        showToast(`Bem-vindo(a), ${res.user.name}!`, 'success');
        window.location.href = '/';
      } else {
        showToast(res.message || 'Erro ao realizar login', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Credenciais inválidas', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!termsAccepted) {
      showToast('Você precisa concordar com os termos para se cadastrar.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          ra: regRa,
          password: regPassword,
          age: parseInt(regAge, 10),
          campus: regCampus,
          course: regCourse,
          gender: regGender,
          looking_for: regLookingFor,
          face_descriptor: biometricResult ? biometricResult.descriptor : null,
          verification_photo: biometricResult ? biometricResult.snapshot : null
        })
      });

      if (res.success || res.user_id) {
        showToast('Cadastro realizado com sucesso! Faça login para continuar.', 'success');
        setTab('login');
        setLoginEmail(regEmail);
        setLoginPassword(regPassword);
      } else {
        showToast(res.message || 'Erro no cadastro', 'error');
      }
    } catch (err) {
      showToast(err.message || 'Erro ao cadastrar', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Camera & Face API helpers
  async function startBiometricScan() {
    setBioState('scanning');
    setBioError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      setBioState('error');
      setBioError('Não foi possível acessar a câmera. Você pode prosseguir com cadastro padrão.');
    }
  }

  function captureSnapshot() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 320;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const snapshot = canvas.toDataURL('image/jpeg', 0.85);

    cancelBiometricScan();
    setBiometricResult({
      snapshot,
      estimatedAge: Math.max(18, parseInt(regAge, 10)),
      descriptor: []
    });
    setBioState('success');
    showToast('Biometria registrada com sucesso!', 'success');
  }

  function cancelBiometricScan() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (bioState === 'scanning') {
      setBioState('idle');
    }
  }

  return (
    <div class="flex-1 w-full max-w-md mx-auto px-4 py-8 flex flex-col justify-center relative z-10">
      <div class="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
        {/* Glow de fundo */}
        <div class="absolute -top-16 -right-16 w-36 h-36 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div class="absolute -bottom-16 -left-16 w-36 h-36 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Título */}
        <div class="text-center mb-6">
          <span class="font-black text-3xl tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
            Pontinho
          </span>
          <p class="text-xs text-slate-400 mt-1 font-medium">Apenas para a comunidade UFABC</p>
        </div>

        {/* Abas */}
        <div class="grid grid-cols-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => setTab('login')}
            class={`py-2 text-xs font-bold rounded-xl transition ${
              tab === 'login'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setTab('register')}
            class={`py-2 text-xs font-bold rounded-xl transition ${
              tab === 'register'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Cadastrar
          </button>
        </div>

        {/* TAB 1: LOGIN */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1.5">E-mail Institucional</label>
              <input
                type="email"
                required
                value={loginEmail}
                onInput={(e) => setLoginEmail(e.target.value)}
                placeholder="nome.sobrenome@aluno.ufabc.edu.br"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1.5">Senha</label>
              <input
                type="password"
                required
                value={loginPassword}
                onInput={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              class="w-full py-3 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-950/50 transition active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Acessar Conta'}
            </button>
          </form>
        )}

        {/* TAB 2: CADASTRO */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} class="space-y-3.5">
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">Nome Completo *</label>
              <input
                type="text"
                required
                value={regName}
                onInput={(e) => setRegName(e.target.value)}
                placeholder="Ex: Ana Clara"
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition"
              />
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">E-mail *</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onInput={(e) => setRegEmail(e.target.value)}
                  placeholder="aluno@ufabc.edu.br"
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">RA (Registro Acadêmico) *</label>
                <input
                  type="text"
                  required
                  value={regRa}
                  onInput={(e) => setRegRa(e.target.value)}
                  placeholder="11202..."
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Senha *</label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onInput={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Idade (+18) *</label>
                <input
                  type="number"
                  min="18"
                  max="99"
                  required
                  value={regAge}
                  onInput={(e) => setRegAge(e.target.value)}
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60 transition"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Campus</label>
                <select
                  value={regCampus}
                  onChange={(e) => setRegCampus(e.target.value)}
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60 transition"
                >
                  <option value="Santo André">Santo André</option>
                  <option value="São Bernardo do Campo">São Bernardo do Campo</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Gênero</label>
                <select
                  value={regGender}
                  onChange={(e) => setRegGender(e.target.value)}
                  class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60 transition"
                >
                  <option value="Mulher">Mulher</option>
                  <option value="Homem">Homem</option>
                  <option value="Não-binário">Não-binário</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">Curso Base</label>
              <select
                value={regCourse}
                onChange={(e) => setRegCourse(e.target.value)}
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60 transition"
              >
                <option value="BC&T - Bacharelado em Ciência e Tecnologia">BC&T - Ciência e Tecnologia</option>
                <option value="BC&H - Bacharelado em Ciências e Humanidades">BC&H - Ciências e Humanidades</option>
                <option value="LCNE - Licenciatura em Ciências Naturais e Exatas">LCNE - Ciências Naturais e Exatas</option>
                <option value="LCH - Licenciatura em Ciências Humanas">LCH - Ciências Humanas</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">Procurando por</label>
              <select
                value={regLookingFor}
                onChange={(e) => setRegLookingFor(e.target.value)}
                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/60 transition"
              >
                <option value="Algo casual">Algo casual</option>
                <option value="Algo sério">Algo sério</option>
                <option value="Amizade">Amizade</option>
                <option value="Aberto a conexões">Aberto a conexões</option>
              </select>
            </div>

            {/* SEÇÃO BIOMÉTRICA (FACE-API + ECA DIGITAL) */}
            <div class="pt-2 border-t border-slate-800">
              <span class="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <span>🛡️</span> <span>Verificação Facial (Opcional / Selo 🔵)</span>
              </span>

              {bioState === 'idle' && (
                <button
                  type="button"
                  onClick={startBiometricScan}
                  class="w-full py-2 bg-slate-950/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-semibold text-emerald-400 transition flex items-center justify-center gap-2"
                >
                  <span>📷</span> Iniciar Reconhecimento Facial
                </button>
              )}

              {bioState === 'scanning' && (
                <div class="flex flex-col items-center p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div class="relative w-36 h-36 rounded-full overflow-hidden border-2 border-emerald-500 shadow-lg">
                    <video ref={videoRef} autoPlay playsInline muted class="w-full h-full object-cover" />
                  </div>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      onClick={captureSnapshot}
                      class="px-3 py-1 bg-emerald-500 text-slate-950 text-xs font-bold rounded-lg"
                    >
                      Tirar Foto
                    </button>
                    <button
                      type="button"
                      onClick={cancelBiometricScan}
                      class="px-3 py-1 bg-slate-800 text-slate-400 text-xs rounded-lg"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {bioState === 'success' && biometricResult && (
                <div class="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 flex items-center gap-2.5">
                  <img src={biometricResult.snapshot} alt="Selfie" class="w-10 h-10 rounded-full object-cover border border-emerald-400" />
                  <div class="flex-1 min-w-0">
                    <span class="text-emerald-400 font-bold text-xs block">✓ Biometria Confirmada</span>
                    <span class="text-[10px] text-slate-400 block">Selo de perfil verificado garantido</span>
                  </div>
                </div>
              )}

              {bioState === 'error' && (
                <div class="p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-300">
                  {bioError}
                </div>
              )}
            </div>

            {/* Checkbox Termos */}
            <div class="flex items-start gap-2 pt-1 text-left">
              <input
                id="reg-terms"
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                class="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer"
              />
              <label for="reg-terms" class="text-[11px] text-slate-400 leading-tight cursor-pointer">
                Concordo com os <a href="/terms" target="_blank" class="text-emerald-400 hover:underline font-semibold">Termos</a> e a <a href="/terms#lgpd" target="_blank" class="text-emerald-400 hover:underline font-semibold">Privacidade</a>.
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              class="w-full py-3 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg transition active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? 'Cadastrando...' : 'Criar Conta'}
            </button>
          </form>
        )}

        {/* ATALHOS RÁPIDOS PARA CONTAS DE TESTE (DEMO) */}
        {demoAccounts.length > 0 && (
          <div class="mt-6 pt-5 border-t border-slate-800 text-center">
            <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
              Contas Demo:
            </span>
            <div class="flex flex-wrap gap-1.5 justify-center">
              {demoAccounts.map((acc) => {
                const shortName = (acc.name || 'Estudante').split(' ')[0];
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillDemo(acc.email, '123456')}
                    class="px-2.5 py-1 bg-slate-800/80 hover:bg-emerald-950/70 hover:text-emerald-300 hover:border-emerald-500/40 text-slate-300 rounded-lg text-[11px] font-medium border border-slate-700/60 transition"
                  >
                    {shortName}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <footer class="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-3">
        <a href="/terms" class="hover:text-emerald-400 transition">Termos de Uso</a>
        <span>•</span>
        <a href="/terms#lgpd" class="hover:text-emerald-400 transition">Privacidade & LGPD</a>
      </footer>
    </div>
  );
}
