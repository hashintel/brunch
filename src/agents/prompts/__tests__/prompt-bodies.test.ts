import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))));

const agentDefinitionExpectations = [
  {
    system: 'src/agents/prompts/elicitor/SYSTEM.md',
    legacyFlat: 'src/.pi/agents/elicitor.md',
    needles: ['# Agent: elicitor', 'multi-spec discipline'],
  },
  {
    system: 'src/agents/prompts/orchestrator/SYSTEM.md',
    needles: ['# Agent: orchestrator', 'execute mode'],
  },
  {
    system: 'src/agents/prompts/reviewer/SYSTEM.md',
    legacyFlat: 'src/.pi/agents/reviewer.md',
    needles: ['name: reviewer', 'checking candidate'],
  },
  {
    system: 'src/agents/prompts/explorer/SYSTEM.md',
    needles: ['name: explorer', 'read-only reconnaissance agent'],
  },
  {
    system: 'src/agents/prompts/researcher/SYSTEM.md',
    needles: ['name: researcher', 'web-research agent'],
  },
  {
    system: 'src/agents/prompts/projector/SYSTEM.md',
    needles: ['name: projector', 'candidate-proposal'],
  },
  {
    system: 'src/agents/prompts/pi-coder/SYSTEM.md',
    needles: [
      'expert coding assistant operating inside *brunch*',
      'Show file paths clearly when working with files',
    ],
  },
];

describe('agent prompt bodies', () => {
  it('keeps agent body resources under src/agents/prompts/<agent>/SYSTEM.md', async () => {
    for (const expectation of agentDefinitionExpectations) {
      const content = await readFile(join(projectRoot, expectation.system), 'utf8');
      for (const needle of expectation.needles) {
        expect(content).toContain(needle);
      }
      if (expectation.legacyFlat) {
        await expect(access(join(projectRoot, expectation.legacyFlat))).rejects.toThrow();
      }
    }
  });

  it('records the adopted body topology in the local README', async () => {
    const readme = await readFile(join(projectRoot, 'src/agents/prompts/README.md'), 'utf8');

    expect(readme).toContain('SYSTEM.md convention is adopted');
    expect(readme).toContain('Background frontmatter is authoring DX');
    expect(readme).toContain('Unlisted directories are not spawnable');
  });
});
