// Brownfield toolchain detection (FE-871): read the real repo and resolve it to
// a registry `ProfileId`, so cook can run a real project's tests without a human
// guessing the stack. This is the brownfield-only *front* of the FE-843 selection
// chain (`flag ≫ detected ≫ spec ≫ architect ≫ bun`); greenfield never detects
// (an empty worktree has nothing to read).
//
// Detection is evidence-first and deliberately conservative — the cheap
// "which lockfile/manifest is present" check, not a language-detection engine.
// One clear supported signal resolves; ambiguous evidence (two test runners) or
// no recognizable JS/TS toolchain returns an actionable `{detected:false}` reason
// rather than silently defaulting to bun — a wrong-but-silent toolchain produces
// unrunnable tests, the exact failure mode this closes.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PROFILE_IDS, type ProfileId } from './project-profile.js';

/** A successful detection names the profile and the evidence that selected it. */
export type ProfileDetection =
  | { detected: true; profile: ProfileId; evidence: string }
  | { detected: false; reason: string };

function fileExists(dir: string, name: string): boolean {
  return existsSync(join(dir, name));
}

/** Dependency names declared in a repo's package.json (deps + devDeps), or null if unreadable. */
function readPackageJsonDeps(dir: string): Set<string> | null {
  const path = join(dir, 'package.json');
  if (!existsSync(path)) return null;
  try {
    const pkg = JSON.parse(readFileSync(path, 'utf8')) as {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
    };
    return new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
  } catch {
    // A present-but-malformed package.json is evidence of a JS project we can't
    // read — treat it as a Node project with no detectable framework.
    return new Set();
  }
}

/**
 * Detect the toolchain `ProfileId` for a repo by introspecting its manifests and
 * lockfiles. Precedence is lockfile/config evidence first (most authoritative),
 * then package.json dependencies, then a catch-all failure. `--profile` (handled
 * upstream in the selection chain) always overrides this.
 */
export function detectProfile(repoDir: string): ProfileDetection {
  // Bun: its lockfile is unambiguous evidence of the bun test runner.
  if (fileExists(repoDir, 'bun.lockb')) return { detected: true, profile: 'bun', evidence: 'bun.lockb' };
  if (fileExists(repoDir, 'bun.lock')) return { detected: true, profile: 'bun', evidence: 'bun.lock' };

  // Deno: config or lockfile. Checked before package.json because Deno repos may
  // also carry a package.json for npm specifiers.
  for (const name of ['deno.json', 'deno.jsonc', 'deno.lock']) {
    if (fileExists(repoDir, name)) return { detected: true, profile: 'deno', evidence: name };
  }

  // Node/TypeScript: pick the runner from declared dependencies.
  const deps = readPackageJsonDeps(repoDir);
  if (deps !== null) {
    const hasVitest = deps.has('vitest');
    const hasJest = deps.has('jest');
    // Two declared runners is genuinely ambiguous — picking one by check-order
    // would silently run the wrong command. Fail loud and let `--profile` decide.
    if (hasVitest && hasJest) {
      return {
        detected: false,
        reason: `package.json declares both vitest and jest — ambiguous test runner. Pass --profile to pick node-vitest or node-jest.`,
      };
    }
    if (hasVitest) {
      return { detected: true, profile: 'node-vitest', evidence: 'package.json devDependency vitest' };
    }
    if (hasJest) {
      return { detected: true, profile: 'node-jest', evidence: 'package.json devDependency jest' };
    }
    // No third-party runner declared → the built-in node:test runner needs none.
    return {
      detected: true,
      profile: 'node-test',
      evidence: 'package.json with no test-framework dependency',
    };
  }

  // No JS/TS evidence (could be a Python/Go/unknown repo — brunch only supports
  // the registry's JS toolchains). Fail with an actionable reason rather than a
  // silent default; the agent's bash can't substitute since the test runner reads
  // the stamped profile with no agent in the loop.
  return {
    detected: false,
    reason: `could not detect a supported toolchain in ${repoDir} (no package.json, deno config, or bun lockfile). Pass --profile to select one of: ${PROFILE_IDS.join(', ')}.`,
  };
}
