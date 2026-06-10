import { access, readFile } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { ElicitationGap } from '../../graph/schema/elicitation-gaps.js';
import type { NodeKind } from '../../graph/schema/nodes.js';
import {
  DEFAULT_BRUNCH_AGENT_STATE,
  projectBrunchAgentState,
} from '../../projections/session/runtime-state.js';
import type { WorkspacePostureState } from '../../session/workspace-session-coordinator.js';
import { composeAgentPrompt } from './compose.js';
import { GOAL_RESOURCES, LENS_RESOURCES, METHOD_RESOURCES, STRATEGY_RESOURCES } from './state.js';

const projectRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

const groundingSpec = {
  id: 1,
  name: 'Grounding Spec',
};

const elicitationSpec = {
  id: 1,
  name: 'Elicitation Spec',
};

const workspace = {
  cwd: '/work/brunch',
  posture: workspacePosture({
    certainty: 'proving',
    stakes: 'high',
    audience: 'internal',
    horizon: 'current-milestone',
    migration: 'free-rewrite',
    sourcing: 'strip-or-build',
  }),
};

function workspacePosture(posture: WorkspacePostureState): WorkspacePostureState {
  return posture;
}

function gap(refersTo: NodeKind, coverage = 1): ElicitationGap {
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

const coveredGaps = ['context', 'thesis', 'goal', 'constraint'].map((kind) => gap(kind as NodeKind));
const zeroCoverageGaps = coveredGaps.map((record) => ({
  ...record,
  coverage: 0,
  answered: false,
  disposition: 'open' as const,
}));

const context = {
  contextHandles: ['graph-overview: compact selected-spec graph summary available via read tools'],
  renderedContexts: [
    '[Selected-spec graph context · intent lens]\n- selected-spec lsn: 7; nodes: 1; edges: 0',
  ],
};

describe('composeAgentPrompt', () => {
  it('emits control, runtime, context handles, and manifest families for default AUTO axes', () => {
    const result = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([]),
      spec: groundingSpec,
      workspace,
      context,
      activeTools: ['read', 'grep', 'present_options'],
      gaps: zeroCoverageGaps,
    });

    expect(result.prompt).toContain('[Brunch agent control]');
    expect(result.prompt).toContain('- agent: elicitor');
    expect(result.prompt).toContain('[Brunch runtime state]');
    expect(result.prompt).toContain(
      '- spec: Grounding Spec (#1), readiness estimate (soft; gates nothing): grounding=0.00, elicitation=0.00, commitment=0.00',
    );
    expect(result.prompt).not.toContain('readiness_grade=');
    expect(result.prompt).toContain(
      '- workspace posture: certainty=proving; stakes=high; audience=internal; horizon=current-milestone; migration=free-rewrite; sourcing=strip-or-build',
    );
    expect(result.prompt).toContain('[Brunch pushed context]');
    expect(result.prompt).toContain('handle: graph-overview: compact selected-spec graph summary');
    expect(result.prompt).toContain('[Selected-spec graph context · intent lens]');
    expect(result.prompt).toContain('<available_goals>');
    expect(result.prompt).toContain('<available_strategies>');
    expect(result.prompt).toContain('<available_lenses>');
    expect(result.prompt).toContain('<available_methods>');
    expect(result.prompt).toContain('name="grounding-advance"');
    expect(result.prompt).not.toContain('name="capture-posture"');
    expect(result.prompt).not.toContain('name="commit-converge"');
  });

  it('surfaces rendered context text and preserves manifest legality when lens changes', () => {
    const intent = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([
        {
          type: 'custom',
          customType: 'brunch.agent_runtime_state',
          data: {
            schemaVersion: 1,
            reason: 'switch',
            source: 'user',
            state: {
              ...DEFAULT_BRUNCH_AGENT_STATE,
              agentLens: 'intent',
            },
          },
        },
      ]),
      spec: elicitationSpec,
      workspace,
      context: {
        renderedContexts: ['[Selected-spec graph context · intent lens]\n- emphasis: intent claims'],
      },
      activeTools: ['read'],
      gaps: coveredGaps,
    });
    const design = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([
        {
          type: 'custom',
          customType: 'brunch.agent_runtime_state',
          data: {
            schemaVersion: 1,
            reason: 'switch',
            source: 'user',
            state: {
              ...DEFAULT_BRUNCH_AGENT_STATE,
              agentLens: 'design',
            },
          },
        },
      ]),
      spec: elicitationSpec,
      workspace,
      context: {
        renderedContexts: ['[Selected-spec graph context · design lens]\n- emphasis: design modules'],
      },
      activeTools: ['read'],
      gaps: coveredGaps,
    });

    expect(intent.prompt).toContain('[Selected-spec graph context · intent lens]');
    expect(design.prompt).toContain('[Selected-spec graph context · design lens]');
    expect(intent.manifests.methods.map((entry) => entry.name)).toEqual(
      design.manifests.methods.map((entry) => entry.name),
    );
    expect(intent.manifests.lenses.map((entry) => entry.name)).toEqual(['intent']);
    expect(design.manifests.lenses.map((entry) => entry.name)).toEqual(['design']);
  });

  it('filters AUTO axes by gap coverage and allow-list, while pinned legal axes point at only the pinned resource', () => {
    const auto = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([
        {
          type: 'custom',
          customType: 'brunch.agent_runtime_state',
          data: {
            schemaVersion: 1,
            reason: 'switch',
            source: 'user',
            state: {
              ...DEFAULT_BRUNCH_AGENT_STATE,
              agentGoal: 'auto',
            },
          },
        },
      ]),
      spec: elicitationSpec,
      workspace,
      activeTools: ['read'],
      gaps: coveredGaps,
    });

    expect(auto.manifests.goals.map((entry) => entry.name)).toEqual([
      'grounding-advance',
      'elicit-expand',
      'commit-converge',
      'capture-posture',
    ]);
    expect(auto.manifests.strategies.map((entry) => entry.name)).toEqual([
      'step-wise-decision-tree',
      'step-wise-disambiguate',
      'propose-graph',
      'project-graph',
    ]);
    expect(auto.manifests.lenses.map((entry) => entry.name)).toEqual(['intent', 'design', 'oracle']);

    const pinned = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([
        {
          type: 'custom',
          customType: 'brunch.agent_runtime_state',
          data: {
            schemaVersion: 1,
            reason: 'switch',
            source: 'user',
            state: {
              ...DEFAULT_BRUNCH_AGENT_STATE,
              agentStrategy: 'step-wise-disambiguate',
              agentLens: 'design',
              agentGoal: 'elicit-expand',
            },
          },
        },
      ]),
      spec: elicitationSpec,
      workspace,
      activeTools: ['read'],
      gaps: coveredGaps,
    });

    expect(pinned.manifests.goals.map((entry) => entry.name)).toEqual(['elicit-expand']);
    expect(pinned.manifests.strategies.map((entry) => entry.name)).toEqual(['step-wise-disambiguate']);
    expect(pinned.manifests.lenses.map((entry) => entry.name)).toEqual(['design']);

    const pinnedFreestyle = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([
        {
          type: 'custom',
          customType: 'brunch.agent_runtime_state',
          data: {
            schemaVersion: 1,
            reason: 'switch',
            source: 'user',
            state: {
              ...DEFAULT_BRUNCH_AGENT_STATE,
              agentStrategy: 'freestyle',
            },
          },
        },
      ]),
      spec: groundingSpec,
      workspace,
      activeTools: ['read'],
      gaps: zeroCoverageGaps,
    });

    expect(pinnedFreestyle.manifests.strategies.map((entry) => entry.name)).toEqual(['freestyle']);
    expect(auto.prompt).toContain(
      '- spec: Elicitation Spec (#1), readiness estimate (soft; gates nothing): grounding=1.00, elicitation=0.00, commitment=0.00',
    );
    expect(auto.prompt).not.toContain('readiness_grade=');
    expect(auto.prompt).not.toContain('name="freestyle"');
    expect(pinnedFreestyle.prompt).toContain('name="freestyle"');
  });

  it('rejects illegal pinned gap-gated selections loudly', () => {
    expect(() =>
      composeAgentPrompt({
        agentId: 'elicitor',
        sessionState: projectBrunchAgentState([
          {
            type: 'custom',
            customType: 'brunch.agent_runtime_state',
            data: {
              schemaVersion: 1,
              reason: 'switch',
              source: 'user',
              state: {
                ...DEFAULT_BRUNCH_AGENT_STATE,
                agentGoal: 'commit-converge',
              },
            },
          },
        ]),
        spec: groundingSpec,
        workspace,
        activeTools: ['read'],
        gaps: zeroCoverageGaps,
      }),
    ).toThrow(
      'Pinned goal "commit-converge" is not legal for elicitor in elicit; capability-readiness returned negotiate for current elicitation gaps.',
    );
  });

  it('advertises only readable .pi prompt resources without filesystem discovery', async () => {
    const result = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([]),
      spec: elicitationSpec,
      workspace,
      activeTools: ['read'],
      gaps: coveredGaps,
    });

    for (const entry of Object.values(result.manifests).flat()) {
      expect(relative(projectRoot, entry.location).startsWith('src/.pi/')).toBe(true);
      await expect(access(entry.location)).resolves.toBeUndefined();
    }
  });

  it('keeps every manifest prompt resource readable and non-trivial', async () => {
    const entries = [
      ...Object.values(GOAL_RESOURCES),
      ...Object.values(STRATEGY_RESOURCES),
      ...Object.values(LENS_RESOURCES),
      ...Object.values(METHOD_RESOURCES),
    ];

    for (const entry of entries) {
      expect(relative(projectRoot, entry.location).startsWith('src/.pi/skills/')).toBe(true);
      const body = await readFile(entry.location, 'utf8');
      expect(
        body.length,
        `${entry.name} should carry prompt-resource guidance beyond a placeholder`,
      ).toBeGreaterThanOrEqual(700);
    }
  });
});
