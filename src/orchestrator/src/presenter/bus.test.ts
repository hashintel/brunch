import { describe, expect, it, vi } from 'vitest';

import { CookBus } from './bus.js';
import type { CookEvent, Presenter } from './events.js';

function recorder(): Presenter & { events: CookEvent[] } {
  const events: CookEvent[] = [];
  return { events, onEvent: (e) => events.push(e), dispose: () => {} };
}

const ev: CookEvent = { kind: 'plan-start', specId: 2, outDir: '/x' };

describe('CookBus', () => {
  it('fans every event out to all subscribed presenters in order', () => {
    const a = recorder();
    const b = recorder();
    const bus = new CookBus();
    bus.subscribe(a);
    bus.subscribe(b);

    bus.emit(ev);
    bus.emit({ kind: 'plan-written', path: '/p', epics: 1, slices: 2 });

    expect(a.events.map((e) => e.kind)).toEqual(['plan-start', 'plan-written']);
    expect(b.events).toEqual(a.events);
  });

  it('isolates a throwing presenter so it cannot abort the run or starve siblings', () => {
    const warn = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});
    const boom: Presenter = {
      onEvent: () => {
        throw new Error('render-boom');
      },
      dispose: () => {},
    };
    const ok = recorder();
    const bus = new CookBus();
    bus.subscribe(boom);
    bus.subscribe(ok);

    expect(() => bus.emit(ev)).not.toThrow();
    expect(ok.events).toEqual([ev]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('disposes every presenter, swallowing dispose errors', async () => {
    const disposed: string[] = [];
    const boom: Presenter = {
      onEvent: () => {},
      dispose: () => {
        throw new Error('dispose-boom');
      },
    };
    const ok: Presenter = { onEvent: () => {}, dispose: () => void disposed.push('ok') };
    const bus = new CookBus();
    bus.subscribe(boom);
    bus.subscribe(ok);

    await expect(bus.dispose()).resolves.toBeUndefined();
    expect(disposed).toEqual(['ok']);
  });
});
