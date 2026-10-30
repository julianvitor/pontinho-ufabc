import { useState, useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { apiFetch, getCurrentUserId, uploadPhoto, resolveMediaUrl, showToast, logout } from '../services/api.js';
import { applyTheme, getStoredTheme, onThemeChange } from '../services/theme.js';
import { UnsavedChangesModal } from '../components/UnsavedChangesModal.jsx';

const VERIFY_CHALLENGES = [
  { id: 'smile', instruction: 'Dê um belo sorriso para a câmera 😊', badge: '2. Dê um Sorriso' },
  { id: 'turn', instruction: 'Vire o rosto levemente para o lado 🔄', badge: '2. Vire o Rosto' }
];

export function ProfilePage() {
  const [user, setUser] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(getStoredTheme());

  // Form states
  const [name, setName] = useState('');
  const [age, setAge] = useState(20);
  const [email, setEmail] = useState('');
  const [campus, setCampus] = useState('Santo André');
  const [course, setCourse] = useState('BC&T - Bacharelado em Ciência e Tecnologia');
  const [specificCourse, setSpecificCourse] = useState('Ciência da Computação');
  const [entity, setEntity] = useState('Nenhuma / Foco no CR');
  const [lookingFor, setLookingFor] = useState('Algo casual');
  const [gender, setGender] = useState('Mulher');
  const [targetGender, setTargetGender] = useState('Todos');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState([]);
  const [newInterest, setNewInterest] = useState('');
  const [photos, setPhotos] = useState([]);
  const [uploadingPublic, setUploadingPublic] = useState(false);
  const [privatePhotos, setPrivatePhotos] = useState([]);
  const [uploadingPrivate, setUploadingPrivate] = useState(false);
  const [privateBio, setPrivateBio] = useState('');

  // Músicas
  const [song1, setSong1] = useState('');
  const [song2, setSong2] = useState('');
  const [song3, setSong3] = useState('');

  // Prompts
  const [prompt1_q, setPrompt1_q] = useState("O melhor lugar para relaxar e fugir da rotina é...");
  const [prompt1_a, setPrompt1_a] = useState("");
  const [prompt2_q, setPrompt2_q] = useState("Minha opinião impopular sobre primeiro encontro...");
  const [prompt2_a, setPrompt2_a] = useState("");
  const [prompt3_q, setPrompt3_q] = useState("No intervalo entre as obrigações você me encontra...");
  const [prompt3_a, setPrompt3_a] = useState("");

  // Status de Verificação Facial
  const [isVerified, setIsVerified] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [verifyLoadingModels, setVerifyLoadingModels] = useState(false);
  const [verifyInstruction, setVerifyInstruction] = useState('Iniciando câmera...');
  const [badgeFaceStatus, setBadgeFaceStatus] = useState('1. Centralize seu rosto');
  const [badgeFaceOk, setBadgeFaceOk] = useState(false);
  const [badgeLivenessText, setBadgeLivenessText] = useState('2. Movimento');
  const [badgeLivenessOk, setBadgeLivenessOk] = useState(false);
  const [verifyComparing, setVerifyComparing] = useState(false);
  const [verifyComparisonDetails, setVerifyComparisonDetails] = useState('');
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const videoRef = useRef(null);
  const verifyStreamRef = useRef(null);
  const verifyAnimIdRef = useRef(null);
  const verifyLoopActiveRef = useRef(false);
  const verifyIsDetectingRef = useRef(false);
  const verifyLivenessPassedRef = useRef(false);
  const verifyConsecutivePassRef = useRef(0);
  const verifyChallengeRef = useRef(null);
  const photoDescriptorCacheRef = useRef(new Map());

  // Rastreamento e diálogo de alterações não salvas
  const initialSnapshotRef = useRef(null);
  const isDirtyRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  function getCurrentSnapshot() {
    return JSON.stringify({
      name: (name || '').trim(),
      age: parseInt(age, 10) || 20,
      campus: campus || '',
      course: course || '',
      specificCourse: specificCourse || '',
      entity: entity || '',
      lookingFor: lookingFor || '',
      gender: gender || '',
      targetGender: targetGender || '',
      bio: (bio || '').trim(),
      interests: Array.isArray(interests) ? [...interests].sort() : [],
      photos: Array.isArray(photos) ? photos : [],
      privatePhotos: Array.isArray(privatePhotos) ? privatePhotos : [],
      privateBio: (privateBio || '').trim(),
      song1: (song1 || '').trim(),
      song2: (song2 || '').trim(),
      song3: (song3 || '').trim(),
      prompt1_q: prompt1_q || '',
      prompt1_a: (prompt1_a || '').trim(),
      prompt2_q: prompt2_q || '',
      prompt2_a: (prompt2_a || '').trim(),
      prompt3_q: prompt3_q || '',
      prompt3_a: (prompt3_a || '').trim()
    });
  }

  const currentUserId = getCurrentUserId();

  useEffect(() => {
    if (!currentUserId) {
      window.location.href = '/login';
      return;
    }
    const unsub = onThemeChange((t) => setCurrentTheme(t));
    initData();
    return () => {
      unsub();
      stopVerifyCamera();
    };
  }, []);

  async function initData() {
    setLoading(true);
    try {
      const [metaData, userData] = await Promise.all([
        apiFetch('/api/metadata').catch(() => null),
        apiFetch('/api/users/me')
      ]);

      if (metaData) setMetadata(metaData);
      if (userData) {
        setUser(userData);
        setIsVerified(!!userData.is_verified);
        setName(userData.name || '');
        setAge(userData.age || 20);
        setEmail(userData.email || '');
        setCampus(userData.campus || 'Santo André');
        setCourse(userData.course || 'BC&T - Bacharelado em Ciência e Tecnologia');
        setSpecificCourse(userData.specific_course || 'Ciência da Computação');
        setEntity(userData.entity || 'Nenhuma / Foco no CR');
        setLookingFor(userData.looking_for || 'Algo casual');
        setGender(userData.gender || 'Mulher');
        setTargetGender(userData.target_gender || 'Todos');
        setBio(userData.bio || '');
        setInterests(Array.isArray(userData.interests) ? userData.interests : []);
        setPhotos(Array.isArray(userData.photos) ? userData.photos : []);
        setPrivatePhotos(Array.isArray(userData.private_photos) ? userData.private_photos : []);
        setPrivateBio(userData.private_bio || '');

        const songsList = Array.isArray(userData.songs) ? userData.songs : [];
        setSong1(songsList[0] || '');
        setSong2(songsList[1] || '');
        setSong3(songsList[2] || '');

        const defaultP1 = (metaData && metaData.prompts && metaData.prompts[0]?.question) || "O melhor lugar para relaxar e fugir da rotina é...";
        const defaultP2 = (metaData && metaData.prompts && metaData.prompts[1]?.question) || "Minha opinião impopular sobre primeiro encontro...";
        const defaultP3 = (metaData && metaData.prompts && metaData.prompts[2]?.question) || "No intervalo entre as obrigações você me encontra...";

        setPrompt1_q(userData.prompt1_q || defaultP1);
        setPrompt1_a(userData.prompt1_a || "");
        setPrompt2_q(userData.prompt2_q || defaultP2);
        setPrompt2_a(userData.prompt2_a || "");
        setPrompt3_q(userData.prompt3_q || defaultP3);
        setPrompt3_a(userData.prompt3_a || "");

        // Inicializa snapshot base para rastreamento de alterações
        const snap = JSON.stringify({
          name: (userData.name || '').trim(),
          age: parseInt(userData.age || 20, 10),
          campus: userData.campus || 'Santo André',
          course: userData.course || 'BC&T - Bacharelado em Ciência e Tecnologia',
          specificCourse: userData.specific_course || 'Ciência da Computação',
          entity: userData.entity || 'Nenhuma / Foco no CR',
          lookingFor: userData.looking_for || 'Algo casual',
          gender: userData.gender || 'Mulher',
          targetGender: userData.target_gender || 'Todos',
          bio: (userData.bio || '').trim(),
          interests: Array.isArray(userData.interests) ? [...userData.interests].sort() : [],
          photos: Array.isArray(userData.photos) ? userData.photos : [],
          privatePhotos: Array.isArray(userData.private_photos) ? userData.private_photos : [],
          privateBio: (userData.private_bio || '').trim(),
          song1: (songsList[0] || '').trim(),
          song2: (songsList[1] || '').trim(),
          song3: (songsList[2] || '').trim(),
          prompt1_q: userData.prompt1_q || defaultP1,
          prompt1_a: (userData.prompt1_a || '').trim(),
          prompt2_q: userData.prompt2_q || defaultP2,
          prompt2_a: (userData.prompt2_a || '').trim(),
          prompt3_q: userData.prompt3_q || defaultP3,
          prompt3_a: (userData.prompt3_a || '').trim()
        });
        initialSnapshotRef.current = snap;
        setIsDirty(false);
        isDirtyRef.current = false;
      }
    } catch (err) {
      showToast(err.message || 'Erro ao carregar perfil', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Monitora alterações dos dados para ativar estado dirty
  useEffect(() => {
    if (!initialSnapshotRef.current) return;
    const current = getCurrentSnapshot();
    const dirty = current !== initialSnapshotRef.current;
    setIsDirty(dirty);
    isDirtyRef.current = dirty;
  }, [
    name, age, campus, course, specificCourse, entity, lookingFor,
    gender, targetGender, bio, interests, photos, privatePhotos,
    privateBio, song1, song2, song3,
    prompt1_q, prompt1_a, prompt2_q, prompt2_a, prompt3_q, prompt3_a
  ]);

  // Intercepta navegação externa, cliques no menu, botão sair e fechar página caso haja alterações pendentes
  useEffect(() => {
    function handleDocumentClick(e) {
      if (!isDirtyRef.current) return;

      // Não intercepta se o clique for dentro do próprio modal de confirmação
      if (e.target.closest('#unsaved-changes-modal-backdrop')) return;

      // Intercepta botão de Logout no Navbar
      const logoutBtn = e.target.closest('#navbar-user-box button');
      if (logoutBtn) {
        e.preventDefault();
        e.stopPropagation();
        setPendingNavigation('LOGOUT');
        setShowUnsavedModal(true);
        return;
      }

      // Intercepta qualquer link de navegação que saia de /profile
      const anchor = e.target.closest('a[href]');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      try {
        const targetUrl = new URL(anchor.href, window.location.origin);
        if (targetUrl.pathname !== window.location.pathname) {
          e.preventDefault();
          e.stopPropagation();
          setPendingNavigation(targetUrl.pathname + targetUrl.search + targetUrl.hash);
          setShowUnsavedModal(true);
        }
      } catch (_) {}
    }

    function handleBeforeUnload(e) {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    }

    function handlePopState() {
      if (isDirtyRef.current) {
        window.history.pushState(null, '', window.location.href);
        setPendingNavigation('BACK');
        setShowUnsavedModal(true);
      }
    }

    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  function executeNavigation(nav) {
    if (!nav) return;
    if (nav === 'BACK') {
      window.history.back();
    } else if (nav === 'LOGOUT') {
      logout().then(() => {
        window.location.href = '/';
      });
    } else {
      window.location.href = nav;
    }
  }

  async function handleModalSaveAndExit() {
    const success = await handleSaveProfile();
    if (success) {
      setShowUnsavedModal(false);
      const dest = pendingNavigation;
      setPendingNavigation(null);
      executeNavigation(dest);
    } else {
      setShowUnsavedModal(false);
    }
  }

  function handleModalDiscardAndExit() {
    setIsDirty(false);
    isDirtyRef.current = false;
    setShowUnsavedModal(false);
    const dest = pendingNavigation;
    setPendingNavigation(null);
    executeNavigation(dest);
  }

  function handleModalCancel() {
    setShowUnsavedModal(false);
    setPendingNavigation(null);
  }

  // --- MODELOS FACE-API E DESCRITORES ---
  async function ensureFaceApiModels() {
    if (typeof window === 'undefined' || !window.faceapi) return false;
    const faceapi = window.faceapi;
    if (faceapi.nets.tinyFaceDetector.params) return true;

    try {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      return true;
    } catch (_) {
      try {
        const CDN_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(CDN_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(CDN_URL)
        ]);
        return true;
      } catch (err2) {
        console.warn('Erro ao carregar modelos faceapi:', err2);
        return false;
      }
    }
  }

  async function getOrComputePhotoDescriptor(photoUrl) {
    if (!photoUrl || typeof window === 'undefined' || !window.faceapi) return null;
    const cache = photoDescriptorCacheRef.current;
    if (cache.has(photoUrl)) return cache.get(photoUrl);

    await ensureFaceApiModels();
    const faceapi = window.faceapi;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        try {
          const det = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 }))
            .withFaceLandmarks()
            .withFaceDescriptor();
          const desc = det && det.descriptor ? Array.from(det.descriptor) : null;
          if (desc) cache.set(photoUrl, desc);
          resolve(desc);
        } catch (_) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = resolveMediaUrl(photoUrl);
    });
  }

  // --- FLUXO DE VERIFICAÇÃO FACIAL COM CÂMERA ---
  async function openVerificationModal() {
    if (photos.length < 2) {
      showToast('Adicione ao menos 2 fotos ao perfil antes de verificar.', 'error');
      return;
    }

    const challenge = VERIFY_CHALLENGES[Math.floor(Math.random() * VERIFY_CHALLENGES.length)];
    verifyChallengeRef.current = challenge;
    verifyLivenessPassedRef.current = false;
    verifyConsecutivePassRef.current = 0;
    verifyLoopActiveRef.current = true;
    verifyIsDetectingRef.current = false;

    setVerifyModalOpen(true);
    setVerifyLoadingModels(true);
    setVerifyInstruction('Iniciando câmera...');
    setBadgeFaceStatus('1. Centralize seu rosto');
    setBadgeFaceOk(false);
    setBadgeLivenessText(challenge.badge);
    setBadgeLivenessOk(false);
    setVerifyComparing(false);
    setVerifyComparisonDetails('');
    setVerifySuccess(false);
    setVerifyError('');

    try {
      await ensureFaceApiModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      verifyStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            resolve();
          };
        });
      }

      setVerifyLoadingModels(false);
      setVerifyInstruction(challenge.instruction);
      startVerifyLoop();

    } catch (err) {
      console.error('Erro na câmera de verificação:', err);
      stopVerifyCamera();
      setVerifyModalOpen(false);
      showToast(err.message || 'Câmera não permitida ou indisponível.', 'error');
    }
  }

  function startVerifyLoop() {
    const faceapi = window.faceapi;
    if (!faceapi) return;
    const detectorOpts = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });

    async function stepVerifyFrame() {
      if (!verifyLoopActiveRef.current || !verifyStreamRef.current || !videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        return;
      }

      if (!verifyIsDetectingRef.current) {
        verifyIsDetectingRef.current = true;
        try {
          const detection = await faceapi.detectSingleFace(videoRef.current, detectorOpts)
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (!detection) {
            setBadgeFaceStatus('1. Centralize seu rosto');
            setBadgeFaceOk(false);
          } else {
            setBadgeFaceStatus('1. Rosto OK ✓');
            setBadgeFaceOk(true);

            const landmarks = detection.landmarks;
            const nose = landmarks.getNose();
            const jaw = landmarks.getJawOutline();
            const mouth = landmarks.getMouth();

            if (!verifyLivenessPassedRef.current) {
              let passCondition = false;
              const ch = verifyChallengeRef.current;
              if (ch.id === 'turn') {
                const noseTip = nose[3];
                const leftJaw = jaw[0];
                const rightJaw = jaw[16];
                const distLeft = Math.abs(noseTip.x - leftJaw.x);
                const distRight = Math.abs(rightJaw.x - noseTip.x);
                const yawRatio = distLeft / (distRight || 1);
                if (yawRatio < 0.55 || yawRatio > 1.8) {
                  passCondition = true;
                }
              } else if (ch.id === 'smile') {
                const mouthLeft = mouth[0];
                const mouthRight = mouth[6];
                const mouthWidth = Math.hypot(mouthRight.x - mouthLeft.x, mouthRight.y - mouthLeft.y);
                const jawWidth = Math.hypot(jaw[16].x - jaw[0].x, jaw[16].y - jaw[0].y);
                const smileRatio = mouthWidth / (jawWidth || 1);
                if (smileRatio > 0.48) {
                  passCondition = true;
                }
              }

              if (passCondition) {
                verifyConsecutivePassRef.current++;
                if (verifyConsecutivePassRef.current >= 2) {
                  verifyLivenessPassedRef.current = true;
                  setBadgeLivenessText('2. Prova de vida OK ✓');
                  setBadgeLivenessOk(true);
                  setVerifyInstruction('Comparando com suas fotos públicas...');

                  // Pausa detecção e compara
                  verifyLoopActiveRef.current = false;
                  const liveDesc = Array.from(detection.descriptor);
                  await executeComparison(liveDesc);
                  return;
                }
              } else {
                verifyConsecutivePassRef.current = Math.max(0, verifyConsecutivePassRef.current - 1);
              }
            }
          }
        } catch (frameErr) {
          console.warn('Erro na detecção de frame:', frameErr);
        } finally {
          verifyIsDetectingRef.current = false;
        }
      }

      if (verifyLoopActiveRef.current) {
        verifyAnimIdRef.current = requestAnimationFrame(stepVerifyFrame);
      }
    }

    verifyAnimIdRef.current = requestAnimationFrame(stepVerifyFrame);
  }

  async function executeComparison(liveDescriptor) {
    setVerifyComparing(true);
    setVerifyComparisonDetails('Analisando feições das fotos cadastradas...');

    let matchedCount = 0;
    const photoDescriptors = [];

    for (let i = 0; i < photos.length; i++) {
      setVerifyComparisonDetails(`Processando foto #${i + 1} de ${photos.length}...`);
      const pDesc = await getOrComputePhotoDescriptor(photos[i]);
      if (pDesc) {
        matchedCount++;
        photoDescriptors.push(pDesc);
      }
    }

    if (matchedCount === 0 || photoDescriptors.length === 0) {
      setVerifyComparing(false);
      setVerifyError('Nenhum rosto encontrado nas fotos do perfil. Adicione fotos nítidas do seu rosto e tente novamente.');
      setVerifyInstruction('Rosto não encontrado nas fotos');
      return;
    }

    try {
      await apiFetch('/api/users/me/verify-face', {
        method: 'POST',
        body: JSON.stringify({
          live_descriptor: liveDescriptor,
          photo_descriptors: photoDescriptors
        })
      });

      setVerifyComparing(false);
      setVerifySuccess(true);
      setVerifyInstruction('Verificado com Sucesso!');
      setIsVerified(true);
      if (user) user.is_verified = true;
      showToast('Perfil verificado com sucesso! 🔵', 'success');

      setTimeout(() => {
        closeVerificationModal();
      }, 1800);

    } catch (err) {
      setVerifyComparing(false);
      setVerifyError(err.message || 'A selfie não atingiu o nível de similaridade com as fotos do perfil. Tente com boa iluminação.');
      setVerifyInstruction('Não conferiu');
    }
  }

  function stopVerifyCamera() {
    verifyLoopActiveRef.current = false;
    if (verifyAnimIdRef.current) {
      cancelAnimationFrame(verifyAnimIdRef.current);
      verifyAnimIdRef.current = null;
    }
    if (verifyStreamRef.current) {
      verifyStreamRef.current.getTracks().forEach((t) => t.stop());
      verifyStreamRef.current = null;
    }
  }

  function closeVerificationModal() {
    stopVerifyCamera();
    setVerifyModalOpen(false);
  }

  // --- UPLOAD E REMOÇÃO DE FOTOS ---
  async function handleUploadPhoto(e, isPrivate) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (isPrivate) setUploadingPrivate(true);
    else setUploadingPublic(true);

    try {
      const isVid = file.type?.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv|m4v|3gp|ogv)$/i.test(file.name || '');
      if (isVid) {
        showToast('Convertendo vídeo para GIF no navegador... (até 10s)', 'info');
      } else {
        showToast('Otimizando e enviando imagem...', 'info');
      }
      const res = await uploadPhoto(file, isPrivate, (pct) => {
        if (pct % 25 === 0 || pct === 100) {
          showToast(`Convertendo vídeo para GIF: ${pct}%`, 'info');
        }
      });
      if (res && res.url) {
        if (isPrivate) {
          setPrivatePhotos((prev) => [...prev, res.url]);
        } else {
          setPhotos((prev) => [...prev, res.url]);
        }
        showToast('Mídia adicionada com sucesso! 📸', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Erro ao enviar foto', 'error');
    } finally {
      if (isPrivate) setUploadingPrivate(false);
      else setUploadingPublic(false);
      e.target.value = '';
    }
  }

  function removePhoto(index, isPrivate) {
    if (isPrivate) {
      setPrivatePhotos((prev) => prev.filter((_, i) => i !== index));
    } else {
      setPhotos((prev) => prev.filter((_, i) => i !== index));
    }
  }

  // --- INTERESSES ---
  function addInterest(e) {
    if (e) e.preventDefault();
    const tag = newInterest.trim().replace(/^#/, '');
    if (tag && !interests.includes(tag)) {
      setInterests((prev) => [...prev, tag]);
      setNewInterest('');
    }
  }

  function removeInterest(tag) {
    setInterests((prev) => prev.filter((t) => t !== tag));
  }

  // --- SALVAMENTO DO PERFIL ---
  async function handleSaveProfile(e) {
    if (e) e.preventDefault();

    // Validação de negócio estrita: mín. 2 fotos
    if (photos.length < 2) {
      showToast('Adicione no mínimo 2 fotos ao seu perfil para salvar.', 'error');
      return;
    }

    setSaving(true);
    try {
      const songsArray = [song1.trim(), song2.trim(), song3.trim()].filter(Boolean);

      let photoDescriptors = null;
      if (isVerified) {
        showToast('Validando fotos com seu rosto verificado...', 'info');
        photoDescriptors = [];
        for (const pUrl of photos) {
          const pDesc = await getOrComputePhotoDescriptor(pUrl);
          if (pDesc) photoDescriptors.push(pDesc);
        }
      }

      const payload = {
        name: name.trim(),
        age: parseInt(age, 10),
        email: email.trim(),
        campus,
        course,
        specific_course: specificCourse,
        entity,
        looking_for: lookingFor,
        gender,
        target_gender: targetGender,
        bio: bio.trim(),
        interests,
        photos,
        private_photos: privatePhotos,
        private_bio: privateBio.trim(),
        prompt1_q,
        prompt1_a: prompt1_a.trim(),
        prompt2_q,
        prompt2_a: prompt2_a.trim(),
        prompt3_q,
        prompt3_a: prompt3_a.trim(),
        songs: songsArray,
        photo_descriptors: photoDescriptors
      };

      const res = await apiFetch('/api/users/me', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (res.revoked_verification) {
        setIsVerified(false);
        if (user) user.is_verified = false;
        showToast('Fotos sem correspondência ao seu rosto. Selo verificado removido.', 'error');
      } else {
        showToast(res.message || 'Perfil salvo com sucesso! 🎉', 'success');
      }

      initialSnapshotRef.current = getCurrentSnapshot();
      setIsDirty(false);
      isDirtyRef.current = false;
      return true;
    } catch (err) {
      showToast(err.message || 'Erro ao salvar perfil', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  }

  // --- LGPD EXPORT & DELETE ---
  async function handleExportData() {
    try {
      showToast('Gerando arquivo de exportação...', 'info');
      const data = await apiFetch('/api/users/me/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meus-dados-pontinho-${(email ? email.split('@')[0] : 'usuario')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Dados exportados com sucesso! 📥', 'success');
    } catch (err) {
      showToast(err.message || 'Erro ao exportar dados.', 'error');
    }
  }

  async function handleDeleteAccount() {
    const confirmed = confirm('Excluir conta permanentemente? Esta ação não pode ser desfeita.');
    if (!confirmed) return;

    const secondConfirm = prompt('Digite EXCLUIR para confirmar a exclusão definitiva:');
    if (secondConfirm !== 'EXCLUIR') {
      showToast('Confirmação incorreta. Ação cancelada.', 'info');
      return;
    }

    try {
      await apiFetch('/api/users/me', { method: 'DELETE' });
      localStorage.clear();
      showToast('Conta excluída com sucesso. 👋', 'success');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1000);
    } catch (err) {
      showToast(err.message || 'Erro ao excluir conta', 'error');
    }
  }

  // Opções de dropdown
  const baseCourses = (metadata && metadata.base_courses) || [
    { name: "BC&T - Bacharelado em Ciência e Tecnologia" },
    { name: "BC&H - Bacharelado em Ciências e Humanidades" },
    { name: "LCNE - Licenciatura em Ciências Naturais e Exatas" },
    { name: "LCH - Licenciatura em Ciências Humanas" },
    { name: "Pós-Graduação (Mestrado / Doutorado)" }
  ];

  const specificCourses = (metadata && metadata.specific_courses) || [
    { name: "Ciência da Computação" },
    { name: "Biotecnologia" },
    { name: "Ciências Biológicas" },
    { name: "Ciências Econômicas" },
    { name: "Filosofia" },
    { name: "Física" },
    { name: "Matemática" },
    { name: "Neurociência" },
    { name: "Planejamento Territorial" },
    { name: "Políticas Públicas" },
    { name: "Química" },
    { name: "Relações Internacionais" },
    { name: "Engenharia Ambiental e Urbana" },
    { name: "Engenharia Biomédica" },
    { name: "Engenharia de Energia" },
    { name: "Engenharia de Gestão" },
    { name: "Engenharia de Informação" },
    { name: "Engenharia de Instrumentação, Automação e Robótica" },
    { name: "Engenharia de Materiais" },
    { name: "Engenharia Aeroespacial" }
  ];

  const entities = (metadata && metadata.entities) || [
    { name: "Atlética Geral" },
    { name: "Bateria Universitária" },
    { name: "Caiás" },
    { name: "Baja" },
    { name: "Enactus" },
    { name: "GPDA" },
    { name: "Rocket Design" },
    { name: "IEEE Student Branch" },
    { name: "Nenhuma / Foco no CR" }
  ];

  const promptOptions = (metadata && metadata.prompts) || [
    { question: "O melhor lugar para relaxar e fugir da rotina é..." },
    { question: "Minha opinião impopular sobre primeiro encontro..." },
    { question: "No intervalo entre as obrigações você me encontra..." },
    { question: "O segredo para me conquistar é..." },
    { question: "Um meme que me define perfeitamente:" },
    { question: "Minha habilidade inútil mais impressionante:" },
    { question: "Se eu pudesse jantar com qualquer pessoa da história:" }
  ];

  const isPride = currentTheme === 'pride';
  const isHalloween = currentTheme === 'halloween';
  const saveBtnThemeClass = isHalloween
    ? 'bg-gradient-to-r from-orange-500 via-purple-600 to-amber-500 hover:opacity-95 text-white border border-orange-400/40 shadow-orange-950/60'
    : isPride
    ? 'bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:opacity-95 text-white shadow-purple-950/60'
    : 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 shadow-emerald-950/60';

  return (
    <main class="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-20 md:pb-8 relative z-10">
      {/* CABEÇALHO DA PÁGINA COM BOTÃO SALVAR RÁPIDO */}
      <div class="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div class="flex items-center gap-2.5">
            <h1 class="text-2xl font-black text-white flex items-center gap-2">
              <span>👤</span> <span>Editar Perfil</span>
            </h1>
            {isDirty && (
              <span
                id="unsaved-badge"
                class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse select-none"
              >
                ● Alterações pendentes
              </span>
            )}
          </div>
          <p class="text-xs text-slate-400 font-medium mt-0.5">
            Complete suas fotos, dados e preferências
          </p>
        </div>
        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={saving || loading}
          class={`self-start sm:self-auto px-5 py-2.5 ${saveBtnThemeClass} font-black text-xs sm:text-sm rounded-xl shadow-lg hover:scale-105 active:scale-95 transition disabled:opacity-50`}
        >
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      {loading && (
        <div class="p-12 text-center text-slate-400">
          <div class="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p class="text-xs text-emerald-400 font-semibold">Carregando seu perfil...</p>
        </div>
      )}

      {!loading && (
        <form onSubmit={handleSaveProfile} class="space-y-6">

          {/* BANNER DE STATUS DE VERIFICAÇÃO FACIAL */}
          <div class="rounded-3xl p-5 border shadow-xl transition">
            {isVerified ? (
              <div class="bg-gradient-to-r from-cyan-950/40 via-blue-950/30 to-slate-900 border border-cyan-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex items-center gap-3.5">
                  <div class="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 flex items-center justify-center text-2xl shadow-inner shrink-0">
                    🔵
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h4 class="font-black text-white text-sm sm:text-base">Perfil Verificado</h4>
                      <span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">ATIVO</span>
                    </div>
                    <p class="text-xs text-slate-300 mt-0.5">Identidade e fotos confirmadas com sucesso.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openVerificationModal}
                  class="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-950/80 hover:bg-slate-800 rounded-xl border border-slate-700/80 transition active:scale-95 text-center shrink-0"
                >
                  Refazer Verificação 🔄
                </button>
              </div>
            ) : (
              <div class="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950/40 border border-blue-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex items-center gap-3.5">
                  <div class="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center justify-center text-2xl shadow-inner shrink-0">
                    🛡️
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h4 class="font-black text-white text-sm sm:text-base">Verifique seu Perfil</h4>
                      <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">Pendente</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openVerificationModal}
                  class="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-cyan-950/60 transition active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>📸</span> <span>Verificar Agora</span>
                </button>
              </div>
            )}
          </div>

          {/* 1. GALERIA DE FOTOS PÚBLICAS */}
          <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>📸</span> <span>Imagens do Perfil</span>
                </h3>
                <p class="text-[11px] text-slate-400">A foto #1 será o destaque principal exibido no feed.</p>
              </div>
              <span class={`text-xs font-bold px-2.5 py-1 rounded-full border ${photos.length >= 2 ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : 'bg-rose-950/60 text-rose-400 border-rose-500/30'}`}>
                {photos.length} foto(s) {photos.length < 2 && '(mín. 2)'}
              </span>
            </div>

            {photos.length === 0 ? (
              <div class="p-6 border-2 border-dashed border-rose-500/30 bg-rose-950/10 rounded-2xl text-center text-xs text-rose-300">
                Adicione pelo menos 2 imagens ao seu perfil para salvar!
              </div>
            ) : (
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {photos.map((url, i) => (
                  <div key={i} class="relative aspect-[3/4] rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 group shadow-md">
                    <img src={resolveMediaUrl(url)} alt={`Foto ${i + 1}`} class="w-full h-full object-cover" />
                    {i === 0 && (
                      <span class="absolute top-2 left-2 bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md shadow-xs">
                        Principal
                      </span>
                    )}
                    <span class="absolute bottom-2 left-2 bg-slate-950/80 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-700/60">
                      #{i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePhoto(i, false)}
                      class="absolute top-2 right-2 w-7 h-7 rounded-full bg-slate-950/80 hover:bg-rose-600 text-white flex items-center justify-center text-xs font-bold transition shadow-sm"
                      title="Remover foto"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div class="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
              <label class="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 rounded-xl text-xs font-black transition shadow-sm cursor-pointer active:scale-95">
                <span>📁</span>
                <span>{uploadingPublic ? 'Enviando foto...' : 'Adicionar Foto'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/*"
                  class="hidden"
                  disabled={uploadingPublic}
                  onChange={(e) => handleUploadPhoto(e, false)}
                />
              </label>
              <span class="text-xs text-slate-400">Imagens ou vídeos curtos (até 10s)</span>
            </div>
          </div>

          {/* 2. ÁREA SECRETA & PICANTE */}
          <div class="bg-gradient-to-br from-rose-950/60 via-slate-950/90 to-black border border-rose-500/30 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-extrabold text-rose-300 flex items-center gap-2">
                  <span>🔥</span> <span>Área Secreta</span>
                </h3>
                <p class="text-[11px] text-rose-200/70 mt-0.5">
                  Fotos e bio exclusivas. Liberadas apenas após consentimento mútuo no chat.
                </p>
              </div>
              <span class="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
                <span>🔒</span> Privado
              </span>
            </div>

            {/* Grid Fotos Privadas */}
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold text-rose-200 flex items-center gap-1.5">
                  <span>📸</span> Fotos Ocultas
                </label>
                <span class="text-[11px] font-semibold text-rose-300/80">
                  {privatePhotos.length} foto(s) secreta(s)
                </span>
              </div>

              {privatePhotos.length === 0 ? (
                <div class="p-4 border border-dashed border-rose-500/40 bg-white/5 rounded-2xl text-center text-xs text-rose-300">
                  Nenhuma foto privada. Adicione fotos exclusivas para seus matches autorizados! 🔥
                </div>
              ) : (
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {privatePhotos.map((url, i) => (
                    <div key={i} class="relative aspect-[3/4] rounded-2xl overflow-hidden border border-rose-500/40 bg-slate-950 group shadow-sm">
                      <img src={resolveMediaUrl(url)} alt={`Secreta ${i + 1}`} class="w-full h-full object-cover" />
                      <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                      <span class="absolute bottom-2 left-2 bg-rose-900/80 text-rose-200 border border-rose-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <span>🔒</span> #{i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePhoto(i, true)}
                        class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center text-xs font-bold transition shadow-sm"
                        title="Remover foto privada"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div class="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
                <label class="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer active:scale-95">
                  <span>🔒</span>
                  <span>{uploadingPrivate ? 'Enviando foto secreta...' : 'Enviar Foto ou GIF Secreto'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/*"
                    class="hidden"
                    disabled={uploadingPrivate}
                    onChange={(e) => handleUploadPhoto(e, true)}
                  />
                </label>
                <span class="text-xs text-rose-200/70">Imagens ou vídeos curtos (privacidade garantida)</span>
              </div>
            </div>

            {/* Bio Secreta */}
            <div class="pt-2 border-t border-white/10">
              <label class="block text-xs font-bold text-rose-200 mb-1 flex items-center gap-1">
                <span>💋</span> Bio Privada (Seu lado ❤️‍🔥 sem filtros)
              </label>
              <textarea
                rows="2"
                value={privateBio}
                onInput={(e) => setPrivateBio(e.target.value)}
                placeholder="O que só seus matches autorizados devem saber sobre você... 🔥"
                class="w-full bg-white/10 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-rose-200/40 focus:outline-none focus:ring-2 focus:ring-rose-500/60 transition"
              />
            </div>
          </div>

          {/* 3. DADOS ACADÊMICOS & PESSOAIS */}
          <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <h3 class="text-sm font-bold text-white flex items-center gap-1.5">
              <span>🎓</span> <span>Dados Pessoais</span>
            </h3>

            {/* Nome, Idade, E-mail */}
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Nome *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onInput={(e) => setName(e.target.value)}
                  class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Idade *</label>
                <input
                  type="number"
                  min="18"
                  max="80"
                  required
                  value={age}
                  onInput={(e) => setAge(e.target.value)}
                  class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">E-mail Institucional *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onInput={(e) => setEmail(e.target.value)}
                  placeholder="@aluno.ufabc.edu.br"
                  class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            {/* Campus, Curso Base, Curso Pós-BI */}
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Campus *</label>
                <select
                  value={campus}
                  onChange={(e) => setCampus(e.target.value)}
                  class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="Santo André">Santo André</option>
                  <option value="São Bernardo do Campo">São Bernardo do Campo</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Curso Base *</label>
                <select
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {baseCourses.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Curso Pós-BI *</label>
                <select
                  value={specificCourse}
                  onChange={(e) => setSpecificCourse(e.target.value)}
                  class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {specificCourses.map((sc) => (
                    <option key={sc.name} value={sc.name}>{sc.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Entidade & Busca */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Entidade Estudantil *</label>
                <select
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                  class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {entities.map((ent) => (
                    <option key={ent.name} value={ent.name}>{ent.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Busca no Pontinho *</label>
                <select
                  value={lookingFor}
                  onChange={(e) => setLookingFor(e.target.value)}
                  class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="Algo sério">Algo sério ❤️</option>
                  <option value="Algo casual">Algo casual 🥂</option>
                  <option value="Amizade">Amizade 🤝</option>
                </select>
              </div>
            </div>

            {/* Gênero & Interesse em */}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Gênero *</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="Mulher">Mulher 👩</option>
                  <option value="Homem">Homem 👨</option>
                  <option value="Não-binário">Não-binário 🏳️‍⚧️</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Interesse em (Ver no Feed) *</label>
                <select
                  value={targetGender}
                  onChange={(e) => setTargetGender(e.target.value)}
                  class="w-full bg-emerald-950/50 border border-emerald-500/40 rounded-xl px-3 py-2 text-xs text-emerald-300 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="Todos">Todos ✨</option>
                  <option value="Mulheres">Mulheres 👩</option>
                  <option value="Homens">Homens 👨</option>
                  <option value="Não-binário">Não-binário 🏳️‍⚧️</option>
                </select>
              </div>
            </div>

            {/* Bio Pública */}
            <div>
              <label class="block text-xs font-bold text-slate-300 mb-1">Bio Pública</label>
              <textarea
                rows="3"
                value={bio}
                onInput={(e) => setBio(e.target.value)}
                placeholder="Conte sobre você, seus hobbies, curso ou o que curte fazer na UFABC..."
                class="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          {/* 4. TAGS DE INTERESSES */}
          <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-3">
            <h3 class="text-sm font-bold text-white flex items-center gap-1.5">
              <span>🏷️</span> <span>Tags de Interesses</span>
            </h3>
            <div class="flex flex-wrap gap-2">
              {interests.map((tag) => (
                <span key={tag} class="px-3 py-1 bg-slate-800 text-emerald-300 text-xs rounded-xl flex items-center gap-1.5 border border-slate-700 shadow-xs">
                  #{tag}
                  <button type="button" onClick={() => removeInterest(tag)} class="text-slate-400 hover:text-white font-bold">✕</button>
                </span>
              ))}
            </div>
            <div class="flex gap-2">
              <input
                type="text"
                value={newInterest}
                onInput={(e) => setNewInterest(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest(); } }}
                placeholder="Nova tag (Ex: Vôlei, Anime, Café, RPG)"
                class="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <button
                type="button"
                onClick={addInterest}
                class="px-4 py-2 bg-slate-800 text-emerald-400 font-bold text-xs rounded-xl hover:bg-slate-700 transition"
              >
                + Adicionar
              </button>
            </div>
          </div>

          {/* 5. MÚSICAS DO PERFIL (YOUTUBE) */}
          <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-3">
            <div>
              <h3 class="text-sm font-bold text-purple-300 flex items-center gap-1.5">
                <span>🎵</span> <span>Músicas do Perfil (YouTube)</span>
              </h3>
              <p class="text-xs text-slate-400 mt-0.5">Tocam em segundo plano ao abrirem seu perfil completo.</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Música 1</label>
                <input
                  type="text"
                  value={song1}
                  onInput={(e) => setSong1(e.target.value)}
                  placeholder="Chico Buarque - Construção"
                  class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Música 2</label>
                <input
                  type="text"
                  value={song2}
                  onInput={(e) => setSong2(e.target.value)}
                  placeholder="Arctic Monkeys - 505"
                  class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">Música 3</label>
                <input
                  type="text"
                  value={song3}
                  onInput={(e) => setSong3(e.target.value)}
                  placeholder="Duda Beat - Bixinho"
                  class="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
            </div>
          </div>

          {/* 6. PERGUNTAS PESSOAIS (PROMPTS) */}
          <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <h3 class="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <span>💬</span> <span>Perguntas Pessoais</span>
            </h3>

            {/* Pergunta 1 */}
            <div class="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
              <label class="block text-[11px] font-bold text-slate-400">Pergunta 1</label>
              <select
                value={prompt1_q}
                onChange={(e) => setPrompt1_q(e.target.value)}
                class="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                {promptOptions.map((p) => (
                  <option key={p.question} value={p.question}>{p.question}</option>
                ))}
              </select>
              <input
                type="text"
                value={prompt1_a}
                onInput={(e) => setPrompt1_a(e.target.value)}
                placeholder="Sua resposta..."
                class="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            {/* Pergunta 2 */}
            <div class="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
              <label class="block text-[11px] font-bold text-slate-400">Pergunta 2</label>
              <select
                value={prompt2_q}
                onChange={(e) => setPrompt2_q(e.target.value)}
                class="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                {promptOptions.map((p) => (
                  <option key={p.question} value={p.question}>{p.question}</option>
                ))}
              </select>
              <input
                type="text"
                value={prompt2_a}
                onInput={(e) => setPrompt2_a(e.target.value)}
                placeholder="Sua resposta..."
                class="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            {/* Pergunta 3 */}
            <div class="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
              <label class="block text-[11px] font-bold text-slate-400">Pergunta 3</label>
              <select
                value={prompt3_q}
                onChange={(e) => setPrompt3_q(e.target.value)}
                class="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                {promptOptions.map((p) => (
                  <option key={p.question} value={p.question}>{p.question}</option>
                ))}
              </select>
              <input
                type="text"
                value={prompt3_a}
                onInput={(e) => setPrompt3_a(e.target.value)}
                placeholder="Sua resposta..."
                class="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>
          </div>

          {/* 7. IDENTIDADE VISUAL & TEMA */}
          <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <div class="flex items-center gap-2.5">
              <span class="text-xl">🎨</span>
              <div>
                <h3 class="text-sm font-black text-white">Identidade Visual & Tema</h3>
                <p class="text-[11px] text-slate-400">Personalize o estilo da sua interface</p>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                onClick={() => applyTheme('ufabc')}
                class={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center gap-3 ${
                  currentTheme === 'ufabc'
                    ? 'border-emerald-500/60 bg-emerald-950/30 ring-2 ring-emerald-500/20'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div class="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-xl shadow-xs">
                  🌿
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-xs text-white">Verde UFABC</span>
                    <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                      Padrão
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-400 mt-0.5">Tons de verde esmeralda e teal</p>
                </div>
              </div>

              <div
                onClick={() => applyTheme('pride')}
                class={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center gap-3 ${
                  currentTheme === 'pride'
                    ? 'border-pink-500/60 bg-pink-950/30 ring-2 ring-pink-500/20'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div class="w-10 h-10 rounded-xl bg-pink-950/60 border border-pink-500/30 flex items-center justify-center text-xl shadow-xs">
                  🏳️‍🌈
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-xs text-white">Orgulho LGBT+</span>
                    <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pink-950 text-pink-300 border border-pink-800/40">
                      Pride
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-400 mt-0.5">Cores vibrantes do arco-íris</p>
                </div>
              </div>

              <div
                onClick={() => applyTheme('halloween')}
                class={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center gap-3 ${
                  currentTheme === 'halloween'
                    ? 'border-orange-500/60 bg-orange-950/30 ring-2 ring-orange-500/20'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                <div class="w-10 h-10 rounded-xl bg-orange-950/60 border border-orange-500/30 flex items-center justify-center text-xl shadow-xs">
                  🎃
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-xs text-white">Halloween</span>
                    <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-800/40">
                      Spooky
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-400 mt-0.5">Abóboras & noite das bruxas</p>
                </div>
              </div>
            </div>
          </div>

          {/* 8. PRIVACIDADE & DIREITOS LGPD */}
          <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <div class="flex items-center gap-2.5">
              <span class="text-xl">🛡️</span>
              <div>
                <h3 class="text-sm font-black text-white">Privacidade & Direitos LGPD</h3>
                <p class="text-[11px] text-slate-400">Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).</p>
              </div>
            </div>

            <div class="bg-slate-950/70 p-4 sm:p-5 rounded-2xl border border-slate-800/80 space-y-3">
              <p class="text-xs text-slate-300 leading-relaxed">
                Como titular de dados, você possui pleno controle sobre suas informações pessoais cadastradas no Pontinho.
                Você pode solicitar uma cópia dos seus dados ou revogar o consentimento e excluir sua conta a qualquer momento.
              </p>

              <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleExportData}
                  class="flex-1 px-4 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 active:scale-95"
                >
                  <span>📥</span> Baixar Meus Dados (Portabilidade JSON)
                </button>

                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  class="px-4 py-2.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 text-xs font-bold rounded-xl border border-rose-500/30 transition flex items-center justify-center gap-2 active:scale-95"
                >
                  <span>🗑️</span> Excluir Minha Conta (Esquecimento)
                </button>
              </div>

              <div class="pt-2 text-center sm:text-left">
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-[11px] text-emerald-400 hover:underline font-semibold inline-flex items-center gap-1.5"
                >
                  <span>📄</span> Ver Termos de Uso e Política de Privacidade completa
                </a>
              </div>
            </div>
          </div>

          {/* BOTÃO PRINCIPAL DE SALVAR */}
          <div class="pt-2">
            <button
              type="submit"
              disabled={saving}
              class={`w-full py-4 ${saveBtnThemeClass} font-black text-sm rounded-2xl shadow-xl transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50`}
            >
              {saving ? 'Salvando Alterações...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      )}

      {/* MODAL DE VERIFICAÇÃO FACIAL RENDERIZADO VIA PORTAL */}
      {verifyModalOpen && typeof document !== 'undefined' && createPortal(
        <div class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div class="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 relative shadow-2xl text-slate-100 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            {/* Fechar */}
            <button
              type="button"
              onClick={closeVerificationModal}
              class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
              title="Fechar"
            >
              ✕
            </button>

            <div class="text-center mb-4">
              <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-bold mb-2">
                <span>🔵</span> Verificação de Identidade
              </div>
              <h3 class="text-lg font-black text-white">Verificação Facial</h3>
              <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Tire uma selfie ao vivo para validar biometricamente suas fotos.
              </p>
            </div>

            {/* Container da Câmera Circular */}
            <div class="relative w-64 h-64 rounded-full overflow-hidden border-4 border-cyan-500/50 shadow-2xl bg-black flex items-center justify-center my-2">
              <video
                ref={videoRef}
                autoplay
                playsinline
                muted
                class="w-full h-full object-cover -scale-x-100"
              />
              {verifyLoadingModels && (
                <div class="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2 text-center p-4">
                  <div class="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  <span class="text-xs text-cyan-300 font-medium">Iniciando câmera...</span>
                </div>
              )}
            </div>

            {/* Instrução e Badges */}
            <div class="w-full text-center mt-3 space-y-2">
              <div class="inline-block px-4 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-xs font-bold text-cyan-300">
                {verifyInstruction}
              </div>
              <div class="flex items-center justify-center gap-2 text-[11px]">
                <span class={`px-2 py-0.5 rounded border font-medium ${badgeFaceOk ? 'bg-slate-900 border-emerald-500/40 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                  {badgeFaceStatus}
                </span>
                <span class={`px-2 py-0.5 rounded border font-medium ${badgeLivenessOk ? 'bg-slate-900 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border-amber-500/40 text-amber-300 animate-pulse'}`}>
                  {badgeLivenessText}
                </span>
              </div>
            </div>

            {/* Detalhes da Comparação */}
            {(verifyComparing || verifySuccess || verifyError) && (
              <div class="w-full mt-4 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-2">
                {verifyComparing && (
                  <div class="flex items-center justify-center gap-2 text-xs text-cyan-400">
                    <div class="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span>{verifyComparisonDetails}</span>
                  </div>
                )}
                {verifySuccess && (
                  <div class="space-y-1">
                    <p class="text-emerald-300 font-black text-sm">🎉 Rosto Confirmado!</p>
                    <p class="text-xs text-slate-300">Identidade confirmada com sucesso em relação às suas fotos públicas.</p>
                  </div>
                )}
                {verifyError && (
                  <div class="space-y-1 text-rose-300 font-medium text-xs">
                    <p class="font-black text-rose-400">❌ Não foi possível confirmar</p>
                    <p class="text-[11px] text-slate-300">{verifyError}</p>
                  </div>
                )}
              </div>
            )}

            <div class="w-full mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeVerificationModal}
                class="flex-1 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* POPUP DE CONFIRMAÇÃO DE ALTERAÇÕES NÃO SALVAS (DESIGN DO TEMA ATIVO) */}
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        theme={currentTheme}
        isSaving={saving}
        onSave={handleModalSaveAndExit}
        onDiscard={handleModalDiscardAndExit}
        onCancel={handleModalCancel}
      />
    </main>
  );
}
