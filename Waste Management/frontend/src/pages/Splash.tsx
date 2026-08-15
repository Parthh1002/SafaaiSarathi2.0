import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * High-Impact Cinematic 3D Intro for Safaai Sarathi:
 * - Ultra-detailed 3D Garbage Truck driving dynamically from left to right
 * - Active spinning 6-wheel chassis, flashing amber beacon, glowing LED headlights
 * - Trailing exhaust smoke & rushing asphalt road markings
 * - Netflix/Apple style typography reveal
 * - Exact 4-second auto-transition to Landing Page + Instant Skip button
 */

/* ------------------------------------------------------------------ 3D Road */

function RoadSurface({ speed = 4.0 }: { speed?: number }) {
  const roadStripes = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!roadStripes.current) return;
    // Shift road markings backwards to simulate forward truck movement
    roadStripes.current.children.forEach((stripe) => {
      stripe.position.x -= delta * speed;
      if (stripe.position.x < -6) {
        stripe.position.x += 12;
      }
    });
  });

  const stripes = useMemo(() => [-5, -3, -1, 1, 3, 5], []);

  return (
    <group position={[0, -0.92, 0]}>
      {/* Dark Asphalt base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[16, 4]} />
        <meshStandardMaterial color="#0b0f12" roughness={0.9} />
      </mesh>

      {/* Road border curb lines */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 1.6]}>
        <planeGeometry args={[16, 0.08]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.3} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -1.6]}>
        <planeGeometry args={[16, 0.08]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.3} />
      </mesh>

      {/* Moving Center Dashed Lines */}
      <group ref={roadStripes} position={[0, 0.006, 0]}>
        {stripes.map((x, idx) => (
          <mesh key={idx} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0, 0]}>
            <planeGeometry args={[1.1, 0.1]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.45} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ 3D Truck */

function DrivingGarbageTruck() {
  const truckGroup = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.PointLight>(null);
  const wheelsRef = useRef<THREE.Mesh[]>([]);
  const exhaustParticles = useRef<THREE.Mesh[]>([]);
  const progress = useRef(0);

  // Colors
  const brandGreen = '#15803d';
  const darkGreen = '#0a3d1c';
  const cabWhite = '#f8fafc';
  const steelGrey = '#334155';
  const darkChassis = '#0f172a';
  const chromeSilver = '#cbd5e1';
  const amberBeacon = '#f59e0b';
  const cautionYellow = '#eab308';
  const ledCyan = '#38bdf8';

  useFrame((_, delta) => {
    if (!truckGroup.current) return;
    progress.current += delta;
    const t = progress.current;

    // Driving trajectory from Left (-5.2) -> Center (0.0) -> Right (+5.5) across ~3.8 seconds
    // Smooth cinematic curve: accelerates in, cruises through center, speeds out
    let posX = -5.0 + t * 2.7;
    if (t > 2.2) {
      // Accelerate exit
      posX += Math.pow(t - 2.2, 1.8) * 1.5;
    }
    truckGroup.current.position.x = posX;

    // Dynamic vehicle suspension bounce and slight aerodynamic pitch
    truckGroup.current.position.y = Math.sin(t * 14) * 0.02 + Math.sin(t * 6) * 0.015;
    truckGroup.current.rotation.z = Math.sin(t * 12) * 0.008 - 0.01; // subtle forward tilt
    truckGroup.current.rotation.y = 0.05 + Math.sin(t * 2) * 0.02; // slight perspective angle

    // Spin all 6 wheels according to speed
    const wheelSpeed = delta * 16;
    wheelsRef.current.forEach((w) => {
      if (w) w.rotation.x += wheelSpeed;
    });

    // Strobe amber emergency beacon light
    if (beaconRef.current) {
      beaconRef.current.intensity = Math.sin(t * 20) > 0.2 ? 3.5 : 0.4;
    }

    // Exhaust smoke puffs trailing behind
    exhaustParticles.current.forEach((mesh, i) => {
      if (!mesh) return;
      const offset = (t * 4 + i * 0.8) % 2;
      mesh.position.x = -1.6 - offset * 0.8;
      mesh.position.y = 0.5 + offset * 0.3;
      mesh.scale.setScalar(0.06 + offset * 0.18);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = Math.max(0, 0.4 - offset * 0.2);
    });
  });

  return (
    <group ref={truckGroup} scale={0.92} position={[-4.5, 0, 0]}>
      {/* ================= CABIN (Front) ================= */}
      {/* Main Cab body */}
      <mesh position={[0.82, 0.24, 0]}>
        <boxGeometry args={[0.95, 0.88, 1.05]} />
        <meshStandardMaterial color={cabWhite} roughness={0.2} metalness={0.1} />
      </mesh>

      {/* Aerodynamic Cab Roof Visor (Green) */}
      <mesh position={[0.78, 0.74, 0]}>
        <boxGeometry args={[0.88, 0.16, 0.98]} />
        <meshStandardMaterial color={brandGreen} roughness={0.3} />
      </mesh>

      {/* Panoramic Tinted Windshield */}
      <mesh position={[1.25, 0.35, 0]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.08, 0.52, 0.88]} />
        <meshStandardMaterial color={ledCyan} roughness={0.05} metalness={0.2} transparent opacity={0.75} />
      </mesh>

      {/* Side Windows */}
      {[-0.53, 0.53].map((z, i) => (
        <mesh key={i} position={[0.82, 0.38, z]}>
          <boxGeometry args={[0.55, 0.36, 0.04]} />
          <meshStandardMaterial color={ledCyan} roughness={0.05} transparent opacity={0.65} />
        </mesh>
      ))}

      {/* Front Chrome Radiator Grille */}
      <mesh position={[1.31, 0.02, 0]}>
        <boxGeometry args={[0.04, 0.38, 0.82]} />
        <meshStandardMaterial color={steelGrey} roughness={0.4} metalness={0.8} />
      </mesh>

      {/* High-intensity LED Headlights */}
      {[-0.34, 0.34].map((z, i) => (
        <group key={i} position={[1.32, -0.05, z]}>
          <mesh>
            <boxGeometry args={[0.05, 0.12, 0.18]} />
            <meshStandardMaterial color="#fff" emissive="#38bdf8" emissiveIntensity={2.5} />
          </mesh>
          {/* Headlight beam glow */}
          <pointLight color="#7dd3fc" intensity={1.8} distance={4} />
        </group>
      ))}

      {/* Emergency Beacon (Top of cab) */}
      <mesh position={[0.65, 0.86, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.1, 16]} />
        <meshStandardMaterial color={amberBeacon} emissive={amberBeacon} emissiveIntensity={2.8} />
      </mesh>
      <pointLight ref={beaconRef} position={[0.65, 0.95, 0]} color={amberBeacon} distance={3.5} />

      {/* Side Mirrors */}
      {[-0.62, 0.62].map((z, i) => (
        <group key={i} position={[1.05, 0.38, z]}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.1, 0.2, 0.05]} />
            <meshStandardMaterial color={darkChassis} roughness={0.5} />
          </mesh>
          <mesh position={[-0.02, 0, (z > 0 ? -1 : 1) * 0.02]}>
            <boxGeometry args={[0.02, 0.18, 0.04]} />
            <meshStandardMaterial color={chromeSilver} roughness={0.1} metalness={0.9} />
          </mesh>
        </group>
      ))}

      {/* ================= COMPACTOR / HOPPER (Back) ================= */}
      {/* Main Waste Tank Body */}
      <mesh position={[-0.65, 0.32, 0]}>
        <boxGeometry args={[1.95, 1.05, 1.12]} />
        <meshStandardMaterial color={brandGreen} roughness={0.35} metalness={0.3} />
      </mesh>

      {/* Hopper Sloped Back Roof */}
      <mesh position={[-1.52, 0.78, 0]} rotation={[0, 0, 0.35]}>
        <boxGeometry args={[0.55, 0.22, 1.08]} />
        <meshStandardMaterial color={darkGreen} roughness={0.4} />
      </mesh>

      {/* Rear Hydraulic Tailgate Door */}
      <mesh position={[-1.66, 0.25, 0]}>
        <boxGeometry args={[0.1, 0.95, 1.08]} />
        <meshStandardMaterial color={steelGrey} roughness={0.5} metalness={0.5} />
      </mesh>

      {/* Hydraulic Lift Pistons (Silver cylinders) */}
      {[-0.57, 0.57].map((z, i) => (
        <group key={i} position={[-1.4, 0.25, z]}>
          <mesh rotation={[0, 0, -0.4]}>
            <cylinderGeometry args={[0.03, 0.03, 0.6, 12]} />
            <meshStandardMaterial color={chromeSilver} roughness={0.2} metalness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Caution Stripe Decals (Sides) */}
      {[-0.565, 0.565].map((z, i) => (
        <group key={i} position={[-0.65, 0.0, z]}>
          <mesh>
            <boxGeometry args={[1.85, 0.12, 0.02]} />
            <meshStandardMaterial color={cautionYellow} roughness={0.4} />
          </mesh>
          {/* Recycling Green Emblem on Tank */}
          <mesh position={[0.2, 0.32, 0.01]}>
            <circleGeometry args={[0.2, 24]} />
            <meshStandardMaterial color="#22c55e" emissive="#15803d" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}

      {/* ================= CHASSIS & EXHAUST ================= */}
      {/* Heavy-duty Steel Frame */}
      <mesh position={[-0.1, -0.32, 0]}>
        <boxGeometry args={[2.95, 0.16, 0.92]} />
        <meshStandardMaterial color={darkChassis} roughness={0.7} metalness={0.6} />
      </mesh>

      {/* Front Heavy Bumper */}
      <mesh position={[1.36, -0.28, 0]}>
        <boxGeometry args={[0.14, 0.18, 1.12]} />
        <meshStandardMaterial color={chromeSilver} roughness={0.25} metalness={0.8} />
      </mesh>

      {/* Side Fuel Tank Cylinder */}
      <mesh position={[0.0, -0.25, 0.52]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.14, 0.14, 0.65, 16]} />
        <meshStandardMaterial color={steelGrey} roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Vertical Chrome Exhaust Stack */}
      <mesh position={[0.42, 0.72, -0.58]}>
        <cylinderGeometry args={[0.035, 0.035, 0.7, 12]} />
        <meshStandardMaterial color={chromeSilver} roughness={0.2} metalness={0.9} />
      </mesh>
      {/* Curved exhaust tip */}
      <mesh position={[0.38, 1.08, -0.58]} rotation={[0, 0, 0.6]}>
        <cylinderGeometry args={[0.035, 0.035, 0.15, 12]} />
        <meshStandardMaterial color={chromeSilver} roughness={0.2} metalness={0.9} />
      </mesh>

      {/* Trailing Smoke Particles */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => { if (el) exhaustParticles.current[i] = el; }} position={[-1.6, 0.6, -0.58]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color="#94a3b8" transparent opacity={0.3} />
        </mesh>
      ))}

      {/* ================= 6 WHEELS ================= */}
      {/* Front Left & Right */}
      {[
        [0.86, -0.52, 0.58],
        [0.86, -0.52, -0.58],
        /* Rear Dual Axles (4 wheels) */
        [-0.65, -0.52, 0.58],
        [-0.65, -0.52, -0.58],
        [-1.25, -0.52, 0.58],
        [-1.25, -0.52, -0.58],
      ].map(([x, y, z], idx) => (
        <group key={idx} position={[x, y, z]}>
          {/* Black Rubber Tire with Tread styling */}
          <mesh
            ref={(el) => { if (el) wheelsRef.current[idx] = el; }}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.27, 0.27, 0.18, 24]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>
          {/* Chrome Hubcap Ring */}
          <mesh position={[0, 0, z > 0 ? 0.095 : -0.095]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.03, 16]} />
            <meshStandardMaterial color={chromeSilver} roughness={0.2} metalness={0.85} />
          </mesh>
        </group>
      ))}

      {/* Realistic Under-body Shadow */}
      <mesh position={[-0.1, -0.85, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.8, 0.7, 1]}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ Scene */

