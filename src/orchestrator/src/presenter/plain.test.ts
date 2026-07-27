import { describe, expect, it } from 'vitest';

import type { CookEvent } from './events.js';
import { PlainPresenter } from './plain.js';

function render(events: CookEvent[]): string[] {
  const lines: string[] = [];
  const presenter = new PlainPresenter({ log: (line) => lines.push(line) });
  for (const event of events) presenter.onEvent(event);
  return lines;
}

/** Render with a fake clock so elapsed values are deterministic (I136-K). */
function renderTimed(events: CookEvent[], nowValues: number[]): string[] {
  const lines: string[] = [];
  let i = 0;
  const presenter = new PlainPresenter({
    log: (line) => lines.push(line),
    now: () => nowValues[Math.min(i++, nowValues.length - 1)]!,
  });
  for (const event of events) presenter.onEvent(event);
  return lines;
}

describe('PlainPresenter — plan surface', () => {
  it('renders the plan banner byte-for-byte', () => {
    expect(render([{ kind: 'plan-start', specId: 2, outDir: '/tmp/x' }])).toEqual([
      '',
      '  brunch recipe',
      '  ──────────────────────────────────────',
      '  spec       2',
      '  out        /tmp/x',
      '',
    ]);
  });

  it('renders the plan-written summary', () => {
    expect(render([{ kind: 'plan-written', path: '/p/plan.yaml', epics: 1, slices: 2 }])).toEqual([
      '  ✓  recipe    /p/plan.yaml',
      '     1 epics, 2 slices',
      '',
    ]);
  });

  it('renders a warnings block with the printed count and one line per message', () => {
    expect(
      render([{ kind: 'plan-warnings', messages: ['cycle-break-dropped-edge: a→b', 'orphan: c'] }]),
    ).toEqual(['  2 warnings:', '  !  cycle-break-dropped-edge: a→b', '  !  orphan: c', '']);
  });

  it('emits nothing for an empty warnings set', () => {
    expect(render([{ kind: 'plan-warnings', messages: [] }])).toEqual([]);
  });
});

describe('PlainPresenter — cook surface', () => {
  it('renders a verbatim line and nothing for cook-start', () => {
    expect(
      render([
        { kind: 'cook-start', runStart: 0 },
        { kind: 'line', text: '  brunch cook' },
      ]),
    ).toEqual(['  brunch cook']);
  });

  it('prepends elapsed-since-cook-start to an action line, padded like the original', () => {
    // runStart 1000ms; clock reads 2500ms at the action → 1.5s elapsed.
    expect(
      renderTimed(
        [
          { kind: 'cook-start', runStart: 1000 },
          { kind: 'action', icon: '▸', message: 'tests     slice-1' },
        ],
        [2500],
      ),
    ).toEqual(['     1.5s  ▸  tests     slice-1']);
  });

  it('keeps an inline duration in the action message untouched', () => {
    expect(
      renderTimed(
        [
          { kind: 'cook-start', runStart: 0 },
          { kind: 'action', icon: '✓', message: 'write-tests (0.3s)' },
        ],
        [12_300],
      ),
    ).toEqual(['    12.3s  ✓  write-tests (0.3s)']);
  });

  it('renders the verbose block with a left border, blank-padded', () => {
    expect(render([{ kind: 'verbose', text: 'line one\nline two' }])).toEqual([
      '',
      '             │ line one',
      '             │ line two',
      '',
    ]);
  });

  it('skips a verbose block whose text is blank', () => {
    expect(render([{ kind: 'verbose', text: '   \n  ' }])).toEqual([]);
  });
});
