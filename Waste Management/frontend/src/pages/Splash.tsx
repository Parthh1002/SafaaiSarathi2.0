import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Netflix-style cinematic intro:
 * - Animated 3D garbage truck (built from primitives)
 * - Cinematic text reveal (letter by letter)
 * - Progress bar auto-advances ~5s
 * - Skip intro button
 */

/* ------------------------------------------------------------------ truck */

function GarbageTruck() {
  const group = useRef<THREE.Group>(null);
  const wheels = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const dustRefs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const t = useRef(0);

  useFrame((_, delta) => {
    if (!group.current) return;
    t.current += delta;

    // Gentle floating + slight rock
    group.current.position.y = Math.sin(t.current * 1.2) * 0.06;
    group.current.rotation.y = Math.sin(t.current * 0.4) * 0.12;
    group.current.rotation.z = Math.sin(t.current * 0.8) * 0.018;

    // Spin wheels
    wheels.forEach((w) => {
      if (w.current) w.current.rotation.x += delta * 3.5;
    });

    // Animate dust particles
    dustRefs.forEach((d, i) => {
      if (d.current) {
        d.current.position.x = -1.8 + Math.sin(t.current * 2 + i) * 0.2;
        d.current.position.y = -0.55 + i * 0.12 + Math.sin(t.current * 3 + i) * 0.06;
        d.current.material.opacity = 0.18 + Math.sin(t.current * 2 + i) * 0.12;
      }
    });
  });

  const green = '#15803d';
  const darkGreen = '#0f4d2a';
  const grey = '#9ca3af';
  const darkGrey = '#374151';
  const yellow = '#fbbf24';
  const silver = '#d1d5db';

  return (
    <group ref={group} scale={0.82}>
      {/* === CABIN === */}
      <mesh position={[0.72, 0.22, 0]}>
        <boxGeometry args={[1.05, 0.85, 1.1]} />
        <meshStandardMaterial color={green} roughness={0.3} metalness={0.5} />
      </mesh>
      {/* Cabin roof */}
      <mesh position={[0.72, 0.72, 0]}>
        <boxGeometry args={[0.95, 0.22, 1.0]} />
        <meshStandardMaterial color={darkGreen} roughness={0.4} metalness={0.4} />
      </mesh>
      {/* Windshield */}
      <mesh position={[1.22, 0.28, 0]}>
        <boxGeometry args={[0.06, 0.52, 0.82]} />
        <meshStandardMaterial color="#7dd3fc" roughness={0.05} metalness={0.1} transparent opacity={0.7} />
      </mesh>
      {/* Headlights */}
      {[-0.34, 0.34].map((z, i) => (
        <mesh key={i} position={[1.24, 0.0, z]}>
          <boxGeometry args={[0.05, 0.14, 0.22]} />
          <meshStandardMaterial color={yellow} emissive={yellow} emissiveIntensity={0.8} />
        </mesh>
      ))}
      {/* Side mirror */}
      <mesh position={[1.0, 0.42, 0.62]}>
        <boxGeometry args={[0.16, 0.1, 0.04]} />
        <meshStandardMaterial color={darkGrey} roughness={0.5} />
      </mesh>

      {/* === BODY / HOPPER === */}
      <mesh position={[-0.7, 0.18, 0]}>
        <boxGeometry args={[2.0, 0.88, 1.1]} />
        <meshStandardMaterial color={green} roughness={0.35} metalness={0.45} />
      </mesh>
      {/* Hopper top slope */}
      <mesh position={[-1.55, 0.72, 0]} rotation={[0, 0, 0.25]}>
        <boxGeometry args={[0.5, 0.22, 1.05]} />
        <meshStandardMaterial color={darkGreen} roughness={0.4} />
      </mesh>
      {/* Compactor door */}
      <mesh position={[-1.7, 0.18, 0]}>
        <boxGeometry args={[0.08, 0.82, 1.05]} />
        <meshStandardMaterial color={darkGrey} roughness={0.5} metalness={0.6} />
      </mesh>
      {/* Body stripe */}
      <mesh position={[-0.7, -0.08, 0.56]}>
        <boxGeometry args={[1.95, 0.08, 0.04]} />
        <meshStandardMaterial color={yellow} roughness={0.4} />
      </mesh>
      {/* Recycle logo patch */}
      <mesh position={[-0.55, 0.25, 0.562]}>
        <circleGeometry args={[0.22, 16]} />
        <meshStandardMaterial color="#22c55e" roughness={0.3} />
      </mesh>

      {/* === CHASSIS === */}
      <mesh position={[-0.18, -0.4, 0]}>
        <boxGeometry args={[2.9, 0.14, 0.9]} />
        <meshStandardMaterial color={darkGrey} roughness={0.6} metalness={0.5} />
      </mesh>
      {/* Bumper */}
      <mesh position={[1.3, -0.32, 0]}>
        <boxGeometry args={[0.12, 0.18, 1.05]} />
        <meshStandardMaterial color={silver} roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Exhaust pipe */}
      <mesh position={[0.6, 0.88, -0.58]}>
        <cylinderGeometry args={[0.04, 0.04, 0.55, 8]} />
        <meshStandardMaterial color={darkGrey} roughness={0.5} metalness={0.7} />
      </mesh>
      {/* Exhaust smoke */}
      <mesh ref={dustRefs[0] as any} position={[0.6, 1.22, -0.58]}>
        <sphereGeometry args={[0.08, 6, 6]} />
        <meshStandardMaterial color={grey} transparent opacity={0.25} />
      </mesh>

      {/* === WHEELS (4) === */}
      {/* Front left */}
      <mesh ref={wheels[0] as any} position={[0.85, -0.55, 0.58]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.18, 16]} />
        <meshStandardMaterial color={darkGrey} roughness={0.8} />
      </mesh>
      {/* Front right */}
      <mesh ref={wheels[1] as any} position={[0.85, -0.55, -0.58]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.18, 16]} />
        <meshStandardMaterial color={darkGrey} roughness={0.8} />
      </mesh>
      {/* Rear left */}
      <mesh ref={wheels[2] as any} position={[-0.95, -0.55, 0.58]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.18, 16]} />
        <meshStandardMaterial color={darkGrey} roughness={0.8} />
      </mesh>
      {/* Rear right */}
      <mesh ref={wheels[3] as any} position={[-0.95, -0.55, -0.58]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.18, 16]} />
        <meshStandardMaterial color={darkGrey} roughness={0.8} />
      </mesh>
      {/* Wheel hub caps */}
      {[[0.85, 0.58], [0.85, -0.58], [-0.95, 0.58], [-0.95, -0.58]].map(([x, z], i) => (
        <mesh key={i} position={[x, -0.55, z + (z > 0 ? 0.1 : -0.1)]}>
          <cylinderGeometry args={[0.12, 0.12, 0.05, 8]} />
          <meshStandardMaterial color={silver} roughness={0.2} metalness={0.9} />
        </mesh>
      ))}

      {/* Ground shadow */}
      <mesh position={[0, -0.85, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ellipseGeometry args={[1.6, 0.6, 16]} />
        <meshStandardMaterial color="#000" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 8, 5]} intensity={2.2} castShadow />
      <directionalLight position={[-4, -2, -3]} intensity={0.6} color="#4ade80" />
      <pointLight position={[0, 3, 2]} intensity={0.8} color="#bbf7d0" />
      <GarbageTruck />
    </>
  );
}

