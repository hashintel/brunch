import { useEffect, useState } from 'react';

/** True when the user has set `prefers-reduced-motion: reduce`. SSR-safe (returns false on server). */
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

/** Canonical spring for chat surface (~250ms settle); imported for consistent feel. */
export const CHAT_SHELL_SPRING = { type: 'spring' as const, mass: 0.6, stiffness: 220, damping: 30 };
