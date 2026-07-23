import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { beforeAll, describe, expect, it } from 'vitest';

import { runBrunchHostLandingOracle } from '../host-landing-oracle.js';

const execFileAsync = promisify(execFile);
const candidateRoot = fileURLToPath(new URL('../../../../', import.meta.url));

describe('built Brunch host-landing oracle through the public TUI', () => {
  beforeAll(async () => {
    await execFileAsync('npm', ['run', 'build'], {
      cwd: candidateRoot,
      timeout: 240_000,
      maxBuffer: 2 * 1024 * 1024,
    });
  }, 250_000);

  it('rejects a fresh session before any provider-capable candidate launch', async () => {
    const report = await runBrunchHostLandingOracle({
      candidateRoot,
      sessionMode: 'fresh',
    });

    expect(report.status).toBe('setup_failed');
    expect(report.setupFailure).toContain('not settled');
  });

  it.each([
    ['brownfield_success', 'passed'],
    ['greenfield_success', 'passed'],
    ['decline', 'passed'],
    ['dirty_host', 'passed'],
    ['conflict', 'passed'],
    ['stale_acceptance', 'passed'],
    ['final_commit_only', 'assertion_failed'],
    ['bookkeeping_retained', 'assertion_failed'],
  ] as const)(
    'judges %s as %s through /brunch:land',
    async (scenario, expectedStatus) => {
      const report = await runBrunchHostLandingOracle({ candidateRoot, scenario });

      expect(
        report.status,
        [report.setupFailure, ...report.terminalEvidence].filter(Boolean).join('\n'),
      ).toBe(expectedStatus);
      expect(report.terminalEvidence.join('\n')).toContain('/brunch:land');
      expect(report.checks.find(({ id }) => id === 'public-tui-preflight')?.status).toBe('passed');
    },
    90_000,
  );
});
