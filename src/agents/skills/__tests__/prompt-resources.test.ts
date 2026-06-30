import { access, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseFrontmatter } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { LENS_RESOURCES, METHOD_RESOURCES, STRATEGY_RESOURCES } from '../../runtime/state.js';

const projectRoot = dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))));

const generateProposalDisclosureExpectations = {
  skill: 'src/agents/skills/methods/generate-proposal/SKILL.md',
  references: [
    'src/agents/skills/methods/generate-proposal/references/intent.md',
    'src/agents/skills/methods/generate-proposal/references/design.md',
    'src/agents/skills/methods/generate-proposal/references/oracle.md',
  ],
};

const executeMethodToolExpectations = {
  'scope-execution-task': [
    'execute_status',
    'execute_snapshot',
    'execute_plan_check',
    'execute_plan_draft',
    'execute_plan_outline',
    'execute_plan_outline_artifact',
  ],
  'build-with-tests': [
    'execute_status',
    'execute_snapshot',
    'execute_plan_check',
    'execute_plan_draft',
    'execute_plan_outline',
    'execute_plan_outline_artifact',
  ],
} as const;

describe('prompt-resource skills', () => {
  it('keeps every code-owned prompt resource readable and substantial', async () => {
    const entries = [
      ...Object.values(STRATEGY_RESOURCES),
      ...Object.values(LENS_RESOURCES),
      ...Object.values(METHOD_RESOURCES),
    ];

    for (const entry of entries) {
      expect(relative(projectRoot, entry.location).startsWith('src/agents/skills/')).toBe(true);
      expect(entry.location.endsWith(`/${entry.name}/SKILL.md`)).toBe(true);
      await expect(access(entry.location)).resolves.toBeUndefined();

      const raw = await readFile(entry.location, 'utf8');
      const { frontmatter, body } = parseFrontmatter(raw);
      expect(frontmatter).toMatchObject({ name: entry.name, description: entry.description });
      expect(
        body.length,
        `${entry.name} should carry prompt-resource guidance beyond a placeholder`,
      ).toBeGreaterThanOrEqual(700);
    }
  });

  it('keeps generate-proposal progressive-disclosure references reachable from the owning skill', async () => {
    const skill = await readFile(join(projectRoot, generateProposalDisclosureExpectations.skill), 'utf8');

    for (const reference of generateProposalDisclosureExpectations.references) {
      await expect(access(join(projectRoot, reference))).resolves.toBeUndefined();
      expect(skill).toContain(
        relative(
          dirname(join(projectRoot, generateProposalDisclosureExpectations.skill)),
          join(projectRoot, reference),
        ),
      );
    }
  });

  it('routes execute-mode methods through code-owned execute foothold tools', async () => {
    for (const [method, toolNames] of Object.entries(executeMethodToolExpectations)) {
      const body = await readFile(join(projectRoot, 'src/agents/skills/methods', method, 'SKILL.md'), 'utf8');
      for (const toolName of toolNames) {
        expect(body).toContain(toolName);
      }
    }
  });
});
