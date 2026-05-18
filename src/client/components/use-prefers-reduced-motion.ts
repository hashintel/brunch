import { useEffect, useState } from 'react';

/**
 * Returns true when the user has requested reduced motion via
 * `prefers-reduced-motion: reduce` (OS / browser setting). FE-716 C15:
 * UNIFIED_CHAT_UX.md §10 requires that every spring / pulse animation in the
 * unified chat surface be a no-op for users with this preference.
 *
 * SSR-safe: returns false on the server (no `window`).
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setPrefersReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return prefersReduced;
}

/**
 * Canonical spring config for the unified chat surface, per
 * UNIFIED_CHAT_UX.md §7 dec 5: mass 0.6, stiffness 220, damping 30. Roughly
 * ~250ms settle time. Imported by motion-using components to keep the feel
 * consistent across the shell, collapsibles, and streaming pulse.
 */
export const CHAT_SHELL_SPRING = { type: 'spring' as const, mass: 0.6, stiffness: 220, damping: 30 };
