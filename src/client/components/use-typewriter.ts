import { useEffect, useRef, useState } from 'react';

// Steady baseline pace for small backlogs — a calm, even typing cadence.
const MIN_CHARS_PER_SECOND = 90;
// Upper bound on how far behind the real stream the reveal is allowed to fall.
// Big chunks accelerate just enough to clear within this window, spread evenly
// across frames rather than popping in as one block.
const MAX_CATCHUP_SECONDS = 0.4;

/**
 * Smooths streamed text so it reveals character-by-character instead of
 * jumping a chunk at a time.
 *
 * The reveal is time-based with sub-character accumulation, so the cadence is
 * even regardless of frame timing or how chunks are batched: it types at a
 * steady {@link MIN_CHARS_PER_SECOND} and only accelerates enough to keep the
 * lag under {@link MAX_CATCHUP_SECONDS}. A 200-char chunk therefore fans out
 * over a few smooth frames instead of appearing all at once.
 *
 * Seeds to whatever `target` is at mount and only animates growth, so a
 * remount mid-stream (or a fully-formed message) shows immediately rather than
 * re-typing from scratch. A shrinking `target` (new message / reset) snaps.
 *
 * Pass `enabled: false` (e.g. prefers-reduced-motion) to pass `target` through
 * untouched.
 */
export function useTypewriter(target: string, enabled = true): string {
  const [display, setDisplay] = useState(target);
  // Fractional revealed length carried across renders so the cadence stays
  // even across chunk boundaries and frames resume where we left off.
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
    // Fresh clock for this run so the first frame's delta is ~0, not a jump.
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

  return display;
}
