import { useEffect, useRef, useState } from 'react';

/**
 * Safaai Sarathi 2.0 - Elegant Minimalist Tech Intro
 * ===================================================
 * Clean, professional, and aesthetic entry sequence:
 * 1. Deep midnight obsidian canvas with subtle ambient emerald aura
 * 2. Glassmorphic emblem with soft breathing ring
 * 3. Modern high-precision typography & civic intelligence badge
 * 4. Micro-particle atmospheric mist (calm and refined)
 * 5. Smooth 2.6-second progress flow with seamless transition
 */

function playSoftChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Soothing ambient sine chord
    const frequencies = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.04, now + 0.15 + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + 2.0);
    });
  } catch {
    // Gracefully ignore audio block
  }
}

// ------------------------------------------------ Subtle Background Particle Canvas
function AmbientParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles = Array.from({ length: 45 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.5 + 0.5,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.5 + 0.2,
      pulseSpeed: Math.random() * 0.02 + 0.01,
      phase: Math.random() * Math.PI * 2,
    }));

    let frame = 0;

    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      // Subtle ambient center radial glow
      const cx = width / 2;
      const cy = height / 2;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(width, height) * 0.7);
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.12)');
      gradient.addColorStop(0.4, 'rgba(6, 78, 59, 0.06)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Draw elegant particles
      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const currentAlpha = p.alpha * (0.6 + 0.4 * Math.sin(frame * p.pulseSpeed + p.phase));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(52, 211, 153, ${currentAlpha})`;
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none" />;
}

// ------------------------------------------------ Main Splash Screen Component
export default function Splash({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setMounted(true);
    playSoftChime();

    const startTime = Date.now();
    const duration = 2400; // Fast 2.4s professional sequence

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      if (pct >= 100) {
        clearInterval(interval);
        setExiting(true);
        setTimeout(onDone, 450);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden bg-[#0a0f0d] text-white select-none transition-opacity duration-500 ${
        exiting ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background Ambient Particles & Light */}
      <AmbientParticleCanvas />

      {/* Top Header Badge */}
      <div
        className={`relative z-20 pt-8 sm:pt-12 transition-all duration-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      >
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-950/40 px-4 py-1.5 backdrop-blur-md shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-semibold tracking-wider text-emerald-300/90 uppercase">
            Civic Intelligence Platform · Swachh Bharat
          </span>
        </div>
      </div>

      {/* Centerpiece: Clean Logo & Professional Branding */}
      <div
        className={`relative z-20 my-auto flex flex-col items-center justify-center text-center px-4 transition-all duration-700 ${
          mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        {/* Emblem Badge with Breathing Ring */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Subtle Glow Ring */}
          <div className="absolute h-28 w-28 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
          <div
            className="absolute h-24 w-24 rounded-full border border-emerald-400/30 animate-spin"
            style={{ animationDuration: '20s' }}
          />

          {/* Central Logo Box */}
          <div className="relative grid h-18 w-18 place-items-center rounded-2xl border border-emerald-400/30 bg-gradient-to-b from-emerald-900/60 to-[#0c1a14] p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <img
              src="/icon.svg"
              alt="Safaai Sarathi"
              className="h-full w-full object-contain filter drop-shadow-[0_2px_8px_rgba(16,185,129,0.5)]"
            />
          </div>
        </div>

        {/* Brand Name */}
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          SAFAAI <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">SARATHI</span>
        </h1>

        {/* Tagline */}
        <p className="mt-2 text-xs sm:text-sm font-medium text-emerald-200/70 tracking-wide max-w-sm">
          Autonomous Waste Management & Route Optimization
        </p>

        {/* Minimalist Linear Progress Bar */}
        <div className="mt-7 w-48 sm:w-56 overflow-hidden rounded-full bg-white/10 h-1 backdrop-blur-xs">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 transition-all duration-150 ease-out shadow-[0_0_8px_rgba(52,211,153,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Bottom Bar: Version & Skip Button */}
      <div
        className={`relative z-20 flex w-full max-w-4xl items-center justify-between px-6 pb-6 text-xs text-white/50 transition-all duration-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <span className="text-[11px] font-medium tracking-wide">v2.0 · Enterprise Edition</span>

        <button
          type="button"
          onClick={onDone}
          className="group flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1 text-[11px] font-semibold text-white/80 backdrop-blur-md transition hover:border-emerald-400/50 hover:bg-emerald-500/10 hover:text-white cursor-pointer active:scale-95"
        >
          <span>Skip</span>
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </button>
      </div>
    </div>
  );
}
