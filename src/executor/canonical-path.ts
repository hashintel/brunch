// Owns the path normalization that decides whether two spellings denote the same
// filesystem location — used by the git worktree/repo identity comparisons in
// `worktree.ts`, `run-execution-authority.ts`, and the app-layer git ports.
// Import this; do not re-copy it into a consumer.
//
// The fallback is deliberately lexical: these consumers compare two paths that both
// exist (a created worktree against `git rev-parse --show-toplevel`), so an
// unresolvable path means the comparison has no real subject and a lexical absolute
// form is enough to make it fail rather than accidentally match.
//
// `git-host-land-port.ts` deliberately keeps a stronger sibling
// (`canonicalPathAllowingMissing`) rather than importing this one: it normalizes
// targets that do not exist yet, so it must resolve symlinks in the deepest existing
// ancestor. Do not collapse the two — see that file's comment.

import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function canonicalPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return resolve(path);
  }
}
