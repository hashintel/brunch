import { execFile } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

describe('brunch login secret PTY probe', () => {
  it('is executable and proves real terminal paste secrecy with isolated Pi auth storage', async () => {
    const script = new URL('../scripts/verify-brunch-login-secret.sh', import.meta.url);

    await access(script, constants.X_OK);

    const { stdout, stderr } = await execFileAsync(script.pathname, [], {
      env: {
        ...process.env,
        PROBE_TIMEOUT_SECONDS: '30',
        SENTINEL_SECRET: 'brunch_WR15_vitest_secret_paste_sentinel',
      },
      timeout: 35_000,
      maxBuffer: 1024 * 1024,
    });

    expect(stderr).toBe('');
    expect(stdout).toContain('Brunch login secret PTY oracle passed.');
    expect(stdout).toContain('terminal bytes exclude the pasted sentinel');
  }, 40_000);
});
