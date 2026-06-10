import { describe, expect, it } from 'vitest';

import type { ElicitationGap } from '../../../graph/schema/elicitation-gaps.js';
import type { NodeKind } from '../../../graph/schema/nodes.js';
import { renderCwdContext } from './cwd.js';

function gap(refersTo: NodeKind, coverage: number, band: ElicitationGap['band']): ElicitationGap {
  return {
    id: `${refersTo}:gap`,
    specId: 42,
    refersTo,
    question: `${refersTo} question`,
    rationale: `${refersTo} rationale`,
    basis: 'implicit',
    band,
    predicate: { kind: 'presence', minimum: 1, nodeKind: refersTo },
    importance: 1,
    coverage,
    answered: coverage >= 1,
    disposition: coverage >= 1 ? 'answered' : 'open',
    createdAtLsn: 1,
  };
}

describe('renderCwdContext', () => {
  it('renders selected-spec/session/posture facts without ambient resource discovery', () => {
    const rendered = renderCwdContext({
      spec: { id: 42, name: 'Payments Spec' },
      workspace: {
        cwd: '/repo/product',
        posture: {
          certainty: 'proving',
          stakes: 'high',
          migration: 'free-rewrite',
        },
      },
      session: { id: 'session-7', label: 'Grounding' },
      gaps: [gap('context', 0.5, 'grounding'), gap('requirement', 1, 'elicitation')],
    });

    expect(rendered).toContain('- cwd: /repo/product');
    expect(rendered).toContain(
      '- selected spec: Payments Spec (#42); readiness estimate (soft; gates nothing): grounding=0.50, elicitation=1.00, commitment=0.00',
    );
    expect(rendered).not.toContain('readiness_grade=');
    expect(rendered).toContain('- selected session: Grounding (session-7)');
    expect(rendered).toContain('certainty=proving; stakes=high; migration=free-rewrite');
    expect(rendered).toContain('ambient Pi resources: not scanned');
    expect(rendered).toContain('graph scope: selected spec only');
    expect(rendered).not.toContain('.pi/context');
  });
});
