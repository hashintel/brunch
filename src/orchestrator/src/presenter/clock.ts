// Elapsed-since-cook-start clock, owned by a presenter (I136-K).
//
// `now` is injectable so goldens and frame tests are deterministic.
// Format matches the pre-refactor `elapsed()`: one decimal second,
// right-padded to 7 columns.

export interface ElapsedClock {
  seed(runStart: number): void;
  elapsed(): string;
}

/**
 * Human elapsed for a live, ticking indicator: whole seconds under a minute,
 * `m:ss` above. Deliberately coarse — no decimals — so a fast re-render loop
 * doesn't make the number flicker.
 */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}m${String(seconds).padStart(2, '0')}s`;
}

export function createElapsedClock(now: () => number = () => Date.now()): ElapsedClock {
  let runStart: number | undefined;
  return {
    seed(rs) {
      runStart = rs;
    },
    elapsed() {
      if (runStart === undefined) runStart = now();
      const seconds = ((now() - runStart) / 1000).toFixed(1);
      return `${seconds}s`.padStart(7);
    },
  };
}
