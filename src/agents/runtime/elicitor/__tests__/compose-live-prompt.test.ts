import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BRUNCH_AGENT_STATE,
  projectBrunchAgentState,
} from '../../../../projections/session/runtime-state.js';
import { composeLiveElicitorPrompt } from '../compose-live-prompt.js';

const workspace = {
  cwd: '/work/brunch',
  posture: {
    certainty: 'proving',
    stakes: 'high',
    horizon: 'current-milestone',
  },
};

describe('composeLiveElicitorPrompt', () => {
  it('assembles the live elicitor prompt without old prompt-resource or gap controls', () => {
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

    expect(result.prompt).toContain('# Agent: elicitor\n\nFixed body.');
    expect(result.prompt).toContain('[Brunch live elicitor control]');
    expect(result.prompt).toContain('- operational mode: elicit');
    expect(result.prompt).toContain('- foreground role: elicitor');
    expect(result.prompt).toContain('- active tools: read, grep, present_question');
    expect(result.prompt).toContain('[Brunch live elicitor context]');
    expect(result.prompt).toContain('- selected spec: Live Assembly Spec (#42)');
    expect(result.prompt).toContain('- workspace: /work/brunch');
    expect(result.prompt).toContain('[Plain selected-spec context]');

    expect(result.prompt).not.toContain('<brunch-skills>');
    expect(result.prompt).not.toContain('[Brunch elicitation recommendation]');
    expect(result.prompt).not.toContain('[Brunch prompt-resource routing]');
    expect(result.prompt).not.toContain('readiness estimate');
    expect(result.prompt).not.toContain('prompt strategy resource');
    expect(result.prompt).not.toContain('prompt lens resource');
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
    ).toThrow(/requires elicit\/elicitor state/);
  });
});
