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
    const store = new RunStore('cook', () => 1000);
    store.push({ kind: 'activity-start', id: 'tests:slice-1', label: 'agent writing tests' });

    const pending = store.getSnapshot().pending;
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ id: 'tests:slice-1', label: 'agent writing tests' });

    store.push({ kind: 'activity-progress', id: 'tests:slice-1', detail: '8 KB' });
    expect(store.getSnapshot().pending[0]).toMatchObject({ detail: '8 KB' });

    store.push({ kind: 'activity-end', id: 'tests:slice-1' });
    expect(store.getSnapshot().pending).toHaveLength(0);
  });

  it('stamps a run-start for the global timer at construction', () => {
    expect(new RunStore('cook', () => 4242).getSnapshot().runStart).toBe(4242);
  });

  it('does not put activity events into the scrolling line log', () => {
    const store = new RunStore('cook', () => 0);
    store.push({ kind: 'activity-start', id: 'a', label: 'booting app' });
    store.push({ kind: 'activity-end', id: 'a' });
    expect(store.getSnapshot().lines).toEqual([]);
  });
});

describe('RunStore — slice grid', () => {
  function seeded(): RunStore {
    const store = new RunStore('cook', () => 0);
    store.push({
      kind: 'run-shape',
      epics: [{ id: 'api' }, { id: 'pay' }],
      slices: [
        { id: 'login', epicId: 'api' },
        { id: 'refresh', epicId: 'api' },
        { id: 'charge', epicId: 'pay' },
      ],
    });
    return store;
  }

  it('seeds every slice as queued, grouped by epic order', () => {
    const { epics, slices } = seeded().getSnapshot();
    expect(epics).toEqual(['api', 'pay']);
    expect(slices.map((s) => [s.id, s.status])).toEqual([
      ['login', 'queued'],
      ['refresh', 'queued'],
      ['charge', 'queued'],
    ]);
  });

  it('flips a slice to running with a step, then passed (latest wins, detail cleared)', () => {
    const store = seeded();
    store.push({ kind: 'slice', id: 'login', epicId: 'api', status: 'running', step: 'tests' });
    store.push({ kind: 'activity-progress', id: 'login', detail: 'edit src/login.ts' });
    let row = store.getSnapshot().slices.find((s) => s.id === 'login')!;
    expect(row).toMatchObject({ status: 'running', step: 'tests', detail: 'edit src/login.ts' });

    store.push({ kind: 'slice', id: 'login', epicId: 'api', status: 'passed' });
    row = store.getSnapshot().slices.find((s) => s.id === 'login')!;
    expect(row.status).toBe('passed');
    expect(row.step).toBeUndefined(); // in-flight label cleared once it stops running
    expect(row.detail).toBeUndefined(); // heartbeat cleared once it stops running
  });

  it('routes slice-keyed activity to the grid, non-slice activity to pending', () => {
    const store = seeded();
    // A slice-keyed activity must NOT create a pending entry.
    store.push({ kind: 'activity-start', id: 'login', label: 'login' });
    expect(store.getSnapshot().pending).toHaveLength(0);

    // A non-slice wait (promotion) does.
    store.push({ kind: 'activity-start', id: 'promote', label: 'promoting → cook/abc' });
    expect(store.getSnapshot().pending.map((p) => p.id)).toEqual(['promote']);
    store.push({ kind: 'activity-end', id: 'promote' });
    expect(store.getSnapshot().pending).toHaveLength(0);
  });
});

describe('RunStore — failure legibility', () => {
  it('stores a slice failure reason', () => {
    const store = new RunStore('cook', () => 0);
    store.push({ kind: 'run-shape', epics: [{ id: 'api' }], slices: [{ id: 'login', epicId: 'api' }] });
    store.push({ kind: 'slice', id: 'login', epicId: 'api', status: 'failed', reason: 'tests failed' });
    expect(store.getSnapshot().slices.find((s) => s.id === 'login')).toMatchObject({
      status: 'failed',
      reason: 'tests failed',
    });
  });

  it('sets haltReason from cook-done(ok:false) and leaves it unset on completion', () => {
    const halted = new RunStore('cook', () => 0);
    halted.push({ kind: 'cook-done', ok: false, reason: 'budget exhausted' });
    expect(halted.getSnapshot().haltReason).toBe('budget exhausted');

    const done = new RunStore('cook', () => 0);
    done.push({ kind: 'cook-done', ok: true });
    expect(done.getSnapshot().haltReason).toBeUndefined();
  });
});

describe('RunStore — attempt counting', () => {
  function seed(): RunStore {
    const store = new RunStore('cook', () => 0);
    store.push({ kind: 'run-shape', epics: [{ id: 'api' }], slices: [{ id: 'login', epicId: 'api' }] });
    return store;
  }
  const attemptsOf = (store: RunStore) => store.getSnapshot().slices.find((s) => s.id === 'login')!.attempts;

  it('counts attempt 1 on first run; step changes mid-run do not bump it', () => {
    const store = seed();
    store.push({ kind: 'slice', id: 'login', epicId: 'api', status: 'running', step: 'tests' });
    expect(attemptsOf(store)).toBe(1);
    store.push({ kind: 'slice', id: 'login', epicId: 'api', status: 'running', step: 'code' });
    store.push({ kind: 'slice', id: 'login', epicId: 'api', status: 'running', step: 'verify' });
    expect(attemptsOf(store)).toBe(1); // running→running keeps the count
  });

  it('bumps the attempt on a retry (failed → running) and keeps it on terminal failure', () => {
    const store = seed();
    store.push({ kind: 'slice', id: 'login', epicId: 'api', status: 'running', step: 'verify' });
    store.push({ kind: 'slice', id: 'login', epicId: 'api', status: 'failed', reason: 'tests failed' });
    store.push({ kind: 'slice', id: 'login', epicId: 'api', status: 'running', step: 'code' });
    expect(attemptsOf(store)).toBe(2); // failed→running is attempt 2
    store.push({ kind: 'slice', id: 'login', epicId: 'api', status: 'failed', reason: 'tests failed' });
    expect(attemptsOf(store)).toBe(2); // terminal failure keeps the count
  });
});
