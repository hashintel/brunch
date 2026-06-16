import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { RunStore } from '../run-store.js';
import { App } from './app.js';

async function tick() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Ink App', () => {
  it('renders the egg header, brigade tracker, and recent activity', async () => {
    const store = new RunStore('cook', () => 0);
    const { lastFrame } = render(<App store={store} />);

    store.push({ kind: 'cook-start', runStart: 0 });
    store.push({ kind: 'action', icon: '▸', message: 'tests     slice-1' });
    await tick();

    const frame = lastFrame() ?? '';
    // Egg header + command title.
    expect(frame).toContain("'-'");
    expect(frame).toContain('brunch cook');
    // Brigade tracker shows every phase, with cook active (◐) once cooking.
    expect(frame).toContain('prep');
    expect(frame).toContain('cook ◐');
    // Activity log carries the formatted action line.
    expect(frame).toContain('tests     slice-1');
  });

  it('marks earlier phases done and reflects promotion as plate', async () => {
    const store = new RunStore('serve', () => 0);
    const { lastFrame } = render(<App store={store} />);

    store.push({ kind: 'cook-start', runStart: 0 });
    store.push({ kind: 'line', text: '  ✓  promoted → cook/abc @ 1234abcd' });
    await tick();

    const frame = lastFrame() ?? '';
    expect(frame).toContain('plate ◐');
    expect(frame).toContain('cook ✓');
    expect(frame).toContain('promoted');
  });
});
