import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));

describe('project interactive shell configuration', () => {
  it('uses an 80% overlay with the upstream package', async () => {
    const config = JSON.parse(await readFile(`${projectRoot}.pi/interactive-shell.json`, 'utf8')) as {
      overlayHeightPercent?: number;
    };
    const settings = JSON.parse(await readFile(`${projectRoot}.pi/settings.json`, 'utf8')) as {
      packages?: unknown[];
    };

    expect(config.overlayHeightPercent).toBe(80);
    expect(settings.packages).toEqual(['npm:pi-interactive-shell@0.13.0']);
  });
});
