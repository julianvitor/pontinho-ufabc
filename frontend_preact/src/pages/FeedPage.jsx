import { useState, useEffect, useRef } from 'preact/hooks';
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
  const [matchData, setMatchData] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const cardRef = useRef(null);
  const stampLikeRef = useRef(null);
  const stampNopeRef = useRef(null);
  const playerRef = useRef(null);

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
    } catch (_) {}
  }

  async function loadFeed() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/feed');
      setCards(data.cards || []);
      setCurrentIndex(0);
      setCurrentPhotoIndex(0);
    } catch (err) {
      showToast(err.message || 'Erro ao carregar feed', 'error');
    } finally {
      setLoading(false);
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
    if (!activeCard) return;

    const el = cardRef.current;
    if (el) {
      el.classList.add(action === 'like' ? 'swiping-right' : 'swiping-left');
    }

    if (activeCard.is_ad) {
      setTimeout(() => {
        setCurrentIndex((i) => i + 1);
        setCurrentPhotoIndex(0);
      }, 250);
      return;
    }

    const targetUserId = activeCard.id;
    try {
      const res = await apiFetch('/api/swipe', {
        method: 'POST',
        body: JSON.stringify({
          target_user_id: targetUserId,
          action: action
        })
      });

      setTimeout(() => {
        setCurrentIndex((i) => i + 1);
        setCurrentPhotoIndex(0);
        if (res.matched) {
          triggerMatchCelebration(res.match_user);
        }
      }, 250);
    } catch (err) {
      showToast(err.message, 'error');
      if (el) el.classList.remove('swiping-right', 'swiping-left');
    }
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
          try { card.setPointerCapture(e.pointerId); } catch (_) {}
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
      try { card.releasePointerCapture(e.pointerId); } catch (_) {}

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
        card.style.transform = '';
        handleSwipe('like');
      } else if (dx < -85) {
        card.style.transform = '';
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
        setDetailsModalOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailsModalOpen, carouselItems.length]);

  return (
    <main class="flex-1 w-full max-w-4xl mx-auto px-3 sm:px-4 pt-3 pb-24 md:pb-6 flex flex-col items-center justify-center relative z-10">
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
                apenas para membros da UFABC
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
                {/* CARD DE PUBLICIDADE */}
                {activeCard.is_ad ? (
                  <div
                    ref={cardRef}
                    id="active-card"
                    class="tinder-card w-full h-full relative select-none bg-slate-900 cursor-grab active:cursor-grabbing"
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
                    ref={cardRef}
                    id="active-card"
                    class="group tinder-card w-full h-full relative cursor-grab active:cursor-grabbing select-none overflow-hidden"
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
                          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
                        </button>
                        <button
                          type="button"
                          onClick={nextPhoto}
                          class="carousel-arrow-btn absolute right-2.5 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-slate-950/70 hover:bg-slate-900 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 sm:opacity-85 hover:sm:opacity-100 shadow-xl border border-white/20 active:scale-95 cursor-pointer backdrop-blur-md"
                          title="Próxima foto (→)"
                        >
                          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
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
                      class={`absolute top-6 right-3 z-30 text-[10px] font-bold px-2 py-0.5 rounded-full transition-all border pointer-events-none ${
                        currentItem && currentItem.is_secret
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
                onClick={() => {
                  setDetailsUser(activeCard);
                  setDetailsModalOpen(true);
                }}
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
      {matchData && (
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
      )}

      {/* MODAL DE DETALHES DO PERFIL */}
      {detailsModalOpen && detailsUser && (
        <div
          id="details-modal"
          class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailsModalOpen(false);
          }}
        >
          <div class="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col text-slate-100">
            <div class="sticky top-0 bg-slate-900/95 backdrop-blur-md px-6 py-4 border-b border-slate-800 flex items-center justify-between z-10">
              <h3 class="font-bold text-white text-lg flex items-center gap-2">
                <span>Detalhes de {detailsUser.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setDetailsModalOpen(false)}
                class="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div id="details-content" class="p-6 space-y-6">
              {/* Bio */}
              {detailsUser.bio && (
                <div class="space-y-1.5">
                  <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Sobre mim</span>
                  <p class="text-sm text-slate-200 leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                    {detailsUser.bio}
                  </p>
                </div>
              )}

              {/* Interesses */}
              {detailsUser.interests && detailsUser.interests.length > 0 && (
                <div class="space-y-2">
                  <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Interesses</span>
                  <div class="flex flex-wrap gap-2">
                    {detailsUser.interests.map((tag, idx) => (
                      <span key={idx} class="px-3 py-1 bg-slate-800/80 text-emerald-300 text-xs rounded-xl border border-slate-700/60 font-medium">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Músicas */}
              {detailsUser.songs && detailsUser.songs.length > 0 && (
                <div class="space-y-2">
                  <span class="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🎵</span> Músicas Favoritas
                  </span>
                  <div class="space-y-1.5">
                    {detailsUser.songs.map((song, idx) => (
                      <div key={idx} class="p-3 bg-purple-950/30 rounded-xl border border-purple-500/20 text-xs text-purple-200 flex items-center justify-between">
                        <span class="truncate">{song}</span>
                        <span class="text-xs">🎶</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Perguntinhas */}
              <div class="space-y-3">
                {detailsUser.prompt1_q && (
                  <div class="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-1">
                    <p class="text-xs font-bold text-emerald-400">{detailsUser.prompt1_q}</p>
                    <p class="text-sm text-slate-200">{detailsUser.prompt1_a}</p>
                  </div>
                )}
                {detailsUser.prompt2_q && (
                  <div class="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-1">
                    <p class="text-xs font-bold text-emerald-400">{detailsUser.prompt2_q}</p>
                    <p class="text-sm text-slate-200">{detailsUser.prompt2_a}</p>
                  </div>
                )}
                {detailsUser.prompt3_q && (
                  <div class="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-1">
                    <p class="text-xs font-bold text-emerald-400">{detailsUser.prompt3_q}</p>
                    <p class="text-sm text-slate-200">{detailsUser.prompt3_a}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé LGPD */}
      <div class="text-center pt-2 pb-2">
        <a href="/terms" class="text-[11px] text-slate-500 hover:text-emerald-400 transition">
          Termos de Uso & Política de Privacidade (LGPD)
        </a>
      </div>
    </main>
  );
}
