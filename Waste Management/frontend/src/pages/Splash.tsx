import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Ultra-Realistic Full-Width 3D Intro for Safaai Sarathi:
 * - Full horizontal edge-to-edge Highway road with rushing lane markings
 * - Highly-detailed modern 6-wheel Heavy Municipal EV Waste Truck
 * - Real dynamic driving motion (Far Left -> Center Cruise -> Accelerate Right Exit)
 * - Active dual amber strobe beacons, glowing LED headlight beam cones, hydraulic pistons
 * - 4-Second exact sequence smoothly leading directly into the Landing Page
 */

/* ------------------------------------------------------------------ Full-Horizon Road */

function FullWidthRoad({ speed = 7.0 }: { speed?: number }) {
  const dashesGroup = useRef<THREE.Group>(null);
  const postsGroup = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    // Move road stripes backwards
    if (dashesGroup.current) {
      dashesGroup.current.children.forEach((dash) => {
        dash.position.x -= delta * speed;
        if (dash.position.x < -18) dash.position.x += 36;
      });
    }
    // Move roadside reflector poles
    if (postsGroup.current) {
      postsGroup.current.children.forEach((post) => {
        post.position.x -= delta * speed;
        if (post.position.x < -18) post.position.x += 36;
      });
    }
  });

  const dashes = useMemo(() => {
    const list = [];
    for (let x = -18; x <= 18; x += 3.0) list.push(x);
    return list;
  }, []);

  const poles = useMemo(() => {
    const list = [];
    for (let x = -18; x <= 18; x += 6.0) list.push(x);
    return list;
  }, []);

  return (
    <group position={[0, -1.05, 0]}>
      {/* Infinite Dark Asphalt Highway base across entire screen width */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[80, 8]} />
        <meshStandardMaterial color="#080c0e" roughness={0.85} metalness={0.2} />
      </mesh>

      {/* Road Shoulder Curbs with High-Tech Green Glow Strips */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 2.2]}>
        <planeGeometry args={[80, 0.12]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -2.2]}>
        <planeGeometry args={[80, 0.12]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.6} />
      </mesh>

      {/* Moving Center Highway White Dashes */}
      <group ref={dashesGroup} position={[0, 0.01, 0]}>
        {dashes.map((x, idx) => (
          <mesh key={idx} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0, 0]}>
            <planeGeometry args={[1.5, 0.12]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
          </mesh>
        ))}
      </group>

      {/* Roadside Reflective Guide Posts */}
      <group ref={postsGroup}>
        {poles.map((x, idx) => (
          <group key={idx} position={[x, 0, -2.35]}>
            <mesh position={[0, 0.45, 0]}>
              <cylinderGeometry args={[0.025, 0.03, 0.9, 8]} />
              <meshStandardMaterial color="#334155" roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.8, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.14, 8]} />
              <meshStandardMaterial color="#22c55e" emissive="#10b981" emissiveIntensity={1.8} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ 3D Realistic Heavy Truck */

function RealisticGarbageTruck() {
  const truck = useRef<THREE.Group>(null);
  const wheels = useRef<THREE.Mesh[]>([]);
  const beacon1 = useRef<THREE.PointLight>(null);
  const beacon2 = useRef<THREE.PointLight>(null);
  const smoke = useRef<THREE.Mesh[]>([]);
  const time = useRef(0);

  // Palette: Swachh Bharat Municipal Clean Green & Crisp High-Tech Elements
  const greenPrimary = '#15803d';
  const greenDeep = '#0f4d25';
  const whiteCab = '#f1f5f9';
  const metallicChassis = '#1e293b';
  const darkMetal = '#0f172a';
  const chrome = '#e2e8f0';
  const amber = '#f59e0b';
  const cautionYellow = '#facc15';
  const glassBlue = '#38bdf8';

  useFrame((_, delta) => {
    if (!truck.current) return;
    time.current += delta;
    const t = time.current;

    // Smooth Left -> Right drive-by trajectory (4.0s sequence)
    // t=0.0: x = -8.5 (starts well off-screen left)
    // t=1.8: x = 0.0 (cruising right through center)
    // t=3.5: x = +9.0 (exits off-screen right)
    let xPos = -8.5 + t * 4.2;
    if (t > 2.0) {
      xPos += Math.pow(t - 2.0, 2.0) * 1.4; // Turbo acceleration out of frame
    }
    truck.current.position.x = xPos;

    // Realistic suspension rumble and subtle vehicle pitch & roll
    truck.current.position.y = Math.sin(t * 18) * 0.015 + Math.sin(t * 8) * 0.01;
    truck.current.rotation.z = Math.sin(t * 14) * 0.006 - 0.008;
    truck.current.rotation.y = 0.06 + Math.sin(t * 2.5) * 0.015;

    // Wheel rotation based on forward motion
    const spinRate = delta * 22;
    wheels.current.forEach((w) => {
      if (w) w.rotation.x += spinRate;
    });

    // Dual emergency beacon strobes
    const strobe = Math.sin(t * 24);
    if (beacon1.current) beacon1.current.intensity = strobe > 0 ? 3.0 : 0.2;
    if (beacon2.current) beacon2.current.intensity = strobe < 0 ? 3.0 : 0.2;

    // Trailing exhaust smoke simulation
    smoke.current.forEach((p, idx) => {
      if (!p) return;
      const life = (t * 5 + idx * 0.7) % 2.5;
      p.position.x = -2.2 - life * 1.2;
      p.position.y = 0.6 + life * 0.4;
      p.scale.setScalar(0.08 + life * 0.25);
      const mat = p.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = Math.max(0, 0.45 - life * 0.18);
    });
  });

  return (
    <group ref={truck} scale={1.05} position={[-8.5, 0, 0]}>
      {/* ================= 1. CABIN (FRONT SECTION) ================= */}
      {/* Main Front Cab Body */}
      <mesh position={[1.1, 0.38, 0]}>
        <boxGeometry args={[1.2, 1.1, 1.25]} />
        <meshStandardMaterial color={whiteCab} roughness={0.25} metalness={0.15} />
      </mesh>

      {/* Aerodynamic Cab Green Sun-Visor Top */}
      <mesh position={[1.05, 0.98, 0]}>
        <boxGeometry args={[1.12, 0.18, 1.2]} />
        <meshStandardMaterial color={greenPrimary} roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Curved Tinted Panoramic Windshield */}
      <mesh position={[1.65, 0.52, 0]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[0.1, 0.65, 1.1]} />
        <meshStandardMaterial color={glassBlue} roughness={0.05} metalness={0.3} transparent opacity={0.78} />
      </mesh>

      {/* Dual Windshield Wipers */}
      {[-0.28, 0.28].map((z, i) => (
        <mesh key={i} position={[1.71, 0.32, z]} rotation={[0, 0, -0.2]}>
          <boxGeometry args={[0.02, 0.35, 0.02]} />
          <meshStandardMaterial color="#000" roughness={0.8} />
        </mesh>
      ))}

      {/* Driver Silhouette outline inside cab */}
      <mesh position={[0.95, 0.45, 0.32]}>
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>

      {/* Side Cab Windows */}
      {[-0.63, 0.63].map((z, i) => (
        <mesh key={i} position={[1.08, 0.54, z]}>
          <boxGeometry args={[0.7, 0.45, 0.04]} />
          <meshStandardMaterial color={glassBlue} roughness={0.05} transparent opacity={0.7} />
        </mesh>
      ))}

      {/* Front Radiator Grille with Chrome Mesh */}
      <mesh position={[1.72, 0.05, 0]}>
        <boxGeometry args={[0.04, 0.48, 1.05]} />
        <meshStandardMaterial color={darkMetal} roughness={0.4} metalness={0.8} />
      </mesh>
      {/* Grille Chrome Trim Horizontal Slats */}
      {[0.16, 0.06, -0.04].map((y, i) => (
        <mesh key={i} position={[1.74, y, 0]}>
          <boxGeometry args={[0.03, 0.035, 0.98]} />
          <meshStandardMaterial color={chrome} roughness={0.15} metalness={0.95} />
        </mesh>
      ))}

      {/* Heavy Front Steel Bumper with Tow Hooks */}
      <mesh position={[1.78, -0.28, 0]}>
        <boxGeometry args={[0.18, 0.22, 1.35]} />
        <meshStandardMaterial color={chrome} roughness={0.2} metalness={0.85} />
      </mesh>

      {/* Projector LED Headlights */}
      {[-0.45, 0.45].map((z, i) => (
        <group key={i} position={[1.79, -0.06, z]}>
          <mesh>
            <boxGeometry args={[0.06, 0.16, 0.24]} />
            <meshStandardMaterial color="#ffffff" emissive="#38bdf8" emissiveIntensity={3.0} />
          </mesh>
          {/* Headlight beam illumination on the road */}
          <pointLight color="#bae6fd" intensity={2.5} distance={6} />
          {/* Visible glowing light cone */}
          <mesh position={[0.9, -0.25, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.45, 1.8, 16, 1, true]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.12} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* Dual Amber Hazard Strobe Beacons on Roof */}
      <group position={[0.95, 1.12, 0]}>
        <mesh position={[0, 0, -0.4]}>
          <cylinderGeometry args={[0.07, 0.07, 0.1, 16]} />
          <meshStandardMaterial color={amber} emissive={amber} emissiveIntensity={3.5} />
        </mesh>
        <pointLight ref={beacon1} position={[0, 0.1, -0.4]} color={amber} distance={4} />

        <mesh position={[0, 0, 0.4]}>
          <cylinderGeometry args={[0.07, 0.07, 0.1, 16]} />
          <meshStandardMaterial color={amber} emissive={amber} emissiveIntensity={3.5} />
        </mesh>
        <pointLight ref={beacon2} position={[0, 0.1, 0.4]} color={amber} distance={4} />
      </group>

      {/* Dual Heavy-duty Chrome Side Mirrors */}
      {[-0.75, 0.75].map((z, i) => (
        <group key={i} position={[1.42, 0.52, z]}>
          {/* Bracket */}
          <mesh position={[-0.1, 0, (z > 0 ? -1 : 1) * 0.08]}>
            <boxGeometry args={[0.22, 0.04, 0.04]} />
            <meshStandardMaterial color={darkMetal} roughness={0.4} />
          </mesh>
          {/* Mirror housing */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.08, 0.28, 0.12]} />
            <meshStandardMaterial color={darkMetal} roughness={0.4} />
          </mesh>
          {/* Mirror glass */}
          <mesh position={[-0.045, 0, 0]}>
            <boxGeometry args={[0.01, 0.24, 0.1]} />
            <meshStandardMaterial color={chrome} roughness={0.05} metalness={0.98} />
          </mesh>
        </group>
      ))}

      {/* ================= 2. COMPACTOR HOPPER BODY ================= */}
      {/* Main Waste Tank Body */}
      <mesh position={[-0.75, 0.48, 0]}>
        <boxGeometry args={[2.55, 1.35, 1.36]} />
        <meshStandardMaterial color={greenPrimary} roughness={0.3} metalness={0.25} />
      </mesh>

      {/* Aerodynamic Top Sloped Hood */}
      <mesh position={[-1.85, 1.02, 0]} rotation={[0, 0, 0.42]}>
        <boxGeometry args={[0.7, 0.25, 1.32]} />
        <meshStandardMaterial color={greenDeep} roughness={0.35} />
      </mesh>

      {/* Reinforced Vertical Ribs on Hopper sides (Structural industrial detail) */}
      {[-0.69, 0.69].map((z, i) => (
        <group key={i}>
          {[-1.6, -1.1, -0.6, -0.1, 0.35].map((x, j) => (
            <mesh key={j} position={[x, 0.48, z]}>
              <boxGeometry args={[0.08, 1.25, 0.05]} />
              <meshStandardMaterial color={greenDeep} roughness={0.4} metalness={0.3} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Diagonal Hazard Chevron Warning Stripes (Yellow & Black) */}
      {[-0.695, 0.695].map((z, i) => (
        <group key={i} position={[-0.75, 0.04, z]}>
          <mesh>
            <boxGeometry args={[2.45, 0.15, 0.02]} />
            <meshStandardMaterial color={cautionYellow} roughness={0.4} />
          </mesh>
          {/* Swachh Bharat / Green Cleanliness Emblem */}
          <mesh position={[0.45, 0.42, 0.015]}>
            <circleGeometry args={[0.26, 32]} />
            <meshStandardMaterial color="#22c55e" emissive="#15803d" emissiveIntensity={0.8} />
          </mesh>
        </group>
      ))}

      {/* Rear Hydraulic Loading Tailgate */}
      <mesh position={[-2.05, 0.38, 0]}>
        <boxGeometry args={[0.16, 1.15, 1.32]} />
        <meshStandardMaterial color={metallicChassis} roughness={0.5} metalness={0.6} />
      </mesh>

      {/* Chrome Hydraulic Cylinders for Compactor */}
      {[-0.66, 0.66].map((z, i) => (
        <group key={i} position={[-1.75, 0.35, z]}>
          <mesh rotation={[0, 0, -0.5]}>
            <cylinderGeometry args={[0.04, 0.04, 0.75, 12]} />
            <meshStandardMaterial color={chrome} roughness={0.15} metalness={0.95} />
          </mesh>
        </group>
      ))}

      {/* ================= 3. CHASSIS & DETAILS ================= */}
      {/* Heavy Steel Longitudinal I-Beam Chassis */}
      <mesh position={[-0.15, -0.32, 0]}>
        <boxGeometry args={[3.8, 0.18, 1.05]} />
        <meshStandardMaterial color={darkMetal} roughness={0.7} metalness={0.7} />
      </mesh>

      {/* Battery / Fuel Tank (EV Clean Tech) */}
      <mesh position={[0.1, -0.25, 0.62]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.85, 16]} />
        <meshStandardMaterial color={metallicChassis} roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Chrome Upright Exhaust Stack */}
      <mesh position={[0.55, 0.95, -0.68]}>
        <cylinderGeometry args={[0.04, 0.04, 0.9, 12]} />
        <meshStandardMaterial color={chrome} roughness={0.1} metalness={0.95} />
      </mesh>
      <mesh position={[0.5, 1.42, -0.68]} rotation={[0, 0, 0.7]}>
        <cylinderGeometry args={[0.04, 0.04, 0.2, 12]} />
        <meshStandardMaterial color={chrome} roughness={0.1} metalness={0.95} />
      </mesh>

      {/* Trailing Exhaust Smoke Puffs */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(el) => { if (el) smoke.current[i] = el; }} position={[-2.1, 0.7, -0.68]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshBasicMaterial color="#94a3b8" transparent opacity={0.35} />
        </mesh>
      ))}

      {/* ================= 4. WHEELS (6x4 HEAVY DUTY CONFIG) ================= */}
      {[
        /* Front Steer Axle (2 wheels) */
        [1.15, -0.52, 0.68],
        [1.15, -0.52, -0.68],
        /* Rear Dual Axles (4 wheels) */
        [-0.75, -0.52, 0.68],
        [-0.75, -0.52, -0.68],
        [-1.55, -0.52, 0.68],
        [-1.55, -0.52, -0.68],
      ].map(([x, y, z], idx) => (
        <group key={idx} position={[x, y, z]}>
          {/* Black Rubber Tire with Deep Tread */}
          <mesh
            ref={(el) => { if (el) wheels.current[idx] = el; }}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.32, 0.32, 0.22, 28]} />
            <meshStandardMaterial color="#0f172a" roughness={0.92} />
          </mesh>
          {/* Chrome Heavy Rim Hub with 8 Lug Nuts */}
          <mesh position={[0, 0, z > 0 ? 0.115 : -0.115]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.04, 16]} />
            <meshStandardMaterial color={chrome} roughness={0.2} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0, z > 0 ? 0.13 : -0.13]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.05, 12]} />
            <meshStandardMaterial color="#10b981" roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Soft Ground Contact Shadow underneath entire truck */}
      <mesh position={[-0.2, -0.96, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.4, 0.95, 1]}>
        <circleGeometry args={[1, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ Fullscreen Scene */

function FullscreenScene() {
  return (
    <>
      <ambientLight intensity={1.2} />
      {/* Dramatic Sun Lighting */}
      <directionalLight position={[6, 9, 5]} intensity={3.0} castShadow />
      {/* High-Tech Emerald Rim Light */}
      <directionalLight position={[-8, 4, -4]} intensity={2.2} color="#10b981" />
      <directionalLight position={[0, -2, 5]} intensity={0.8} color="#38bdf8" />

      {/* Full horizontal highway spanning across entire viewport */}
      <FullWidthRoad speed={6.5} />

      {/* Dynamic Driving Garbage Truck */}
      <RealisticGarbageTruck />
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

/* ------------------------------------------------------------------ Main Splash Page */

export default function Splash({ onDone }: { onDone: () => void }) {
  const [webglFailed, setWebglFailed] = useState(false);
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduceMotion) {
      setTimeout(onDone, 500);
      return;
    }

    // Exact 4.0s sequence:
    // 0.0s - 3.4s: Truck drives across full screen & text reveals
    // 3.4s - 4.0s: Smooth cinematic fade out
    // 4.0s: Immediate transition to Landing page
    const t1 = setTimeout(() => setPhase('hold'), 400);
    const t2 = setTimeout(() => setPhase('out'), 3400);
    const t3 = setTimeout(() => {
      onDone();
    }, 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onDone, reduceMotion]);

  const skip = () => {
    onDone();
  };

  return (
    <div
      className="relative flex min-h-dvh w-full flex-col items-center justify-between overflow-hidden px-4 py-8 select-none"
      style={{
        background: 'radial-gradient(ellipse at 50% 35%, #052412 0%, #020e06 50%, #000000 100%)',
        transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: phase === 'out' ? 0 : 1,
      }}
    >
      {/* Background Cybernetic Ambient Glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[90vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-600/15 blur-[90px]" />
        <div className="absolute left-1/2 top-1/2 h-[50vmin] w-[50vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-500/10 blur-[60px]" />
        
        {/* Subtle coordinate grid lines in background */}
        <div 
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `linear-gradient(#22c55e 1px, transparent 1px), linear-gradient(to right, #22c55e 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* Top Header: Official Indian Government Emblem Badge */}
      <div
        className="relative z-20 flex items-center justify-center gap-2 pt-2 transition-all duration-700"
        style={{
          opacity: phase === 'in' ? 0 : 1,
          transform: phase === 'in' ? 'translateY(-15px)' : 'translateY(0)',
        }}
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[0.7rem] font-bold tracking-widest text-white/80 backdrop-blur-md shadow-lg shadow-black/40">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          भारत सरकार &nbsp;·&nbsp; Government of India
        </span>
      </div>

      {/* FULLSCREEN 3D CANVAS: Road & Truck Spans Full Width Across The Screen */}
      <div
        className="absolute inset-0 z-10 h-full w-full pointer-events-none"
        style={{
          opacity: phase === 'in' ? 0 : 1,
          transition: 'opacity 0.6s ease',
        }}
      >
        {reduceMotion || webglFailed ? (
          <div className="grid h-full w-full place-items-center">
            <img src="/icon.svg" alt="" className="h-28 w-28 animate-pulse opacity-90" />
          </div>
        ) : (
          <Suspense fallback={null}>
            <Canvas
              camera={{ position: [0, 0.7, 5.2], fov: 46 }}
              dpr={[1, 2]}
              onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
              fallback={<img src="/icon.svg" alt="" className="h-28 w-28" />}
              onError={() => setWebglFailed(true)}
            >
              <FullscreenScene />
            </Canvas>
          </Suspense>
        )}
      </div>

      {/* Center Cinematic Overlay Titles (Overlaid atop the 3D Scene) */}
      <div className="relative z-20 flex flex-col items-center justify-center mt-auto mb-16 w-full max-w-2xl text-center pointer-events-none">
        {/* Brand Name Title */}
        <div
          className="transition-all duration-700"
          style={{
            opacity: phase === 'in' ? 0 : 1,
            transform: phase === 'in' ? 'translateY(16px)' : 'translateY(0)',
          }}
        >
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
            <Typewriter text="Safaai " delay={300} className="text-white font-black" />
            <Typewriter text="Sarathi" delay={700} className="bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent font-black" />
          </h1>
        </div>

        {/* Subtitle tag */}
        <p
          className="mt-2.5 max-w-sm text-xs sm:text-sm font-medium tracking-widest uppercase text-emerald-400/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] transition-all duration-700"
          style={{
            opacity: phase === 'in' ? 0 : 1,
            transitionDelay: '1000ms',
          }}
        >
          Smart Civic AI · Autonomous Clean Fleet
        </p>

        {/* Dynamic Tricolor Progress bar */}
        <div className="mt-5 h-1 w-52 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
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

      {/* Bottom Bar: Skip Button & Tech Version */}
      <div className="relative z-20 flex w-full max-w-5xl items-center justify-between px-4 pb-2">
        <span className="text-[0.7rem] font-semibold tracking-widest uppercase text-white/50">
          Autonomous Fleet v2.0
        </span>

        {/* Skip intro button */}
        <button
          type="button"
          onClick={skip}
          className="group flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white/80 backdrop-blur-md transition-all hover:border-emerald-400/60 hover:bg-emerald-500/20 hover:text-white active:scale-95 shadow-lg shadow-black/30"
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
