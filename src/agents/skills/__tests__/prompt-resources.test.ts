import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))));

const resourceExpectations = [
  {
    file: 'src/agents/skills/methods/run-structured-exchange/SKILL.md',
    needles: ['details.schema', 'schema` plus `v', 'answered`, `cancelled`, or `unavailable`'],
  },
  {
    file: 'src/agents/skills/methods/capture/SKILL.md',
    needles: [
      'single home',
      'FE-861',
      'Gap close/spawn responsibility belongs here',
      'graph-authoring-heuristics.md',
    ],
  },
  {
    file: 'src/agents/skills/methods/commit-graph/SKILL.md',
    needles: ['graph-authoring-heuristics.md', 'role-named mutation grammar'],
  },
  {
    file: 'src/agents/contexts/references/graph-authoring-heuristics.md',
    needles: ['Graph authoring heuristics', 'graph-ontology.md', 'low-confidence', 'mutate_graph'],
  },
  {
    file: 'src/agents/skills/methods/generate-proposal/SKILL.md',
    needles: ['legibility_cost_of_knowing', 'core_bet', 'graph_refs', '`{ node_id: string }` only'],
  },
];

const generateProposalDisclosureExpectations = {
  skill: 'src/agents/skills/methods/generate-proposal/SKILL.md',
  references: [
    {
      file: 'src/agents/skills/methods/generate-proposal/references/intent.md',
      needles: ['intent plane', 'single pick', 'present_candidates'],
    },
    {
      file: 'src/agents/skills/methods/generate-proposal/references/design.md',
      needles: ['design plane', 'synthesize', 'present_review_set'],
    },
    {
      file: 'src/agents/skills/methods/generate-proposal/references/oracle.md',
      needles: ['oracle plane', 'compose', 'blind spots'],
    },
  ],
  probes: 'src/agents/skills/methods/generate-proposal/probes.md',
};

describe('prompt-resource skills', () => {
  it('keeps prompt-resource guidance in skill resources', async () => {
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

  it('records adopted prompt-skill topology and deferred prompt-skill triggers in the local README', async () => {
    const readme = await readFile(join(projectRoot, 'src/agents/skills/README.md'), 'utf8');

    expect(readme).toContain('Agent Skills-standard prompt resources');
    expect(readme).toContain('<name>/SKILL.md');
    expect(readme).toContain('references/` subfiles');
    expect(readme).toContain('progressive disclosure');
    expect(readme).toContain('Shared typed-vocab context references');
    expect(readme).toContain('src/agents/contexts/references/graph-ontology.md');
    expect(readme).toContain('edge-policy, detail-payload, and `detail.form` vocabulary');
    expect(readme).toContain('drift-checked');
    expect(readme).toContain('Shared authored context references');
    expect(readme).toContain('src/agents/contexts/references/graph-authoring-heuristics.md');
  });

  it('records the shared context-reference and backstage curation homes', async () => {
    const contextsReadme = await readFile(join(projectRoot, 'src/agents/contexts/README.md'), 'utf8');
    expect(contextsReadme).toContain('references/       runtime-eligible shared context references');
    expect(contextsReadme).toContain('references/graph-ontology.md');
    expect(contextsReadme).toContain('references/graph-authoring-heuristics.md');

    const docsReadme = await readFile(join(projectRoot, 'src/agents/docs/README.md'), 'utf8');
    expect(docsReadme).toContain('backstage notes for curating Brunch-authored agent resources');
    expect(docsReadme).toContain('not copied into packaged runtime assets');
  });
});
