import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * 3D intro (plan §9): a rotating symbol plus an animated wordmark, ~4.5s,
 * auto-transitioning to the landing page.
 *
 * Built with react-three-fiber for a genuine 3D feel. Anyone who has asked for
 * reduced motion, or whose device cannot get a WebGL context, gets the static
 * wordmark instead — the intro is never a barrier to entering the product.
 */

function Trefoil() {
  const group = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.85;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.6) * 0.22;
  });

  // Three interlocking arrows — the recycling triad, rendered as real geometry.
  const arrows = [0, 1, 2].map((i) => {
    const angle = (i / 3) * Math.PI * 2;
    return (
      <group key={i} rotation={[0, 0, angle]}>
        <mesh position={[0, 1.05, 0]} castShadow>
          <boxGeometry args={[0.92, 0.3, 0.3]} />
          <meshStandardMaterial color="#16a34a" roughness={0.32} metalness={0.35} />
        </mesh>
        <mesh position={[0.62, 1.05, 0]} rotation={[0, 0, -Math.PI / 4]}>
          <coneGeometry args={[0.3, 0.62, 4]} />
          <meshStandardMaterial color="#22c55e" roughness={0.28} metalness={0.4} />
        </mesh>
      </group>
    );
  });

  return (
    <group ref={group} scale={1.05}>
      {arrows}
      <mesh>
        <icosahedronGeometry args={[0.62, 1]} />
        <meshStandardMaterial color="#0f766e" roughness={0.2} metalness={0.6} wireframe />
      </mesh>
    </group>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 6, 5]} intensity={1.5} />
      <directionalLight position={[-4, -2, -3]} intensity={0.5} color="#4ade80" />
      <Trefoil />
    </>
  );
}

export default function Splash({ onDone }: { onDone: () => void }) {
  const [webglFailed, setWebglFailed] = useState(false);
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    // Skip the intro entirely once it has been seen this session.
    if (sessionStorage.getItem('ss_intro_seen')) {
      onDone();
      return;
    }
    const timer = setTimeout(() => {
      sessionStorage.setItem('ss_intro_seen', '1');
      onDone();
    }, reduceMotion ? 900 : 4500);
    return () => clearTimeout(timer);
  }, [onDone, reduceMotion]);

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-surface px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/10 blur-3xl"
      />

      <div className="relative flex flex-col items-center">
        <div className="h-52 w-52 sm:h-64 sm:w-64">
          {reduceMotion || webglFailed ? (
            <div className="grid h-full w-full place-items-center">
              <img src="/icon.svg" alt="" className="h-32 w-32 sm:h-40 sm:w-40" />
            </div>
          ) : (
            <Suspense fallback={null}>
              <Canvas
                camera={{ position: [0, 0, 5.2], fov: 45 }}
                dpr={[1, 2]}
                onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
                fallback={<img src="/icon.svg" alt="" className="h-40 w-40" />}
                onError={() => setWebglFailed(true)}
              >
                <Scene />
              </Canvas>
            </Suspense>
          )}
        </div>

        <h1 className="animate-fade-up text-fluid-3xl font-bold tracking-tight" style={{ animationDelay: '0.35s' }}>
          Safaai <span className="text-brand">Sarathi</span>
        </h1>
        <p
          className="mt-2 max-w-xs animate-fade-up text-center text-fluid-sm text-muted"
          style={{ animationDelay: '0.75s' }}
        >
          AI-verified civic response for cleaner wards
        </p>

        <div className="mt-8 h-0.5 w-40 overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full bg-brand"
            style={{ animation: `grow ${reduceMotion ? 0.8 : 4.4}s linear forwards` }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem('ss_intro_seen', '1');
          onDone();
        }}
        className="absolute bottom-8 text-fluid-xs font-medium text-muted underline-offset-4 hover:underline"
      >
        Skip intro
      </button>

      <style>{`@keyframes grow { from { width: 0 } to { width: 100% } }`}</style>
    </div>
  );
}
