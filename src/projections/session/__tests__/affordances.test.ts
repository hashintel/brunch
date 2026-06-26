import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  axisOptionsForRuntimeState,
  pinnableAxisOptionsForRuntimeState,
} from '../../../agents/runtime/policy.js';
import { groundingFloorGaps } from '../../../graph/schema/elicitation-gap-fixtures.js';
import { DEFAULT_BRUNCH_AGENT_STATE } from '../../../session/runtime-state.js';
import { affordances } from '../affordances.js';
import { resolveBrunchAgentState } from '../runtime-state.js';

function resolved(overrides: Partial<typeof DEFAULT_BRUNCH_AGENT_STATE> = {}) {
  return resolveBrunchAgentState({ ...DEFAULT_BRUNCH_AGENT_STATE, ...overrides });
}

describe('runtime affordances derivation', () => {
  it('reports legal options and default-on-switch values for runtime posture axes', () => {
    expect(affordances(resolved(), groundingFloorGaps())).toEqual({
      strategy: {
        selection: 'auto',
        legalOptions: ['step-wise-decision-tree', 'step-wise-disambiguate'],
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
    const derived = affordances(resolved(), groundingFloorGaps({ defaultCoverage: 0 }));

    expect(derived.strategy.legalOptions).toEqual(['step-wise-decision-tree', 'step-wise-disambiguate']);
    expect(derived.lens.legalOptions).toEqual(['intent']);

    expect(
      affordances(resolved({ agentStrategy: 'freestyle' }), groundingFloorGaps({ coverage: { context: 0 } }))
        .strategy,
    ).toEqual({
      selection: 'freestyle',
      legalOptions: ['freestyle', 'step-wise-decision-tree', 'step-wise-disambiguate'],
      defaultOnSwitch: 'auto',
    });
  });

  it('keeps strategy options capability-independent while gating generative lenses', () => {
    const uncovered = affordances(resolved(), groundingFloorGaps({ defaultCoverage: 0 }));
    const covered = affordances(resolved(), groundingFloorGaps());

    expect(uncovered.strategy.legalOptions).toEqual(['step-wise-decision-tree', 'step-wise-disambiguate']);
    expect(covered.strategy.legalOptions).toEqual(['step-wise-decision-tree', 'step-wise-disambiguate']);
    expect(uncovered.lens.legalOptions).not.toContain('design');
    expect(uncovered.lens.legalOptions).not.toContain('oracle');
  });

  it('keeps freestyle on the user-pin surface even while the AUTO manifest excludes it', () => {
    // Same AUTO state: the manifest view omits freestyle, the pin surface keeps it.
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
    expect(affordances(resolved(), groundingFloorGaps()).strategy.legalOptions).not.toContain('freestyle');

    expect(affordances(resolved({ agentStrategy: 'freestyle' }), groundingFloorGaps()).strategy).toEqual({
      selection: 'freestyle',
      legalOptions: ['freestyle', 'step-wise-decision-tree', 'step-wise-disambiguate'],
      defaultOnSwitch: 'auto',
    });
  });

  it('fails loud when a gated lens requires a kind absent from the register (config bug, not uncovered)', () => {
    // A capability-relevant kind missing from the gap register is a seeding/config bug;
    // the affordance projection must surface it, not silently omit the option.
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

    for (const fileName of ['affordances.ts', 'runtime-policy.ts']) {
      const sourcePath = fileURLToPath(new URL(`../${fileName}`, import.meta.url));
      const source = readFileSync(sourcePath, 'utf8');
      expect(source).not.toMatch(/ReadinessGrade|GRADE_RANK|MIN_GRADE/);
    }
  });
});
