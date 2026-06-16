import { describe, expect, it } from 'vitest';

import { RunStore } from './run-store.js';

describe('RunStore', () => {
  it('folds cook events into phase + formatted lines, using the injected clock', () => {
    const store = new RunStore('cook', () => 1500);
    store.push({ kind: 'cook-start', runStart: 1000 });
    store.push({ kind: 'action', icon: '▸', message: 'tests     slice-1' });

    const state = store.getSnapshot();
    expect(state.command).toBe('cook');
    expect(state.phase).toBe('cook');
    // 1500 - 1000 = 0.5s, formatted exactly like the plain backend.
    expect(state.lines).toEqual(['     0.5s  ▸  tests     slice-1']);
  });

  it('advances the brigade phase on a promotion line', () => {
    const store = new RunStore('serve', () => 0);
    store.push({ kind: 'cook-start', runStart: 0 });
    store.push({ kind: 'line', text: '  ✓  promoted → cook/abc @ 1234abcd' });
    expect(store.getSnapshot().phase).toBe('plate');
  });

  it('keeps a stable snapshot reference and does not notify on a no-op event', () => {
    const store = new RunStore('cook', () => 0);
    store.push({ kind: 'cook-start', runStart: 0 });
    const before = store.getSnapshot();

    let notified = 0;
    store.subscribe(() => notified++);
    // A second cook-start adds no lines and cannot advance the phase.
    store.push({ kind: 'cook-start', runStart: 0 });

    expect(store.getSnapshot()).toBe(before);
    expect(notified).toBe(0);
  });

  it('notifies subscribers when state changes', () => {
    const store = new RunStore('cook', () => 0);
    let notified = 0;
    store.subscribe(() => notified++);
    store.push({ kind: 'line', text: '  brunch cook' });
    expect(notified).toBe(1);
  });

  it('tracks pending activities: start adds, progress updates detail, end removes', () => {
    let clock = 1000;
    const store = new RunStore('cook', () => clock);
    store.push({ kind: 'activity-start', id: 'tests:slice-1', label: 'agent writing tests' });

    let pending = store.getSnapshot().pending;
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ id: 'tests:slice-1', label: 'agent writing tests', startedAt: 1000 });

    store.push({ kind: 'activity-progress', id: 'tests:slice-1', detail: '8 KB' });
    expect(store.getSnapshot().pending[0]).toMatchObject({ detail: '8 KB' });

    clock = 5000;
    store.push({ kind: 'activity-end', id: 'tests:slice-1' });
    expect(store.getSnapshot().pending).toHaveLength(0);
  });

  it('does not put activity events into the scrolling line log', () => {
    const store = new RunStore('cook', () => 0);
    store.push({ kind: 'activity-start', id: 'a', label: 'booting app' });
    store.push({ kind: 'activity-end', id: 'a' });
    expect(store.getSnapshot().lines).toEqual([]);
  });
});
