// Elapsed-since-cook-start clock, owned by a presenter (I136-K).
//
// `now` is injectable so goldens and frame tests are deterministic.
// Format matches the pre-refactor `elapsed()`: one decimal second,
// right-padded to 7 columns.

export interface ElapsedClock {
  seed(runStart: number): void;
  elapsed(): string;
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
