// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { KindBadge, nodeRefCode, PLANE_ACCENT } from '../node-card.js';

afterEach(cleanup);

describe('node-card primitives', () => {
  it('renders canonical kind labels from NODE_KIND_METADATA', () => {
    const cases = [
      { kind: 'goal', plane: 'intent', label: 'G' },
      { kind: 'criterion', plane: 'intent', label: 'AC' },
      { kind: 'check', plane: 'oracle', label: 'CH' },
      { kind: 'module', plane: 'design', label: 'MOD' },
      { kind: 'slice', plane: 'plan', label: 'S' },
    ] as const;
    for (const { kind, plane, label } of cases) {
      const { container } = render(<KindBadge kind={kind} plane={plane} />);
      expect(container.textContent).toBe(label);
    }
  });

  it('formats reference codes from kind + ordinal (D62-L)', () => {
    expect(nodeRefCode('goal', 1)).toBe('G1');
    expect(nodeRefCode('criterion', 3)).toBe('AC3');
    expect(nodeRefCode('context', 2)).toBe('CTX2');
  });

  it('defines an accent for every plane', () => {
    for (const plane of ['intent', 'oracle', 'design', 'plan'] as const) {
      expect(PLANE_ACCENT[plane].text).toMatch(/^#[0-9a-f]{6}$/i);
      expect(PLANE_ACCENT[plane].bg).toContain('rgba');
    }
  });
});
