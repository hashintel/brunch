import { describe, expect, it } from 'vitest';

import { runCommand } from '../command-runner.js';

describe('runCommand', () => {
  it('terminates a running command when the caller aborts', async () => {
    const controller = new AbortController();
    const running = runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 10_000)'], {
      cwd: process.cwd(),
      signal: controller.signal,
    });

    controller.abort();

    await expect(running).resolves.toMatchObject({ exitCode: 1, aborted: true });
  });

  it('terminates a running command after its timeout', async () => {
    const result = await runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 10_000)'], {
      cwd: process.cwd(),
      timeoutMs: 10,
    });

    expect(result).toMatchObject({ exitCode: 1, timedOut: true });
  });

  it('caps captured output', async () => {
    const result = await runCommand(process.execPath, ['-e', 'process.stdout.write("abcdefghij")'], {
      cwd: process.cwd(),
      maxOutputBytes: 4,
    });

    expect(result).toMatchObject({ exitCode: 0, stdout: 'abcd', outputTruncated: true });
  });
});
