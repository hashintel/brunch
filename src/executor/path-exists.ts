// Owns the "is there anything at this path" question for the executor core, the
// app-layer git ports, and their suites. Import this; do not re-copy it into a
// consumer — this module replaced 24 private copies (22 named `pathExists`, plus
// byte-identical `fileExists` aliases in `launch.ts` and `run-freshness.ts`).
//
// It is homed here rather than in `src/app/` because `app/` imports `executor/` and
// never the reverse — see `src/executor/TOPOLOGY.md` §Boundary rules and its
// executable form in `__tests__/boundaries.test.ts`. It is a sibling of
// `canonical-path.ts` rather than a member of it: that module answers whether two
// spellings denote the same location, which is a different question, and widening it
// into a general fs-predicate bucket would make its name stop describing it.
//
// Existence, not readability: `access` with no mode argument checks visibility only,
// so a directory, an empty file, and a file the process cannot read all answer true.
// `source-policy.ts` keeps a stricter private check that requires the path to read as
// UTF-8 text; it is not this predicate and must not be collapsed into it.

import { access } from 'node:fs/promises';

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
