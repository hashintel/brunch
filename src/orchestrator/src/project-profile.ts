// Shared toolchain descriptor: profiles are data literals (path templates +
// argv template + conventions prose) compiled into the `Toolchain` interface,
// so no test-path convention or framework is hardcoded across the emitter,
// reconciliation, the executability contract, or the cook harness. Adding a
// runtime = adding one data entry.

export type ProfileId = 'bun' | 'brunch' | 'node-vitest' | 'node-test' | 'node-jest' | 'deno';

export interface Toolchain {
  sliceTarget(sliceId: string): string;
  epicTarget(epicId: string): string;
  /** Argv that runs a single test target in the cook sandbox. */
  testCommand(target: string): string[];
  /**
   * Agent-facing description of the test framework + scaffold/install
   * conventions, injected into the cook test-writer task so prompts carry no
   * hardcoded stack (greenfield worktrees have no surrounding code to infer
   * from — the prose alone must let the agent stand the stack up).
   */
  testConventions: string;
}

export interface ProjectProfile {
  id: ProfileId;
  toolchain: Toolchain;
}

/**
 * Declarative profile shape: `{id}` in target templates is the slice/epic id;
 * exactly one `testCommand` element is the literal `'{target}'`.
 */
interface ProfileData {
  sliceTarget: string;
  epicTarget: string;
  testCommand: readonly string[];
  testConventions: string;
}

const PROFILE_DATA: Record<ProfileId, ProfileData> = {
  bun: {
    sliceTarget: 'tests/{id}.test.ts',
    epicTarget: 'tests/{id}.integration.test.ts',
    testCommand: ['bun', 'test', '{target}'],
    testConventions:
      'Use bun\'s test runner: `import { describe, expect, it } from "bun:test"`. The harness runs each target with `bun test <target>`.',
  },
  // Brunch's own stack: TypeScript + vitest, tests co-located with source.
  brunch: {
    sliceTarget: '{id}.test.ts',
    epicTarget: '{id}.integration.test.ts',
    testCommand: ['npx', 'vitest', 'run', '{target}'],
    testConventions:
      'Use vitest: `import { describe, expect, it } from "vitest"`. The harness runs each target with `vitest run <target>`.',
  },
  'node-vitest': {
    sliceTarget: 'tests/{id}.test.ts',
    epicTarget: 'tests/{id}.integration.test.ts',
    testCommand: ['npx', 'vitest', 'run', '{target}'],
    testConventions:
      'Use vitest on Node: `import { describe, expect, it } from "vitest"`. Scaffold a package.json with `vitest` and `typescript` as devDependencies and run `npm install` before testing. The harness runs each target with `npx vitest run <target>`.',
  },
  'node-test': {
    sliceTarget: 'tests/{id}.test.ts',
    epicTarget: 'tests/{id}.integration.test.ts',
    testCommand: ['node', '--test', '{target}'],
    testConventions:
      "Use the built-in node:test runner: `import { test } from 'node:test'` and `import assert from 'node:assert/strict'`. Write TypeScript with erasable syntax only (no enums or namespaces) — Node strips types natively, so no install or build step is needed to run tests. The harness runs each target with `node --test <target>`.",
  },
  'node-jest': {
    sliceTarget: 'tests/{id}.test.ts',
    epicTarget: 'tests/{id}.integration.test.ts',
    testCommand: ['npx', 'jest', '--runTestsByPath', '{target}'],
    testConventions:
      'Use jest with ts-jest: `import { describe, expect, it } from "@jest/globals"`. Scaffold a package.json with `jest`, `ts-jest`, and `typescript` as devDependencies plus a jest.config.js using the ts-jest preset, then run `npm install` before testing. The harness runs each target with `npx jest --runTestsByPath <target>`.',
  },
  deno: {
    sliceTarget: 'tests/{id}.test.ts',
    epicTarget: 'tests/{id}.integration.test.ts',
    testCommand: ['deno', 'test', '--allow-all', '{target}'],
    testConventions:
      "Use Deno's built-in test runner: `Deno.test(...)` with assertions from `jsr:@std/assert`. No package.json or install step — imports resolve via jsr/npm specifiers. The harness runs each target with `deno test --allow-all <target>`.",
  },
};

function compileProfile(id: ProfileId, data: ProfileData): ProjectProfile {
  return {
    id,
    toolchain: {
      sliceTarget: (sliceId) => data.sliceTarget.replaceAll('{id}', sliceId),
      epicTarget: (epicId) => data.epicTarget.replaceAll('{id}', epicId),
      testCommand: (target) => data.testCommand.map((arg) => (arg === '{target}' ? target : arg)),
      testConventions: data.testConventions,
    },
  };
}

export const PROFILES: Record<ProfileId, ProjectProfile> = Object.fromEntries(
  (Object.entries(PROFILE_DATA) as [ProfileId, ProfileData][]).map(([id, data]) => [
    id,
    compileProfile(id, data),
  ]),
) as Record<ProfileId, ProjectProfile>;

export const bunProfile: ProjectProfile = PROFILES.bun;
export const brunchProfile: ProjectProfile = PROFILES.brunch;

export const PROFILE_IDS = Object.keys(PROFILE_DATA) as readonly ProfileId[];

export class UnknownProfileError extends Error {
  constructor(value: string) {
    super(`Unknown toolchain profile "${value}". Valid profiles: ${PROFILE_IDS.join(', ')}.`);
    this.name = 'UnknownProfileError';
  }
}

/** Validate an externally-supplied profile id (CLI flag, hand-edited YAML). */
export function parseProfileId(value: string): ProfileId {
  if (!Object.hasOwn(PROFILE_DATA, value)) throw new UnknownProfileError(value);
  return value as ProfileId;
}

/**
 * Resolve the toolchain for a plan's profile id. Absent → bun (lenient, for
 * hand-authored fixture plans); unknown → `UnknownProfileError`, so a typo'd
 * id in plan.yaml fails loudly instead of silently running under bun.
 */
export function resolveToolchain(profile?: ProfileId): Toolchain {
  if (profile === undefined) return bunProfile.toolchain;
  return PROFILES[parseProfileId(profile)].toolchain;
}

export const defaultToolchain: Toolchain = bunProfile.toolchain;

/**
 * Relocate a toolchain's test targets into `dir`, preserving the profile's
 * filename convention (`{id}.test.ts`, `{id}.integration.test.ts`). Brownfield
 * detection uses this to co-locate cook's generated tests in the directory the
 * host repo already keeps its tests — see `detectTestDir`. A profile's default
 * test directory (e.g. `tests/`) can fall outside a repo's narrowed runner
 * include glob, making the chosen path unrunnable; relocating to the repo's own
 * test directory keeps it discoverable. `dir` of `''`/`'.'` strips the prefix
 * (tests at the repo root).
 */
export function withTestDir(toolchain: Toolchain, dir: string): Toolchain {
  const cleaned = dir.replace(/\/+$/, '');
  const relocate = (target: string): string => {
    const basename = target.slice(target.lastIndexOf('/') + 1);
    return cleaned === '' || cleaned === '.' ? basename : `${cleaned}/${basename}`;
  };
  return {
    ...toolchain,
    sliceTarget: (sliceId) => relocate(toolchain.sliceTarget(sliceId)),
    epicTarget: (epicId) => relocate(toolchain.epicTarget(epicId)),
  };
}
