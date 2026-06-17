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
    // Big lowercase ASCII wordmark rendered + the command label.
    expect(frame).toContain('/_.___/');
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
    expect(frame).toContain('2s'); // whole seconds — no jittery decimal
    expect(frame).not.toContain('2.5s');
    expect(frame).toContain('8 KB');

    store.push({ kind: 'activity-end', id: 'tests:slice-1' });
    await tick();

    frame = lastFrame() ?? '';
    expect(frame).not.toContain('agent writing tests');
  });
});

describe('Ink App — slice grid', () => {
  it("renders epics with per-slice status, the running slice's step/detail, and queued slices", async () => {
    const store = new RunStore('cook', () => 0);
    const { lastFrame } = render(<App store={store} now={() => 0} />);

    store.push({
      kind: 'run-shape',
      epics: [{ id: 'api-auth' }],
      slices: [
        { id: 'login', epicId: 'api-auth' },
        { id: 'refresh', epicId: 'api-auth' },
      ],
    });
    store.push({ kind: 'slice', id: 'login', epicId: 'api-auth', status: 'passed' });
    store.push({ kind: 'slice', id: 'refresh', epicId: 'api-auth', status: 'running', step: 'code' });
    store.push({ kind: 'activity-progress', id: 'refresh', detail: 'edit src/token.ts' });
    await tick();

    const frame = lastFrame() ?? '';
    expect(frame).toContain('api-auth'); // epic group header
    expect(frame).toContain('✓ login'); // passed
    expect(frame).toContain('refresh · code · edit src/token.ts'); // running w/ step + detail
  });
});

describe('Ink App — failure legibility', () => {
  it('shows a failed slice reason and pins a halt summary', async () => {
    const store = new RunStore('cook', () => 0);
    const { lastFrame } = render(<App store={store} now={() => 0} />);
    store.push({ kind: 'run-shape', epics: [{ id: 'api' }], slices: [{ id: 'login', epicId: 'api' }] });
    store.push({ kind: 'slice', id: 'login', epicId: 'api', status: 'failed', reason: 'tests failed' });
    store.push({ kind: 'cook-done', ok: false, reason: 'login exhausted retries' });
    await tick();

    const frame = lastFrame() ?? '';
    expect(frame).toContain('login · tests failed');
    expect(frame).toContain('✗ halted · login exhausted retries');
  });

  it('shows no halt summary for a completed run', async () => {
    const store = new RunStore('cook', () => 0);
    const { lastFrame } = render(<App store={store} now={() => 0} />);
    store.push({ kind: 'run-shape', epics: [{ id: 'api' }], slices: [{ id: 'login', epicId: 'api' }] });
    store.push({ kind: 'slice', id: 'login', epicId: 'api', status: 'passed' });
    store.push({ kind: 'cook-done', ok: true });
    await tick();

    expect(lastFrame() ?? '').not.toContain('✗ halted');
  });
});

describe('Ink App — attempt count', () => {
  it('shows the attempt only once a slice has retried', async () => {
    const store = new RunStore('cook', () => 0);
    const { lastFrame } = render(<App store={store} now={() => 0} />);
    store.push({ kind: 'run-shape', epics: [{ id: 'api' }], slices: [{ id: 'login', epicId: 'api' }] });
    store.push({ kind: 'slice', id: 'login', epicId: 'api', status: 'running', step: 'code' });
    await tick();
    expect(lastFrame() ?? '').not.toContain('attempt'); // first run: no clutter

    store.push({ kind: 'slice', id: 'login', epicId: 'api', status: 'failed', reason: 'tests failed' });
    store.push({ kind: 'slice', id: 'login', epicId: 'api', status: 'running', step: 'code' });
    await tick();
    expect(lastFrame() ?? '').toContain('attempt 2');
  });
});
