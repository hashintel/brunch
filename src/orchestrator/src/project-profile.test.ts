import { describe, expect, it } from 'vitest';

import {
  brunchProfile,
  bunProfile,
  parseProfileId,
  PROFILES,
  resolveToolchain,
  UnknownProfileError,
} from './project-profile.js';

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

describe('expanded TS profiles', () => {
  it('node-vitest runs vitest via npx with tests/ layout', () => {
    const toolchain = resolveToolchain('node-vitest');
    expect(toolchain.sliceTarget('chunk')).toBe('tests/chunk.test.ts');
    expect(toolchain.epicTarget('utils')).toBe('tests/utils.integration.test.ts');
    expect(toolchain.testCommand('tests/x.test.ts')).toEqual(['npx', 'vitest', 'run', 'tests/x.test.ts']);
    expect(toolchain.testConventions).toContain('vitest');
  });

  it('node-test runs the built-in node:test runner', () => {
    const toolchain = resolveToolchain('node-test');
    expect(toolchain.testCommand('tests/x.test.ts')).toEqual(['node', '--test', 'tests/x.test.ts']);
    expect(toolchain.testConventions).toContain('node:test');
  });

  it('node-jest runs jest by path with ts-jest conventions', () => {
    const toolchain = resolveToolchain('node-jest');
    expect(toolchain.testCommand('tests/x.test.ts')).toEqual([
      'npx',
      'jest',
      '--runTestsByPath',
      'tests/x.test.ts',
    ]);
    expect(toolchain.testConventions).toContain('ts-jest');
  });

  it('deno runs deno test with --allow-all and no install step', () => {
    const toolchain = resolveToolchain('deno');
    expect(toolchain.testCommand('tests/x.test.ts')).toEqual([
      'deno',
      'test',
      '--allow-all',
      'tests/x.test.ts',
    ]);
    expect(toolchain.testConventions).toContain('Deno.test');
  });
});

describe('registry invariants (every profile)', () => {
  const profiles = Object.values(PROFILES);

  it('embeds the slice/epic id in both targets', () => {
    for (const { id, toolchain } of profiles) {
      expect(toolchain.sliceTarget('SLICE_X'), id).toContain('SLICE_X');
      expect(toolchain.epicTarget('EPIC_X'), id).toContain('EPIC_X');
      expect(toolchain.sliceTarget('SLICE_X'), id).not.toContain('{id}');
    }
  });

  it('embeds the target in exactly one command argument, with no leftover placeholder', () => {
    for (const { id, toolchain } of profiles) {
      const argv = toolchain.testCommand('TARGET_X');
      expect(
        argv.filter((arg) => arg.includes('TARGET_X')),
        id,
      ).toHaveLength(1);
      expect(argv.join(' '), id).not.toContain('{target}');
    }
  });

  it('carries non-empty agent-facing conventions naming the run command', () => {
    for (const { id, toolchain } of profiles) {
      expect(toolchain.testConventions.length, id).toBeGreaterThan(0);
      expect(toolchain.testConventions, id).toContain('The harness runs each target with');
    }
  });
});

describe('resolveToolchain', () => {
  it('resolves a known profile', () => {
    expect(resolveToolchain('brunch')).toBe(brunchProfile.toolchain);
  });

  it('falls back to bun for an absent profile (hand-authored fixtures)', () => {
    expect(resolveToolchain(undefined)).toBe(bunProfile.toolchain);
  });

  it('throws UnknownProfileError for an unrecognized id, listing valid profiles', () => {
    // @ts-expect-error — exercise the runtime guard against unvalidated YAML.
    expect(() => resolveToolchain('rust')).toThrow(UnknownProfileError);
    // @ts-expect-error — same call, message shape.
    expect(() => resolveToolchain('rust')).toThrow(/rust.*bun.*node-vitest/s);
  });
});

describe('parseProfileId', () => {
  it('accepts every registered id and rejects unknown values', () => {
    for (const id of Object.keys(PROFILES)) {
      expect(parseProfileId(id)).toBe(id);
    }
    expect(() => parseProfileId('rust')).toThrow(UnknownProfileError);
    expect(() => parseProfileId('toString')).toThrow(UnknownProfileError);
  });
});
