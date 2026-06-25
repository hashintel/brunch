import { readFile, readdir } from 'node:fs/promises';
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

const generateProposalDisclosureExpectations = {
  skill: 'src/.pi/skills/methods/generate-proposal/SKILL.md',
  references: [
    {
      file: 'src/.pi/skills/methods/generate-proposal/references/intent.md',
      needles: ['intent plane', 'single pick', 'present_candidates'],
    },
    {
      file: 'src/.pi/skills/methods/generate-proposal/references/design.md',
      needles: ['design plane', 'synthesize', 'present_review_set'],
    },
    {
      file: 'src/.pi/skills/methods/generate-proposal/references/oracle.md',
      needles: ['oracle plane', 'compose', 'blind spots'],
    },
  ],
  probes: 'src/.pi/skills/methods/generate-proposal/probes.md',
};

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

  it('keeps generate-proposal plane details behind explicit disclosed references', async () => {
    const skill = await readFile(join(projectRoot, generateProposalDisclosureExpectations.skill), 'utf8');
    expect(skill).toContain('references/intent.md');
    expect(skill).toContain('references/design.md');
    expect(skill).toContain('references/oracle.md');
    expect(skill).toContain('Do not write picked intent candidates to the graph');
    expect(skill).toContain('Cite existing ontology/render surfaces');

    for (const expectation of generateProposalDisclosureExpectations.references) {
      const content = await readFile(join(projectRoot, expectation.file), 'utf8');
      for (const needle of expectation.needles) {
        expect(content).toContain(needle);
      }
    }

    const probes = await readFile(join(projectRoot, generateProposalDisclosureExpectations.probes), 'utf8');
    expect(probes).toContain('Model: GPT-5.5   Last run: 2026-06-24');
    expect(probes).toContain('intent-pick');
    expect(probes).toContain('design-synthesize');
    expect(probes).toContain('oracle-compose');
    expect(probes).toContain('should NOT fire');
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
