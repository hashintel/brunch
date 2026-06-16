import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Copy `src` to `dest` using copy-on-write when the host supports it,
 * falling back to a regular recursive `cpSync` otherwise. Lazy at the block
 * level on APFS (macOS) and reflink-capable filesystems (Linux btrfs/xfs/etc.),
 * so large gitignored content like `node_modules/` costs ~zero disk on the
 * first copy.
 */
export function cowCopy(src: string, dest: string): void {
  const flag = process.platform === 'darwin' ? '-c' : process.platform === 'linux' ? '--reflink=auto' : null;
  if (flag) {
    const result = spawnSync('cp', [flag, '-R', src, dest], { stdio: ['ignore', 'pipe', 'pipe'] });
    if (result.status === 0) return;
    // Fall through to cpSync on any failure (unsupported filesystem, missing
    // flag in the host cp, etc.) — correctness is preserved at the cost of disk.
  }
  cpSync(src, dest, { dereference: false, recursive: true });
}

/** Top-level names skipped when CoW-copying into cook sandboxes. */
export const COW_COPY_DEFAULT_EXCLUDE = new Set(['.git', '.brunch']);

const NO_SYMLINKS: ReadonlySet<string> = new Set();

/**
 * Provision top-level entries from `sourceDir` that are absent in `destDir`
 * (untracked/gitignored dirs like `node_modules/`, `dist/`). Skips names in
 * `exclude` and entries already present in the destination (typically tracked
 * files materialized by `git worktree add`).
 *
 * Names in `symlink` are linked to the source entry instead of copied — used to
 * share a single read-only `node_modules/` across slice sandboxes rather than
 * paying a CoW copy per slice. Everything else is CoW-copied (lazy on APFS /
 * reflink filesystems, deep copy otherwise).
 */
export function copyMissingTopLevelEntries(
  sourceDir: string,
  destDir: string,
  exclude: ReadonlySet<string> = COW_COPY_DEFAULT_EXCLUDE,
  symlink: ReadonlySet<string> = NO_SYMLINKS,
): void {
  const source = resolve(sourceDir);
  const dest = resolve(destDir);
  for (const entry of readdirSync(source)) {
    if (exclude.has(entry)) continue;
    const destPath = join(dest, entry);
    if (existsSync(destPath)) continue;
    const sourcePath = join(source, entry);
    if (symlink.has(entry)) {
      symlinkSync(sourcePath, destPath);
    } else {
      cowCopy(sourcePath, destPath);
    }
  }
}
