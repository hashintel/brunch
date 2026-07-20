import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

import { expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

it('compiles current source before proving the built CLI differential', async () => {
  const cwd = resolve('.');
  await execFileAsync('npm', ['run', 'build'], { cwd });
  const { stdout } = await execFileAsync(
    'npm',
    [
      'test',
      '--',
      'src/probes/__tests__/provider-conduct-report.test.ts',
      '-t',
      'runs the source CLI through a canonical session and real workspace without mutation',
    ],
    {
      cwd,
      env: { ...process.env, PROVIDER_CONDUCT_BUILT_DIFFERENTIAL: '1' },
      timeout: 120_000,
    },
  );
  expect(stdout).toContain('1 passed');
}, 180_000);
