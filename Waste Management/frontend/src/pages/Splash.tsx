import { useEffect, useState } from 'react';

/**
 * Safaai Sarathi 2.0 - Gandhinagar Civic Edition Intro
 * ====================================================
 * Cinematic entrance featuring:
 * 1. Realistic Mahatma Mandir & GMC EV Compactor Fleet background with subtle Ken Burns zoom
 * 2. Pure animated typography (logo removed as requested) with metallic emerald shimmer
 * 3. Official Gandhinagar Municipal Corporation (GMC) & Swachh Bharat mission badges
 * 4. Crisp glowing Indian tricolor progress indicator
 * 5. Instant Skip action & smooth transition into the application
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

    // Harmonious crystal chord (C5, E5, G5, C6)
    const frequencies = [523.25, 659.25, 783.99, 1046.5];
    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.04, now + 0.15 + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + 2.2);
    });
  } catch {
    // Gracefully ignore audio block
  }
}

export default function Splash({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setMounted(true);
    playSoftChime();

    const startTime = Date.now();
    const duration = 2800; // Smooth 2.8s entrance

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
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden bg-black text-white select-none transition-all duration-500 ${
        exiting ? 'opacity-0 scale-98 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* ================= BACKGROUND: REALISTIC MAHATMA MANDIR & GMC TRUCK ================= */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src="/gmc-gandhinagar-splash.jpg"
          alt="GMC Gandhinagar Mahatma Mandir"
          className="h-full w-full object-cover object-center scale-105 animate-[kenburns_16s_ease-out_infinite_alternate]"
        />

        {/* Sophisticated Dark Gradient Scrim for crisp text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/80 backdrop-blur-[1px]" />
        <div className="absolute inset-0 bg-radial from-transparent via-black/40 to-black/90" />
      </div>

      {/* ================= TOP BADGE: GMC & CIVIC MISSION ================= */}
      <div
        className={`relative z-20 pt-8 sm:pt-12 transition-all duration-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      >
        <div className="flex items-center gap-2.5 rounded-full border border-white/20 bg-black/60 px-4 py-1.5 backdrop-blur-xl shadow-lg shadow-black/40">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-bold tracking-[0.2em] text-emerald-300 uppercase">
            Gandhinagar Municipal Corporation · Swachh Bharat
          </span>
        </div>
      </div>

      {/* ================= CENTER: PURE ANIMATED TYPOGRAPHY (LOGO REMOVED) ================= */}
      <div
        className={`relative z-20 my-auto flex flex-col items-center justify-center text-center px-4 transition-all duration-1000 ${
          mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'
        }`}
      >
        {/* Sub-label */}
        <div className="mb-2.5 inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 border border-emerald-400/30 px-3 py-1 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-300">
            Smart City Capital Mission
          </span>
        </div>

        {/* Grand Title with Traveling Light Shimmer */}
        <div className="relative overflow-hidden px-2 py-1">
          <h1 className="text-4xl sm:text-7xl font-black tracking-tight leading-none text-white drop-shadow-[0_15px_35px_rgba(0,0,0,0.95)]">
            <span className="inline-block transition-transform duration-700 hover:scale-105">
              SAFAAI
            </span>{' '}
            <span className="inline-block bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent font-black filter drop-shadow-[0_0_25px_rgba(16,185,129,0.8)]">
              SARATHI
            </span>
          </h1>

          {/* Traveling Shimmer Overlay */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.2s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg] pointer-events-none" />
        </div>

        {/* Dynamic Tagline */}
        <p className="mt-3.5 max-w-md text-xs sm:text-base font-semibold text-emerald-100/80 tracking-wide drop-shadow-md">
          AI-Powered Civic Waste Governance & Route Optimization Platform
        </p>

        {/* Glowing Indian Tricolor Precision Progress Line */}
        <div className="mt-8 h-1 w-52 sm:w-72 overflow-hidden rounded-full bg-white/15 ring-1 ring-white/20 backdrop-blur-md shadow-lg">
          <div
            className="h-full rounded-full transition-all duration-150 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #FF9933 0%, #FFFFFF 50%, #138808 100%)',
              boxShadow: '0 0 12px rgba(255, 255, 255, 0.9)',
            }}
          />
        </div>
      </div>

      {/* ================= BOTTOM: EDITION TAG & SKIP BUTTON ================= */}
      <div
        className={`relative z-20 flex w-full max-w-5xl items-center justify-between px-6 pb-6 text-xs text-white/60 transition-all duration-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <span className="text-[11px] font-bold tracking-wider uppercase text-white/50">
          GMC v2.0 · Capital Fleet Intelligence
        </span>

        {/* Fast Skip Button */}
        <button
          type="button"
          onClick={onDone}
          className="group flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-xl transition hover:border-emerald-400 hover:bg-emerald-500/20 active:scale-95 shadow-lg cursor-pointer"
        >
          <span>Skip</span>
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </button>
      </div>

      <style>{`
        @keyframes kenburns {
          0% { transform: scale(1.04) translateY(0px); }
          100% { transform: scale(1.12) translateY(-12px); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-150%) skewX(-20deg); }
          100% { transform: translateX(200%) skewX(-20deg); }
        }
      `}</style>
    </div>
  );
}
