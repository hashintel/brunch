import { existsSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { publicScenarioNames, publicScenarios, walkthroughScenarioMatrix } from './scenarios.js';
import { runSeedCli } from './seed.js';

describe('runSeedCli', () => {
  function createTempDir(): string {
    return mkdtempSync(join(tmpdir(), 'brunch-seed-'));
  }

  it('keeps the public seed catalog wired to TypeScript scenario builders only', () => {
    for (const scenarioName of publicScenarioNames) {
      expect(publicScenarios[scenarioName]).toBeTypeOf('function');
    }

    for (const entry of walkthroughScenarioMatrix) {
      expect(publicScenarios[entry.scenarioName]).toBe(entry.seedScenario);
    }
  });

  it('lists only public trusted scenarios when no scenario is provided', async () => {
    const io = {
      log: vi.fn(),
      error: vi.fn(),
    };

    const exitCode = await runSeedCli([], io);

    expect(exitCode).toBe(1);
    expect(io.error).toHaveBeenCalledTimes(2);
    const listOutput = io.error.mock.calls.map(([line]) => String(line)).join('\n');
    expect(listOutput).toContain('issue-tracker-kickoff-ready');
    expect(listOutput).toContain('issue-tracker-grounding-closure-pending');
    expect(listOutput).toContain('issue-tracker-design-recovery');
    expect(listOutput).toContain('issue-tracker-criteria-kickoff-ready');
    expect(listOutput).toContain('forced-close-all-phases-closed');
    expect(listOutput).toContain('low-readiness-all-phases-closed');
    expect(listOutput).not.toContain('issue-tracker-grounding-closed');
    expect(listOutput).not.toContain('issue-tracker-design-active');
  });

  it('rejects unknown scenarios through the public seed CLI', async () => {
    const io = {
      log: vi.fn(),
      error: vi.fn(),
    };

    const exitCode = await runSeedCli(['not-a-scenario'], io);

    expect(exitCode).toBe(1);
    expect(io.log).not.toHaveBeenCalled();
    expect(io.error.mock.calls[0]?.[0]).toBe('Unknown scenario: not-a-scenario');
    const advertisedCatalog = String(io.error.mock.calls[1]?.[0] ?? '');
    expect(advertisedCatalog).toContain('low-readiness-all-phases-closed');
  });

  it('defaults to the local .brunch project database when no db path is provided', async () => {
    const tempDir = createTempDir();
    const io = {
      log: vi.fn(),
      error: vi.fn(),
    };

    try {
      const exitCode = await runSeedCli(['issue-tracker-kickoff-ready'], io, tempDir);

      expect(exitCode).toBe(0);
      expect(io.error).not.toHaveBeenCalled();
      expect(existsSync(join(tempDir, '.brunch', 'brunch.db'))).toBe(true);
      expect(String(io.log.mock.calls[0]?.[0] ?? '')).toContain(join(tempDir, '.brunch', 'brunch.db'));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('uses BRUNCH_DB when provided and no explicit db path arg is given', async () => {
    const tempDir = createTempDir();
    const configuredDbPath = join(tempDir, 'scratch.db');
    const io = {
      log: vi.fn(),
      error: vi.fn(),
    };

    try {
      const exitCode = await runSeedCli(['issue-tracker-kickoff-ready'], io, tempDir, configuredDbPath);

      expect(exitCode).toBe(0);
      expect(io.error).not.toHaveBeenCalled();
      expect(existsSync(configuredDbPath)).toBe(true);
      expect(String(io.log.mock.calls[0]?.[0] ?? '')).toContain(configuredDbPath);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
