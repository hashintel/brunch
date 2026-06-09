import { describe, expect, it } from 'vitest';

import { brunchProfile, bunProfile, resolveToolchain } from './project-profile.js';

describe('toolchain target shaping', () => {
  it('bun puts tests under tests/ with bun naming', () => {
    expect(bunProfile.toolchain.sliceTarget('chunk')).toBe('tests/chunk.test.ts');
    expect(bunProfile.toolchain.epicTarget('utils')).toBe('tests/utils.integration.test.ts');
  });

  it('brunch co-locates tests with no tests/ prefix', () => {
    expect(brunchProfile.toolchain.sliceTarget('chunk')).toBe('chunk.test.ts');
    expect(brunchProfile.toolchain.epicTarget('utils')).toBe('utils.integration.test.ts');
  });
});

describe('toolchain test command', () => {
  it('bun runs `bun test <target>`', () => {
    expect(bunProfile.toolchain.testCommand('tests/x.test.ts')).toEqual(['bun', 'test', 'tests/x.test.ts']);
  });

  it('brunch runs vitest', () => {
    expect(brunchProfile.toolchain.testCommand('x.test.ts')).toEqual(['npx', 'vitest', 'run', 'x.test.ts']);
  });
});

describe('toolchain test conventions are framework-specific', () => {
  it('bun conventions mention bun:test', () => {
    expect(bunProfile.toolchain.testConventions).toContain('bun:test');
  });

  it('brunch conventions mention vitest, not bun', () => {
    expect(brunchProfile.toolchain.testConventions).toContain('vitest');
    expect(brunchProfile.toolchain.testConventions).not.toContain('bun');
  });
});

describe('resolveToolchain', () => {
  it('resolves a known profile', () => {
    expect(resolveToolchain('brunch')).toBe(brunchProfile.toolchain);
  });

  it('falls back to bun for an absent or unknown profile', () => {
    expect(resolveToolchain(undefined)).toBe(bunProfile.toolchain);
    // @ts-expect-error — exercise the runtime fallback for an unrecognized id.
    expect(resolveToolchain('rust')).toBe(bunProfile.toolchain);
  });
});
