// FE-829 slice 1: the shared toolchain descriptor.
//
// A `Toolchain` derives verification target paths from plan structure so
// no test-path convention is hardcoded in the emitter, reconciliation, or
// the executability contract — `tests/<id>.test.ts` is *derived*, not
// baked in. The same descriptor is the seam slice 2 widens for the cook
// `code-writer`/`test-writer` prompts and the `test-runner` (language,
// framework, file conventions). Slice 1 only needs the target shape.

export interface Toolchain {
  /** Verification target path for a per-slice unit test. */
  sliceTarget(sliceId: string): string;
  /** Verification target path for a per-epic integration test. */
  epicTarget(epicId: string): string;
}

export interface ProjectProfile {
  id: string;
  toolchain: Toolchain;
}

/** Bun is the first (and currently only) implemented profile. */
export const bunProfile: ProjectProfile = {
  id: 'bun',
  toolchain: {
    sliceTarget: (sliceId) => `tests/${sliceId}.test.ts`,
    epicTarget: (epicId) => `tests/${epicId}.integration.test.ts`,
  },
};

/** Default toolchain used until a spec carries its own profile. */
export const defaultToolchain: Toolchain = bunProfile.toolchain;