/* ----------------------------------------------------------------- typewriter */

function Typewriter({ text, delay = 0, className = '' }: { text: string; delay?: number; className?: string }) {
  const [shown, setShown] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(startTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    if (shown.length >= text.length) return;
    const timer = setTimeout(() => setShown(text.slice(0, shown.length + 1)), 45);
    return () => clearTimeout(timer);
  }, [started, shown, text]);

  return (
    <span className={className}>
      {shown}
      {shown.length < text.length && started && (
        <span className="inline-block w-0.5 h-[1em] align-middle bg-current ml-0.5 animate-pulse" />
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ splash */

export default function Splash({ onDone }: { onDone: () => void }) {
  const [webglFailed, setWebglFailed] = useState(false);
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (sessionStorage.getItem('ss_intro_seen')) { onDone(); return; }
    if (reduceMotion) {
      sessionStorage.setItem('ss_intro_seen', '1');
      setTimeout(onDone, 800);
      return;
    }
    const t1 = setTimeout(() => setPhase('hold'), 600);
    const t2 = setTimeout(() => setPhase('out'), 4400);
    const t3 = setTimeout(() => { sessionStorage.setItem('ss_intro_seen', '1'); onDone(); }, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone, reduceMotion]);

  const skip = () => { sessionStorage.setItem('ss_intro_seen', '1'); onDone(); };

  return (
    <div
      className="relative grid min-h-dvh place-items-center overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 40%, #0a2e18 0%, #000 70%)',
        transition: 'opacity 0.6s ease',
        opacity: phase === 'out' ? 0 : 1,
      }}
    >
      {/* Ambient glow rings */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-900/30 blur-[80px]" />
        <div className="absolute left-1/2 top-1/2 h-[40vmin] w-[40vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-700/20 blur-[40px]" />
        {/* Subtle scan line */}
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-green-500/20 to-transparent" style={{ top: '38%' }} />
      </div>

      <div className="relative flex flex-col items-center gap-0 px-6 text-center">
        {/* 3D Model */}
        <div
          className="h-52 w-72 sm:h-64 sm:w-96"
          style={{
            opacity: phase === 'in' ? 0 : 1,
            transform: phase === 'in' ? 'translateY(20px) scale(0.9)' : 'translateY(0) scale(1)',
            transition: 'opacity 0.7s ease, transform 0.7s ease',
          }}
        >
          {reduceMotion || webglFailed ? (
            <div className="grid h-full w-full place-items-center">
              <img src="/icon.svg" alt="" className="h-24 w-24 opacity-80" />
            </div>
          ) : (
            <Suspense fallback={null}>
              <Canvas
                camera={{ position: [0, 0.5, 5.8], fov: 42 }}
                dpr={[1, 2]}
                onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
                fallback={<img src="/icon.svg" alt="" className="h-24 w-24" />}
                onError={() => setWebglFailed(true)}
              >
                <Scene />
              </Canvas>
            </Suspense>
          )}
        </div>

        {/* Title — Netflix style: white "Safaai" + brand-green "Sarathi" */}
        <div
          style={{
            opacity: phase === 'in' ? 0 : 1,
            transform: phase === 'in' ? 'translateY(16px)' : 'translateY(0)',
            transition: 'opacity 0.6s ease 0.35s, transform 0.6s ease 0.35s',
          }}
        >
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            <Typewriter text="Safaai " delay={500} className="text-white" />
            <Typewriter text="Sarathi" delay={900} className="text-green-400" />
          </h1>
        </div>

        {/* Subtitle */}
        <p
          className="mt-3 max-w-xs text-[0.82rem] tracking-widest uppercase text-white/45"
          style={{
            opacity: phase === 'in' ? 0 : 1,
            transition: 'opacity 0.7s ease 1.4s',
          }}
        >
          AI-verified civic waste response
        </p>

        {/* Tricolor progress bar */}
        <div className="mt-6 h-0.5 w-44 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #FF9933 0%, #fff 45%, #138808 100%)',
              animation: reduceMotion ? undefined : `grow ${4.3}s linear forwards`,
              width: reduceMotion ? '100%' : undefined,
            }}
          />
        </div>

        {/* Government of India tag */}
        <p
          className="mt-4 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white/30"
          style={{
            opacity: phase === 'in' ? 0 : 1,
            transition: 'opacity 0.7s ease 1.8s',
          }}
        >
          भारत सरकार &nbsp;·&nbsp; Government of India
        </p>
      </div>

      {/* Skip intro — Netflix style bottom right */}
      <button
        type="button"
        onClick={skip}
        className="absolute bottom-8 right-6 flex items-center gap-2 rounded border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/60 backdrop-blur-sm transition hover:border-white/40 hover:text-white/90 sm:right-10"
      >
        Skip Intro
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
          <path d="M2 2l6 4-6 4V2zm7 0h1.5v8H9V2z" />
        </svg>
      </button>

      <style>{`@keyframes grow { from { width: 0 } to { width: 100% } }`}</style>
    </div>
  );
}
