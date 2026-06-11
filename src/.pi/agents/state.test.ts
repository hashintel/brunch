import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { ElicitationGap } from '../../graph/schema/elicitation-gaps.js';
import type { NodeKind } from '../../graph/schema/nodes.js';
import { projectBrunchAgentState } from '../../projections/session/runtime-state.js';
import { activeToolNamesForPosture, manifestsForState } from './state.js';

function gap(refersTo: NodeKind, coverage: number): ElicitationGap {
  return {
    id: `${refersTo}:gap`,
    specId: 1,
    refersTo,
    question: `${refersTo} question`,
    rationale: `${refersTo} rationale`,
    basis: 'implicit',
    band: 'grounding',
    predicate: { kind: 'presence', minimum: 1, nodeKind: refersTo },
    importance: 1,
    coverage,
    answered: coverage >= 1,
    disposition: coverage >= 1 ? 'answered' : 'open',
    createdAtLsn: 1,
  };
}

function groundingGaps(coverage: Partial<Record<NodeKind, number>> = {}): ElicitationGap[] {
  return ['context', 'thesis', 'goal', 'constraint'].map((kind) =>
    gap(kind as NodeKind, coverage[kind as NodeKind] ?? 1),
  );
}

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
    const uncoveredGaps = groundingGaps({ context: 0, thesis: 0, goal: 0, constraint: 0 });
    const coveredGaps = groundingGaps();

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
    const uncovered = groundingGaps({ context: 0 });
    const covered = groundingGaps({ context: 0.5 });

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
    const gaps = groundingGaps({ context: 0, thesis: 0, goal: 0, constraint: 0 });
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
      gaps: groundingGaps({ context: 0, thesis: 0, goal: 0, constraint: 0 }),
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

    expect(manifestsForState(autoState, groundingGaps()).strategies.map((entry) => entry.name)).toEqual([
      'step-wise-decision-tree',
      'step-wise-disambiguate',
      'propose-graph',
      'project-graph',
    ]);
    expect(
      manifestsForState(
        pinnedFreestyle,
        groundingGaps({ context: 0, thesis: 0, goal: 0, constraint: 0 }),
      ).strategies.map((entry) => entry.name),
    ).toEqual(['freestyle']);
    expect(
      activeToolNamesForPosture({
        registeredToolNames,
        state: pinnedFreestyle,
        gaps: groundingGaps(),
      }),
    ).toEqual(
      activeToolNamesForPosture({
        registeredToolNames,
        state: autoState,
        gaps: groundingGaps(),
      }),
    );
  });

  it('throws on an illegal pinned axis with a negotiate outcome message, not a grade', () => {
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

    expect(() => manifestsForState(state, groundingGaps({ thesis: 0 }))).toThrow(
      'Pinned goal "commit-converge" is not legal for elicitor in elicit; capability-readiness returned negotiate for current elicitation gaps.',
    );
  });

  it('keeps state.ts free of grade-gate symbols', () => {
    const source = readFileSync(fileURLToPath(new URL('./state.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/ReadinessGrade|GRADE_RANK|MIN_GRADE|isGradeLegal/);
  });
});