function Scene() {
  return (
    <>
      <ambientLight intensity={1.1} />
      {/* Sunlight */}
      <directionalLight position={[5, 8, 4]} intensity={2.8} castShadow />
      {/* Cyan/Green Rimlight for dramatic tech aesthetic */}
      <directionalLight position={[-6, 3, -3]} intensity={1.6} color="#4ade80" />
      <directionalLight position={[0, -2, 4]} intensity={0.5} color="#38bdf8" />
      
      {/* 3D Road with moving markings */}
      <RoadSurface speed={5.5} />
      
      {/* The Dynamic Driving Truck */}
      <DrivingGarbageTruck />
    </>
  );
}

/* ----------------------------------------------------------------- Typewriter */

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
    const timer = setTimeout(() => setShown(text.slice(0, shown.length + 1)), 40);
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

/* ------------------------------------------------------------------ Splash Page */

export default function Splash({ onDone }: { onDone: () => void }) {
  const [webglFailed, setWebglFailed] = useState(false);
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (sessionStorage.getItem('ss_intro_seen')) {
      onDone();
      return;
    }
    if (reduceMotion) {
      sessionStorage.setItem('ss_intro_seen', '1');
      setTimeout(onDone, 600);
      return;
    }

    // Exact 4-second sequence:
    // 0.0s - 3.4s: Truck drives across & text reveals
    // 3.4s - 4.0s: Smooth fade out
    // 4.0s: Transition directly into Landing Page
    const t1 = setTimeout(() => setPhase('hold'), 400);
    const t2 = setTimeout(() => setPhase('out'), 3400);
    const t3 = setTimeout(() => {
      sessionStorage.setItem('ss_intro_seen', '1');
      onDone();
    }, 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onDone, reduceMotion]);

  const skip = () => {
    sessionStorage.setItem('ss_intro_seen', '1');
    onDone();
  };

  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-between overflow-hidden px-4 py-8 select-none"
      style={{
        background: 'radial-gradient(ellipse at 50% 35%, #062814 0%, #031309 50%, #000000 100%)',
        transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: phase === 'out' ? 0 : 1,
      }}
    >
      {/* Background Cybernetic & Glow Effects */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Soft emerald energy spheres */}
        <div className="absolute left-1/2 top-1/3 h-[90vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-600/15 blur-[90px]" />
        <div className="absolute left-1/2 top-1/2 h-[50vmin] w-[50vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-500/10 blur-[60px]" />
        
        {/* Subtle grid lines in background */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(#22c55e 1px, transparent 1px), linear-gradient(to right, #22c55e 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Laser horizon scanline */}
        <div className="absolute inset-x-0 top-[48%] h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
      </div>

      {/* Top Header: Official Indian Government Emblem Badge */}
      <div
        className="relative z-10 flex items-center justify-center gap-2 pt-2 transition-all duration-700"
        style={{
          opacity: phase === 'in' ? 0 : 1,
          transform: phase === 'in' ? 'translateY(-15px)' : 'translateY(0)',
        }}
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[0.7rem] font-bold tracking-widest text-white/70 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          भारत सरकार &nbsp;·&nbsp; Government of India
        </span>
      </div>

      {/* Center 3D Stage & Titles */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto w-full max-w-2xl">
        {/* 3D Canvas Stage */}
        <div
          className="h-56 w-full max-w-lg sm:h-72"
          style={{
            opacity: phase === 'in' ? 0 : 1,
            transform: phase === 'in' ? 'scale(0.92)' : 'scale(1)',
            transition: 'opacity 0.6s ease, transform 0.6s ease',
          }}
        >
          {reduceMotion || webglFailed ? (
            <div className="grid h-full w-full place-items-center">
              <img src="/icon.svg" alt="" className="h-24 w-24 animate-pulse opacity-90" />
            </div>
          ) : (
            <Suspense fallback={null}>
              <Canvas
                camera={{ position: [0, 0.8, 4.8], fov: 44 }}
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

        {/* Brand Name Title */}
        <div
          className="mt-2 transition-all duration-700"
          style={{
            opacity: phase === 'in' ? 0 : 1,
            transform: phase === 'in' ? 'translateY(16px)' : 'translateY(0)',
          }}
        >
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl drop-shadow-lg">
            <Typewriter text="Safaai " delay={300} className="text-white font-black" />
            <Typewriter text="Sarathi" delay={700} className="bg-gradient-to-r from-emerald-400 to-green-500 bg-clip-text text-transparent font-black" />
          </h1>
        </div>

        {/* Subtitle tag */}
        <p
          className="mt-2.5 max-w-xs text-xs sm:text-sm font-medium tracking-wider uppercase text-emerald-400/80 transition-all duration-700"
          style={{
            opacity: phase === 'in' ? 0 : 1,
            transitionDelay: '1000ms',
          }}
        >
          Smart Civic AI · Clean City Corridor
        </p>

        {/* Dynamic Tricolor Progress bar */}
        <div className="mt-5 h-1 w-48 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15">
          <div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #FF9933 0%, #ffffff 50%, #138808 100%)',
              animation: reduceMotion ? undefined : `grow 3.8s cubic-bezier(0.1, 0.7, 0.1, 1) forwards`,
              width: reduceMotion ? '100%' : undefined,
            }}
          />
        </div>
      </div>

      {/* Bottom Bar: Skip Button & Tech note */}
      <div className="relative z-10 flex w-full max-w-3xl items-center justify-between px-2 pb-2">
        <span className="text-[0.68rem] font-semibold tracking-wider uppercase text-white/40">
          Autonomous Fleet v2.0
        </span>

        {/* Skip intro button */}
        <button
          type="button"
          onClick={skip}
          className="group flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white/70 backdrop-blur-md transition-all hover:border-emerald-400/50 hover:bg-emerald-500/10 hover:text-white active:scale-95"
        >
          <span>Skip</span>
          <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2 2l6 4-6 4V2zm7 0h1.5v8H9V2z" />
          </svg>
        </button>
      </div>

      <style>{`@keyframes grow { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}
