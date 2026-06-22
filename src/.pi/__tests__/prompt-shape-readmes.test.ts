import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../${relativePath}`, import.meta.url)), 'utf8');
}

describe('prompt-shape decisions', () => {
  it('records adopted prompt-skill topology and remaining deferred prompt-shape triggers in canonical READMEs', () => {
    const skillsReadme = readRepoFile('src/.pi/skills/README.md');
    const agentsReadme = readRepoFile('src/.pi/agents/README.md');

    expect(skillsReadme).toContain('Agent Skills-standard prompt resources');
    expect(skillsReadme).toContain('<name>/SKILL.md');
    expect(skillsReadme).toContain('references/` subfiles');
    expect(skillsReadme).toContain('progressive disclosure');
    expect(skillsReadme).toContain('_generated/ typed-vocab references');
    expect(skillsReadme).toContain('deferred until a concrete stale-member need appears');
    expect(skillsReadme).toContain('regenerated and drift-checked');

    expect(agentsReadme).toContain('SYSTEM.md convention is adopted');
    expect(agentsReadme).toContain('[sub]');
    expect(agentsReadme).toContain('deferred until the first sub-agent lands');
  });
});
