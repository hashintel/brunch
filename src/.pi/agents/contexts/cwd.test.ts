import { describe, expect, it } from 'vitest';

import { presenceGap } from '../../../graph/schema/elicitation-gap-fixtures.js';
import { renderCwdContext } from './cwd.js';

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
      gaps: [
        presenceGap({ refersTo: 'context', coverage: 0.5, band: 'grounding', specId: 42 }),
        presenceGap({ refersTo: 'requirement', coverage: 1, band: 'elicitation', specId: 42 }),
      ],
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
