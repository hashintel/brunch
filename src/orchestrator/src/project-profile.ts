// Shared toolchain descriptor: derives verification target paths so no
// test-path convention is hardcoded across the emitter, reconciliation, or
// the executability contract.

export type ProfileId = 'bun' | 'brunch';

export interface Toolchain {
  sliceTarget(sliceId: string): string;
  epicTarget(epicId: string): string;
  /** Argv that runs a single test target in the cook sandbox. */
  testCommand(target: string): string[];
  /**
   * Agent-facing description of the test framework + import conventions,
   * injected into the cook test-writer task so prompts carry no hardcoded
   * stack (greenfield worktrees have no surrounding code to infer from).
   */
  testConventions: string;
}

export interface ProjectProfile {
  id: ProfileId;
  toolchain: Toolchain;
}

export const bunProfile: ProjectProfile = {
  id: 'bun',
  toolchain: {
    sliceTarget: (sliceId) => `tests/${sliceId}.test.ts`,
    epicTarget: (epicId) => `tests/${epicId}.integration.test.ts`,
    testCommand: (target) => ['bun', 'test', target],
    testConventions:
      'Use bun\'s test runner: `import { describe, expect, it } from "bun:test"`. The harness runs each target with `bun test <target>`.',
  },
};

// Brunch's own stack: TypeScript + vitest, tests co-located with source.
export const brunchProfile: ProjectProfile = {
  id: 'brunch',
  toolchain: {
    sliceTarget: (sliceId) => `${sliceId}.test.ts`,
    epicTarget: (epicId) => `${epicId}.integration.test.ts`,
    testCommand: (target) => ['npx', 'vitest', 'run', target],
    testConventions:
      'Use vitest: `import { describe, expect, it } from "vitest"`. The harness runs each target with `vitest run <target>`.',
  },
};

const PROFILES: Record<ProfileId, ProjectProfile> = {
  bun: bunProfile,
  brunch: brunchProfile,
};

/**
 * Resolve the toolchain for a plan's profile id, falling back to bun for
 * an absent or unrecognized profile (the same lenient default `loadPlan`
 * applies to `mode`).
 */
export function resolveToolchain(profile?: ProfileId): Toolchain {
  return (profile ? PROFILES[profile] : undefined)?.toolchain ?? bunProfile.toolchain;
}

export const defaultToolchain: Toolchain = bunProfile.toolchain;
