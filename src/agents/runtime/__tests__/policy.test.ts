import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { groundingFloorGaps } from '../../../graph/schema/elicitation-gap-fixtures.js';
import { resolveBrunchAgentState } from '../../../projections/session/runtime-state.js';
import { DEFAULT_BRUNCH_AGENT_STATE } from '../../../session/runtime-state.js';
import {
  axisOptionsForRuntimeState,
  defaultLensForRuntimeState,
  defaultStrategyForRuntimeState,
  pinnableAxisOptionsForRuntimeState,
} from '../policy.js';

function resolved(overrides: Partial<typeof DEFAULT_BRUNCH_AGENT_STATE> = {}) {
  return resolveBrunchAgentState({ ...DEFAULT_BRUNCH_AGENT_STATE, ...overrides });
}

describe('agent runtime policy posture affordances', () => {
  it('reports legal options and default-on-switch values for runtime posture axes', () => {
    const state = resolved();

    expect({
      strategy: {
        legalOptions: axisOptionsForRuntimeState('strategy', state, groundingFloorGaps()),
        defaultOnSwitch: defaultStrategyForRuntimeState(state),
      },
      lens: {
        legalOptions: axisOptionsForRuntimeState('lens', state, groundingFloorGaps()),
        defaultOnSwitch: defaultLensForRuntimeState(state),
      },
    }).toEqual({
      strategy: {
        legalOptions: ['step-wise-decision-tree', 'step-wise-disambiguate'],
        defaultOnSwitch: 'auto',
      },
      lens: {
        legalOptions: ['intent', 'design', 'oracle'],
        defaultOnSwitch: 'auto',
      },
    });
  });

  it('keeps floor options legal when relevant gaps have zero coverage', () => {
    const gaps = groundingFloorGaps({ defaultCoverage: 0 });

    expect(axisOptionsForRuntimeState('strategy', resolved(), gaps)).toEqual([
      'step-wise-decision-tree',
      'step-wise-disambiguate',
    ]);
    expect(axisOptionsForRuntimeState('lens', resolved(), gaps)).toEqual(['intent']);
    expect(axisOptionsForRuntimeState('strategy', resolved({ agentStrategy: 'freestyle' }), gaps)).toEqual([
      'freestyle',
      'step-wise-decision-tree',
      'step-wise-disambiguate',
    ]);
  });

  it('keeps strategy options capability-independent while gating generative lenses', () => {
    const uncovered = groundingFloorGaps({ defaultCoverage: 0 });
    const covered = groundingFloorGaps();

    expect(axisOptionsForRuntimeState('strategy', resolved(), uncovered)).toEqual([
      'step-wise-decision-tree',
      'step-wise-disambiguate',
    ]);
    expect(axisOptionsForRuntimeState('strategy', resolved(), covered)).toEqual([
      'step-wise-decision-tree',
      'step-wise-disambiguate',
    ]);
    expect(axisOptionsForRuntimeState('lens', resolved(), uncovered)).not.toContain('design');
    expect(axisOptionsForRuntimeState('lens', resolved(), uncovered)).not.toContain('oracle');
  });

  it('keeps freestyle on the user-pin surface even while the AUTO manifest excludes it', () => {
    expect(axisOptionsForRuntimeState('strategy', resolved(), groundingFloorGaps())).not.toContain(
      'freestyle',
    );
    expect(pinnableAxisOptionsForRuntimeState('strategy', resolved(), groundingFloorGaps())).toContain(
      'freestyle',
    );
  });

  it('gates the pin surface by capability readiness while keeping floor options pinnable', () => {
    const uncovered = groundingFloorGaps({ defaultCoverage: 0 });

    expect(pinnableAxisOptionsForRuntimeState('strategy', resolved(), uncovered)).toEqual([
      'freestyle',
      'step-wise-decision-tree',
      'step-wise-disambiguate',
    ]);
    expect(pinnableAxisOptionsForRuntimeState('lens', resolved(), uncovered)).toEqual(['intent']);
    expect(pinnableAxisOptionsForRuntimeState('lens', resolved(), groundingFloorGaps())).toEqual([
      'intent',
      'design',
      'oracle',
    ]);
  });

  it('excludes freestyle from AUTO strategy affordances but reports a pinned legal strategy', () => {
    expect(axisOptionsForRuntimeState('strategy', resolved(), groundingFloorGaps())).not.toContain(
      'freestyle',
    );
    expect(
      axisOptionsForRuntimeState('strategy', resolved({ agentStrategy: 'freestyle' }), groundingFloorGaps()),
    ).toEqual(['freestyle', 'step-wise-decision-tree', 'step-wise-disambiguate']);
  });

  it('fails loud when a gated lens requires a kind absent from the register (config bug, not uncovered)', () => {
    const missingThesis = groundingFloorGaps().filter((g) => g.refersTo !== 'thesis');
    expect(() => axisOptionsForRuntimeState('lens', resolved(), missingThesis)).toThrow(
      /no presence gap for thesis/,
    );
  });

  it('fails loud on an empty gap register for gated lenses (wiring bug — every spec is seeded with floor gaps)', () => {
    expect(() => axisOptionsForRuntimeState('lens', resolved(), [])).toThrow(/no presence gap/);
  });

  it('derives per-axis legal options without grade-gate symbols', () => {
    expect(
      axisOptionsForRuntimeState('lens', resolved(), groundingFloorGaps({ coverage: { thesis: 0 } })),
    ).toEqual(['intent']);

    const source = readFileSync(fileURLToPath(new URL('../policy.ts', import.meta.url)), 'utf8');
    expect(source).not.toMatch(/ReadinessGrade|GRADE_RANK|MIN_GRADE/);
  });
});
