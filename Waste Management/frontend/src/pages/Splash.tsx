import { useEffect, useRef, useState } from 'react';

/**
 * Safaai Sarathi 2.0 - Ultra-Cinematic "Netflix-Style" Intro Sequence
 * =================================================================
 * High-end cinematic entrance featuring:
 * 1. Web Audio API synthesized "Ta-Dum" sub-bass boom + crystal shimmer
 * 2. Multi-spectral kinetic light ribbons & glowing emerald/cyan light rays
 * 3. 3D chromatic energy convergence forming the iconic Safaai Sarathi emblem
 * 4. Hyperspace particle stream exploding into the camera (Netflix ribbon burst style)
 * 5. Tracked cinematic typography with traveling light flare
 * 6. Flawless 4.2-second sequence transitioning into the Landing/Dashboard
 */

// ------------------------------------------------ Cinematic Web Audio Synthesizer
function playCinematicTadum() {
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // 1. Deep Cinema Sub-Bass Impact Boom ("TA...")
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(110, now);
    subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.9);

    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.75, now + 0.05);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 2.3);

    // 2. Cinematic Brass/Metallic Impact ("...DUM!")
    const impactOsc = ctx.createOscillator();
    const impactGain = ctx.createGain();
    impactOsc.type = 'sawtooth';
    impactOsc.frequency.setValueAtTime(160, now + 0.12);
    impactOsc.frequency.exponentialRampToValueAtTime(45, now + 1.2);

    // Filter to give that warm, expensive cinema punch
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now + 0.12);
    filter.frequency.exponentialRampToValueAtTime(120, now + 1.2);

    impactGain.gain.setValueAtTime(0.001, now + 0.12);
    impactGain.gain.linearRampToValueAtTime(0.5, now + 0.18);
    impactGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

    impactOsc.connect(filter);
    filter.connect(impactGain);
    impactGain.connect(ctx.destination);
    impactOsc.start(now + 0.12);
    impactOsc.stop(now + 2.1);

    // 3. Shimmering Crystal Sparkle Chord (Emerald Harmonic Swell)
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const chimeOsc = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chimeOsc.type = 'triangle';
      chimeOsc.frequency.setValueAtTime(freq, now + 0.2 + idx * 0.04);

      chimeGain.gain.setValueAtTime(0.001, now + 0.2 + idx * 0.04);
      chimeGain.gain.linearRampToValueAtTime(0.12, now + 0.5);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

      chimeOsc.connect(chimeGain);
      chimeGain.connect(ctx.destination);
      chimeOsc.start(now + 0.2 + idx * 0.04);
      chimeOsc.stop(now + 3.0);
    });
  } catch {
    // Audio autostart policy gracefully ignored
  }
}

