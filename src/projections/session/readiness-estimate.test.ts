import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { ElicitationGap } from '../../graph/schema/elicitation-gaps.js';
import { READINESS_BANDS } from '../../graph/schema/kinds.js';
import type { NodeKind, ReadinessBand } from '../../graph/schema/nodes.js';
import { readinessEstimate } from './readiness-estimate.js';

function gap(overrides: {
  readonly id?: string;
  readonly band: ReadinessBand;
  readonly coverage: number;
  readonly importance?: number;
  readonly refersTo?: NodeKind;
}): ElicitationGap {
  return {
    id: overrides.id ?? `${overrides.band}:${overrides.refersTo ?? 'context'}:${overrides.coverage}`,
    specId: 1,
    refersTo: overrides.refersTo ?? 'context',
    question: `${overrides.band} question`,
    rationale: `${overrides.band} rationale`,
    basis: 'implicit',
    band: overrides.band,
    predicate: { kind: 'presence', minimum: 1, nodeKind: overrides.refersTo ?? 'context' },
    importance: overrides.importance ?? 1,
    coverage: overrides.coverage,
    answered: overrides.coverage >= 1,
    disposition: overrides.coverage >= 1 ? 'answered' : 'open',
    createdAtLsn: 1,
  };
}

describe('readiness estimate projection', () => {
  it('returns coverage for every readiness band', () => {
    const estimate = readinessEstimate([
      gap({ band: 'grounding', coverage: 1 }),
      gap({ band: 'elicitation', coverage: 0.5 }),
      gap({ band: 'commitment', coverage: 0.25 }),
    ]);

    expect(Object.keys(estimate.coverage)).toEqual([...READINESS_BANDS]);
    expect(estimate.coverage).toEqual({ grounding: 1, elicitation: 0.5, commitment: 0.25 });
  });

  it('reports an empty band as zero coverage', () => {
    expect(readinessEstimate([gap({ band: 'grounding', coverage: 0.75 })]).coverage).toEqual({
      grounding: 0.75,
      elicitation: 0,
      commitment: 0,
    });
  });

  it('uses an importance-weighted mean per band', () => {
    const estimate = readinessEstimate([
      gap({ band: 'elicitation', coverage: 1, importance: 3 }),
      gap({ band: 'elicitation', coverage: 0, importance: 1 }),
    ]);

    expect(estimate.coverage.elicitation).toBe(0.75);
  });

  it('regresses honestly when gap coverage lowers and rises when coverage improves', () => {
    const lower = readinessEstimate([
      gap({ id: 'same', band: 'commitment', coverage: 0.25 }),
      gap({ id: 'other', band: 'commitment', coverage: 0.75 }),
    ]);
    const higher = readinessEstimate([
      gap({ id: 'same', band: 'commitment', coverage: 0.75 }),
      gap({ id: 'other', band: 'commitment', coverage: 0.75 }),
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
