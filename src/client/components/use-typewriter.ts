import { useEffect, useRef, useState } from 'react';

const MIN_CHARS_PER_SECOND = 90;
// How far behind the live stream the reveal may fall; big chunks accelerate
// just enough to clear within this window instead of popping in at once.
const MAX_CATCHUP_SECONDS = 0.4;

/**
 * Reveals streamed text character-by-character instead of jumping a chunk at a
 * time. Time-based with sub-character accumulation, so the cadence stays even
 * regardless of frame timing or chunk batching.
 *
 * Seeds to `target` at mount and only animates growth — a remount mid-stream
 * or a fully-formed message shows immediately; a shrinking `target` snaps.
 * `enabled: false` (e.g. reduced motion) passes `target` through untouched.
 */
export function useTypewriter(target: string, enabled = true): string {
  const [display, setDisplay] = useState(target);
  const revealedRef = useRef(target.length);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      revealedRef.current = target.length;
      setDisplay(target);
      return;
    }
    // Reset / shorter target → snap; nothing to type out.
    if (target.length <= Math.floor(revealedRef.current)) {
      revealedRef.current = target.length;
      setDisplay(target);
      return;
    }
    // Fresh clock so the first frame's delta is ~0, not a jump.
    lastTimeRef.current = null;
    const animate = (now: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = now;
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      const backlog = target.length - revealedRef.current;
      if (backlog <= 0) {
        frameRef.current = null;
        return;
      }
      const charsPerSecond = Math.max(MIN_CHARS_PER_SECOND, backlog / MAX_CATCHUP_SECONDS);
      revealedRef.current = Math.min(target.length, revealedRef.current + charsPerSecond * dt);
      setDisplay(target.slice(0, Math.floor(revealedRef.current)));
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [target, enabled]);

  // Disabled → synchronous passthrough (no one-render lag while the effect syncs).
  return enabled ? display : target;
}
