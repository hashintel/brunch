import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { groundingFloorGaps } from '../../../graph/schema/elicitation-gap-fixtures.js';
import { projectBrunchAgentState } from '../../../projections/session/runtime-state.js';
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
  'mutate_graph',
];

describe('agent posture policy', () => {
  it('derives method manifests and active tool names from gap coverage', () => {
    const state = projectBrunchAgentState([]);
    const uncoveredGaps = groundingFloorGaps({ defaultCoverage: 0 });
    const coveredGaps = groundingFloorGaps();

    const floorMethods = manifestsForState(state, uncoveredGaps).methods.map((entry) => entry.name);
    const floorTools = activeToolNamesForPosture({ registeredToolNames, state, gaps: uncoveredGaps });
    const coveredMethods = manifestsForState(state, coveredGaps).methods.map((entry) => entry.name);
    const coveredTools = activeToolNamesForPosture({ registeredToolNames, state, gaps: coveredGaps });

    expect(floorMethods).toEqual(['run-structured-exchange', 'infer-and-capture', 'read-context']);
    expect(floorTools).not.toContain('mutate_graph');
    expect(floorTools).not.toContain('present_review_set');
    expect(floorTools).not.toContain('request_review');
    expect(floorTools).toContain('read_graph');
    expect(floorTools).toContain('read_session_context');
    expect(floorTools).not.toContain('bash');
    expect(floorTools).toEqual(
      expect.arrayContaining(['present_question', 'present_options', 'request_answer']),
    );

    expect(coveredMethods).toEqual([
      'run-structured-exchange',
      'infer-and-capture',
      'commit-graph',
      'read-context',
      'generate-proposal',
      'review-for-gaps',
    ]);
    expect(coveredTools).toContain('mutate_graph');
    expect(coveredTools).toEqual(expect.arrayContaining(['present_review_set', 'request_review']));
  });

  it('moves a gated method and its tools from absent to present when coverage rises', () => {
    const state = projectBrunchAgentState([]);
    const uncovered = groundingFloorGaps({ coverage: { context: 0 } });
    const covered = groundingFloorGaps({ coverage: { context: 0.5 } });

    expect(manifestsForState(state, uncovered).methods.map((entry) => entry.name)).not.toContain(
      'commit-graph',
    );
    expect(activeToolNamesForPosture({ registeredToolNames, state, gaps: uncovered })).not.toContain(
      'mutate_graph',
    );
    expect(manifestsForState(state, covered).methods.map((entry) => entry.name)).toContain('commit-graph');
    expect(activeToolNamesForPosture({ registeredToolNames, state, gaps: covered })).toContain(
      'mutate_graph',
    );
  });

  it('allows registered dev tool names only through the injected dev allow-list', () => {
    const state = projectBrunchAgentState([]);
    const gaps = groundingFloorGaps({ defaultCoverage: 0 });
    const productTools = activeToolNamesForPosture({
      registeredToolNames: [...registeredToolNames, 'brunch_session_query'],
      state,
      gaps,
    });
    const devTools = activeToolNamesForPosture({
      registeredToolNames: [...registeredToolNames, 'brunch_session_query'],
      state,
      gaps,
      devAllowedToolNames: ['brunch_session_query'],
    });

    expect(productTools).not.toContain('brunch_session_query');
    expect(devTools).toContain('brunch_session_query');
    expect(productTools).toEqual(activeToolNamesForPosture({ registeredToolNames, state, gaps }));
  });

  it('keeps blocked tools blocked and never advertises unregistered dev tool names', () => {
    const state = projectBrunchAgentState([]);
    const tools = activeToolNamesForPosture({
      registeredToolNames,
      state,
      gaps: groundingFloorGaps({ defaultCoverage: 0 }),
      devAllowedToolNames: ['bash', 'brunch_session_query'],
    });

    expect(tools).not.toContain('bash');
    expect(tools).not.toContain('brunch_session_query');
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

    expect(manifestsForState(autoState, groundingFloorGaps()).strategies.map((entry) => entry.name)).toEqual([
      'step-wise-decision-tree',
      'step-wise-disambiguate',
      'propose-graph',
      'project-graph',
    ]);
    expect(
      manifestsForState(pinnedFreestyle, groundingFloorGaps({ defaultCoverage: 0 })).strategies.map(
        (entry) => entry.name,
      ),
    ).toEqual(['freestyle']);
    expect(
      activeToolNamesForPosture({
        registeredToolNames,
        state: pinnedFreestyle,
        gaps: groundingFloorGaps(),
      }),
    ).toEqual(
      activeToolNamesForPosture({
        registeredToolNames,
        state: autoState,
        gaps: groundingFloorGaps(),
      }),
    );
  });

  it('keeps a pinned goal visible when capability-readiness negotiates, while gated methods stay absent', () => {
    const state = projectBrunchAgentState([
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
            agentStrategy: 'auto',
            agentLens: 'auto',
            agentGoal: 'commit-converge',
          },
        },
      },
    ]);

    const manifests = manifestsForState(state, groundingFloorGaps({ coverage: { thesis: 0 } }));

    expect(manifests.goals.map((entry) => entry.name)).toEqual(['commit-converge']);
    expect(manifests.methods.map((entry) => entry.name)).not.toContain('review-for-gaps');
  });

  it('fails loud on an empty gap register instead of returning empty manifests', () => {
    // Every spec is seeded with floor gaps at creation; an empty register reaching
    // manifest derivation is a wiring bug, never a legal quiet posture.
    const state = projectBrunchAgentState([]);
    expect(() => manifestsForState(state, [])).toThrow(/no elicitation gap/);
  });

  it('keeps state.ts free of grade-gate symbols', () => {
    const source = readFileSync(fileURLToPath(new URL('./state.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/ReadinessGrade|GRADE_RANK|MIN_GRADE|isGradeLegal/);
  });
});
