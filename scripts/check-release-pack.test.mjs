import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { installedBrunchBinPath, runtimeMarkdownAssetPaths } from './check-release-pack.mjs';

describe('check-release-pack helpers', () => {
  it('uses the Windows npm prefix bin layout', () => {
    expect(installedBrunchBinPath('/tmp/prefix', 'win32')).toBe(join('/tmp/prefix', 'brunch.cmd'));
    expect(installedBrunchBinPath('/tmp/prefix', 'darwin')).toBe(join('/tmp/prefix', 'bin', 'brunch'));
  });

  it('enumerates the runtime markdown asset families protected by build:pi-assets', async () => {
    const paths = await runtimeMarkdownAssetPaths(process.cwd());

    expect(paths).toEqual(
      expect.arrayContaining([
        'dist/agents/prompts/elicitor.md',
        'dist/agents/prompts/executor.md',
        'dist/agents/subagents/explorer.md',
        'dist/agents/subagents/worker.md',
        'dist/agents/references/data-model.md',
        'dist/agents/references/readiness-bands.md',
      ]),
    );
    expect(paths).not.toContain('dist/agents/prompts/TOPOLOGY.md');
  });
});
