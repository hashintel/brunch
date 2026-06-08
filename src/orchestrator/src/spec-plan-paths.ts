// Single owner for the spec-scoped plan-emission layout used by `brunch
// plan <specId>` (writer) and `brunch cook [--spec=<id>]` (resolver).
//
// Layout: `<dir>/.brunch/cook/specs/<specId>/plan.yaml`. Each spec gets
// its own subdirectory so multiple completed specifications can coexist
// on the same project without overwriting each other; cook resolves
// either by explicit `--spec=<id>` or by auto-picking the newest plan.
//
// Lives in `src/orchestrator/` (not `src/server/`) so the server-side
// plan-runner can import it without inverting the established
// orchestrator-pure-of-server dependency direction.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Absolute path to `<dir>/.brunch/cook/specs/<specId>/plan.yaml`. */
export function specPlanPath(dir: string, specId: number): string {
  return join(specsRootDir(dir), String(specId), 'plan.yaml');
}

/** Absolute path to `<dir>/.brunch/cook/specs`. */
export function specsRootDir(dir: string): string {
  return join(dir, '.brunch', 'cook', 'specs');
}

/**
 * Walk `<dir>/.brunch/cook/specs/<n>/plan.yaml` and return the most
 * recently modified plan path by mtime, or `undefined` if none exist.
 * Subdirectory names that aren't positive integers are ignored (the
 * writer only ever creates positive-integer dirs via
 * `String(specificationId)`), so unrelated directories sitting next to
 * spec stores don't poison the auto-pick.
 */
export function resolveLatestSpecPlanPath(dir: string): string | undefined {
  const root = specsRootDir(dir);
  if (!existsSync(root)) return undefined;

  let newest: { path: string; mtimeMs: number; specId: number } | undefined;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const parsed = Number(entry.name);
    if (!Number.isInteger(parsed) || parsed <= 0) continue;
    const planPath = join(root, entry.name, 'plan.yaml');
    if (!existsSync(planPath)) continue;
    const mtimeMs = statSync(planPath).mtimeMs;
    if (!newest || mtimeMs > newest.mtimeMs || (mtimeMs === newest.mtimeMs && parsed > newest.specId)) {
      newest = { path: planPath, mtimeMs, specId: parsed };
    }
  }
  return newest?.path;
}

/**
 * Parse a CLI-supplied spec id (positive integer or throw). `flagLabel`
 * appears verbatim in the error message — pass `--spec`, `<specId>`, or
 * whatever the calling surface uses so the error reads naturally.
 */
export function parseSpecId(raw: string, flagLabel: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${flagLabel} value: "${raw}". Must be a positive integer.`);
  }
  return parsed;
}
