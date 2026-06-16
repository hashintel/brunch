import { describe, expect, it } from 'vitest';

import type { CookEvent } from './events.js';
import { PlainPresenter } from './plain.js';

function render(events: CookEvent[]): string[] {
  const lines: string[] = [];
  const presenter = new PlainPresenter({ log: (line) => lines.push(line) });
  for (const event of events) presenter.onEvent(event);
  return lines;
}

describe('PlainPresenter — plan surface', () => {
  it('renders the plan banner byte-for-byte', () => {
    expect(render([{ kind: 'plan-start', specId: 2, outDir: '/tmp/x' }])).toEqual([
      '',
      '  brunch plan',
      '  ──────────────────────────────────────',
      '  spec       2',
      '  out        /tmp/x',
      '',
    ]);
  });

  it('renders the plan-written summary', () => {
    expect(render([{ kind: 'plan-written', path: '/p/plan.yaml', epics: 1, slices: 2 }])).toEqual([
      '  ✓  plan      /p/plan.yaml',
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
