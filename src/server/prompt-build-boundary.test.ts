// @vitest-environment node

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { build } from 'vite';
import { describe, expect, it } from 'vitest';

describe('server prompt asset build boundary', () => {
  it('copies markdown prompt assets next to the built server runtime', async () => {
    await build({
      configFile: 'vite.config.ts',
      logLevel: 'silent',
      mode: 'server-runtime',
    });

    const promptPath = join(process.cwd(), 'dist/server/prompts/side-chat-role.md');
    expect(existsSync(promptPath)).toBe(true);
    expect(readFileSync(promptPath, 'utf8')).toContain('side-chat assistant in Brunch');
  }, 60_000);
});
