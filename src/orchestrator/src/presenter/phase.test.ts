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

  it('advances to taste on an epic/verify action and to plate on a promotion line', () => {
    expect(nextPhase('cook', { kind: 'action', icon: '▸', message: 'verify    api-auth' })).toBe('taste');
    expect(nextPhase('cook', { kind: 'action', icon: '●', message: 'epic      api-auth → PASS' })).toBe(
      'taste',
    );
    expect(nextPhase('taste', { kind: 'line', text: '  ✓  promoted → cook/abc @ 1234abcd' })).toBe('plate');
  });

  it('never regresses to an earlier phase', () => {
    // A per-slice action after taste must not pull the tracker back to cook.
    expect(nextPhase('taste', { kind: 'action', icon: '▸', message: 'tests     slice-2' })).toBe('taste');
    expect(nextPhase('plate', { kind: 'cook-start', runStart: 0 })).toBe('plate');
  });

  it('walks a full cook run prep → cook → taste → plate', () => {
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
