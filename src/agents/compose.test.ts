import { access } from 'node:fs/promises';
import { dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DEFAULT_BRUNCH_AGENT_STATE, projectBrunchAgentState } from '../session/runtime-state.js';
import { composeAgentPrompt } from './compose.js';

const projectRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const groundingSpec = {
  id: 1,
  name: 'Grounding Spec',
  readinessGrade: 'grounding_onboarding' as const,
};

const elicitationSpec = {
  id: 1,
  name: 'Elicitation Spec',
  readinessGrade: 'elicitation_ready' as const,
};

const workspace = {
  cwd: '/work/brunch',
  posture: {
    certainty: 'proving',
    stakes: 'high',
    audience: 'internal',
    horizon: 'current-milestone',
    migration: 'free-rewrite',
    sourcing: 'strip-or-build',
  },
};

const snapshots = {
  contextHandles: ['graph-overview: compact selected-spec graph summary available via snapshot tools'],
};

describe('composeAgentPrompt', () => {
  it('emits control, runtime, context handles, and manifest families for default AUTO axes', () => {
    const result = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([]),
      spec: groundingSpec,
      workspace,
      snapshots,
      activeTools: ['read', 'grep', 'present_options'],
    });

    expect(result.prompt).toContain('[Brunch agent control]');
    expect(result.prompt).toContain('- agent: elicitor');
    expect(result.prompt).toContain('[Brunch runtime state]');
    expect(result.prompt).toContain('- spec: Grounding Spec (#1), readiness_grade=grounding_onboarding');
    expect(result.prompt).toContain(
      '- workspace posture: certainty=proving; stakes=high; audience=internal; horizon=current-milestone; migration=free-rewrite; sourcing=strip-or-build',
    );
    expect(result.prompt).toContain('[Brunch context handles]');
    expect(result.prompt).toContain('graph-overview: compact selected-spec graph summary');
    expect(result.prompt).toContain('<available_goals>');
    expect(result.prompt).toContain('<available_strategies>');
    expect(result.prompt).toContain('<available_lenses>');
    expect(result.prompt).toContain('<available_methods>');
    expect(result.prompt).toContain('name="grounding-advance"');
    expect(result.prompt).not.toContain('name="capture-posture"');
    expect(result.prompt).not.toContain('name="commit-converge"');
  });

  it('filters AUTO axes by grade and allow-list, while pinned legal axes point at only the pinned resource', () => {
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
    });

    expect(auto.manifests.goals.map((entry) => entry.name)).toEqual([
      'grounding-advance',
      'elicit-expand',
      'capture-posture',
    ]);
    expect(auto.manifests.strategies.map((entry) => entry.name)).toEqual([
      'step-wise-decision-tree',
      'step-wise-disambiguate',
      'propose-graph',
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
    });

    expect(pinned.manifests.goals.map((entry) => entry.name)).toEqual(['elicit-expand']);
    expect(pinned.manifests.strategies.map((entry) => entry.name)).toEqual(['step-wise-disambiguate']);
    expect(pinned.manifests.lenses.map((entry) => entry.name)).toEqual(['design']);
  });

  it('rejects illegal pinned grade-gated selections loudly', () => {
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
      }),
    ).toThrow(
      'Pinned goal "commit-converge" is not legal for elicitor in elicit at readiness grade grounding_onboarding.',
    );
  });

  it('advertises only readable src/agents resources without filesystem discovery', async () => {
    const result = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([]),
      spec: elicitationSpec,
      workspace,
      activeTools: ['read'],
    });

    for (const entry of Object.values(result.manifests).flat()) {
      expect(relative(projectRoot, entry.location).startsWith('src/agents/')).toBe(true);
      await expect(access(entry.location)).resolves.toBeUndefined();
    }
  });
});
