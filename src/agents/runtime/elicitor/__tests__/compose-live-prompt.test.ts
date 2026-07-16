import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PROJECT_EXECUTION_HARNESS_TITLE } from '../../../../graph/schema/nodes.js';
import {
  DEFAULT_BRUNCH_AGENT_STATE,
  projectBrunchAgentState,
} from '../../../../projections/session/runtime-state.js';
import { composeLiveElicitorPrompt } from '../compose-live-prompt.js';

// Manifest skill locations are absolute paths (see src/agents/skills/registry.ts); normalize the
// machine root before snapshotting so the committed golden carries no workstation-specific path.
const packageRoot = fileURLToPath(new URL('../../../../..', import.meta.url)).replace(/\/$/u, '');

const workspace = {
  cwd: '/work/brunch',
  posture: {
    certainty: 'proving',
    stakes: 'high',
    horizon: 'current-milestone',
  },
};

describe('composeLiveElicitorPrompt', () => {
  it('assembles the live elicitor prompt without old prompt-resource or gap controls', async () => {
    const result = composeLiveElicitorPrompt({
      sessionState: projectBrunchAgentState([]),
      spec: { id: 42, name: 'Live Assembly Spec' },
      workspace,
      context: {
        contextHandles: ['selected-spec: plain summary available through read tools'],
        renderedContexts: ['[Plain selected-spec context]\n- goal: Keep the live path legible.'],
      },
      activeTools: ['read', 'grep', 'present_question'],
      agentBody: '# Agent: elicitor\n\nFixed body.',
    });

    const normalizedPrompt = result.prompt.replaceAll(packageRoot, '<PKG>');

    await expect(normalizedPrompt).toMatchFileSnapshot('../__snapshots__/live-elicitor-prompt.md');
  });

  it('includes the bundled elicitor style and choice-shape guidance', () => {
    const result = composeLiveElicitorPrompt({
      sessionState: projectBrunchAgentState([]),
      spec: { id: 42, name: 'Live Assembly Spec' },
      workspace,
      activeTools: ['present_question', 'request_response'],
    });

    expect(result.prompt).toContain('Be clear and concise');
    expect(result.prompt).toContain('Prefer structural forms');
    expect(result.prompt).toContain('Use multi-select when options are not mutually exclusive');
  });

  it('keeps scratchpad obligations private in ordinary user-facing prose', () => {
    const result = composeLiveElicitorPrompt({
      sessionState: projectBrunchAgentState([]),
      spec: { id: 42, name: 'Live Assembly Spec' },
      workspace,
    });

    expect(result.prompt).toContain('private working state');
    expect(result.prompt).toContain('Do not routinely enumerate');
    expect(result.prompt).toContain('unless the user explicitly asks');
  });

  it('carries ingest and map routing resources in the active foreground manifest', () => {
    const result = composeLiveElicitorPrompt({
      sessionState: projectBrunchAgentState([]),
      spec: { id: 42, name: 'Live Assembly Spec' },
      workspace,
    });
    const ingestLocation = result.prompt.match(
      /<skill>\s*<name>ingest<\/name>[\s\S]*?<location>([^<]+)<\/location>/,
    )?.[1];

    expect(ingestLocation).toBeDefined();
    expect(ingestLocation).toMatch(/agents\/skills\/ingest\/SKILL\.md$/);
    const ingestBody = readFileSync(ingestLocation!, 'utf8');
    expect(ingestBody).toContain('../map/references/routing.md');
    expect(ingestBody).toContain(
      'Default after digest approval: map the accepted_abstract directly into advisory graph mutations',
    );
    expect(ingestBody).toContain('multi-pass extraction: entities, relations, then narrative obligations');
  });

  it('teaches scope as the durable handoff from specification to build', () => {
    const result = composeLiveElicitorPrompt({
      sessionState: projectBrunchAgentState([]),
      spec: { id: 42, name: 'Live Assembly Spec' },
      workspace,
    });

    expect(result.prompt).toContain('intent -> design -> verification -> scope -> build');
    expect(result.prompt).toContain('`scope` is the durable handoff package to build');
    expect(result.prompt).toContain('present a plan-lens review set');
    expect(result.prompt).toContain('places the handoff under an owning frontier');
    expect(result.prompt).toContain(
      'default to drafting both the owning frontier and the scope unless an accepted frontier already exists',
    );
    expect(result.prompt).toContain(
      'Keep each handoff package under exactly one frontier unless an accepted phase threshold truly requires more plan structure',
    );
    expect(result.prompt).toContain(
      'requirement `-[realization]->` scope; scope `-[composition]->` design unit; criterion/check `-[dependency]->` scope',
    );
    expect(result.prompt).toContain(
      'requirements, acceptance criteria, design anchors, and verification machinery',
    );
    expect(result.prompt).toContain(
      'The frontier contains the scope; the scope should not contain a frontier, and design/check anchors should stay on the scope when there is only one handoff package',
    );
    expect(result.prompt).toContain('For a single execution-facing handoff package');
  });

  it('requires an author-approved execution harness before an execution-facing scope', () => {
    const result = composeLiveElicitorPrompt({
      sessionState: projectBrunchAgentState([]),
      spec: { id: 42, name: 'Live Assembly Spec' },
      workspace,
      agentBody: '# Agent: elicitor\n\nFixed body without execution policy.',
    });

    expect(result.prompt).toContain(
      `settled \`oracle/vv_method\` named \`${PROJECT_EXECUTION_HARNESS_TITLE}\``,
    );
    expect(result.prompt).toContain('What command should Brunch run to verify the implementation?');
    expect(result.prompt).toContain('`execute.verify: <command>`');
    expect(result.prompt).toContain('the user must approve the recipe');
    expect(result.prompt).toContain('Reject shell composition');
  });

  it('fails loud when called for a non-elicitor foreground state', () => {
    const sessionState = projectBrunchAgentState([
      {
        type: 'custom',
        customType: 'brunch.agent_runtime_state',
        data: {
          schemaVersion: 1,
          reason: 'switch',
          source: 'user',
          state: {
            ...DEFAULT_BRUNCH_AGENT_STATE,
            operationalMode: 'execute',
          },
        },
      },
    ]);

    expect(() =>
      composeLiveElicitorPrompt({
        sessionState,
        spec: { id: 42, name: 'Live Assembly Spec' },
        workspace,
      }),
    ).toThrow(/requires specify\/elicitor state/);
  });
});
