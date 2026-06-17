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

import { type Dirent, existsSync, readdirSync, readFileSync } from 'node:fs';
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
 * Workspace globs declared by a monorepo root — npm/yarn `workspaces` (array or
 * `{ packages }`) or pnpm `pnpm-workspace.yaml`. Empty when the repo is not a
 * declared monorepo. Scoping to *declared* workspaces (not every package.json on
 * disk) keeps a stray nested project — a docs prototype, an example app — from
 * poisoning runner detection.
 */
function readWorkspaceGlobs(repoDir: string): string[] {
  const pkgPath = join(repoDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
        workspaces?: string[] | { packages?: string[] };
      };
      const ws = pkg.workspaces;
      if (Array.isArray(ws)) return ws;
      if (ws && Array.isArray(ws.packages)) return ws.packages;
    } catch {
      // Malformed root package.json: fall through to the pnpm manifest.
    }
  }
  const pnpmPath = join(repoDir, 'pnpm-workspace.yaml');
  if (existsSync(pnpmPath)) {
    try {
      const globs: string[] = [];
      for (const line of readFileSync(pnpmPath, 'utf8').split('\n')) {
        const match = /^\s*-\s*['"]?([^'"#]+?)['"]?\s*$/.exec(line);
        if (match) globs.push(match[1].trim());
      }
      return globs;
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Resolve a workspace glob to concrete package directories. Handles the two
 * forms that cover virtually all real monorepos — a literal directory (`apps/web`)
 * and a single-level wildcard (`packages/*`). Deeper/exotic globs are skipped:
 * this is the cheap evidence check, not a glob engine.
 */
function resolveWorkspaceDirs(repoDir: string, glob: string): string[] {
  const trimmed = glob.replace(/\/+$/, '');
  if (trimmed.endsWith('/*')) {
    const base = trimmed.slice(0, -2);
    try {
      return readdirSync(join(repoDir, base), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(base, entry.name));
    } catch {
      return [];
    }
  }
  return trimmed.includes('*') ? [] : [trimmed];
}

/** Union of dependency names declared across a monorepo root's workspace packages. */
function collectWorkspaceDeps(repoDir: string): Set<string> {
  const deps = new Set<string>();
  for (const glob of readWorkspaceGlobs(repoDir)) {
    for (const wsDir of resolveWorkspaceDirs(repoDir, glob)) {
      const wsDeps = readPackageJsonDeps(join(repoDir, wsDir));
      if (wsDeps) for (const dep of wsDeps) deps.add(dep);
    }
  }
  return deps;
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
  const rootDeps = readPackageJsonDeps(repoDir);
  if (rootDeps !== null) {
    // Root deps are most authoritative. Only when the root declares no runner do
    // we widen to the monorepo's workspace packages — a monorepo root often holds
    // just tooling while the runner lives in each package. A repo that already
    // resolves at the root never pays the workspace scan and can't be made
    // ambiguous by a workspace.
    let deps = rootDeps;
    let source = 'package.json';
    if (!rootDeps.has('vitest') && !rootDeps.has('jest')) {
      const wsDeps = collectWorkspaceDeps(repoDir);
      if (wsDeps.has('vitest') || wsDeps.has('jest')) {
        deps = wsDeps;
        source = 'workspace package.json';
      }
    }

    const hasVitest = deps.has('vitest');
    const hasJest = deps.has('jest');
    // Two declared runners is genuinely ambiguous — picking one by check-order
    // would silently run the wrong command. Fail loud and let `--profile` decide.
    if (hasVitest && hasJest) {
      return {
        detected: false,
        reason: `${source} declares both vitest and jest — ambiguous test runner. Pass --profile to pick node-vitest or node-jest.`,
      };
    }
    if (hasVitest) {
      return { detected: true, profile: 'node-vitest', evidence: `${source} devDependency vitest` };
    }
    if (hasJest) {
      return { detected: true, profile: 'node-jest', evidence: `${source} devDependency jest` };
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

/** A test file the host runner already discovers; `.test.`/`.spec.` in js/ts/jsx/tsx. */
const TEST_FILE_RE = /\.(test|spec)\.[cm]?[jt]sx?$/;

/** Directories never worth walking for test-layout evidence. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.brunch', '.next', 'coverage']);

/** Bound the walk so a pathological tree can't stall plan emission. */
const MAX_WALK_DEPTH = 8;

/**
 * Discover the top-level directory a brownfield repo already keeps its tests in,
 * by sampling existing test files rather than parsing the host runner's config.
 *
 * A test runner's config (e.g. vitest's `test.include`) is executable TS/JS —
 * there is no cheap, reliable way to read its globs statically. But the repo's
 * *existing* test files are ground truth: whatever config the host uses already
 * discovers and runs them, so co-locating cook's generated slice tests in the
 * same top-level directory guarantees the same discovery covers them. This
 * closes the brownfield failure where a profile's default `tests/{id}.test.ts`
 * path falls outside a repo whose vitest `include` is narrowed to `src/**`
 * (vitest then reports "No test files found" for an explicitly-named file).
 *
 * Returns the POSIX-relative directory tests cluster in (e.g. `'src'`, or
 * `'packages/app/src'` in a monorepo), or `null` when the repo has no test files
 * to learn from — cook then keeps the profile's default path. The *full*
 * directory (not just the top segment) is returned so a monorepo whose runner
 * include is rooted deep (e.g. a per-package `src` glob) still gets a covered
 * path.
 */
export function detectTestDir(repoDir: string): string | null {
  // Tally test files by their full directory relative to the repo root. Root
  // tests use relDir '' so generated targets strip the profile's default tests/
  // prefix and stay at the repo root. Keys are POSIX paths so the emitted target
  // matches profile conventions regardless of host separator.
  const counts = new Map<string, number>();

  const walk = (dir: string, depth: number, relDir: string): void => {
    if (depth > MAX_WALK_DEPTH) return;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        walk(join(dir, entry.name), depth + 1, relDir === '' ? entry.name : `${relDir}/${entry.name}`);
      } else if (entry.isFile() && TEST_FILE_RE.test(entry.name)) {
        counts.set(relDir, (counts.get(relDir) ?? 0) + 1);
      }
    }
  };
  walk(repoDir, 0, '');

  if (counts.size === 0) return null;
  // Dominant directory wins; ties broken by name (shallower/earlier first) for
  // determinism.
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}
