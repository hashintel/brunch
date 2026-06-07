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
});
