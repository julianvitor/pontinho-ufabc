/**
 * Pontinho - Efeito Dinâmico de Fundo (Conexões & Pontinhos Vivos)
 * Animação de partículas leves e conectadas ("Pontinhos") em Canvas HTML5 acelerado.
 */
(function() {
  function initAmbientBackground() {
    let canvas = document.getElementById('ambient-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'ambient-canvas';
      canvas.className = 'fixed inset-0 pointer-events-none z-0';
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '0';
      document.body.prepend(canvas);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Quantidade de partículas baseada no tamanho da tela
    const count = Math.min(Math.floor((width * height) / 22000), 45);
    const particles = [];

    // Cores conforme o tema atual
    function getColors() {
      const isPride = document.documentElement.classList.contains('theme-pride');
      if (isPride) {
        return {
          points: [
            'rgba(236, 72, 153, ', // Pink
            'rgba(168, 85, 247, ', // Purple
            'rgba(56, 189, 248, ', // Sky Blue
            'rgba(251, 191, 36, '  // Amber
          ],
          line: 'rgba(168, 85, 247, '
        };
      }
      return {
        points: [
          'rgba(52, 211, 153, ',  // Emerald 400
          'rgba(16, 185, 129, ',  // Emerald 500
          'rgba(45, 212, 191, ',  // Teal 400
          'rgba(110, 231, 183, '  // Emerald 300
        ],
        line: 'rgba(52, 211, 153, '
      };
    }

    let colors = getColors();

    class Particle {
      constructor() {
        this.reset(true);
      }

      reset(initial = false) {
        this.x = Math.random() * width;
        this.y = initial ? Math.random() * height : height + 10;
        this.radius = Math.random() * 2 + 1.2;
        this.baseAlpha = Math.random() * 0.5 + 0.35;
        this.alpha = this.baseAlpha;
        this.vx = (Math.random() - 0.5) * 0.45;
        this.vy = -(Math.random() * 0.45 + 0.2); // Sobe suavemente
        this.pulseSpeed = Math.random() * 0.025 + 0.01;
        this.pulseAngle = Math.random() * Math.PI * 2;
        this.colorPrefix = colors.points[Math.floor(Math.random() * colors.points.length)];
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        // Pulso suave de brilho
        this.pulseAngle += this.pulseSpeed;
        this.alpha = this.baseAlpha + Math.sin(this.pulseAngle) * 0.25;

        // Reposiciona ao sair da tela
        if (this.y < -15 || this.x < -15 || this.x > width + 15) {
          this.reset(false);
        }
      }

      draw() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.colorPrefix + Math.max(0.1, Math.min(1, this.alpha)) + ')';
        ctx.shadowColor = this.colorPrefix + '0.8)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      }
    }

    for (let i = 0; i < count; i++) {
      particles.push(new Particle());
    }

    // Interatividade com ponteiro (mouse/touch)
    const mouse = { x: -1000, y: -1000 };
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }, { passive: true });

    window.addEventListener('mouseleave', () => {
      mouse.x = -1000;
      mouse.y = -1000;
    }, { passive: true });

    let animationId = null;
    let lastTime = 0;

    function render(timestamp) {
      animationId = requestAnimationFrame(render);

      // Limita taxa para economizar bateria se necessário
      if (timestamp - lastTime < 16) return;
      lastTime = timestamp;

      ctx.clearRect(0, 0, width, height);
      colors = getColors();

      const maxDist = 110;
      const maxDistSq = maxDist * maxDist;

      // Desenha conexões suaves entre pontinhos próximos
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxDistSq) {
            const dist = Math.sqrt(distSq);
            const lineAlpha = (1 - dist / maxDist) * 0.18;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = colors.line + lineAlpha + ')';
            ctx.lineWidth = 0.85;
            ctx.stroke();
          }
        }

        // Conexão sutil com o mouse se próximo
        const mdx = p1.x - mouse.x;
        const mdy = p1.y - mouse.y;
        const mDistSq = mdx * mdx + mdy * mdy;
        if (mDistSq < 140 * 140) {
          const mDist = Math.sqrt(mDistSq);
          const mAlpha = (1 - mDist / 140) * 0.35;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = colors.line + mAlpha + ')';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        p1.update();
        p1.draw();
      }
    }

    // Gerenciamento de visibilidade (pausa em segundo plano)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (animationId) cancelAnimationFrame(animationId);
      } else {
        lastTime = performance.now();
        animationId = requestAnimationFrame(render);
      }
    });

    animationId = requestAnimationFrame(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAmbientBackground);
  } else {
    initAmbientBackground();
  }
})();
