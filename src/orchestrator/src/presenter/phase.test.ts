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

  it('lights taste on the epic verdict but NOT on per-slice verify (mid-cook)', () => {
    // Per-slice verify runs during cooking — must not light taste.
    expect(nextPhase('cook', { kind: 'action', icon: '▸', message: 'verify    api-auth' })).toBe('cook');
    expect(nextPhase('cook', { kind: 'action', icon: '✓', message: 'verify    tests/x.test.ts' })).toBe(
      'cook',
    );
    // The epic-verification verdict is the real verify→taste signal (no ctx → fallback).
    expect(nextPhase('cook', { kind: 'action', icon: '●', message: 'epic      api-auth → PASS' })).toBe(
      'taste',
    );
  });

  it('gates taste behind ALL known epics having a verdict', () => {
    const verdict = (id: string): CookEvent => ({ kind: 'action', icon: '●', message: `epic ${id} → PASS` });
    // One of two epics verdicted → still cooking.
    expect(nextPhase('cook', verdict('a'), { epics: ['a', 'b'], verdictedEpics: new Set(['a']) })).toBe(
      'cook',
    );
    // Every known epic verdicted → taste.
    expect(nextPhase('cook', verdict('b'), { epics: ['a', 'b'], verdictedEpics: new Set(['a', 'b']) })).toBe(
      'taste',
    );
    // A FAIL verdict still counts as a verdict — the gate is "all verdicted", not "all passed".
    expect(
      nextPhase(
        'cook',
        { kind: 'action', icon: '●', message: 'epic b → FAIL' },
        {
          epics: ['a', 'b'],
          verdictedEpics: new Set(['a', 'b']),
        },
      ),
    ).toBe('taste');
  });

  it('advances to plate on a promotion line and to serve on a completed run', () => {
    expect(nextPhase('cook', { kind: 'line', text: '  ✓  promoted → cook/abc @ 1234abcd' })).toBe('plate');
    // The finish block's phrasing puts `promoted` after the phase word; it must still light plate.
    expect(nextPhase('cook', { kind: 'line', text: '  ✓  cook → promoted' })).toBe('plate');
    expect(nextPhase('cook', { kind: 'line', text: '  ✓  cook → promoted + landed' })).toBe('plate');
    expect(nextPhase('plate', { kind: 'cook-done', ok: true })).toBe('serve');
  });

  it('does not light serve when the run halted', () => {
    expect(nextPhase('cook', { kind: 'cook-done', ok: false })).toBe('cook');
  });

  it('does not light plate for a no-promotion failure message', () => {
    expect(nextPhase('cook', { kind: 'line', text: '  !  run did not complete — nothing promoted.' })).toBe(
      'cook',
    );
  });

  it('never regresses to an earlier phase', () => {
    expect(nextPhase('serve', { kind: 'cook-start', runStart: 0 })).toBe('serve');
    expect(nextPhase('taste', { kind: 'action', icon: '▸', message: 'tests     slice-2' })).toBe('taste');
  });

  it('walks a full cook run prep → cook → taste → plate → serve', () => {
    expect(
      walk([
        { kind: 'cook-start', runStart: 0 },
        { kind: 'action', icon: '▸', message: 'tests     slice-1' },
        { kind: 'action', icon: '●', message: 'epic      api-auth → PASS' },
        { kind: 'line', text: '  ✓  promoted → cook/abc @ 1234abcd' },
        { kind: 'cook-done', ok: true },
      ]),
    ).toBe('serve');
  });
});
