import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const legacyContextPath = join(projectRoot, 'src/.pi/context');

const legacyImportNeedles = [
  ['src', '.pi', 'context'].join('/'),
  'compose' + '-brunch-prompt',
  ['context', 'prompt-packs'].join('/'),
  ['context', 'builders'].join('/'),
];

const agentDefinitionExpectations = [
  {
    system: 'src/.pi/agents/elicitor/SYSTEM.md',
    legacyFlat: 'src/.pi/agents/elicitor.md',
    needles: ['# Agent: elicitor', 'multi-spec discipline'],
  },
  {
    system: 'src/.pi/agents/orchestrator/SYSTEM.md',
    needles: ['# Agent: orchestrator', 'execute mode'],
  },
  {
    system: 'src/.pi/agents/reviewer/SYSTEM.md',
    legacyFlat: 'src/.pi/agents/reviewer.md',
    needles: ['name: reviewer', 'checking candidate'],
  },
  {
    system: 'src/.pi/agents/explorer/SYSTEM.md',
    needles: ['name: explorer', 'read-only reconnaissance agent'],
  },
  {
    system: 'src/.pi/agents/researcher/SYSTEM.md',
    needles: ['name: researcher', 'web-research agent'],
  },
  {
    system: 'src/.pi/agents/projector/SYSTEM.md',
    needles: ['name: projector', 'candidate-proposal'],
  },
  {
    system: 'src/.pi/agents/pi-coder/SYSTEM.md',
    needles: [
      'expert coding assistant operating inside *brunch*',
      'Show file paths clearly when working with files',
    ],
  },
];

const runtimeRegistryExpectations = [
  {
    file: 'src/session/schema/kinds.ts',
    required: "export const AGENT_ROLE_IDS = ['elicitor', 'orchestrator'] as const;",
    forbidden: ['reviewer', 'pi-coder'],
  },
  {
    file: 'src/projections/session/runtime-policy.ts',
    required:
      'export const FOREGROUND_AGENT_ROSTER: Record<OperationalModeId, OperationalModeDefinition> = {',
    // `reviewer` is a non-write background agent that legitimately appears in
    // elicit's code-owned `canDelegate` set (D92-L delegatable-set lives beside
    // the op_mode policy). Only `pi-coder` — an unwired planned foreground —
    // must stay out of the foreground registry here.
    forbidden: ['pi-coder'],
  },
];

const resourceExpectations = [
  {
    file: 'src/.pi/skills/methods/run-structured-exchange/SKILL.md',
    needles: ['details.schema', 'schema` plus `v', 'answered`, `cancelled`, or `unavailable`'],
  },
  {
    file: 'src/.pi/skills/methods/capture/SKILL.md',
    needles: ['single home', 'FE-861', 'Gap close/spawn responsibility belongs here'],
  },
  {
    file: 'src/.pi/skills/methods/generate-proposal/SKILL.md',
    needles: ['legibility_cost_of_knowing', 'core_bet', 'graph_refs', '`{ node_id: string }` only'],
  },
];

describe('agents topology', () => {
  it('keeps prompt guidance in .pi resources and removes the legacy .pi context source', async () => {
    await expect(readdir(legacyContextPath)).rejects.toThrow();

    for (const expectation of resourceExpectations) {
      const content = await readFile(join(projectRoot, expectation.file), 'utf8');
      for (const needle of expectation.needles) {
        expect(content).toContain(needle);
      }
    }
  });

  it('keeps agent body resources under <agent>/SYSTEM.md', async () => {
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

  it('keeps named future agent bodies out of the runtime registry', async () => {
    for (const expectation of runtimeRegistryExpectations) {
      const content = await readFile(join(projectRoot, expectation.file), 'utf8');
      expect(content).toContain(expectation.required);
      for (const needle of expectation.forbidden) {
        expect(content, `${expectation.file} must not register ${needle}`).not.toContain(needle);
      }
    }
  });

  it('keeps product source imports free of legacy .pi context prompt paths', async () => {
    const files = await listSourceFiles(join(projectRoot, 'src'));

    for (const file of files) {
      const rel = relative(projectRoot, file);
      if (rel.endsWith('.test.ts') || rel.includes('/__tests__/')) continue;
      const content = await readFile(file, 'utf8');
      for (const needle of legacyImportNeedles) {
        expect(content, `${rel} must not reference ${needle}`).not.toContain(needle);
      }
    }
  });
});

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(path)));
      continue;
    }
    if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) {
      files.push(path);
    }
  }

  return files;
}
