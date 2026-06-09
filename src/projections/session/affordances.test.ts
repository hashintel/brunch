import { describe, expect, it } from 'vitest';

import { DEFAULT_BRUNCH_AGENT_STATE } from '../../session/runtime-state.js';
import { affordances } from './affordances.js';
import { resolveBrunchAgentState } from './runtime-state.js';

function resolved(overrides: Partial<typeof DEFAULT_BRUNCH_AGENT_STATE> = {}) {
  return resolveBrunchAgentState({ ...DEFAULT_BRUNCH_AGENT_STATE, ...overrides });
}

describe('runtime affordances derivation', () => {
  it('reports legal options and default-on-switch values for every posture axis', () => {
    expect(affordances(resolved(), 'commitments_ready')).toEqual({
      goal: {
        selection: 'grounding-advance',
        legalOptions: ['grounding-advance', 'elicit-expand', 'commit-converge', 'capture-posture'],
        defaultOnSwitch: 'grounding-advance',
      },
      strategy: {
        selection: 'auto',
        legalOptions: ['step-wise-decision-tree', 'step-wise-disambiguate', 'propose-graph', 'project-graph'],
        defaultOnSwitch: 'auto',
      },
      lens: {
        selection: 'auto',
        legalOptions: ['intent', 'design', 'oracle'],
        defaultOnSwitch: 'auto',
      },
    });
  });

  it('excludes freestyle from AUTO strategy affordances but reports a pinned legal strategy', () => {
    expect(affordances(resolved(), 'planning_ready').strategy.legalOptions).not.toContain('freestyle');

    expect(affordances(resolved({ agentStrategy: 'freestyle' }), 'grounding_onboarding').strategy).toEqual({
      selection: 'freestyle',
      legalOptions: ['freestyle', 'step-wise-decision-tree', 'step-wise-disambiguate'],
      defaultOnSwitch: 'auto',
    });
  });

  it('uses readiness grade as a load-bearing legality input', () => {
    const grounding = affordances(resolved(), 'grounding_onboarding');
    const elicitation = affordances(resolved(), 'elicitation_ready');
    const commitments = affordances(resolved(), 'commitments_ready');

    expect(grounding.goal.legalOptions).toEqual(['grounding-advance', 'capture-posture']);
    expect(grounding.strategy.legalOptions).toEqual(['step-wise-decision-tree', 'step-wise-disambiguate']);
    expect(grounding.lens.legalOptions).toEqual(['intent']);

    expect(elicitation.goal.legalOptions).toContain('elicit-expand');
    expect(elicitation.strategy.legalOptions).toContain('propose-graph');
    expect(elicitation.lens.legalOptions).toEqual(['intent', 'design', 'oracle']);

    expect(commitments.goal.legalOptions).toContain('commit-converge');
    expect(commitments.strategy.legalOptions).toContain('project-graph');
  });
});
