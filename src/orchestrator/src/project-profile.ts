// Shared toolchain descriptor: derives verification target paths so no
// test-path convention is hardcoded across the emitter, reconciliation, or
// the executability contract.

export type ProfileId = 'bun' | 'brunch';

export interface Toolchain {
  sliceTarget(sliceId: string): string;
  epicTarget(epicId: string): string;
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
  },
};

// Brunch's own stack: TypeScript + vitest, tests co-located with source.
export const brunchProfile: ProjectProfile = {
  id: 'brunch',
  toolchain: {
    sliceTarget: (sliceId) => `${sliceId}.test.ts`,
    epicTarget: (epicId) => `${epicId}.integration.test.ts`,
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
