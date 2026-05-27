import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync } from 'node:fs';
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

/**
 * CoW-copy top-level entries from `sourceDir` that are absent in `destDir`
 * (untracked/gitignored dirs like `node_modules/`, `dist/`). Skips names in
 * `exclude` and entries already present in the destination (typically tracked
 * files materialized by `git worktree add`).
 */
export function copyMissingTopLevelEntries(
  sourceDir: string,
  destDir: string,
  exclude: ReadonlySet<string> = new Set(['.git']),
): void {
  const source = resolve(sourceDir);
  const dest = resolve(destDir);
  for (const entry of readdirSync(source)) {
    if (exclude.has(entry)) continue;
    const destPath = join(dest, entry);
    if (existsSync(destPath)) continue;
    cowCopy(join(source, entry), destPath);
  }
}
