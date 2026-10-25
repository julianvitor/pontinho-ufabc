import { useEffect, useRef } from 'preact/hooks';
import { onThemeChange } from '../services/theme.js';

export function AmbientBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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

    function getColors() {
      const isPride = document.documentElement.classList.contains('theme-pride');
      if (isPride) {
        return {
          points: [
            'rgba(236, 72, 153, ',
            'rgba(168, 85, 247, ',
            'rgba(56, 189, 248, ',
            'rgba(251, 191, 36, '
          ],
          line: 'rgba(168, 85, 247, '
        };
      }
      return {
        points: [
          'rgba(52, 211, 153, ',
          'rgba(168, 85, 247, ',
          'rgba(45, 212, 191, ',
          'rgba(110, 231, 183, '
        ],
        line: 'rgba(52, 211, 153, '
      };
    }

    let colors = getColors();
    const unsubTheme = onThemeChange(() => {
      colors = getColors();
      particles.forEach(p => {
        p.colorPrefix = colors.points[Math.floor(Math.random() * colors.points.length)];
      });
    });

    const count = Math.min(Math.floor((width * height) / 22000), 45);
    const particles = [];

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
        this.vy = -(Math.random() * 0.45 + 0.2);
        this.pulseSpeed = Math.random() * 0.025 + 0.01;
        this.pulseAngle = Math.random() * Math.PI * 2;
        this.colorPrefix = colors.points[Math.floor(Math.random() * colors.points.length)];
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.pulseAngle += this.pulseSpeed;
        this.alpha = this.baseAlpha + Math.sin(this.pulseAngle) * 0.25;
        if (this.y < -15 || this.x < -15 || this.x > width + 15) {
          this.reset(false);
        }
      }
      draw() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${this.colorPrefix}${Math.max(0.1, Math.min(0.9, this.alpha))})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = `${this.colorPrefix}0.6)`;
        ctx.fill();
        ctx.restore();
      }
    }

    for (let i = 0; i < count; i++) {
      particles.push(new Particle());
    }

    let animId;
    function loop() {
      ctx.clearRect(0, 0, width, height);

      // Conexões de linhas próximas
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist < 110) {
            const lineAlpha = (1 - dist / 110) * 0.18;
            ctx.strokeStyle = `${colors.line}${lineAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      particles.forEach(p => {
        p.update();
        p.draw();
      });

      animId = requestAnimationFrame(loop);
    }
    loop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      unsubTheme();
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        id="ambient-canvas"
        class="fixed inset-0 pointer-events-none z-0"
        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 0 }}
      />
      <div class="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div class="ambient-glow-1 absolute top-0 left-1/2 -translate-x-1/2 w-[750px] h-[400px] bg-emerald-500/20 rounded-full blur-[100px]" />
        <div class="ambient-glow-2 absolute bottom-0 right-0 w-[500px] h-[400px] bg-teal-500/20 rounded-full blur-[100px]" />
        <div class="ambient-glow-3 absolute top-1/3 left-[-100px] w-[400px] h-[400px] bg-emerald-400/10 rounded-full blur-[110px]" />
      </div>
    </>
  );
}