// ------------------------------------------------ High-Performance Cinematic Canvas
function NetflixRibbonCanvas({ progress }: { progress: number }) {
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

    // Generate 60 Spectral Light Ribbons (Emerald, Neon Cyan, Golden Glow, Pure White)
    const RIBBON_COUNT = 48;
    const ribbons = Array.from({ length: RIBBON_COUNT }, (_, i) => ({
      angle: (i / RIBBON_COUNT) * Math.PI * 2,
      speed: 0.8 + Math.random() * 1.6,
      width: 2 + Math.random() * 5,
      length: 120 + Math.random() * 280,
      hue: i % 3 === 0 ? '#10b981' : i % 3 === 1 ? '#06b6d4' : '#f59e0b',
      alpha: 0.3 + Math.random() * 0.6,
      noiseOffset: Math.random() * 100,
    }));

    // Generate 120 Hyperspace Stars/Sparks
    const sparkCount = 140;
    const sparks = Array.from({ length: sparkCount }, () => ({
      x: (Math.random() - 0.5) * width * 1.5,
      y: (Math.random() - 0.5) * height * 1.5,
      z: Math.random() * width,
      size: 1 + Math.random() * 2.5,
      color: Math.random() > 0.4 ? '#34d399' : '#38bdf8',
    }));

    let frame = 0;

    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // 1. Central Volumetric Aura Pulse
      const auraPulse = Math.sin(frame * 0.05) * 0.15 + 0.85;
      const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(width, height) * 0.6);
      gradient.addColorStop(0, `rgba(16, 185, 129, ${0.28 * auraPulse})`);
      gradient.addColorStop(0.25, `rgba(6, 182, 212, ${0.12 * auraPulse})`);
      gradient.addColorStop(0.55, 'rgba(5, 36, 18, 0.05)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // 2. Netflix-style Dynamic Light Ribbons radiating from center
      ribbons.forEach((r, idx) => {
        const currentAngle = r.angle + Math.sin(frame * 0.01 + r.noiseOffset) * 0.2;
        const dist = ((frame * r.speed * 4) % (width * 0.75)) + 40;
        const x1 = cx + Math.cos(currentAngle) * (dist * 0.2);
        const y1 = cy + Math.sin(currentAngle) * (dist * 0.2);
        const x2 = cx + Math.cos(currentAngle) * (dist + r.length);
        const y2 = cy + Math.sin(currentAngle) * (dist + r.length);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = r.width * (dist / 300);
        ctx.lineCap = 'round';
        ctx.strokeStyle = r.hue;
        ctx.globalAlpha = r.alpha * Math.min(1, dist / 80) * (1 - dist / (width * 0.75));
        ctx.shadowColor = r.hue;
        ctx.shadowBlur = 18;
        ctx.stroke();
        ctx.restore();
      });

      // 3. Hyperspace Particle Stream (Z-depth zoom into screen)
      sparks.forEach((s) => {
        s.z -= 7 + (frame % 20);
        if (s.z <= 0) {
          s.z = width;
          s.x = (Math.random() - 0.5) * width * 1.5;
          s.y = (Math.random() - 0.5) * height * 1.5;
        }

        const k = 280 / s.z;
        const px = cx + s.x * k;
        const py = cy + s.y * k;

        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          const pSize = Math.max(0.8, (1 - s.z / width) * s.size * 3.5);
          ctx.save();
          ctx.beginPath();
          ctx.arc(px, py, pSize, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.globalAlpha = Math.min(1, (1 - s.z / width) * 1.4);
          ctx.shadowColor = s.color;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.restore();
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none" />;
}

// ------------------------------------------------ Main Cinematic Splash Component
export default function Splash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'intro' | 'boom' | 'reveal' | 'zoom' | 'exit'>('intro');
  const [progress, setProgress] = useState(0);

  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduceMotion) {
      setTimeout(onDone, 300);
      return;
    }

    // Attempt Cinematic Audio trigger
    playCinematicTadum();

    // Sequence Milestones (Total: 4.2 seconds)
    // 0.0s - 0.5s: Tension & Sub-bass build
    // 0.5s - 1.8s: "Ta-Dum" impact burst & ribbons bloom
    // 1.8s - 3.4s: Emblem & Golden Typography illumination
    // 3.4s - 4.1s: Netflix-style hyperspace zoom into app
    // 4.2s: Transition to Landing

    const t1 = setTimeout(() => {
      setPhase('boom');
    }, 400);

    const t2 = setTimeout(() => {
      setPhase('reveal');
    }, 1400);

    const t3 = setTimeout(() => {
      setPhase('zoom');
    }, 3200);

    const t4 = setTimeout(() => {
      setPhase('exit');
    }, 3900);

    const t5 = setTimeout(() => {
      onDone();
    }, 4300);

    // Progress bar ticker
    const interval = setInterval(() => {
      setProgress((p) => Math.min(100, p + 2.5));
    }, 100);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearInterval(interval);
    };
  }, [onDone, reduceMotion]);

  return (
    <div
      onClick={playCinematicTadum}
      className={`fixed inset-0 z-[100] flex min-h-dvh w-full flex-col items-center justify-between overflow-hidden bg-black text-white select-none transition-all duration-700 ${
        phase === 'exit' ? 'opacity-0 scale-125 blur-md' : 'opacity-100 scale-100 blur-0'
      }`}
      style={{
        background: 'radial-gradient(circle at 50% 45%, #052414 0%, #021109 45%, #000000 100%)',
      }}
    >
      {/* Dynamic Spectral Canvas (Netflix Light Ribbons & Hyperspace Sparks) */}
      <NetflixRibbonCanvas progress={progress} />

      {/* Cinematic Horizontal Anamorphic Lens Flare Line */}
      <div
        className={`pointer-events-none absolute top-1/2 left-0 h-[2px] w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-400 to-transparent transition-all duration-1000 ${
          phase === 'boom' || phase === 'reveal'
            ? 'opacity-80 scale-x-100 shadow-[0_0_25px_#06b6d4]'
            : 'opacity-0 scale-x-20'
        }`}
      />

      {/* Top Bar: Official Seal Badge */}
      <div
        className={`relative z-20 flex items-center justify-center pt-8 transition-all duration-1000 ${
          phase === 'intro' ? 'opacity-0 -translate-y-8' : 'opacity-100 translate-y-0'
        }`}
      >
        <div className="flex items-center gap-2.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-4 py-1.5 backdrop-blur-xl shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-black tracking-[0.25em] uppercase text-emerald-300/90">
            Government of India · Civic AI Mission
          </span>
        </div>
      </div>

      {/* ================= CENTERPIECE: THE ICONIC SAFAAI SARATHI EMBLEM & TYPOGRAPHY ================= */}
      <div
        className={`relative z-20 my-auto flex flex-col items-center justify-center text-center transition-all duration-1000 ${
          phase === 'zoom'
            ? 'scale-[2.4] opacity-0 blur-lg transition-transform duration-700 ease-in'
            : phase === 'boom' || phase === 'reveal'
            ? 'scale-100 opacity-100 blur-0'
            : 'scale-90 opacity-0 blur-sm'
        }`}
      >
        {/* 1. Glowing 3D Emblem Container with Swachh Energy Shield */}
        <div className="relative mb-6 flex items-center justify-center">
          {/* Ambient Multi-layer Halo Ring */}
          <div className="absolute h-36 w-36 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 opacity-30 blur-2xl animate-pulse" />
          <div className="absolute h-28 w-28 rounded-full border border-emerald-400/40 shadow-[0_0_35px_rgba(16,185,129,0.5)] animate-spin" style={{ animationDuration: '14s' }} />

          {/* Central Holographic Icon */}
          <div className="relative grid h-20 w-20 place-items-center rounded-3xl border border-white/25 bg-gradient-to-b from-white/20 via-emerald-600/30 to-emerald-950/80 p-3.5 backdrop-blur-2xl shadow-[0_15px_35px_rgba(0,0,0,0.8),0_0_30px_rgba(16,185,129,0.6)]">
            <img
              src="/icon.svg"
              alt="Safaai Sarathi"
              className="h-full w-full object-contain filter drop-shadow-[0_0_12px_rgba(255,255,255,0.9)]"
            />
          </div>
        </div>

        {/* 2. Netflix-Style Grand Tracked Title */}
        <div className="relative overflow-hidden px-4">
          <h1 className="text-4xl sm:text-7xl font-black tracking-tight leading-none text-white drop-shadow-[0_10px_35px_rgba(0,0,0,0.9)]">
            <span className="inline-block transition-transform duration-700 text-white">
              SAFAAI
            </span>{' '}
            <span className="inline-block bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent filter drop-shadow-[0_0_20px_rgba(16,185,129,0.7)] font-black">
              SARATHI
            </span>
          </h1>

          {/* Traveling Shimmer Light Bar across title */}
          <div
            className={`absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] ${
              phase === 'reveal' ? 'animate-[shimmer_1.8s_ease-out_forwards]' : ''
            }`}
          />
        </div>

        {/* 3. Subtitle / Tagline */}
        <p
          className={`mt-4 text-xs sm:text-sm font-extrabold tracking-[0.35em] uppercase text-emerald-300/80 drop-shadow-md transition-all duration-700 ${
            phase === 'reveal' || phase === 'zoom'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          }`}
        >
          Autonomous Clean Fleet · Intelligence Platform
        </p>

        {/* 4. Indian Tricolor Energy Beam */}
        <div
          className={`mt-6 h-1 w-48 sm:w-64 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur-md shadow-lg transition-all duration-700 ${
            phase === 'reveal' || phase === 'zoom' ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`}
        >
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #FF9933 0%, #FFFFFF 50%, #138808 100%)',
              boxShadow: '0 0 15px rgba(255, 255, 255, 0.8)',
            }}
          />
        </div>
      </div>

      {/* ================= BOTTOM BAR ================= */}
      <div className="relative z-20 flex w-full max-w-5xl items-center justify-between px-6 pb-6">
        {/* Left: Version Tag */}
        <div className="text-[11px] font-bold uppercase tracking-widest text-white/40">
          v2.0 · Ultra High-Def
        </div>

        {/* Right: Skip Button */}
        <button
          type="button"
          onClick={onDone}
          className="group flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white/90 backdrop-blur-md transition hover:border-emerald-400 hover:bg-emerald-500/20 hover:text-white active:scale-95 shadow-lg cursor-pointer"
        >
          <span>Skip</span>
          <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2 2l6 4-6 4V2zm7 0h1.5v8H9V2z" />
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-150%) skewX(-20deg); }
          100% { transform: translateX(200%) skewX(-20deg); }
        }
      `}</style>
    </div>
  );
}
