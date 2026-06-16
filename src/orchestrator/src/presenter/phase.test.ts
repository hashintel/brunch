import { describe, expect, it } from 'vitest';

import type { CookEvent } from './events.js';
import { type BrigadePhase, nextPhase } from './phase.js';

function walk(events: CookEvent[]): BrigadePhase {
  return events.reduce<BrigadePhase>((phase, event) => nextPhase(phase, event), 'prep');
}

describe('nextPhase', () => {
  it('lights recipe at plan-start and cook at cook-start', () => {
    expect(nextPhase('prep', { kind: 'plan-start', specId: 1, outDir: '/x' })).toBe('recipe');
    expect(nextPhase('prep', { kind: 'cook-start', runStart: 0 })).toBe('cook');
  });

  it('does NOT advance to taste on verify/epic actions (they fire mid-cook)', () => {
    expect(nextPhase('cook', { kind: 'action', icon: '▸', message: 'verify    api-auth' })).toBe('cook');
    expect(nextPhase('cook', { kind: 'action', icon: '●', message: 'epic      api-auth → PASS' })).toBe(
      'cook',
    );
  });

  it('advances to plate on a promotion line', () => {
    expect(nextPhase('cook', { kind: 'line', text: '  ✓  promoted → cook/abc @ 1234abcd' })).toBe('plate');
  });

  it('never regresses to an earlier phase', () => {
    expect(nextPhase('plate', { kind: 'cook-start', runStart: 0 })).toBe('plate');
    expect(nextPhase('cook', { kind: 'action', icon: '▸', message: 'tests     slice-2' })).toBe('cook');
  });

  it('walks a full cook run prep → cook → plate (taste stays unlit)', () => {
    expect(
      walk([
        { kind: 'cook-start', runStart: 0 },
        { kind: 'action', icon: '▸', message: 'tests     slice-1' },
        { kind: 'action', icon: '▸', message: 'verify    api-auth' },
        { kind: 'line', text: '  ✓  promoted → cook/abc @ 1234abcd' },
      ]),
    ).toBe('plate');
  });
});
