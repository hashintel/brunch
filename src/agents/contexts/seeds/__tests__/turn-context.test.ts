import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { ElicitationScratchpadItem } from '../../../../session/elicitation-scratchpad.js';
import * as turnContext from '../turn-context.js';
import { renderWorkspaceSeed } from '../turn-context.js';

const scratchpad: readonly ElicitationScratchpadItem[] = [
  { id: 'gap-1', obligation: 'confirm the audience', disposition: 'open' },
  { id: 'gap-2', obligation: 'confirm the constraint', disposition: 'resolved' },
];

describe('foreground context topology', () => {
  it('keeps only reusable seed renderers and no eager per-turn foreground path', () => {
    const promptAdapter = readFileSync(
      new URL('../../../../.pi/extensions/agent-runtime/system-prompts/index.ts', import.meta.url),
      'utf8',
    );
    const topology = [
      readFileSync(new URL('../../TOPOLOGY.md', import.meta.url), 'utf8'),
      readFileSync(new URL('../../../runtime/elicitor/TOPOLOGY.md', import.meta.url), 'utf8'),
      readFileSync(new URL('../../../../.pi/extensions/TOPOLOGY.md', import.meta.url), 'utf8'),
    ].join('\n');

    expect.soft(turnContext).not.toHaveProperty('composeAgentContextSeed');
    expect
      .soft(
        existsSync(
          new URL('../../../../.pi/extensions/agent-runtime/system-prompts/world-reads.ts', import.meta.url),
        ),
      )
      .toBe(false);
    expect.soft(promptAdapter).not.toContain('graphReads');
    expect.soft(topology).not.toMatch(/composeAgentContextSeed|world-reads\.ts|per-turn pushed context/u);
    expect(turnContext).toMatchObject({ renderWorkspaceSeed: expect.any(Function) });
    expect(turnContext).not.toHaveProperty('renderGraphSeed');
  });
});

describe('renderWorkspaceSeed', () => {
  it('renders selected-spec/session/posture facts without ambient resource discovery', async () => {
    const rendered = renderWorkspaceSeed({
      spec: { id: 42, name: 'Payments Spec' },
      workspace: {
        cwd: '/repo/product',
        posture: {
          certainty: 'proving',
          stakes: 'high',
          migration: 'free-rewrite',
        },
      },
      session: { id: 'session-7', label: 'Grounding' },
      scratchpad,
    });

    await expect(rendered).toMatchFileSnapshot('../__snapshots__/turn-context-workspace-seed.md');
    expect(rendered).not.toContain('readiness_grade=');
    expect(rendered).not.toContain('readiness estimate');
    expect(rendered).not.toContain('.pi/context');
  });
});
