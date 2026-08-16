import React, { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export interface SpotlightNavItem {
  to: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  end?: boolean;
  badge?: number;
}

export interface SpotlightNavProps {
  items: SpotlightNavItem[];
  accent?: 'brand' | 'orange';
  className?: string;
}

export function SpotlightNav({
  items,
  accent = 'brand',
  className = '',
}: SpotlightNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number; opacity: number }>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  // Find active index based on route
  const activeIndex = items.findIndex((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );

  // Update sliding active pill position smoothly
  useLayoutEffect(() => {
    if (!navRef.current) return;
    const nav = navRef.current;
    const activeEl = nav.querySelector<HTMLElement>(`[data-nav-index="${activeIndex}"]`);

    if (activeEl) {
      const navRect = nav.getBoundingClientRect();
      const itemRect = activeEl.getBoundingClientRect();
      setPillStyle({
        left: itemRect.left - navRect.left,
        width: itemRect.width,
        opacity: 1,
      });
    } else {
      setPillStyle((prev) => ({ ...prev, opacity: 0 }));
    }
  }, [activeIndex, location.pathname, items]);

  // Spring animation helper
  const animateValue = (
    from: number,
    to: number,
    onUpdate: (val: number) => void,
    onComplete?: () => void
  ) => {
    let current = from;
    let velocity = 0;
    const stiffness = 220;
    const damping = 22;
    let animFrame: number;
    let lastTime = performance.now();

    const frame = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.032);
      lastTime = time;

      const force = -stiffness * (current - to);
      const dampingForce = -damping * velocity;
      const acceleration = force + dampingForce;

      velocity += acceleration * dt;
      current += velocity * dt;

      onUpdate(current);

      if (Math.abs(current - to) < 0.2 && Math.abs(velocity) < 0.2) {
        onUpdate(to);
        onComplete?.();
        return;
      }
      animFrame = requestAnimationFrame(frame);
    };

    animFrame = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animFrame);
  };

  const spotlightX = useRef(0);
  const ambienceX = useRef(0);
  const cancelAmbienceAnim = useRef<(() => void) | null>(null);
  const cancelSpotlightAnim = useRef<(() => void) | null>(null);

  // Update Ambience position whenever active route changes
  useEffect(() => {
    if (!navRef.current) return;
    const nav = navRef.current;
    const activeEl = nav.querySelector<HTMLElement>(`[data-nav-index="${activeIndex}"]`);

    if (activeEl) {
      const navRect = nav.getBoundingClientRect();
      const itemRect = activeEl.getBoundingClientRect();
      const targetX = itemRect.left - navRect.left + itemRect.width / 2;

      if (ambienceX.current === 0) {
        ambienceX.current = targetX;
        nav.style.setProperty('--ambience-x', `${targetX}px`);
      } else {
        if (cancelAmbienceAnim.current) cancelAmbienceAnim.current();
        cancelAmbienceAnim.current = animateValue(
          ambienceX.current,
          targetX,
          (v) => {
            ambienceX.current = v;
            nav.style.setProperty('--ambience-x', `${v}px`);
          }
        );
      }
    }
  }, [activeIndex, items]);

  // Mouse Move / Leave Spotlight Handling
  useEffect(() => {
    if (!navRef.current) return;
    const nav = navRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = nav.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setHoverX(x);
      spotlightX.current = x;
      nav.style.setProperty('--spotlight-x', `${x}px`);
    };

    const handleMouseLeave = () => {
      setHoverX(null);
      const activeEl = nav.querySelector<HTMLElement>(`[data-nav-index="${activeIndex}"]`);
      if (activeEl) {
        const navRect = nav.getBoundingClientRect();
        const itemRect = activeEl.getBoundingClientRect();
        const targetX = itemRect.left - navRect.left + itemRect.width / 2;

        if (cancelSpotlightAnim.current) cancelSpotlightAnim.current();
        cancelSpotlightAnim.current = animateValue(
          spotlightX.current,
          targetX,
          (v) => {
            spotlightX.current = v;
            nav.style.setProperty('--spotlight-x', `${v}px`);
          }
        );
      }
    };

    nav.addEventListener('mousemove', handleMouseMove);
    nav.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      nav.removeEventListener('mousemove', handleMouseMove);
      nav.removeEventListener('mouseleave', handleMouseLeave);
      if (cancelAmbienceAnim.current) cancelAmbienceAnim.current();
      if (cancelSpotlightAnim.current) cancelSpotlightAnim.current();
    };
  }, [activeIndex]);

  const isOrange = accent === 'orange';
  const spotlightColor = isOrange
    ? 'rgba(234, 88, 12, 0.16)'
    : 'rgba(22, 163, 74, 0.16)';
  const ambienceGlowColor = isOrange
    ? 'rgba(234, 88, 12, 0.95)'
    : 'rgba(22, 163, 74, 0.95)';

  return (
    <nav
      ref={navRef}
      className={`spotlight-nav relative flex items-center h-10 sm:h-11 rounded-full border border-line bg-surface/90 px-1.5 shadow-xs backdrop-blur-xl transition-all duration-300 overflow-hidden ${className}`}
      style={
        {
          '--spotlight-color': spotlightColor,
          '--ambience-color': ambienceGlowColor,
        } as React.CSSProperties
      }
    >
      {/* Sliding Active Pill Background Animation */}
      <div
        className={`pointer-events-none absolute h-[calc(100%-8px)] top-1 rounded-full transition-all duration-300 ease-out z-[2] ${
          isOrange
            ? 'bg-orange-600/15 border border-orange-500/30 shadow-xs shadow-orange-500/10'
            : 'bg-brand/15 border border-brand/30 shadow-xs shadow-brand/10'
        }`}
        style={{
          transform: `translateX(${pillStyle.left}px)`,
          width: `${pillStyle.width}px`,
          opacity: pillStyle.opacity,
        }}
      />

      {/* Moving Mouse Spotlight */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 w-full h-full z-[1] transition-opacity duration-300"
        style={{
          opacity: hoverX !== null ? 1 : 0,
          background: `radial-gradient(130px circle at var(--spotlight-x, 50%) 100%, var(--spotlight-color), transparent 65%)`,
        }}
      />

      {/* Active State Ambient Glow & Bottom Light Beam */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 w-full h-[2.5px] z-[3]"
        style={{
          background: `radial-gradient(80px circle at var(--ambience-x, 50%) 0%, var(--ambience-color), transparent 100%)`,
        }}
      />

      {/* Nav Items List */}
      <ul className="relative flex items-center h-full px-1 gap-1 z-[10] list-none m-0">
        {items.map((item, idx) => {
          const isActive = idx === activeIndex;
          const Icon = item.icon;
          return (
            <li key={item.to} className="relative h-full flex items-center justify-center">
              <NavLink
                to={item.to}
                end={item.end}
                data-nav-index={idx}
                className={({ isActive: matchActive }) =>
                  `relative flex items-center gap-2 rounded-full px-3.5 sm:px-4 py-1.5 text-fluid-xs font-semibold transition-colors duration-200 ${
                    matchActive || isActive
                      ? isOrange
                        ? 'text-orange-700 dark:text-orange-300 font-bold'
                        : 'text-brand dark:text-emerald-300 font-bold'
                      : 'text-muted hover:text-ink'
                  }`
                }
              >
                {Icon && <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />}
                <span className="whitespace-nowrap">{item.label}</span>
                {item.badge ? (
                  <span className="ml-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.6rem] font-bold text-white shadow-xs">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default SpotlightNav;
