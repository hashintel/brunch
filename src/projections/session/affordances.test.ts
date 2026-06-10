import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { ElicitationGap } from '../../graph/schema/elicitation-gaps.js';
import type { NodeKind } from '../../graph/schema/nodes.js';
import { DEFAULT_BRUNCH_AGENT_STATE } from '../../session/runtime-state.js';
import { affordances } from './affordances.js';
import { axisOptionsForRuntimeState } from './runtime-policy.js';
import { resolveBrunchAgentState } from './runtime-state.js';

function resolved(overrides: Partial<typeof DEFAULT_BRUNCH_AGENT_STATE> = {}) {
  return resolveBrunchAgentState({ ...DEFAULT_BRUNCH_AGENT_STATE, ...overrides });
}

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

describe('runtime affordances derivation', () => {
  it('reports legal options and default-on-switch values for every posture axis', () => {
    expect(affordances(resolved(), groundingGaps())).toEqual({
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

  it('keeps floor options legal when relevant gaps have zero coverage', () => {
    const derived = affordances(resolved(), groundingGaps({ context: 0, thesis: 0, goal: 0, constraint: 0 }));

    expect(derived.goal.legalOptions).toEqual(['grounding-advance', 'capture-posture']);
    expect(derived.strategy.legalOptions).toEqual(['step-wise-decision-tree', 'step-wise-disambiguate']);
    expect(derived.lens.legalOptions).toEqual(['intent']);

    expect(
      affordances(resolved({ agentStrategy: 'freestyle' }), groundingGaps({ context: 0 })).strategy,
    ).toEqual({
      selection: 'freestyle',
      legalOptions: ['freestyle', 'step-wise-decision-tree', 'step-wise-disambiguate'],
      defaultOnSwitch: 'auto',
    });
  });

  it('excludes gated options until capability-relevant gaps are covered', () => {
    const uncovered = affordances(
      resolved(),
      groundingGaps({ context: 0, thesis: 0, goal: 0, constraint: 0 }),
    );

    expect(uncovered.goal.legalOptions).not.toContain('elicit-expand');
    expect(uncovered.goal.legalOptions).not.toContain('commit-converge');
    expect(uncovered.strategy.legalOptions).not.toContain('propose-graph');
    expect(uncovered.strategy.legalOptions).not.toContain('project-graph');
    expect(uncovered.lens.legalOptions).not.toContain('design');
    expect(uncovered.lens.legalOptions).not.toContain('oracle');
  });

  it('moves gated options from absent to present when gap coverage rises', () => {
    const uncovered = affordances(resolved(), groundingGaps({ context: 0 })).strategy.legalOptions;
    const covered = affordances(resolved(), groundingGaps({ context: 0.5 })).strategy.legalOptions;

    expect(uncovered).not.toContain('propose-graph');
    expect(covered).toContain('propose-graph');
  });

  it('excludes freestyle from AUTO strategy affordances but reports a pinned legal strategy', () => {
    expect(affordances(resolved(), groundingGaps()).strategy.legalOptions).not.toContain('freestyle');

    expect(affordances(resolved({ agentStrategy: 'freestyle' }), groundingGaps()).strategy).toEqual({
      selection: 'freestyle',
      legalOptions: [
        'freestyle',
        'step-wise-decision-tree',
        'step-wise-disambiguate',
        'propose-graph',
        'project-graph',
      ],
      defaultOnSwitch: 'auto',
    });
  });

  it('fails loud when a gated option requires a kind absent from the register (config bug, not uncovered)', () => {
    // A capability-relevant kind missing from the gap register is a seeding/config bug;
    // the affordance projection must surface it, not silently omit the option.
    const missingThesis = groundingGaps().filter((g) => g.refersTo !== 'thesis');
    expect(() => axisOptionsForRuntimeState('strategy', resolved(), missingThesis)).toThrow(
      /no elicitation gap for thesis/,
    );
  });

  it('derives per-axis legal options without grade-gate symbols', () => {
    expect(axisOptionsForRuntimeState('lens', resolved(), groundingGaps({ thesis: 0 }))).toEqual(['intent']);

    for (const fileName of ['affordances.ts', 'runtime-policy.ts']) {
      const sourcePath = fileURLToPath(new URL(`./${fileName}`, import.meta.url));
      const source = readFileSync(sourcePath, 'utf8');
      expect(source).not.toMatch(/ReadinessGrade|GRADE_RANK|MIN_GRADE/);
    }
  });
});
