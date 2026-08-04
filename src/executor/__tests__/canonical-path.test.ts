import { mkdtemp, mkdir, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { canonicalPath } from '../canonical-path.js';

// The consolidated owner replaced four byte-identical copies in `worktree.ts`,
// `run-execution-authority.ts`, `git-run-promotion-port.ts`, and
// `git-slice-integration-port.ts`. The fifth copy — `git-host-land-port.ts`'s
// `canonicalPathAllowingMissing` — is a deliberate semantic fork, so the missing-path
// case below pins the boundary between the two rather than merely exercising a
// fallback: this owner leaves a missing path's symlinked ancestors unresolved, and
// host landing needs them resolved.
describe('canonicalPath', () => {
  let root: string;
  let real: string;
  let link: string;

  beforeAll(async () => {
    root = await realRoot();
    real = join(root, 'real');
    link = join(root, 'link');
    await mkdir(real, { recursive: true });
    await symlink(real, link, 'dir');
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('resolves symlinks so two spellings of an existing directory compare equal', async () => {
    expect(await canonicalPath(link)).toBe(real);
    expect(await canonicalPath(link)).toBe(await canonicalPath(real));
  });

  it('normalizes relative and redundant segments of an existing directory', async () => {
    expect(await canonicalPath(join(real, '..', 'real'))).toBe(real);
    expect(await canonicalPath(join(real, '.'))).toBe(real);
  });

  it('falls back to a lexical absolute path when the path does not exist', async () => {
    const missing = join(link, 'absent');
    expect(await canonicalPath(missing)).toBe(resolve(missing));
    // The lexical form keeps the symlinked ancestor unresolved, so it does not equal
    // the real location. `git-host-land-port.ts` cannot accept this, which is why it
    // owns a stronger sibling instead of importing this function.
    expect(await canonicalPath(missing)).not.toBe(join(real, 'absent'));
  });
});

// `mkdtemp` under the OS temp dir can itself sit behind a symlink (`/tmp` ->
// `/private/tmp` on macOS), which would make the assertions above compare a
// symlinked path against a symlinked path. Resolve the root once up front, through
// `realpath` rather than the function under test.
async function realRoot(): Promise<string> {
  return realpath(await mkdtemp(join(tmpdir(), 'canonical-path-')));
}
