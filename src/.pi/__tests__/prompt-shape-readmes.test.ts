import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../${relativePath}`, import.meta.url)), 'utf8');
}

describe('prompt-skill shape decisions', () => {
  it('records adopted prompt-skill topology and remaining deferred prompt-skill triggers in the local README', () => {
    const skillsReadme = readRepoFile('src/.pi/skills/README.md');

    expect(skillsReadme).toContain('Agent Skills-standard prompt resources');
    expect(skillsReadme).toContain('<name>/SKILL.md');
    expect(skillsReadme).toContain('references/` subfiles');
    expect(skillsReadme).toContain('progressive disclosure');
    expect(skillsReadme).toContain('_generated/ typed-vocab references');
    expect(skillsReadme).toContain('concrete citing need appears');
    expect(skillsReadme).toContain('drift-checked');
  });
});
