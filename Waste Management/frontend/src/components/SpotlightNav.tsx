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

  // Update sliding active pill position safely with boundary check
  useLayoutEffect(() => {
    if (!navRef.current) return;
    const nav = navRef.current;
    if (activeIndex === -1) {
      setPillStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }

    const activeEl = nav.querySelector<HTMLElement>(`[data-nav-index="${activeIndex}"]`);
    if (activeEl) {
      const navRect = nav.getBoundingClientRect();
      const itemRect = activeEl.getBoundingClientRect();
      if (itemRect.width > 0) {
        setPillStyle({
          left: Math.max(0, itemRect.left - navRect.left),
          width: itemRect.width,
          opacity: 1,
        });
      }
    } else {
      setPillStyle((prev) => ({ ...prev, opacity: 0 }));
    }
  }, [activeIndex, location.pathname, items]);

  const spotlightX = useRef(0);
  const ambienceX = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  // Update Ambience position whenever active route changes
  useEffect(() => {
    if (!navRef.current) return;
    const nav = navRef.current;
    if (activeIndex === -1) return;

    const activeEl = nav.querySelector<HTMLElement>(`[data-nav-index="${activeIndex}"]`);
    if (activeEl) {
      const navRect = nav.getBoundingClientRect();
      const itemRect = activeEl.getBoundingClientRect();
      const targetX = itemRect.left - navRect.left + itemRect.width / 2;

      ambienceX.current = targetX;
      nav.style.setProperty('--ambience-x', `${targetX}px`);
    }
  }, [activeIndex, items]);

  // Mouse Move / Leave Spotlight Handling with requestAnimationFrame throttling
  useEffect(() => {
    if (!navRef.current) return;
    const nav = navRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(() => {
        if (!nav) return;
        const rect = nav.getBoundingClientRect();
        const x = e.clientX - rect.left;
        setHoverX(x);
        spotlightX.current = x;
        nav.style.setProperty('--spotlight-x', `${x}px`);
      });
    };

    const handleMouseLeave = () => {
      setHoverX(null);
      if (activeIndex !== -1 && nav) {
        const activeEl = nav.querySelector<HTMLElement>(`[data-nav-index="${activeIndex}"]`);
        if (activeEl) {
          const navRect = nav.getBoundingClientRect();
          const itemRect = activeEl.getBoundingClientRect();
          const targetX = itemRect.left - navRect.left + itemRect.width / 2;
          spotlightX.current = targetX;
          nav.style.setProperty('--spotlight-x', `${targetX}px`);
        }
      }
    };

    nav.addEventListener('mousemove', handleMouseMove, { passive: true });
    nav.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    return () => {
      nav.removeEventListener('mousemove', handleMouseMove);
      nav.removeEventListener('mouseleave', handleMouseLeave);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
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
