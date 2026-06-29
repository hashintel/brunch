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

    await expect(result.prompt).toMatchFileSnapshot('../__snapshots__/live-elicitor-prompt.md');
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
