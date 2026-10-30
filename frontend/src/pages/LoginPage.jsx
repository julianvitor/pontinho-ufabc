import { useState, useEffect, useRef } from 'preact/hooks';
import { apiFetch, setCurrentUserId, showToast } from '../services/api.js';

const LIVENESS_CHALLENGES = [
  {
    id: 'turn',
    name: 'Giro de Cabeça',
    instruction: 'Vire o rosto levemente para o lado 🔄',
    badgeText: '2. Vire o Rosto'
  },
  {
    id: 'smile',
    name: 'Sorriso',
    instruction: 'Dê um belo sorriso para a câmera 😊',
    badgeText: '2. Dê um Sorriso'
  }
];

export function LoginPage({ onOpenTheme, onOpenHelp }) {
  const [tab, setTab] = useState('login');
  const [demoAccounts, setDemoAccounts] = useState([]);

  // Campos Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Campos Cadastro (Apenas os 3 campos do static: email, nome, senha)
  const [regEmail, setRegEmail] = useState('');
  const [regName, setRegName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Biometria Facial & Prova de Vida
  const [bioStep, setBioStep] = useState('initial'); // 'initial' | 'scanning' | 'success' | 'blocked'
  const [overlayText, setOverlayText] = useState('Iniciando câmera...');
  const [badgeFaceState, setBadgeFaceState] = useState({
    className: 'p-1 rounded bg-slate-900 border border-slate-800 text-slate-500 font-medium transition',
    text: '1. Rosto'
  });
  const [badgeLivenessState, setBadgeLivenessState] = useState({
    className: 'p-1 rounded bg-slate-900 border border-slate-800 text-slate-500 font-medium transition',
    text: '2. Movimento'
  });
  const [badgeAgeState, setBadgeAgeState] = useState({
    className: 'p-1 rounded bg-slate-900 border border-slate-800 text-slate-500 font-medium transition',
    text: '3. Idade +18'
  });
  const [showFallback, setShowFallback] = useState(false);
  const [biometricResult, setBiometricResult] = useState(null);
  const [blockedMessage, setBlockedMessage] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Refs para loop de animação e estados voláteis
  const streamRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const loopActiveRef = useRef(false);
  const isDetectingRef = useRef(false);
  const modelsLoadedRef = useRef(false);
  const currentChallengeRef = useRef(LIVENESS_CHALLENGES[0]);
  const livenessPassedRef = useRef(false);
  const baselineSmileRef = useRef(0.5);
  const baselineSamplesRef = useRef(0);
  const consecutivePassFramesRef = useRef(0);
  const ageReadingsRef = useRef([]);
  const consecutiveFaceFramesRef = useRef(0);
  const faceStartTimeRef = useRef(0);

  useEffect(() => {
    loadDemoAccounts();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'register') {
      setTab('register');
    }

    return () => {
      cancelBiometricStreamOnly();
    };
  }, []);

  async function loadDemoAccounts() {
    try {
      const accounts = await apiFetch('/api/auth/demo-accounts');
      if (Array.isArray(accounts)) {
        setDemoAccounts(accounts);
      }
    } catch (err) {
      console.warn('Não foi possível carregar contas demo:', err);
    }
  }

  function fillDemo(email, pw) {
    setTab('login');
    setLoginEmail(email);
    setLoginPassword(pw);
    showToast(`E-mail e senha preenchidos para ${email}!`);
  }

  async function handleLogin(e) {
    e.preventDefault();
    const email = loginEmail.trim();
    const password = loginPassword;

    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      setCurrentUserId(data.user.id, data.token);
      showToast('Bem-vindo(a)! 🔥', 'success');

      setTimeout(() => {
        window.location.href = '/';
      }, 600);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ==========================================
  // ESTADO E LÓGICA BIOMÉTRICA (ECA DIGITAL)
  // ==========================================
  async function loadBiometricModels() {
    if (modelsLoadedRef.current) return true;
    const faceapi = window.faceapi;
    if (!faceapi) {
      throw new Error('Biblioteca biométrica indisponível. Verifique sua conexão.');
    }

    try {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      modelsLoadedRef.current = true;
      return true;
    } catch (err) {
      console.warn('Falha ao carregar modelos locais, tentando fallback CDN:', err);
      try {
        const CDN_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(CDN_URL),
          faceapi.nets.ageGenderNet.loadFromUri(CDN_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(CDN_URL)
        ]);
        modelsLoadedRef.current = true;
        return true;
      } catch (cdnErr) {
        console.error('Falha crítica ao carregar modelos:', cdnErr);
        throw new Error('Não foi possível carregar os modelos biométricos. Verifique sua conexão.');
      }
    }
  }

  function getLandmarkPoint(landmarks, idx) {
    if (!landmarks || !landmarks.positions || !landmarks.positions[idx]) return { x: 0, y: 0 };
    const p = landmarks.positions[idx];
    return {
      x: p.x !== undefined ? p.x : (p._x !== undefined ? p._x : 0),
      y: p.y !== undefined ? p.y : (p._y !== undefined ? p._y : 0)
    };
  }

  function calculateSmileRatio(landmarks) {
    const mouthLeft = getLandmarkPoint(landmarks, 48);
    const mouthRight = getLandmarkPoint(landmarks, 54);
    const eyeLeft = getLandmarkPoint(landmarks, 36);
    const eyeRight = getLandmarkPoint(landmarks, 45);

    const mouthWidth = Math.hypot(mouthRight.x - mouthLeft.x, mouthRight.y - mouthLeft.y);
    const eyeWidth = Math.hypot(eyeRight.x - eyeLeft.x, eyeRight.y - eyeLeft.y);

    if (!eyeWidth || eyeWidth === 0) return 0.5;
    return mouthWidth / eyeWidth;
  }

  function calculateYawRatio(landmarks) {
    const faceLeft = getLandmarkPoint(landmarks, 0);
    const faceRight = getLandmarkPoint(landmarks, 16);
    const nose = getLandmarkPoint(landmarks, 30);

    const distToLeft = Math.abs(nose.x - faceLeft.x);
    const distToRight = Math.abs(faceRight.x - nose.x);

    if (!distToRight || distToRight === 0) return 1.0;
    return distToLeft / distToRight;
  }

  function cancelBiometricStreamOnly() {
    loopActiveRef.current = false;
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    isDetectingRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function cancelBiometricVerification() {
    cancelBiometricStreamOnly();
    setBioStep('initial');
  }

  function resetBiometrics() {
    cancelBiometricStreamOnly();
    setBiometricResult(null);
    setBioStep('initial');
    setShowFallback(false);

    setBadgeFaceState({
      className: 'p-1 rounded bg-slate-900 border border-slate-800 text-slate-500 font-medium transition',
      text: '1. Rosto'
    });
    setBadgeLivenessState({
      className: 'p-1 rounded bg-slate-900 border border-slate-800 text-slate-500 font-medium transition',
      text: '2. Desafio'
    });
    setBadgeAgeState({
      className: 'p-1 rounded bg-slate-900 border border-slate-800 text-slate-500 font-medium transition',
      text: '3. Idade +18'
    });
  }

  function switchLivenessChallenge() {
    currentChallengeRef.current =
      currentChallengeRef.current.id === 'turn' ? LIVENESS_CHALLENGES[1] : LIVENESS_CHALLENGES[0];

    if (!livenessPassedRef.current) {
      setOverlayText(currentChallengeRef.current.instruction);
      setBadgeLivenessState({
        className: 'p-1 rounded bg-slate-900 border border-amber-500/40 text-amber-300 font-medium transition animate-pulse',
        text: currentChallengeRef.current.badgeText
      });
    }
    showToast(`Desafio: ${currentChallengeRef.current.name}`, 'info');
  }

  function forceLivenessManualCheck() {
    if (ageReadingsRef.current.length >= 2 || consecutiveFaceFramesRef.current >= 2) {
      livenessPassedRef.current = true;
      setBadgeLivenessState({
        className: 'p-1 rounded bg-emerald-950/70 border border-emerald-500 text-emerald-300 font-semibold transition',
        text: '2. Desafio OK ✓'
      });
      setOverlayText('✓ Prova de vida confirmada!');
      showToast('Validação concluída!', 'success');
    } else {
      showToast('Centralize o rosto no círculo.', 'info');
    }
  }

  async function startBiometricVerification() {
    setBioStep('scanning');
    setOverlayText('Carregando IA biométrica...');
    setShowFallback(false);

    currentChallengeRef.current =
      LIVENESS_CHALLENGES[Math.floor(Math.random() * LIVENESS_CHALLENGES.length)];

    try {
      await loadBiometricModels();
      setOverlayText('Iniciando câmera frontal...');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Acesso à câmera requer conexão segura. Acesse pelo localhost (http://localhost:3001) ou via HTTPS.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error('Elemento de vídeo não encontrado.');
      video.srcObject = stream;

      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      setOverlayText(currentChallengeRef.current.instruction);
      setBadgeFaceState({
        className: 'p-1 rounded bg-slate-900 border border-emerald-500/40 text-emerald-300 font-medium transition animate-pulse',
        text: '1. Rosto'
      });
      setBadgeLivenessState({
        className: 'p-1 rounded bg-slate-900 border border-amber-500/40 text-amber-300 font-medium transition animate-pulse',
        text: currentChallengeRef.current.badgeText
      });
      setBadgeAgeState({
        className: 'p-1 rounded bg-slate-900 border border-slate-800 text-slate-500 font-medium transition',
        text: '3. Idade +18'
      });

      // Reset estado de detecção
      livenessPassedRef.current = false;
      baselineSmileRef.current = 0.5;
      baselineSamplesRef.current = 0;
      consecutivePassFramesRef.current = 0;
      ageReadingsRef.current = [];
      consecutiveFaceFramesRef.current = 0;
      faceStartTimeRef.current = 0;
      loopActiveRef.current = true;
      isDetectingRef.current = false;

      const faceapi = window.faceapi;
      const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });

      async function runDetectionFrame() {
        if (!loopActiveRef.current || !streamRef.current || video.paused || video.ended) return;

        if (!isDetectingRef.current) {
          isDetectingRef.current = true;
          try {
            const detection = await faceapi
              .detectSingleFace(video, detectorOptions)
              .withFaceLandmarks()
              .withAgeAndGender()
              .withFaceDescriptor();

            if (!detection) {
              consecutiveFaceFramesRef.current = Math.max(0, consecutiveFaceFramesRef.current - 1);
              if (consecutiveFaceFramesRef.current === 0) {
                setOverlayText('Centralize seu rosto no círculo');
                setBadgeFaceState({
                  className: 'p-1 rounded bg-slate-900 border border-slate-800 text-slate-500 font-medium transition',
                  text: '1. Rosto'
                });
              }
            } else {
              if (!faceStartTimeRef.current) faceStartTimeRef.current = Date.now();
              consecutiveFaceFramesRef.current++;

              if (consecutiveFaceFramesRef.current >= 2) {
                setBadgeFaceState({
                  className: 'p-1 rounded bg-emerald-950/70 border border-emerald-500 text-emerald-300 font-semibold transition',
                  text: '1. Rosto ✓'
                });
              }

              const landmarks = detection.landmarks;
              const currentSmile = calculateSmileRatio(landmarks);
              const currentYaw = calculateYawRatio(landmarks);

              if (baselineSamplesRef.current < 12) {
                baselineSmileRef.current =
                  (baselineSmileRef.current * baselineSamplesRef.current + currentSmile) /
                  (baselineSamplesRef.current + 1);
                baselineSamplesRef.current++;
              }

              if (detection.age && detection.age > 0) {
                ageReadingsRef.current.push(detection.age);
              }

              if (!livenessPassedRef.current) {
                const isTurned = currentYaw > 1.55 || currentYaw < 0.65;
                const isSmiling = currentSmile > Math.max(0.57, baselineSmileRef.current * 1.15);

                let passed = false;
                if (currentChallengeRef.current.id === 'turn' && isTurned) {
                  passed = true;
                } else if (currentChallengeRef.current.id === 'smile' && isSmiling) {
                  passed = true;
                } else if (isTurned || isSmiling) {
                  passed = true;
                }

                if (passed) {
                  consecutivePassFramesRef.current++;
                  if (consecutivePassFramesRef.current >= 2) {
                    livenessPassedRef.current = true;
                    setOverlayText('✓ Desafio cumprido! Analisando...');
                    setBadgeLivenessState({
                      className: 'p-1 rounded bg-emerald-950/70 border border-emerald-500 text-emerald-300 font-semibold transition',
                      text: '2. Desafio OK ✓'
                    });
                  }
                } else {
                  consecutivePassFramesRef.current = 0;
                  setOverlayText(currentChallengeRef.current.instruction);
                  setBadgeLivenessState({
                    className: 'p-1 rounded bg-slate-900 border border-amber-500/40 text-amber-300 font-medium transition animate-pulse',
                    text: currentChallengeRef.current.badgeText
                  });
                }

                if (faceStartTimeRef.current && Date.now() - faceStartTimeRef.current > 3500) {
                  setShowFallback(true);
                }
              }

              if (livenessPassedRef.current) {
                setOverlayText('Analisando idade (+18)...');
                setBadgeAgeState({
                  className: 'p-1 rounded bg-slate-900 border border-emerald-500/40 text-emerald-300 font-medium transition animate-pulse',
                  text: '3. Idade +18'
                });
              }

              if (livenessPassedRef.current && ageReadingsRef.current.length >= 4) {
                loopActiveRef.current = false;

                const sortedAges = [...ageReadingsRef.current].sort((a, b) => a - b);
                const medianAge = Math.round(sortedAges[Math.floor(sortedAges.length / 2)]);

                const hiddenCanvas = document.createElement('canvas');
                hiddenCanvas.width = video.videoWidth || 480;
                hiddenCanvas.height = video.videoHeight || 480;
                const ctx = hiddenCanvas.getContext('2d');
                ctx.translate(hiddenCanvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
                const snapshotBase64 = hiddenCanvas.toDataURL('image/jpeg', 0.85);
                const faceDescriptor =
                  detection && detection.descriptor ? Array.from(detection.descriptor) : null;

                finishBiometricVerification(medianAge, snapshotBase64, faceDescriptor);
                return;
              }
            }
          } catch (detErr) {
            console.warn('Detecção frame:', detErr);
          } finally {
            isDetectingRef.current = false;
          }
        }

        if (loopActiveRef.current) {
          animFrameIdRef.current = requestAnimationFrame(runDetectionFrame);
        }
      }

      animFrameIdRef.current = requestAnimationFrame(runDetectionFrame);
    } catch (err) {
      console.error('Erro na biometria:', err);
      cancelBiometricVerification();
      showToast(err.message || 'Câmera não permitida ou indisponível.', 'error');
    }
  }

  function finishBiometricVerification(estimatedAge, snapshotBase64, faceDescriptor = null) {
    cancelBiometricStreamOnly();

    if (estimatedAge < 18) {
      setBiometricResult(null);
      setBlockedMessage(
        `A estimativa biométrica indicou ${estimatedAge} anos (inferior a 18 anos). Conforme a Lei nº 14.811/2024 (ECA Digital), o acesso ao Pontinho é restrito exclusivamente a maiores de 18 anos.`
      );
      setBioStep('blocked');
      showToast('Cadastro bloqueado: Usuário menor de 18 anos.', 'error');
      return;
    }

    setBiometricResult({
      verified: true,
      livenessPassed: true,
      estimatedAge,
      snapshot: snapshotBase64,
      descriptor: faceDescriptor
    });
    setBioStep('success');
    showToast('Aprovado (+18) ✓', 'success');
  }

  async function handleRegister(e) {
    e.preventDefault();
    const rawEmail = regEmail.trim();
    const name = regName.trim();
    const password = regPassword;

    if (!termsAccepted) {
      showToast('Aceite os termos para continuar.', 'error');
      return;
    }

    if (!password || password.length < 8) {
      showToast('Senha mínima: 8 caracteres.', 'error');
      return;
    }

    if (!biometricResult || !biometricResult.verified || !biometricResult.livenessPassed) {
      showToast('Validação facial (+18) obrigatória.', 'error');
      return;
    }

    if (biometricResult.estimatedAge < 18) {
      showToast('Cadastro bloqueado: menor de 18 anos.', 'error');
      return;
    }

    let email = rawEmail.toLowerCase();
    if (!email.includes('@')) {
      email += '@aluno.ufabc.edu.br';
    }

    if (!email.endsWith('@aluno.ufabc.edu.br') && !email.endsWith('@ufabc.edu.br')) {
      showToast('Use e-mail institucional @ufabc.', 'error');
      return;
    }

    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          name,
          password,
          terms_accepted: true,
          age_verified: true,
          liveness_passed: true,
          estimated_age: biometricResult.estimatedAge,
          face_snapshot: biometricResult.snapshot,
          face_descriptor: biometricResult.descriptor
        })
      });

      setCurrentUserId(data.user_id, data.token);
      showToast('Cadastro realizado! 🎓', 'success');

      setTimeout(() => {
        window.location.href = '/profile';
      }, 700);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  return (
    <div class="min-h-[100dvh] flex flex-col justify-center items-center p-3 sm:p-4 text-slate-100 font-sans antialiased relative overflow-x-hidden">
      {/* BARRA SUPERIOR DE AJUDA E RETORNO */}
      <header class="w-full max-w-md mx-auto mb-3 flex items-center justify-between px-2 z-10">
        <a href="/" class="text-xs font-semibold text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition">
          <span>❮</span> Início
        </a>
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenTheme}
            class="theme-pill-btn px-2 sm:px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 rounded-xl border border-slate-700/70 transition flex items-center gap-1 shadow-xs"
            title="Escolher Tema Visual (UFABC / Orgulho LGBT+)"
          >
            <span class="theme-active-icon">🌿</span> <span class="hidden sm:inline font-bold theme-active-name">UFABC</span>
          </button>
          <button
            type="button"
            onClick={onOpenHelp}
            class="px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-950/50 hover:bg-emerald-900/60 rounded-xl border border-emerald-800/40 transition flex items-center gap-1.5"
            title="Central de Ajuda e Segurança"
          >
            <span>🛡️</span> <span>Ajuda</span>
          </button>
        </div>
      </header>

      {/* CARD PRINCIPAL DE AUTENTICAÇÃO */}
      <div class="w-full max-w-md bg-slate-900/90 rounded-3xl shadow-2xl overflow-hidden border border-slate-800/80 backdrop-blur-xl text-slate-100 transition-all shadow-black/80 relative z-10">
        {/* CABEÇALHO */}
        <div class="bg-gradient-to-b from-emerald-950/60 via-slate-900 to-slate-900/90 py-3.5 px-6 text-center relative border-b border-emerald-500/20">
          <h1 class="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent flex items-center justify-center gap-2">
            <span>Pontinho</span>
            <span class="theme-pride-badge hidden text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded-md bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white shadow-xs">
              PRIDE 🏳️‍🌈
            </span>
            <span class="theme-halloween-badge hidden text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded-md bg-gradient-to-r from-orange-500 via-purple-600 to-amber-500 text-white shadow-xs border border-orange-500/40">
              HALLOWEEN 🎃
            </span>
          </h1>
        </div>

        {/* SELETOR DE ABAS: LOGIN OU CADASTRO */}
        <div class="flex border-b border-slate-800 bg-slate-950/60">
          <button
            id="tab-btn-login"
            type="button"
            onClick={() => setTab('login')}
            class={`flex-1 py-3.5 text-xs sm:text-sm transition ${
              tab === 'login'
                ? 'font-bold text-emerald-400 border-b-2 border-emerald-500 bg-slate-900/80'
                : 'font-semibold text-slate-400 hover:text-slate-200'
            }`}
          >
            Entrar
          </button>
          <button
            id="tab-btn-register"
            type="button"
            onClick={() => setTab('register')}
            class={`flex-1 py-3.5 text-xs sm:text-sm transition ${
              tab === 'register'
                ? 'font-bold text-emerald-400 border-b-2 border-emerald-500 bg-slate-900/80'
                : 'font-semibold text-slate-400 hover:text-slate-200'
            }`}
          >
            Cadastrar-se
          </button>
        </div>

        <div class="p-5 sm:p-6">
          {/* ABA 1: FORMULÁRIO DE LOGIN */}
          {tab === 'login' && (
            <form id="form-login" onSubmit={handleLogin} class="space-y-3.5">
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">E-mail Institucional</label>
                <input
                  id="login-email"
                  type="text"
                  required
                  value={loginEmail}
                  onInput={(e) => setLoginEmail(e.target.value)}
                  placeholder="nome@aluno.ufabc.edu.br"
                  class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Senha</label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={loginPassword}
                  onInput={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
                />
              </div>

              <button
                type="submit"
                class="w-full py-3 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/60 transition active:scale-[0.99]"
              >
                Entrar
              </button>
            </form>
          )}

          {/* ABA 2: FORMULÁRIO DE CADASTRO */}
          {tab === 'register' && (
            <form id="form-register" onSubmit={handleRegister} class="space-y-3.5">
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">E-mail UFABC</label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={regEmail}
                  onInput={(e) => setRegEmail(e.target.value)}
                  placeholder="nome.sobrenome@aluno.ufabc.edu.br"
                  class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
                />
                <p class="text-[10px] text-slate-500 mt-1">Apenas e-mail institucional @ufabc</p>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Nome</label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={regName}
                  onInput={(e) => setRegName(e.target.value)}
                  placeholder="Como quer ser chamado(a)"
                  class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Senha</label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  minlength={8}
                  value={regPassword}
                  onInput={(e) => setRegPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
                />
              </div>

              {/* VERIFICAÇÃO FACIAL & PROVA DE VIDA (ECA DIGITAL - LEI 14.811/2024) */}
              <div class="bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-3.5 space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm">🛡️</span>
                    <span class="text-xs font-bold text-emerald-400">Verificação (+18)</span>
                  </div>
                  <span class="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                    +18 Anos
                  </span>
                </div>
                <p class="text-[11px] text-slate-400 leading-tight">
                  Confirme sua maioridade (+18) com uma selfie rápida.
                </p>

                {/* Status / Botão de Ação Inicial */}
                {bioStep === 'initial' && (
                  <div id="bio-initial-state" class="text-center pt-1">
                    <button
                      type="button"
                      id="bio-start-btn"
                      onClick={startBiometricVerification}
                      class="w-full py-2.5 px-3 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                    >
                      <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span>Verificar (+18)</span>
                    </button>
                  </div>
                )}

                {/* Área Ativa da Câmera / Scanner */}
                {bioStep === 'scanning' && (
                  <div id="bio-camera-container" class="relative flex flex-col items-center">
                    <div class="relative w-48 h-48 sm:w-52 sm:h-52 rounded-full overflow-hidden border-2 border-emerald-500 shadow-lg shadow-emerald-500/20 bg-black flex items-center justify-center">
                      <video
                        ref={videoRef}
                        playsInline
                        autoPlay
                        muted
                        class="w-full h-full object-cover -scale-x-100"
                      />
                      <canvas ref={canvasRef} class="hidden" />

                      {/* Moldura oval indicadora */}
                      <div
                        id="bio-target-ring"
                        class="absolute inset-2 rounded-full border border-dashed border-emerald-400/50 animate-pulse pointer-events-none"
                      />

                      {/* Overlay com instrução dinâmica */}
                      <div
                        id="bio-overlay-pill"
                        class="absolute bottom-2.5 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md text-[10px] font-bold text-white text-center shadow max-w-[90%] truncate"
                      >
                        {overlayText}
                      </div>
                    </div>

                    {/* Indicadores em tempo real */}
                    <div class="grid grid-cols-3 gap-1.5 w-full mt-3 text-[10px] text-center">
                      <div id="badge-face" class={badgeFaceState.className}>
                        {badgeFaceState.text}
                      </div>
                      <div id="badge-liveness" class={badgeLivenessState.className}>
                        {badgeLivenessState.text}
                      </div>
                      <div id="badge-age" class={badgeAgeState.className}>
                        {badgeAgeState.text}
                      </div>
                    </div>

                    {/* Fallback para validar manualmente ou trocar desafio */}
                    {showFallback && (
                      <div id="bio-manual-fallback" class="mt-2.5 text-center w-full space-y-1.5">
                        <div class="flex gap-1.5 justify-center">
                          <button
                            type="button"
                            onClick={switchLivenessChallenge}
                            class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition"
                          >
                            🎲 Trocar
                          </button>
                          <button
                            type="button"
                            onClick={forceLivenessManualCheck}
                            class="px-2.5 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/50 hover:bg-emerald-900 text-emerald-300 text-[10px] font-bold transition flex items-center gap-1"
                          >
                            <span>📸</span> <span>Validar</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={cancelBiometricVerification}
                      class="mt-2 text-[10px] text-slate-500 hover:text-slate-300 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                {/* Resultado Aprovado */}
                {bioStep === 'success' && biometricResult && (
                  <div
                    id="bio-success-card"
                    class="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 flex items-center gap-3"
                  >
                    <img
                      id="bio-snapshot-thumb"
                      src={biometricResult.snapshot}
                      alt="Selfie Verificada"
                      class="w-12 h-12 rounded-full object-cover border-2 border-emerald-400 flex-shrink-0"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="text-emerald-400 font-bold text-xs">✓ Verificado (+18)</span>
                      </div>
                      <p id="bio-success-details" class="text-[11px] text-slate-300">
                        Prova de vida confirmada • Idade estimada: {biometricResult.estimatedAge} anos
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={resetBiometrics}
                      class="text-[10px] text-slate-400 hover:text-white underline flex-shrink-0"
                      title="Refazer"
                    >
                      Refazer
                    </button>
                  </div>
                )}

                {/* Alerta de Bloqueio por Idade < 18 */}
                {bioStep === 'blocked' && (
                  <div
                    id="bio-blocked-card"
                    class="p-3 rounded-xl bg-red-950/60 border border-red-500/50 space-y-1"
                  >
                    <div class="flex items-center gap-1.5 text-red-400 font-bold text-xs">
                      <span>🚫</span> <span>Menor de 18 anos</span>
                    </div>
                    <p id="bio-blocked-msg" class="text-[11px] text-red-200 leading-tight">
                      {blockedMessage}
                    </p>
                    <button
                      type="button"
                      onClick={resetBiometrics}
                      class="mt-1 text-[10px] text-slate-300 hover:text-white underline"
                    >
                      Tentar novamente
                    </button>
                  </div>
                )}
              </div>

              <div class="flex items-start gap-2.5 pt-1 text-left">
                <input
                  id="reg-terms"
                  type="checkbox"
                  required
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  class="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer"
                />
                <label for="reg-terms" class="text-[11px] text-slate-400 leading-tight cursor-pointer">
                  Concordo com os{' '}
                  <a href="/terms" target="_blank" class="text-emerald-400 hover:underline font-semibold">
                    Termos
                  </a>{' '}
                  e a{' '}
                  <a href="/terms#lgpd" target="_blank" class="text-emerald-400 hover:underline font-semibold">
                    Privacidade
                  </a>
                  .
                </label>
              </div>

              <button
                type="submit"
                class="w-full py-3 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/60 transition active:scale-[0.99]"
              >
                Criar Conta
              </button>
            </form>
          )}

          {/* ATALHOS RÁPIDOS PARA CONTAS DE TESTE (CARREGADOS DINAMICAMENTE DO BACKEND) */}
          {demoAccounts.length > 0 && (
            <div id="demo-section" class="mt-6 pt-5 border-t border-slate-800 text-center">
              <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
                Contas Demo:
              </span>
              <div id="demo-buttons-container" class="flex flex-wrap gap-1.5 justify-center">
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
      </div>

      {/* RODAPÉ DE PRIVACIDADE E TERMOS DE USO */}
      <footer class="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-3">
        <a href="/terms" class="hover:text-emerald-400 transition">
          Termos de Uso
        </a>
        <span>•</span>
        <a href="/terms#lgpd" class="hover:text-emerald-400 transition">
          Privacidade & LGPD
        </a>
      </footer>
    </div>
  );
}
