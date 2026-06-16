import { describe, expect, it } from 'vitest';

import type { CookOptions } from '../orchestrator/src/cook-cli.js';
import { parseServeArgs, runServe, serveCookOptions } from './serve-runner.js';

describe('parseServeArgs', () => {
  it('requires a positive integer specId', () => {
    expect(() => parseServeArgs([])).toThrow(/Missing <specId>/);
    expect(() => parseServeArgs(['0'])).toThrow(/positive integer/);
    expect(() => parseServeArgs(['abc'])).toThrow(/positive integer/);
    expect(parseServeArgs(['7']).specificationId).toBe(7);
  });

  it('maps the flags it owns and rejects unknown ones', () => {
    const opts = parseServeArgs([
      '12',
      '--out=dist',
      '--force',
      '--profile=node-vitest',
      '--policy=parallel',
      '--max-retries=5',
      '--petrinaut-stream',
      '--petrinaut-url=https://x/brunch',
      '--petrinaut-lanes=mechanical',
      '--petrinaut-fold=color',
      '--no-petrinaut-open',
      '--verbose',
    ]);
    expect(opts).toMatchObject({
      specificationId: 12,
      outDir: 'dist',
      force: true,
      profile: 'node-vitest',
      policy: 'parallel',
      maxRetries: 5,
      petrinautStream: true,
      petrinautUrl: 'https://x/brunch',
      petrinautLanes: 'mechanical',
      petrinautFold: 'color',
      petrinautOpen: false,
      verbose: true,
    });
    expect(() => parseServeArgs(['1', '--nope'])).toThrow(/Unknown flag/);
    expect(() => parseServeArgs(['1', '2'])).toThrow(/Unexpected positional/);
  });

  it('defaults the optional flags', () => {
    const opts = parseServeArgs(['3']);
    expect(opts).toMatchObject({
      outDir: undefined,
      force: false,
      profile: undefined,
      policy: 'serial',
      maxRetries: 3,
      petrinautStream: false,
      petrinautOpen: true,
      verbose: false,
    });
  });
});

describe('serveCookOptions', () => {
  it('sets specId so cook reads the just-emitted plan, and forwards --out as the promote target', () => {
    const cook = serveCookOptions(
      parseServeArgs(['9', '--out=out', '--force', '--policy=parallel']),
      '/proj',
    );
    expect(cook.specId).toBe(9);
    expect(cook.outDir).toBe('out');
    expect(cook.force).toBe(true);
    expect(cook.policy).toBe('parallel');
    // cook reads opts.dir raw (no launch-cwd default — that's parseCookArgs only),
    // so serve must thread the resolved dir the plan was written to, not ''.
    expect(cook.dir).toBe('/proj');
  });

  it('omits outDir when serve had none (brownfield promotes automatically)', () => {
    const cook = serveCookOptions(parseServeArgs(['9']), '/proj');
    expect(cook.outDir).toBeUndefined();
  });
});

describe('runServe', () => {
  it('plans then cooks, passing the mapped cook options', async () => {
    const calls: string[] = [];
    let cookSaw: CookOptions | undefined;
    await runServe(parseServeArgs(['4', '--out=dist']), '/proj', {
      plan: async () => {
        calls.push('plan');
      },
      cook: async (o) => {
        calls.push('cook');
        cookSaw = o;
      },
    });
    expect(calls).toEqual(['plan', 'cook']);
    expect(cookSaw?.specId).toBe(4);
    expect(cookSaw?.outDir).toBe('dist');
    // cook runs against the same dir the plan was written to.
    expect(cookSaw?.dir).toBe('/proj');
  });

  it('does not cook if planning fails', async () => {
    let cooked = false;
    await expect(
      runServe(parseServeArgs(['4']), '/proj', {
        plan: async () => {
          throw new Error('plan boom');
        },
        cook: async () => {
          cooked = true;
        },
      }),
    ).rejects.toThrow(/plan boom/);
    expect(cooked).toBe(false);
  });
});
