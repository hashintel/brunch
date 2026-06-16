import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { RunStore } from '../run-store.js';
import { App } from './app.js';

async function tick() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Ink App', () => {
  it('renders the wordmark header, brigade tracker, and recent activity', async () => {
    const store = new RunStore('cook', () => 0);
    const { lastFrame } = render(<App store={store} />);

    store.push({ kind: 'cook-start', runStart: 0 });
    store.push({ kind: 'action', icon: '▸', message: 'tests     slice-1' });
    await tick();

    const frame = lastFrame() ?? '';
    // Wordmark header + command.
    expect(frame).toContain('brunch');
    expect(frame).toContain('cook');
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

  it('shows a pending activity with label + elapsed + detail, and clears it on end', async () => {
    let clock = 1000;
    const store = new RunStore('cook', () => clock);
    const { lastFrame } = render(<App store={store} now={() => clock} />);

    store.push({ kind: 'activity-start', id: 'tests:slice-1', label: 'agent writing tests' });
    store.push({ kind: 'activity-progress', id: 'tests:slice-1', detail: '8 KB' });
    clock = 3500; // 2.5s elapsed
    await tick();

    let frame = lastFrame() ?? '';
    expect(frame).toContain('agent writing tests');
    expect(frame).toContain('2.5s');
    expect(frame).toContain('8 KB');

    store.push({ kind: 'activity-end', id: 'tests:slice-1' });
    await tick();

    frame = lastFrame() ?? '';
    expect(frame).not.toContain('agent writing tests');
  });
});
