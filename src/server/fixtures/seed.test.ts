import { describe, expect, it, vi } from 'vitest';

import { runSeedCli } from './seed.js';

describe('runSeedCli', () => {
  it('lists only public trusted scenarios when no scenario is provided', () => {
    const io = {
      log: vi.fn(),
      error: vi.fn(),
    };

    const exitCode = runSeedCli([], io);

    expect(exitCode).toBe(1);
    expect(io.error).toHaveBeenCalledTimes(2);
    const listOutput = io.error.mock.calls.map(([line]) => String(line)).join('\n');
    expect(listOutput).toContain('issue-tracker-scope-closed');
    expect(listOutput).toContain('forced-close-all-phases-closed');
    expect(listOutput).not.toContain('low-readiness-all-phases-closed');
  });

  it('rejects synthetic test-only scenarios through the public seed CLI', () => {
    const io = {
      log: vi.fn(),
      error: vi.fn(),
    };

    const exitCode = runSeedCli(['low-readiness-all-phases-closed'], io);

    expect(exitCode).toBe(1);
    expect(io.log).not.toHaveBeenCalled();
    expect(io.error.mock.calls[0]?.[0]).toBe('Unknown scenario: low-readiness-all-phases-closed');
    const advertisedCatalog = String(io.error.mock.calls[1]?.[0] ?? '');
    expect(advertisedCatalog).not.toContain('low-readiness-all-phases-closed');
  });
});
