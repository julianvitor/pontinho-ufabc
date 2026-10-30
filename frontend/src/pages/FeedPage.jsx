import { useState, useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { apiFetch, getCurrentUserId, resolveMediaUrl, showToast, resolveYouTubeId } from '../services/api.js';

export function FeedPage() {
  const [userId, setUserId] = useState(getCurrentUserId());
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [landingEvents, setLandingEvents] = useState([]);
  const [detailsUser, setDetailsUser] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [modalPhotoIndex, setModalPhotoIndex] = useState(0);
  const [modalPlayingSongIndex, setModalPlayingSongIndex] = useState(0);
  const [isModalAudioPlaying, setIsModalAudioPlaying] = useState(false);
  const [modalVideoId, setModalVideoId] = useState(null);

  // Modal de denúncia / bloqueio
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBlockUser, setReportBlockUser] = useState(true);
  const [submittingReport, setSubmittingReport] = useState(false);

  const [matchData, setMatchData] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const cardRef = useRef(null);
  const stampLikeRef = useRef(null);
  const stampNopeRef = useRef(null);
  const playerRef = useRef(null);
  const isSwipingRef = useRef(false);
  const isFetchingMoreRef = useRef(false);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (detailsModalOpen || reportModalOpen || matchData) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    };
  }, [detailsModalOpen, reportModalOpen, matchData]);

  useEffect(() => {
    const id = getCurrentUserId();
    setUserId(id);
    if (!id) {
      loadLandingEvents();
      setLoading(false);
    } else {
      loadFeed();
    }
  }, []);

  async function loadLandingEvents() {
    try {
      const events = await apiFetch('/api/events');
      if (Array.isArray(events)) {
        setLandingEvents(events.slice(0, 3));
      }
    } catch (_) { }
  }

  function shuffleCards(cardList) {
    if (!Array.isArray(cardList) || cardList.length <= 1) return cardList;
    const arr = [...cardList];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async function loadFeed() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/feed?limit=20');
      const loadedCards = shuffleCards(data.cards || []);
      setCards(loadedCards);
      setCurrentIndex(0);
      setCurrentPhotoIndex(0);
      setHasMore(data.has_more ?? (loadedCards.length >= 20));
    } catch (err) {
      showToast(err.message || 'Erro ao carregar feed', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchMoreCards() {
    if (isFetchingMoreRef.current || !hasMoreRef.current) return;
    isFetchingMoreRef.current = true;
    try {
      // Coleta os IDs de perfis reais que ainda estão na fila ativa (do índice atual em diante)
      const currentDeck = cardsRef.current.slice(currentIndex);
      const activeIds = currentDeck
        .filter((c) => !c.is_ad && c.id)
        .map((c) => c.id);

      const excludeParam = activeIds.length > 0 ? `&exclude=${activeIds.join(',')}` : '';
      const data = await apiFetch(`/api/feed?limit=20${excludeParam}`);
      const newCards = shuffleCards(data.cards || []);
      if (newCards.length === 0) {
        setHasMore(false);
      } else {
        setCards((prev) => {
          const existingIds = new Set(prev.filter((c) => !c.is_ad).map((c) => c.id));
          const filteredNew = newCards.filter((c) => c.is_ad || !existingIds.has(c.id));
          if (filteredNew.length === 0) {
            setHasMore(false);
            return prev;
          }
          return [...prev, ...filteredNew];
        });
        if (data.has_more !== undefined) {
          setHasMore(Boolean(data.has_more));
        }
      }
    } catch (_) {
      // Falha silenciosa em background
    } finally {
      isFetchingMoreRef.current = false;
    }
  }

  async function resetSwipes() {
    try {
      await apiFetch('/api/feed/reset', { method: 'POST' });
      showToast('Histórico resetado! Recarregando perfis...', 'info');
      loadFeed();
    } catch (_) {
      loadFeed();
    }
  }

  const activeCard = cards[currentIndex] || null;
  const nextCard = cards[currentIndex + 1] || null;

  // Monta lista de itens do carrossel (fotos normais + secret teaser)
  const carouselItems = activeCard && !activeCard.is_ad
    ? (activeCard.photos && activeCard.photos.length ? activeCard.photos : ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800']).map(p => ({
      url: p,
      is_secret: false
    })).concat(activeCard.secret_teaser_photo ? [{ url: activeCard.secret_teaser_photo, is_secret: true }] : [])
    : [];

  const currentItem = carouselItems[currentPhotoIndex] || carouselItems[0] || null;

  function prevPhoto(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!carouselItems || carouselItems.length <= 1) return;
    setCurrentPhotoIndex((prev) => (prev - 1 + carouselItems.length) % carouselItems.length);
  }

  function nextPhoto(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!carouselItems || carouselItems.length <= 1) return;
    setCurrentPhotoIndex((prev) => (prev + 1) % carouselItems.length);
  }

  function goToPhoto(idx, e) {
    if (e && e.stopPropagation) e.stopPropagation();
    setCurrentPhotoIndex(idx);
  }

  async function handleSwipe(action) {
    if (!activeCard || isSwipingRef.current) return;
    isSwipingRef.current = true;

    const el = cardRef.current;
    if (el) {
      el.classList.add(action === 'like' ? 'swiping-right' : 'swiping-left');
    }

    const isAd = activeCard.is_ad;
    const targetUserId = activeCard.id;

    let swipePromise = null;
    if (!isAd) {
      swipePromise = apiFetch('/api/swipe', {
        method: 'POST',
        body: JSON.stringify({
          target_user_id: targetUserId,
          action: action
        })
      }).catch((err) => {
        showToast(err.message || 'Erro ao registrar swipe', 'error');
        return null;
      });
    }

    setTimeout(async () => {
      // Limpa as classes de swipe e estilos do elemento atual antes de avançar
      if (el) {
        el.classList.remove('swiping-right', 'swiping-left', 'animating');
        el.style.transform = '';
        el.style.opacity = '';
      }
      if (stampLikeRef.current) stampLikeRef.current.style.opacity = '0';
      if (stampNopeRef.current) stampNopeRef.current.style.opacity = '0';

      setCurrentIndex((prevIdx) => {
        const nextIdx = prevIdx + 1;
        const remaining = cardsRef.current.length - nextIdx;
        if (remaining <= 5 && hasMoreRef.current && !isFetchingMoreRef.current) {
          fetchMoreCards();
        }
        return nextIdx;
      });
      setCurrentPhotoIndex(0);
      isSwipingRef.current = false;

      if (swipePromise) {
        const res = await swipePromise;
        if (res && res.matched) {
          triggerMatchCelebration(res.match_user);
        }
      }
    }, 280);
  }

  async function triggerMatchCelebration(partner) {
    try {
      const me = await apiFetch('/api/users/me');
      setMatchData({
        partner,
        myPhoto: me.photos && me.photos.length ? me.photos[0] : '',
        partnerPhoto: partner.photos && partner.photos.length ? partner.photos[0] : ''
      });
    } catch (_) {
      showToast(`Deu match com ${partner.name}! 🎉`, 'success');
    }
  }

  // Drag & Swipe gesture handling
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    let isDragging = false;
    let hasMoved = false;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;

    const stampLike = stampLikeRef.current;
    const stampNope = stampNopeRef.current;

    function onPointerDown(e) {
      if (e.target.closest('button, a, .photo-indicator, .carousel-arrow-btn')) return;
      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      currentX = startX;
      currentY = startY;
      card.classList.remove('animating');
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      currentX = e.clientX;
      currentY = e.clientY;
      const dx = currentX - startX;
      const dy = currentY - startY;
      const dist = Math.hypot(dx, dy);

      if (!hasMoved) {
        if (dist > 8) {
          hasMoved = true;
          try { card.setPointerCapture(e.pointerId); } catch (_) { }
        } else {
          return;
        }
      }

      const rot = dx * 0.06;
      card.style.transform = `translate(${dx}px, ${dy * 0.3}px) rotate(${rot}deg)`;

      if (stampLike && stampNope) {
        if (dx > 25) {
          stampLike.style.opacity = Math.min(1, (dx - 25) / 75);
          stampNope.style.opacity = '0';
        } else if (dx < -25) {
          stampNope.style.opacity = Math.min(1, (-dx - 25) / 75);
          stampLike.style.opacity = '0';
        } else {
          stampLike.style.opacity = '0';
          stampNope.style.opacity = '0';
        }
      }
    }

    function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;
      try { card.releasePointerCapture(e.pointerId); } catch (_) { }

      const dx = currentX - startX;
      const dy = currentY - startY;
      const dist = Math.hypot(dx, dy);

      if (stampLike) stampLike.style.opacity = '0';
      if (stampNope) stampNope.style.opacity = '0';

      if (!hasMoved || dist < 10) {
        card.classList.remove('animating');
        card.style.transform = '';
        if (e.target.closest('button, a, .photo-indicator, .carousel-arrow-btn')) return;

        const rect = card.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        if (clickX < rect.width / 2) {
          prevPhoto(e);
        } else {
          nextPhoto(e);
        }
        return;
      }

      if (dx > 85) {
        handleSwipe('like');
      } else if (dx < -85) {
        handleSwipe('pass');
      } else {
        card.classList.add('animating');
        card.style.transform = 'translate(0px, 0px) rotate(0deg)';
        setTimeout(() => {
          card.classList.remove('animating');
          card.style.transform = '';
        }, 280);
      }
    }

    card.addEventListener('pointerdown', onPointerDown);
    card.addEventListener('pointermove', onPointerMove);
    card.addEventListener('pointerup', onPointerUp);
    card.addEventListener('pointercancel', onPointerUp);

    return () => {
      card.removeEventListener('pointerdown', onPointerDown);
      card.removeEventListener('pointermove', onPointerMove);
      card.removeEventListener('pointerup', onPointerUp);
      card.removeEventListener('pointercancel', onPointerUp);
    };
  }, [activeCard, currentPhotoIndex, carouselItems.length]);

  // Teclado Desktop
  useEffect(() => {
    function handleKeyDown(e) {
      const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'ArrowLeft') {
        prevPhoto(e);
      } else if (e.key === 'ArrowRight') {
        nextPhoto(e);
      } else if (e.key === 'Escape' && detailsModalOpen) {
        closeDetailsModal();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailsModalOpen, carouselItems.length]);

  function openDetailsModal(user) {
    if (!user || user.is_ad) return;
    setDetailsUser(user);
    setModalPhotoIndex(currentPhotoIndex || 0);

    const songs = Array.isArray(user.songs) ? user.songs.filter((s) => s && s.trim()) : [];
    if (songs.length > 0) {
      setModalPlayingSongIndex(0);
      setIsModalAudioPlaying(true);
      playModalSong(songs[0]);
    } else {
      setIsModalAudioPlaying(false);
      setModalVideoId(null);
    }
    setDetailsModalOpen(true);
  }

  function closeDetailsModal() {
    setIsModalAudioPlaying(false);
    setModalVideoId(null);
    setDetailsModalOpen(false);
  }

  async function playModalSong(songTitle) {
    if (!songTitle) return;
    try {
      const vid = await resolveYouTubeId(songTitle);
      if (vid) {
        setModalVideoId(vid);
      }
    } catch (_) { }
  }

  function selectModalSong(index) {
    if (!detailsUser) return;
    const songs = Array.isArray(detailsUser.songs) ? detailsUser.songs.filter((s) => s && s.trim()) : [];
    if (index < 0 || index >= songs.length) return;
    setModalPlayingSongIndex(index);
    setIsModalAudioPlaying(true);
    playModalSong(songs[index]);
  }

  function toggleModalAudio() {
    setIsModalAudioPlaying((prev) => !prev);
  }

  const modalCarouselItems = detailsUser
    ? (detailsUser.photos && detailsUser.photos.length
      ? detailsUser.photos
      : ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800']
    )
      .map((p) => ({
        url: p,
        is_secret: false
      }))
      .concat(
        detailsUser.secret_teaser_photo
          ? [{ url: detailsUser.secret_teaser_photo, is_secret: true }]
          : []
      )
    : [];

  const currentModalItem = modalCarouselItems[modalPhotoIndex] || modalCarouselItems[0] || null;
  const modalSongs = Array.isArray(detailsUser?.songs)
    ? detailsUser.songs.filter((s) => s && s.trim())
    : [];

  function prevModalPhoto(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!modalCarouselItems || modalCarouselItems.length <= 1) return;
    setModalPhotoIndex((prev) => (prev - 1 + modalCarouselItems.length) % modalCarouselItems.length);
  }

  function nextModalPhoto(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!modalCarouselItems || modalCarouselItems.length <= 1) return;
    setModalPhotoIndex((prev) => (prev + 1) % modalCarouselItems.length);
  }

  function goToModalPhoto(idx, e) {
    if (e && e.stopPropagation) e.stopPropagation();
    setModalPhotoIndex(idx);
  }

  function handleOpenReportFromDetails() {
    if (!detailsUser) return;
    closeDetailsModal();
    setReportReason('');
    setReportDetails('');
    setReportBlockUser(true);
    setReportModalOpen(true);
  }

  async function handleSubmitReport(e) {
    e.preventDefault();
    if (!detailsUser || !detailsUser.id) return;
    if (!reportReason) {
      showToast('Selecione um motivo para a denúncia.', 'error');
      return;
    }

    setSubmittingReport(true);
    try {
      await apiFetch(`/api/users/${detailsUser.id}/report`, {
        method: 'POST',
        body: JSON.stringify({
          reason: reportReason,
          details: reportDetails,
          block_user: reportBlockUser
        })
      });

      showToast('Denúncia enviada à moderação com sucesso. Agradecemos por manter o Pontinho seguro!', 'success');
      setReportModalOpen(false);
      handleSwipe('pass');
    } catch (err) {
      showToast(err.message || 'Erro ao enviar denúncia', 'error');
    } finally {
      setSubmittingReport(false);
    }
  }

  return (
    <main class="flex-1 w-full max-w-4xl mx-auto px-3 sm:px-4 pt-3 pb-24 md:pb-6 flex flex-col items-center justify-center relative">
      {/* 1. SEÇÃO DE LANDING (DESCONECTADO) */}
      {!userId && (
        <div id="landing-section" class="w-full max-w-md mx-auto py-4 flex flex-col items-center text-center space-y-6">
          <div class="w-full bg-gradient-to-br from-slate-900 via-slate-900/95 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-800/80 relative overflow-hidden">
            <div class="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
            <div class="absolute -bottom-12 -left-12 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

            <h1 class="text-3xl sm:text-4xl font-black tracking-tight text-white">Pontinho</h1>
            <p class="text-xs sm:text-sm text-slate-300 mt-2 font-medium max-w-sm mx-auto leading-relaxed">
              Conexões, amizades e festas.{' '}
              <span class="font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-lg inline-block shadow-xs">
                apenas para membros da <span class="text-yellow-400">UFABC</span>
              </span>
            </p>

            <div class="grid grid-cols-3 gap-2 my-6 text-center">
              <div class="p-2.5 bg-slate-950/50 rounded-2xl border border-slate-800">
                <span class="text-base block">✨</span>
                <span class="text-[11px] font-bold text-slate-200 block mt-1">Conexões</span>
              </div>
              <div class="p-2.5 bg-slate-950/50 rounded-2xl border border-slate-800">
                <span class="text-base block">🎵</span>
                <span class="text-[11px] font-bold text-slate-200 block mt-1">Músicas</span>
              </div>
              <div class="p-2.5 bg-slate-950/50 rounded-2xl border border-slate-800">
                <span class="text-base block">🔥</span>
                <span class="text-[11px] font-bold text-slate-200 block mt-1">Privado</span>
              </div>
            </div>

            <div class="space-y-2">
              <a
                href="/login?tab=register"
                class="block w-full py-3 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-sm rounded-xl shadow-lg transition active:scale-[0.99]"
              >
                Criar Conta
              </a>
              <a
                href="/login?tab=login"
                class="block w-full py-2.5 bg-slate-950/80 hover:bg-slate-800 text-emerald-300 font-semibold text-xs sm:text-sm rounded-xl border border-emerald-500/30 transition"
              >
                Entrar
              </a>
            </div>
          </div>

          {landingEvents.length > 0 && (
            <div id="landing-events-section" class="w-full bg-slate-900/90 rounded-3xl p-4 sm:p-5 shadow-xl border border-slate-800/80 text-left space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-xl">🎉</span>
                  <div>
                    <h3 class="text-sm font-black text-white">Festas & Rolês</h3>
                    <p class="text-[11px] text-emerald-400 font-medium">Veja o que está rolando na facul</p>
                  </div>
                </div>
                <a href="/events" class="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 hover:underline">
                  Ver todas ❯
                </a>
              </div>

              <div class="space-y-2">
                {landingEvents.map((ev) => {
                  const dateObj = new Date(ev.event_date.replace(' ', 'T'));
                  const day = isNaN(dateObj.getDate()) ? '--' : dateObj.getDate();
                  const monthNames = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
                  const month = isNaN(dateObj.getMonth()) ? 'MÊS' : monthNames[dateObj.getMonth()];
                  const time = ev.event_date.split(' ')[1] || '22:00';
                  const coverUrl = resolveMediaUrl(ev.image_url) || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800';

                  return (
                    <a
                      key={ev.id}
                      href="/events"
                      class="block p-3 rounded-2xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800/80 hover:border-emerald-500/40 transition group"
                    >
                      <div class="flex items-center gap-3">
                        <div class="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-slate-900 border border-slate-800">
                          <img src={coverUrl} alt={ev.title} class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                          <div class="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] font-black text-center text-emerald-400 py-0.2">
                            {day} {month}
                          </div>
                        </div>
                        <div class="flex-1 min-w-0">
                          <h4 class="text-xs font-bold text-white group-hover:text-emerald-300 truncate">{ev.title}</h4>
                          <p class="text-[11px] text-slate-400 truncate mt-0.5">📍 {ev.location}</p>
                          <div class="flex items-center gap-2 mt-1">
                            <span class="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.2 rounded-full">
                              🔥 {ev.attendees_count} {ev.attendees_count === 1 ? 'confirmado' : 'confirmados'}
                            </span>
                            <span class="text-[10px] text-slate-500">⏰ {time}h</span>
                          </div>
                        </div>
                        <span class="text-slate-500 group-hover:text-emerald-400 text-xs shrink-0">❯</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. SEÇÃO DE SWIPES (AUTENTICADO) */}
      {userId && (
        <div id="swipe-section" class="w-full max-w-md mx-auto flex flex-col items-center">
          <div class="w-full flex items-center justify-end text-xs text-slate-400 mb-2 px-1">
            <button
              type="button"
              onClick={resetSwipes}
              class="text-slate-400 hover:text-emerald-400 text-xs font-medium hover:underline flex items-center gap-1 transition"
            >
              <span>🔄</span> Resetar
            </button>
          </div>

          <div
            id="deck-container"
            class="relative w-full h-[64dvh] sm:h-[580px] max-h-[620px] rounded-3xl shadow-2xl bg-slate-900 border border-slate-800/90 overflow-hidden flex items-center justify-center shadow-black/80"
          >
            {loading && (
              <div id="loading-spinner" class="flex flex-col items-center gap-2 text-slate-400">
                <div class="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p class="text-xs font-medium text-emerald-400">Buscando...</p>
              </div>
            )}

            {!loading && (!activeCard || currentIndex >= cards.length) && (
              <div id="empty-state" class="flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div class="w-16 h-16 bg-emerald-950/60 rounded-full flex items-center justify-center text-2xl border border-emerald-500/30 text-emerald-400">
                  🎓
                </div>
                <div>
                  <h3 class="text-lg font-bold text-white">Fim dos perfis</h3>
                  <p class="text-xs text-slate-400 mt-0.5">Sem novos alunos no momento.</p>
                </div>
                <button
                  type="button"
                  onClick={resetSwipes}
                  class="px-4 py-2 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 text-slate-950 font-bold text-xs rounded-xl shadow-md transition hover:scale-105 active:scale-95"
                >
                  Recomeçar
                </button>
              </div>
            )}

            {!loading && activeCard && (
              <div id="card-wrapper" class="w-full h-full relative">
                {/* CARD EM SEGUNDO PLANO (PRÓXIMO PERFIL - ELIMINA TELA PRETA DURANTE SWIPE) */}
                {nextCard && (
                  <div
                    key={nextCard.is_ad ? `next-ad-${nextCard.id}` : `next-user-${nextCard.id}`}
                    class="tinder-card w-full h-full absolute inset-0 select-none overflow-hidden scale-[0.96] opacity-60 pointer-events-none rounded-3xl"
                  >
                    <div class="w-full h-full relative overflow-hidden bg-slate-950">
                      <img
                        src={resolveMediaUrl(
                          nextCard.is_ad
                            ? nextCard.image_url
                            : (nextCard.photos && nextCard.photos[0]) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800'
                        )}
                        alt={nextCard.name || nextCard.title}
                        class="w-full h-full object-cover"
                      />
                      <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                      <div class="absolute inset-x-0 bottom-0 p-5 text-white">
                        <h2 class="text-xl font-extrabold text-white">
                          {nextCard.is_ad ? nextCard.title : `${nextCard.name}, ${nextCard.age}`}
                        </h2>
                        <p class="text-xs text-slate-300">
                          {nextCard.is_ad ? '⭐ Publicidade' : (nextCard.course || nextCard.campus)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* CARD DE PUBLICIDADE */}
                {activeCard.is_ad ? (
                  <div
                    key={`ad-${activeCard.id}-${currentIndex}`}
                    ref={cardRef}
                    id="active-card"
                    class="tinder-card w-full h-full relative select-none bg-slate-900 cursor-grab active:cursor-grabbing z-10"
                  >
                    <div ref={stampLikeRef} id="stamp-like" class="swipe-stamp like">CONFERIR</div>
                    <div ref={stampNopeRef} id="stamp-nope" class="swipe-stamp nope">PULAR</div>

                    <img src={activeCard.image_url} alt={activeCard.title} class="w-full h-full object-cover" />
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />

                    <div class="absolute top-4 left-4 z-20">
                      <span class="bg-amber-400 text-slate-950 font-black text-xs px-3 py-1 rounded-full shadow-lg uppercase tracking-wider flex items-center gap-1">
                        ⭐ Publicidade
                      </span>
                    </div>

                    <div class="absolute inset-x-0 bottom-0 p-6 z-20 text-white">
                      <h2 class="text-2xl font-extrabold text-amber-300 leading-tight">{activeCard.title}</h2>
                      <p class="text-sm text-slate-300 mt-2 leading-relaxed">{activeCard.description}</p>
                      <div class="mt-5 space-y-2">
                        <a
                          href={activeCard.link_url}
                          target="_blank"
                          class="block w-full py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-extrabold text-sm text-center rounded-xl shadow-lg transition"
                        >
                          {activeCard.button_text || 'Conferir'} ➔
                        </a>
                        <button
                          type="button"
                          onClick={() => handleSwipe('pass')}
                          class="w-full py-2 bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-medium rounded-xl transition"
                        >
                          Continuar swiping
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* CARD DE ESTUDANTE */
                  <div
                    key={`user-${activeCard.id}-${currentIndex}`}
                    ref={cardRef}
                    id="active-card"
                    class="group tinder-card w-full h-full relative cursor-grab active:cursor-grabbing select-none overflow-hidden z-10"
                  >
                    <div ref={stampLikeRef} id="stamp-like" class="swipe-stamp like">CURTI</div>
                    <div ref={stampNopeRef} id="stamp-nope" class="swipe-stamp nope">PASSO</div>

                    <div class="w-full h-full relative overflow-hidden bg-slate-950">
                      <img
                        id="card-photo"
                        src={resolveMediaUrl(currentItem ? currentItem.url : '')}
                        alt={activeCard.name}
                        class="w-full h-full object-cover pointer-events-none transition-all duration-300"
                        style={currentItem && currentItem.is_secret ? { filter: 'blur(36px)', transform: 'scale(1.2)' } : {}}
                      />

                      {currentItem && currentItem.is_secret && (
                        <div id="secret-photo-overlay" class="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10 select-none pointer-events-none">
                          <div class="w-16 h-16 rounded-3xl bg-rose-950/80 border border-rose-500/60 shadow-2xl shadow-rose-950 text-rose-300 text-3xl flex items-center justify-center mb-3 animate-pulse">
                            🔒
                          </div>
                          <span class="inline-block px-3 py-1 bg-gradient-to-r from-rose-600 to-red-600 text-white font-black text-[11px] rounded-full uppercase tracking-wider shadow-md mb-2">
                            Álbum Secreto 🔥
                          </span>
                          <p class="text-xs text-rose-100 font-medium max-w-xs leading-relaxed">
                            Foto protegida. Curta o perfil para ter a chance de desbloquear após o match!
                          </p>
                          {activeCard.private_photos_count > 0 && (
                            <span class="text-[11px] text-rose-300 font-semibold mt-2">
                              Total de {activeCard.private_photos_count} {activeCard.private_photos_count === 1 ? 'foto secreta' : 'fotos secretas'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Metades clicáveis para fotos */}
                    <div class="absolute inset-y-0 left-0 w-1/2 z-20 cursor-pointer select-none" onClick={prevPhoto} title="Foto anterior (←)" />
                    <div class="absolute inset-y-0 right-0 w-1/2 z-20 cursor-pointer select-none" onClick={nextPhoto} title="Próxima foto (→)" />

                    {/* Botões visuais de navegação no desktop */}
                    {carouselItems.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={prevPhoto}
                          class="carousel-arrow-btn absolute left-2.5 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-slate-950/70 hover:bg-slate-900 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 sm:opacity-85 hover:sm:opacity-100 shadow-xl border border-white/20 active:scale-95 cursor-pointer backdrop-blur-md"
                          title="Foto anterior (←)"
                        >
                          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button
                          type="button"
                          onClick={nextPhoto}
                          class="carousel-arrow-btn absolute right-2.5 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-slate-950/70 hover:bg-slate-900 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 sm:opacity-85 hover:sm:opacity-100 shadow-xl border border-white/20 active:scale-95 cursor-pointer backdrop-blur-md"
                          title="Próxima foto (→)"
                        >
                          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" /></svg>
                        </button>

                        <div class="absolute top-3 inset-x-3 z-30 flex gap-1.5 pointer-events-auto">
                          {carouselItems.map((item, i) => (
                            <div
                              key={i}
                              class={`flex-1 photo-indicator ${i === currentPhotoIndex ? 'active' : ''} ${item.is_secret ? 'secret' : ''}`}
                              onClick={(e) => goToPhoto(i, e)}
                              title={`Ver foto ${i + 1}`}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {/* Contador de fotos */}
                    <div
                      id="photo-count-badge"
                      class={`absolute top-6 right-3 z-30 text-[10px] font-bold px-2 py-0.5 rounded-full transition-all border pointer-events-none ${currentItem && currentItem.is_secret
                        ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                        : 'bg-black/50 backdrop-blur-md text-white border-white/10'
                        }`}
                    >
                      <span id="photo-count-label">
                        {currentItem && currentItem.is_secret
                          ? `🔒 ${currentPhotoIndex + 1}/${carouselItems.length} (Secreta)`
                          : `${currentPhotoIndex + 1}/${carouselItems.length} fotos`}
                      </span>
                    </div>

                    <div class="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none z-10" />

                    <div class="absolute inset-x-0 bottom-0 p-4 sm:p-5 z-20 text-white flex flex-col justify-end pointer-events-none">
                      <div class="pointer-events-auto">
                        <div class="flex flex-wrap items-center gap-1.5 mb-2">
                          <span class="bg-emerald-600/90 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                            📍 {activeCard.campus}
                          </span>
                          {activeCard.gender && activeCard.gender !== 'Não informado' && (
                            <span class="bg-indigo-600/90 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-sm">
                              {activeCard.gender === 'Mulher' ? '👩 Mulher' : activeCard.gender === 'Homem' ? '👨 Homem' : activeCard.gender === 'Não-binário' ? '🏳️‍⚧️ Não-binário' : activeCard.gender}
                            </span>
                          )}
                          <span class="bg-rose-500/90 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full shadow-sm">
                            {activeCard.looking_for}
                          </span>
                          <span class="bg-amber-500/90 backdrop-blur-md text-slate-900 text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                            🏛️ {activeCard.entity}
                          </span>
                          {activeCard.has_private_content && (
                            <span class="bg-gradient-to-r from-rose-600 to-red-600/90 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1 border border-rose-400/40">
                              🔒 Álbum Secreto 🔥
                            </span>
                          )}
                        </div>

                        <div class="flex items-center gap-2 flex-wrap">
                          <h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight">{activeCard.name}</h2>
                          <span class="text-xl sm:text-2xl font-light text-slate-300">{activeCard.age}</span>
                          {activeCard.is_verified && (
                            <span class="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-400/50 text-cyan-300 shadow-xs" title="Perfil Verificado por Biometria Facial">
                              <span>🔵</span> <span>Verificado</span>
                            </span>
                          )}
                        </div>

                        <p class="text-xs sm:text-sm text-emerald-300 font-medium mt-0.5 line-clamp-1">
                          🎓 {activeCard.specific_course || activeCard.course}
                        </p>

                        {activeCard.songs && activeCard.songs.length > 0 && (
                          <div class="mt-2 flex items-center gap-1.5 text-[11px] text-purple-200 bg-purple-950/70 backdrop-blur-md px-2.5 py-1 rounded-xl border border-purple-400/30 truncate">
                            <span>🎵</span>
                            <span class="truncate">{activeCard.songs[0]}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. BOTÕES DE CONTROLE INFERIORES */}
          {!loading && activeCard && (
            <div id="action-controls" class="flex items-center justify-center gap-6 mt-4 sm:mt-5">
              <button
                type="button"
                onClick={() => handleSwipe('pass')}
                class="w-14 h-14 rounded-full bg-slate-900/90 shadow-xl border border-slate-800 text-rose-500 text-2xl flex items-center justify-center hover:scale-110 active:scale-95 hover:bg-rose-950/40 hover:border-rose-500/40 transition-all focus:outline-none shadow-black/50"
                title="Passar (Não curti)"
              >
                ✕
              </button>

              <button
                type="button"
                onClick={() => openDetailsModal(activeCard)}
                class="w-11 h-11 rounded-full bg-slate-900/90 shadow-lg border border-slate-800 text-emerald-400 flex items-center justify-center hover:scale-110 active:scale-95 hover:bg-emerald-950/40 hover:border-emerald-500/40 transition-all focus:outline-none shadow-black/50"
                title="Ver perfil completo e músicas"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => handleSwipe('like')}
                class="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-500 shadow-xl shadow-emerald-950/60 text-slate-950 text-2xl flex items-center justify-center hover:scale-110 active:scale-95 hover:brightness-110 transition-all focus:outline-none font-bold"
                title="Curtir"
              >
                💚
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE CELEBRAÇÃO DE MATCH */}
      {matchData &&
        (() => {
          const matchModalContent = (
            <div id="match-modal" class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div class="bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950 w-full max-w-md rounded-3xl p-8 text-center text-white border border-emerald-500/30 shadow-2xl relative overflow-hidden animate-scale">
                <div class="absolute -top-10 -right-10 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl" />
                <div class="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl" />

                <span class="inline-block text-4xl mb-2 animate-bounce">🎉</span>
                <h2 class="text-2xl font-black tracking-tight bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent">
                  Deu Match!
                </h2>
                <p id="match-subtitle" class="text-slate-300 text-xs mt-1 mb-5">
                  Você e {matchData.partner.name} combinaram!
                </p>

                <div class="flex items-center justify-center gap-3 my-3">
                  <img id="match-my-photo" class="w-20 h-20 rounded-full object-cover border-3 border-white shadow-xl" src={resolveMediaUrl(matchData.myPhoto)} alt="Sua foto" />
                  <div class="w-9 h-9 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-base shadow-lg">🔥</div>
                  <img id="match-partner-photo" class="w-20 h-20 rounded-full object-cover border-3 border-emerald-400 shadow-xl" src={resolveMediaUrl(matchData.partnerPhoto)} alt="Foto do Match" />
                </div>

                <div class="space-y-2 mt-5">
                  <a
                    id="match-chat-btn"
                    href="/matches"
                    class="block w-full py-3 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black text-sm rounded-xl shadow-lg transition"
                  >
                    Conversar 💬
                  </a>
                  <button
                    type="button"
                    onClick={() => setMatchData(null)}
                    class="w-full py-2 text-slate-400 hover:text-white font-medium text-xs transition"
                  >
                    Continuar
                  </button>
                </div>
              </div>
            </div>
          );
          return typeof document !== 'undefined' ? createPortal(matchModalContent, document.body) : matchModalContent;
        })()}

      {/* MODAL DE DETALHES DO PERFIL */}
      {detailsModalOpen && detailsUser &&
        (() => {
          const detailsModalContent = (
            <div
              id="details-modal"
              class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeDetailsModal();
              }}
            >
              <div class="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col text-slate-100">
                <div class="sticky top-0 bg-slate-900/95 backdrop-blur-md px-6 py-4 border-b border-slate-800 flex items-center justify-between z-10">
                  <h3 class="font-bold text-white text-lg flex items-center gap-2">
                    <span>Detalhes do Perfil</span>
                  </h3>
                  <button
                    type="button"
                    onClick={closeDetailsModal}
                    class="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div id="details-content" class="p-6 space-y-6 pb-12 sm:pb-6">
                  {/* Carrossel de Fotos com Destaque (Foto Completa, 100% Desobstruída) */}
                  <div class="space-y-2">
                    <div class="relative w-full h-80 sm:h-96 md:h-[420px] rounded-3xl overflow-hidden bg-black/95 border border-slate-800 shadow-2xl flex items-center justify-center select-none group">
                      {/* Imagem Principal com Destaque: Exibida Completa (object-contain) */}
                      <img
                        id="modal-carousel-photo"
                        src={resolveMediaUrl(currentModalItem?.url)}
                        alt={detailsUser.name}
                        style={currentModalItem?.is_secret ? 'filter: blur(16px); transform: scale(1.05);' : ''}
                        class="max-w-full max-h-full w-auto h-auto object-contain pointer-events-none transition-all duration-300"
                      />

                      {/* Overlay Misterioso do Álbum Secreto no Modal (Apenas para foto secreta) */}
                      {currentModalItem?.is_secret && (
                        <div id="modal-secret-overlay" class="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20 pointer-events-none">
                          <div class="w-14 h-14 rounded-2xl bg-rose-950/90 border border-rose-500/60 shadow-xl shadow-rose-950 text-rose-300 text-2xl flex items-center justify-center mb-3 animate-pulse">
                            🔒
                          </div>
                          <span class="inline-block px-3 py-1 bg-gradient-to-r from-rose-600 to-red-600 text-white font-black text-[10px] rounded-full uppercase tracking-wider shadow-md mb-2">
                            Álbum Secreto 🔥
                          </span>
                          <p class="text-xs text-rose-100 font-medium max-w-xs leading-relaxed">
                            Foto protegida. Curta o perfil para ter a chance de desbloquear após o match!
                          </p>
                          {detailsUser.private_photos_count ? (
                            <span class="text-[11px] text-rose-300 font-semibold mt-2">
                              Total de {detailsUser.private_photos_count} {detailsUser.private_photos_count === 1 ? 'foto secreta' : 'fotos secretas'}
                            </span>
                          ) : null}
                        </div>
                      )}

                      {/* Áreas invisíveis para toque/clique para avançar ou voltar (sem nada visual na frente da foto) */}
                      <div class="absolute inset-y-0 left-0 w-1/2 z-10 cursor-pointer" onClick={prevModalPhoto} title="Foto anterior" />
                      <div class="absolute inset-y-0 right-0 w-1/2 z-10 cursor-pointer" onClick={nextModalPhoto} title="Próxima foto" />
                    </div>

                    {/* Controles do Carrossel FORA da foto (nenhum elemento na frente da imagem) */}
                    {modalCarouselItems.length > 1 && (
                      <div class="flex items-center justify-between px-3 py-2 bg-slate-950/80 rounded-2xl border border-slate-800/80">
                        <div class="flex items-center gap-3 flex-1 min-w-0 mr-2">
                          {/* Indicadores de fotos em barras */}
                          <div class="flex gap-1.5 flex-1 max-w-[160px] sm:max-w-[220px]">
                            {modalCarouselItems.map((item, idx) => (
                              <div
                                key={idx}
                                class={`flex-1 modal-photo-indicator ${idx === modalPhotoIndex ? 'active' : ''} ${item.is_secret ? 'secret' : ''}`}
                                onClick={(e) => goToModalPhoto(idx, e)}
                                title={`Ver foto ${idx + 1}`}
                              />
                            ))}
                          </div>
                          {/* Contador de Fotos */}
                          <span id="modal-photo-count-badge" class={`text-[11px] font-semibold ${currentModalItem?.is_secret ? 'text-rose-400 font-bold' : 'text-slate-400'} shrink-0`}>
                            <span id="modal-photo-count-label">
                              {currentModalItem?.is_secret
                                ? `🔒 ${modalPhotoIndex + 1}/${modalCarouselItems.length} (Secreta)`
                                : `${modalPhotoIndex + 1}/${modalCarouselItems.length} fotos`}
                            </span>
                          </span>
                        </div>

                        {/* Botões de navegação fora da foto */}
                        <div class="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={prevModalPhoto}
                            class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center transition active:scale-95 border border-slate-700/60"
                            title="Foto anterior"
                          >
                            ❮
                          </button>
                          <button
                            type="button"
                            onClick={nextModalPhoto}
                            class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center transition active:scale-95 border border-slate-700/60"
                            title="Próxima foto"
                          >
                            ❯
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* MÚSICAS DO PERFIL (YOUTUBE) */}
                  {modalSongs.length > 0 && (
                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <h4 class="text-xs font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                          <span>🎵</span> Músicas
                        </h4>
                        <span class="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span class="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" /> YouTube
                        </span>
                      </div>

                      <div class="relative p-3 bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white rounded-2xl border border-purple-500/30 shadow-lg overflow-hidden">
                        <div class="flex items-center justify-between gap-3">
                          <div class="flex items-center gap-2.5 min-w-0">
                            <span id="player-vinyl-icon" class={`text-base inline-block ${isModalAudioPlaying ? 'animate-spin' : ''}`} style="animation-duration: 3s;">
                              💿
                            </span>
                            <p id="player-current-song-title" class="text-xs font-bold text-white truncate">
                              {modalSongs[modalPlayingSongIndex] || modalSongs[0]}
                            </p>
                          </div>

                          <div class="flex items-center gap-2 shrink-0">
                            <button
                              id="player-toggle-btn"
                              type="button"
                              onClick={toggleModalAudio}
                              class="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs flex items-center justify-center transition active:scale-95"
                              title="Pausar / Tocar"
                            >
                              {isModalAudioPlaying ? '⏸️' : '▶️'}
                            </button>
                          </div>
                        </div>

                        {/* Visualizador de Ondas Sonoras */}
                        <div id="player-visualizer-bar" class="flex items-center justify-between px-2.5 py-1.5 bg-black/40 rounded-xl border border-white/5 mt-2">
                          <span id="player-status-badge" class="text-[10px] text-purple-200 font-medium">
                            {isModalAudioPlaying ? 'Tocando no Perfil' : 'Pausado'}
                          </span>
                          <div id="player-equalizer-waves" class="flex items-end gap-1 h-3" style={isModalAudioPlaying ? { opacity: 1 } : { opacity: 0.3 }}>
                            <span class="w-1 bg-purple-400 rounded-full animate-pulse" style="height: 60%; animation-duration: 0.8s;" />
                            <span class="w-1 bg-rose-400 rounded-full animate-pulse" style="height: 100%; animation-duration: 0.5s;" />
                            <span class="w-1 bg-purple-300 rounded-full animate-pulse" style="height: 40%; animation-duration: 0.9s;" />
                            <span class="w-1 bg-teal-400 rounded-full animate-pulse" style="height: 80%; animation-duration: 0.6s;" />
                            <span class="w-1 bg-purple-400 rounded-full animate-pulse" style="height: 50%; animation-duration: 0.7s;" />
                          </div>
                        </div>

                        {/* Host do Player de Áudio do YouTube (dentro do card, transparente) */}
                        {isModalAudioPlaying && modalVideoId && (
                          <div id="modal-youtube-container" style="position:absolute; bottom:0; right:0; width:64px; height:64px; opacity:0.001; pointer-events:none; overflow:hidden; z-index:0;">
                            <iframe
                              id="yt-bg-player"
                              width="64"
                              height="64"
                              src={`https://www.youtube.com/embed/${modalVideoId}?autoplay=1&mute=0&enablejsapi=1&playsinline=1&controls=0&rel=0`}
                              title="YouTube music player"
                              frameBorder="0"
                              allow="autoplay; encrypted-media"
                            />
                          </div>
                        )}

                        {/* Chips de músicas */}
                        <div class="flex flex-wrap gap-1.5 pt-2 mt-2 border-t border-white/10">
                          {modalSongs.map((s, idx) => (
                            <button
                              key={idx}
                              id={`song-chip-${idx}`}
                              type="button"
                              onClick={() => selectModalSong(idx)}
                              class={`song-chip text-[11px] font-semibold px-2 py-0.5 rounded-lg transition flex items-center gap-1 ${idx === modalPlayingSongIndex
                                ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-300'
                                : 'bg-white/10 text-purple-200 hover:bg-white/20'
                                }`}
                            >
                              <span>🎧</span> <span class="truncate max-w-[120px]">{s}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dados Básicos */}
                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3 class="text-2xl font-black text-white">{detailsUser.name}</h3>
                      <span class="text-lg text-slate-400 font-light">{detailsUser.age}</span>
                      {detailsUser.is_verified && (
                        <span class="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-400/50 text-cyan-300 shadow-xs" title="Perfil Verificado por Biometria Facial">
                          <span>🔵</span> <span>Verificado</span>
                        </span>
                      )}
                    </div>
                    <p class="text-xs sm:text-sm text-emerald-400 font-medium mt-0.5">
                      🎓 {detailsUser.specific_course || detailsUser.course}
                    </p>
                    <div class="flex flex-wrap gap-1.5 mt-2">
                      <span class="bg-emerald-950/60 text-emerald-300 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-emerald-500/30">
                        📍 {detailsUser.campus}
                      </span>
                      {detailsUser.gender && detailsUser.gender !== 'Não informado' && (
                        <span class="bg-indigo-950/60 text-indigo-300 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-indigo-500/30">
                          {detailsUser.gender}
                        </span>
                      )}
                      <span class="bg-rose-950/60 text-rose-300 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-rose-500/30">
                        {detailsUser.looking_for}
                      </span>
                      <span class="bg-amber-950/60 text-amber-300 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-amber-500/30">
                        🏛️ {detailsUser.entity}
                      </span>
                    </div>
                  </div>

                  {/* Bio */}
                  {detailsUser.bio && (
                    <div class="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800">
                      <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Bio</h4>
                      <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">{detailsUser.bio}</p>
                    </div>
                  )}

                  {/* Teaser Bloqueado de Conteúdo Secreto / Picante */}
                  {detailsUser.has_private_content && (
                    <div class="p-4 rounded-2xl bg-gradient-to-r from-rose-950 via-slate-900 to-black border border-rose-500/30 text-white shadow-lg flex items-center justify-between gap-3">
                      <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center text-xl shrink-0 border border-rose-500/30">
                          🔒
                        </div>
                        <div>
                          <h4 class="text-xs font-bold text-rose-200 flex items-center gap-1.5">
                            <span>🔥</span> Álbum & Bio Secreta ({detailsUser.private_photos_count || 0} fotos)
                          </h4>
                          <p class="text-[11px] text-rose-300/70 mt-0.5">
                            Conteúdo exclusivo disponível após match e autorização no chat.
                          </p>
                        </div>
                      </div>
                      <span class="text-[11px] font-bold text-rose-300 bg-rose-500/20 px-2.5 py-1 rounded-full border border-rose-500/30 shrink-0">
                        Bloqueado
                      </span>
                    </div>
                  )}

                  {/* Interesses */}
                  {detailsUser.interests && detailsUser.interests.length > 0 && (
                    <div>
                      <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Interesses</h4>
                      <div class="flex flex-wrap gap-1.5">
                        {detailsUser.interests.map((item, idx) => (
                          <span key={idx} class="bg-slate-950/80 text-emerald-300 text-xs font-semibold px-3 py-1 rounded-full border border-slate-800">
                            #{item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Perguntas */}
                  <div class="space-y-2.5 pt-2 border-t border-slate-800">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-emerald-400">Perguntas</h4>

                    {detailsUser.prompt1_q && detailsUser.prompt1_a && (
                      <div class="p-4 bg-emerald-950/40 rounded-2xl border border-emerald-500/20">
                        <span class="text-xs font-bold text-emerald-300 block">{detailsUser.prompt1_q}</span>
                        <p class="text-sm font-medium text-slate-200 mt-1 italic">"{detailsUser.prompt1_a}"</p>
                      </div>
                    )}

                    {detailsUser.prompt2_q && detailsUser.prompt2_a && (
                      <div class="p-4 bg-teal-950/40 rounded-2xl border border-teal-500/20">
                        <span class="text-xs font-bold text-teal-300 block">{detailsUser.prompt2_q}</span>
                        <p class="text-sm font-medium text-slate-200 mt-1 italic">"{detailsUser.prompt2_a}"</p>
                      </div>
                    )}

                    {detailsUser.prompt3_q && detailsUser.prompt3_a && (
                      <div class="p-4 bg-amber-950/30 rounded-2xl border border-amber-500/20">
                        <span class="text-xs font-bold text-amber-300 block">{detailsUser.prompt3_q}</span>
                        <p class="text-sm font-medium text-slate-200 mt-1 italic">"{detailsUser.prompt3_a}"</p>
                      </div>
                    )}
                  </div>

                  {/* Opções de Segurança / Moderação */}
                  <div class="pt-4 pb-2 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleOpenReportFromDetails}
                      class="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1.5 py-2 px-3 bg-rose-950/40 hover:bg-rose-900/50 rounded-xl border border-rose-800/40 transition"
                    >
                      <span>⚠️</span> <span>Denunciar ou Bloquear este perfil</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
          return typeof document !== 'undefined' ? createPortal(detailsModalContent, document.body) : detailsModalContent;
        })()}

      {/* MODAL DE DENÚNCIA / BLOQUEIO */}
      {reportModalOpen && detailsUser &&
        (() => {
          const reportModalContent = (
            <div
              id="global-report-modal"
              class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-opacity"
              onClick={(e) => {
                if (e.target === e.currentTarget) setReportModalOpen(false);
              }}
            >
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
                  Você está denunciando o perfil de <strong class="text-white">{detailsUser.name || 'Usuário'}</strong>. Nossa moderação analisa cada caso com seriedade e sigilo.
                </p>

                <form onSubmit={handleSubmitReport} class="space-y-3.5">
                  <div>
                    <label class="block text-xs font-bold text-slate-300 mb-1">Motivo da denúncia</label>
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      required
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
                      rows="3"
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
                    <label for="report-block-check" class="text-xs text-slate-300 cursor-pointer">
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
                      class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-black shadow-lg shadow-rose-950/60 transition"
                    >
                      {submittingReport ? 'Enviando...' : 'Enviar Denúncia'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
          return typeof document !== 'undefined' ? createPortal(reportModalContent, document.body) : reportModalContent;
        })()}

      {/* Rodapé LGPD */}
      <div class="text-center pt-2 pb-2">
        <a href="/terms" class="text-[11px] text-slate-500 hover:text-emerald-400 transition">
          Termos de Uso & Política de Privacidade (LGPD)
        </a>
      </div>
    </main>
  );
}
