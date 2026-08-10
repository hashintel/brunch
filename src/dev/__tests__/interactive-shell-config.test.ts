import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));

describe('project interactive shell configuration', () => {
  it('uses the upstream shell package without overriding project extension discovery', async () => {
    const config = JSON.parse(await readFile(`${projectRoot}.pi/interactive-shell.json`, 'utf8')) as {
      overlayHeightPercent?: number;
    };
    const settings = JSON.parse(await readFile(`${projectRoot}.pi/settings.json`, 'utf8')) as {
      packages?: unknown[];
      extensions?: unknown[];
    };

    expect(config.overlayHeightPercent).toBe(80);
    expect(settings.packages).toEqual(['npm:pi-interactive-shell@0.13.0']);
    expect(settings.extensions).toBeUndefined();
  });
});
