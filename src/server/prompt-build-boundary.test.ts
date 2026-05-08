// @vitest-environment node

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { build } from 'vite';
import { describe, expect, it } from 'vitest';

import { copyServerPromptAssets } from '../../vite.config.js';

describe('server prompt asset build boundary', () => {
  it('mirrors prompt assets by removing stale destination files before copy', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'brunch-prompt-copy-'));
    const sourceDir = join(tempRoot, 'src-prompts');
    const destinationDir = join(tempRoot, 'dist-prompts');
    mkdirSync(sourceDir);
    mkdirSync(destinationDir);

    copyServerPromptAssets(sourceDir, destinationDir);
    writeFileSync(join(destinationDir, 'stale-prompt.md'), 'removed');
    writeFileSync(join(sourceDir, 'current-prompt.md'), 'current');

    copyServerPromptAssets(sourceDir, destinationDir);

    expect(existsSync(join(destinationDir, 'current-prompt.md'))).toBe(true);
    expect(existsSync(join(destinationDir, 'stale-prompt.md'))).toBe(false);
  });

  it('copies markdown prompt assets next to an isolated built server runtime', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'brunch-server-build-'));
    const outDir = join(tempRoot, 'server');

    await build({
      configFile: 'vite.config.ts',
      logLevel: 'silent',
      mode: 'server-runtime',
      build: {
        outDir,
      },
    });

    const promptPath = join(outDir, 'prompts/side-chat-role.md');
    expect(existsSync(promptPath)).toBe(true);
    expect(readFileSync(promptPath, 'utf8')).toContain('side-chat assistant in Brunch');
  }, 60_000);
});
