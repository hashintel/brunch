import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const promptPath = fileURLToPath(new URL('../../../.pi/prompts/compare-specs.md', import.meta.url));

describe('/compare-specs operator prompt', () => {
  it('continues without another selection turn when exactly one mission is eligible', async () => {
    const prompt = await readFile(promptPath, 'utf8');

    expect(prompt).toContain('If exactly one mission is eligible, select it and continue in this turn');
    expect(prompt).toContain('Only ask the operator to select a mission when more than one is eligible');
    expect(prompt).toContain('if none are eligible, report that and stop');
  });
});
