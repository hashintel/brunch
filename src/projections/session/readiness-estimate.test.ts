import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { presenceGap } from '../../graph/schema/elicitation-gap-fixtures.js';
import { READINESS_BANDS } from '../../graph/schema/kinds.js';
import { readinessEstimate } from './readiness-estimate.js';

describe('readiness estimate projection', () => {
  it('returns coverage for every readiness band', () => {
    const estimate = readinessEstimate([
      presenceGap({ refersTo: 'context', band: 'grounding', coverage: 1 }),
      presenceGap({ refersTo: 'context', band: 'elicitation', coverage: 0.5 }),
      presenceGap({ refersTo: 'context', band: 'commitment', coverage: 0.25 }),
    ]);

    expect(Object.keys(estimate.coverage)).toEqual([...READINESS_BANDS]);
    expect(estimate.coverage).toEqual({ grounding: 1, elicitation: 0.5, commitment: 0.25 });
  });

  it('reports an empty band as zero coverage', () => {
    expect(
      readinessEstimate([presenceGap({ refersTo: 'context', band: 'grounding', coverage: 0.75 })]).coverage,
    ).toEqual({
      grounding: 0.75,
      elicitation: 0,
      commitment: 0,
    });
  });

  it('uses an importance-weighted mean per band', () => {
    const estimate = readinessEstimate([
      presenceGap({ refersTo: 'context', band: 'elicitation', coverage: 1, importance: 3 }),
      presenceGap({ refersTo: 'context', band: 'elicitation', coverage: 0, importance: 1 }),
    ]);

    expect(estimate.coverage.elicitation).toBe(0.75);
  });

  it('regresses honestly when gap coverage lowers and rises when coverage improves', () => {
    const lower = readinessEstimate([
      presenceGap({ refersTo: 'context', id: 'same', band: 'commitment', coverage: 0.25 }),
      presenceGap({ refersTo: 'context', id: 'other', band: 'commitment', coverage: 0.75 }),
    ]);
    const higher = readinessEstimate([
      presenceGap({ refersTo: 'context', id: 'same', band: 'commitment', coverage: 0.75 }),
      presenceGap({ refersTo: 'context', id: 'other', band: 'commitment', coverage: 0.75 }),
    ]);

    expect(lower.coverage.commitment).toBe(0.5);
    expect(higher.coverage.commitment).toBe(0.75);
    expect(lower.coverage.commitment).toBeLessThan(higher.coverage.commitment);
  });

  it('does not import grade symbols and is not imported by legality paths', () => {
    const estimateSource = readFileSync(
      fileURLToPath(new URL('./readiness-estimate.ts', import.meta.url)),
      'utf8',
    );
    expect(estimateSource).not.toMatch(/ReadinessGrade|READINESS_GRADES|GRADE_RANK|MIN_GRADE/);

    for (const relativePath of ['./runtime-policy.ts', './affordances.ts', '../../.pi/agents/state.ts']) {
      const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
      expect(source).not.toMatch(/readiness-estimate|readinessEstimate/);
    }
  });
});
