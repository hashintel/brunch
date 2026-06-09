import { tmpdir } from 'node:os';
import { basename, resolve, sep } from 'node:path';

/**
 * Probe runs default to an ephemeral `mkdtemp` workspace under the OS temp
 * directory. Persisting that absolute path (e.g. `/var/folders/…/T/brunch-…`)
 * into committed report fixtures leaks machine-specific, non-deterministic
 * paths. Replace such a `cwd` with a stable, portable marker so persisted
 * reports stay reproducible; leave explicit non-temp working directories
 * untouched.
 */
export const EPHEMERAL_WORKSPACE_CWD = '<ephemeral-workspace>';

const PORTABLE_RUN_ID = /^[A-Za-z0-9._-]+$/u;

export function assertPortableRunId(runId: string): string {
  if (
    runId.length === 0 ||
    runId === '.' ||
    runId === '..' ||
    basename(runId) !== runId ||
    runId.includes('\\') ||
    !PORTABLE_RUN_ID.test(runId)
  ) {
    throw new Error(
      `Artifact runId must be a portable single path segment; received ${JSON.stringify(runId)}`,
    );
  }
  return runId;
}

export function portableCwd(cwd: string): string {
  const tempRoot = resolve(tmpdir());
  const resolved = resolve(cwd);
  if (resolved === tempRoot || resolved.startsWith(`${tempRoot}${sep}`)) {
    return EPHEMERAL_WORKSPACE_CWD;
  }
  return cwd;
}
