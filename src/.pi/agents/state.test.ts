import { describe, expect, it } from 'vitest';

import { projectBrunchAgentState } from '../../projections/session/runtime-state.js';
import { activeToolNamesForPosture, manifestsForState } from './state.js';

const registeredToolNames = [
  'read',
  'grep',
  'find',
  'ls',
  'bash',
  'edit',
  'write',
  'present_question',
  'present_options',
  'request_answer',
  'request_choice',
  'request_choices',
  'present_review_set',
  'request_review',
  'read_graph',
  'read_session_context',
  'commit_graph',
];

describe('agent posture policy', () => {
  it('derives method manifests and active tool names from one grade policy', () => {
    const state = projectBrunchAgentState([]);

    const groundingMethods = manifestsForState(state, 'grounding_onboarding').methods.map(
      (entry) => entry.name,
    );
    const groundingTools = activeToolNamesForPosture({
      registeredToolNames,
      state,
      readinessGrade: 'grounding_onboarding',
    });
    const elicitationMethods = manifestsForState(state, 'elicitation_ready').methods.map(
      (entry) => entry.name,
    );
    const elicitationTools = activeToolNamesForPosture({
      registeredToolNames,
      state,
      readinessGrade: 'elicitation_ready',
    });
    const commitmentsMethods = manifestsForState(state, 'commitments_ready').methods.map(
      (entry) => entry.name,
    );
    const commitmentsTools = activeToolNamesForPosture({
      registeredToolNames,
      state,
      readinessGrade: 'commitments_ready',
    });

    expect(groundingMethods).not.toContain('commit-graph');
    expect(groundingTools).not.toContain('commit_graph');
    expect(groundingTools).toContain('read_graph');
    expect(groundingTools).toContain('read_session_context');
    expect(groundingTools).not.toContain('bash');
    expect(groundingTools).toEqual(
      expect.arrayContaining(['present_question', 'present_options', 'request_answer']),
    );

    expect(elicitationMethods).toContain('commit-graph');
    expect(elicitationTools).toContain('commit_graph');
    expect(commitmentsMethods).toContain('generate-proposal');
    expect(commitmentsTools).toContain('commit_graph');
    expect(commitmentsTools).toEqual(expect.arrayContaining(['present_review_set', 'request_review']));
    expect(elicitationTools).not.toContain('present_review_set');
  });

  it('keeps freestyle pin-only while leaving elicit tool authority unchanged', () => {
    const autoState = projectBrunchAgentState([]);
    const pinnedFreestyle = projectBrunchAgentState([
      {
        type: 'custom',
        customType: 'brunch.agent_runtime_state',
        data: {
          schemaVersion: 1,
          reason: 'switch',
          source: 'user',
          state: {
            schemaVersion: 1,
            operationalMode: 'elicit',
            agentStrategy: 'freestyle',
            agentLens: 'auto',
            agentGoal: 'grounding-advance',
          },
        },
      },
    ]);

    expect(manifestsForState(autoState, 'elicitation_ready').strategies.map((entry) => entry.name)).toEqual([
      'step-wise-decision-tree',
      'step-wise-disambiguate',
      'propose-graph',
    ]);
    expect(
      manifestsForState(pinnedFreestyle, 'grounding_onboarding').strategies.map((entry) => entry.name),
    ).toEqual(['freestyle']);
    expect(
      activeToolNamesForPosture({
        registeredToolNames,
        state: pinnedFreestyle,
        readinessGrade: 'elicitation_ready',
      }),
    ).toEqual(
      activeToolNamesForPosture({
        registeredToolNames,
        state: autoState,
        readinessGrade: 'elicitation_ready',
      }),
    );
  });
});
