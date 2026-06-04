import { describe, expect, it } from 'vitest';

import { renderCwdContext } from './cwd.js';

describe('renderCwdContext', () => {
  it('renders selected-spec/session/posture facts without ambient resource discovery', () => {
    const rendered = renderCwdContext({
      spec: { id: 42, name: 'Payments Spec', readinessGrade: 'elicitation_ready' },
      workspace: {
        cwd: '/repo/product',
        posture: {
          certainty: 'proving',
          stakes: 'high',
          migration: 'free-rewrite',
        },
      },
      session: { id: 'session-7', label: 'Grounding' },
    });

    expect(rendered).toContain('- cwd: /repo/product');
    expect(rendered).toContain('- selected spec: Payments Spec (#42); readiness_grade=elicitation_ready');
    expect(rendered).toContain('- selected session: Grounding (session-7)');
    expect(rendered).toContain('certainty=proving; stakes=high; migration=free-rewrite');
    expect(rendered).toContain('ambient Pi resources: not scanned');
    expect(rendered).toContain('graph scope: selected spec only');
    expect(rendered).not.toContain('.pi/context');
  });
});
