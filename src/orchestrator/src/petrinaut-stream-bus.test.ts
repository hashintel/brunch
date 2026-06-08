import { describe, expect, it } from 'vitest';

import type { PetrinautEvent } from './petrinaut-events.js';
import type { SdcpnFile } from './petrinaut-sdcpn.js';
import { type BrunchExecutionExportFrame, createPetrinautStreamBus } from './petrinaut-stream-bus.js';
import { type BrunchExecutionExport, reduceBrunchExecutionExport } from './petrinaut-stream-export.js';

// ---------------------------------------------------------------------------
// Minimal SdcpnFile fixture — three-place / two-transition net mirroring the
// frame-replay oracle in petrinaut-stream-export.test.ts. The bus is
// fold-agnostic; the SDCPN content only matters to the `definition` frame.
// ---------------------------------------------------------------------------

const sdcpnFile: SdcpnFile = {
  version: 1,
  meta: { generator: 'brunch', generatorVersion: '0.2.0' },
  title: 'stream-bus-fixture',
  places: [
    { id: 'src', name: 'Src', colorId: null, dynamicsEnabled: false, differentialEquationId: null },
    { id: 'middle', name: 'Middle', colorId: null, dynamicsEnabled: false, differentialEquationId: null },
    { id: 'dst', name: 'Dst', colorId: null, dynamicsEnabled: false, differentialEquationId: null },
  ],
  transitions: [
    {
      id: 't-consume',
      name: 'TConsume',
      inputArcs: [{ placeId: 'src', weight: 1, type: 'standard' }],
      outputArcs: [{ placeId: 'middle', weight: 1 }],
      lambdaType: 'predicate',
      lambdaCode: '',
      transitionKernelCode: '',
    },
    {
      id: 't-emit',
      name: 'TEmit',
      inputArcs: [{ placeId: 'middle', weight: 1, type: 'standard' }],
      outputArcs: [{ placeId: 'dst', weight: 1 }],
      lambdaType: 'predicate',
      lambdaCode: '',
      transitionKernelCode: '',
    },
  ],
  types: [],
  differentialEquations: [],
  parameters: [],
  scenarios: [],
  metrics: [],
};

const initialEvent: PetrinautEvent = {
  kind: 'initial_marking',
  ts: '2026-06-02T00:00:00.000Z',
  runId: 'run-bus',
  marking: { src: [{ id: 'tk-a' }, { id: 'tk-b' }] },
};

const consumeA: PetrinautEvent = {
  kind: 'transition_fired',
  ts: '2026-06-02T00:00:00.100Z',
  runId: 'run-bus',
  transitionName: 't-consume',
  input: { src: [{ id: 'tk-a' }] },
  output: { middle: [{ id: 'tk-c' }] },
};

const consumeB: PetrinautEvent = {
  kind: 'transition_fired',
  ts: '2026-06-02T00:00:00.200Z',
  runId: 'run-bus',
  transitionName: 't-consume',
  input: { src: [{ id: 'tk-b' }] },
  output: { middle: [{ id: 'tk-d' }] },
};

const emitC: PetrinautEvent = {
  kind: 'transition_fired',
  ts: '2026-06-02T00:00:00.300Z',
  runId: 'run-bus',
  transitionName: 't-emit',
  input: { middle: [{ id: 'tk-c' }] },
  output: { dst: [{ id: 'tk-e' }] },
};

const halted: PetrinautEvent = {
  kind: 'net_halted',
  ts: '2026-06-02T00:00:00.500Z',
  runId: 'run-bus',
};
const completed: PetrinautEvent = {
  kind: 'net_completed',
  ts: '2026-06-02T00:00:00.500Z',
  runId: 'run-bus',
};

const allEvents: PetrinautEvent[] = [initialEvent, consumeA, consumeB, emitC, halted];

// ---------------------------------------------------------------------------
// Subscriber attached pre-publish — every PetrinautEvent translates 1:1 into
// the expected BrunchExecutionExportFrame kind in order.
// ---------------------------------------------------------------------------

describe('createPetrinautStreamBus — frame translation (pre-subscribed)', () => {
  it('emits definition → initial_state → N transition_firing → terminal in order', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));
    for (const e of allEvents) bus.publish(e);

    expect(frames.map((f) => f.kind)).toEqual([
      'definition',
      'initial_state',
      'transition_firing',
      'transition_firing',
      'transition_firing',
      'terminal',
    ]);
  });

  it('translates each transition_fired event via the shared eventToTransitionFiring helper', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));
    for (const e of allEvents) bus.publish(e);

    const firings = frames.filter(
      (f): f is Extract<BrunchExecutionExportFrame, { kind: 'transition_firing' }> =>
        f.kind === 'transition_firing',
    );
    expect(firings.map((f) => f.firing.transitionId)).toEqual(['t-consume', 't-consume', 't-emit']);
    expect(firings[0]!.firing.input).toEqual({ src: 1 });
    expect(firings[0]!.firing.output).toEqual({ middle: 1 });
    expect(firings[0]!.firing.ts).toBe('2026-06-02T00:00:00.100Z');
  });

  it('emits exactly one definition frame even if subscribe is called before any publish', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));

    // Pre-publish subscribers receive definition immediately on subscribe —
    // the SDCPN file is known at bus-construction time.
    expect(frames.filter((f) => f.kind === 'definition')).toHaveLength(1);
  });

  it('emits at most one terminal frame even if both net_halted and net_deadlocked publish', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));
    bus.publish(initialEvent);
    bus.publish(halted);
    bus.publish({ kind: 'net_deadlocked', ts: '2026-06-02T00:00:00.600Z', runId: 'run-bus' });

    expect(frames.filter((f) => f.kind === 'terminal')).toHaveLength(1);
  });

  it('emits a terminal frame when a completed run publishes net_completed', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));
    bus.publish(initialEvent);
    bus.publish(completed);

    expect(frames.map((f) => f.kind)).toEqual(['definition', 'initial_state', 'terminal']);
  });

  it('does not deliver further frames to a subscriber after the terminal frame', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));
    for (const e of allEvents) bus.publish(e);
    const afterTerminal = frames.length;

    // Publishing additional events after terminal must not produce more frames.
    bus.publish({
      kind: 'transition_fired',
      ts: '2026-06-02T00:00:00.999Z',
      runId: 'run-bus',
      transitionName: 't-emit',
      input: { middle: [{ id: 'tk-d' }] },
      output: { dst: [{ id: 'tk-f' }] },
    });
    expect(frames.length).toBe(afterTerminal);
  });
});

// ---------------------------------------------------------------------------
// Replay-on-subscribe — late subscribers get the full buffered timeline
// synchronously, then any further live frames.
// ---------------------------------------------------------------------------

describe('createPetrinautStreamBus — replay-on-subscribe', () => {
  it('replays the full back-buffer synchronously to a subscriber attached after publishing', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    for (const e of allEvents) bus.publish(e);

    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));

    expect(frames.map((f) => f.kind)).toEqual([
      'definition',
      'initial_state',
      'transition_firing',
      'transition_firing',
      'transition_firing',
      'terminal',
    ]);
  });

  it('replays buffered frames then delivers subsequent live frames', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    bus.publish(initialEvent);
    bus.publish(consumeA);

    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));
    // synchronous replay of definition + initial_state + 1 firing
    const replayLength = frames.length;
    expect(replayLength).toBe(3);

    bus.publish(consumeB);
    bus.publish(emitC);
    bus.publish(halted);

    expect(frames.map((f) => f.kind)).toEqual([
      'definition',
      'initial_state',
      'transition_firing',
      'transition_firing',
      'transition_firing',
      'terminal',
    ]);
  });

  it('does not deliver the same frame twice to a subscriber attached between publishes', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    bus.publish(initialEvent);
    bus.publish(consumeA);

    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));
    bus.publish(consumeB);

    const firings = frames.filter((f) => f.kind === 'transition_firing');
    expect(firings).toHaveLength(2);
    expect(firings[0]).not.toBe(firings[1]);
  });
});

// ---------------------------------------------------------------------------
// Unsubscribe semantics
// ---------------------------------------------------------------------------

describe('createPetrinautStreamBus — unsubscribe', () => {
  it('halts delivery to the cancelled subscriber while others keep receiving', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    const a: BrunchExecutionExportFrame[] = [];
    const b: BrunchExecutionExportFrame[] = [];
    const unsubA = bus.subscribe((f) => a.push(f));
    bus.subscribe((f) => b.push(f));

    bus.publish(initialEvent);
    const aBeforeUnsub = a.length;
    unsubA();
    bus.publish(consumeA);
    bus.publish(halted);

    // a froze at the unsub moment; b received everything.
    expect(a.length).toBe(aBeforeUnsub);
    expect(b.map((f) => f.kind)).toEqual(['definition', 'initial_state', 'transition_firing', 'terminal']);
  });
});

// ---------------------------------------------------------------------------
// Replay-equivalence oracle — frame stream and static reducer agree.
// ---------------------------------------------------------------------------

describe('createPetrinautStreamBus — replay-equivalence with the static reducer', () => {
  it('frames collected from a pre-subscribed observer fold back into the static reducer output', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));
    for (const e of allEvents) bus.publish(e);

    const fromBus = foldFramesToExport(frames);
    const fromReducer = reduceBrunchExecutionExport({ sdcpnFile, events: allEvents });
    expect(fromBus).toEqual(fromReducer);
  });

  it('frames collected from a late subscriber (post-publish) fold back to the same export', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    for (const e of allEvents) bus.publish(e);
    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));

    const fromBus = foldFramesToExport(frames);
    const fromReducer = reduceBrunchExecutionExport({ sdcpnFile, events: allEvents });
    expect(fromBus).toEqual(fromReducer);
  });
});

// ---------------------------------------------------------------------------
// Type-level pin — frame discriminated union shape is locked.
// ---------------------------------------------------------------------------

describe('BrunchExecutionExportFrame type exports', () => {
  it('exports the locked discriminated union kinds', () => {
    const def: BrunchExecutionExportFrame = {
      kind: 'definition',
      definition: {
        version: 1,
        meta: { generator: 'brunch' },
        title: 't',
        places: [],
        transitions: [],
        types: [],
      },
    };
    const init: BrunchExecutionExportFrame = { kind: 'initial_state', initialState: { p: 1 } };
    const firing: BrunchExecutionExportFrame = {
      kind: 'transition_firing',
      firing: { transitionId: 't', input: { p: 1 }, output: { q: 1 }, ts: '2026' },
    };
    const term: BrunchExecutionExportFrame = { kind: 'terminal' };
    expect([def.kind, init.kind, firing.kind, term.kind]).toEqual([
      'definition',
      'initial_state',
      'transition_firing',
      'terminal',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Helper: re-fold a frame sequence into the BrunchExecutionExport bundle.
// ---------------------------------------------------------------------------

function foldFramesToExport(frames: readonly BrunchExecutionExportFrame[]): BrunchExecutionExport {
  let definition: BrunchExecutionExport['definition'] | undefined;
  let initialState: BrunchExecutionExport['initialState'] | undefined;
  const transitionFirings: BrunchExecutionExport['transitionFirings'] = [];
  for (const f of frames) {
    if (f.kind === 'definition') definition = f.definition;
    else if (f.kind === 'initial_state') initialState = f.initialState;
    else if (f.kind === 'transition_firing') transitionFirings.push(f.firing);
  }
  if (!definition) throw new Error('foldFramesToExport: missing definition frame');
  if (!initialState) throw new Error('foldFramesToExport: missing initial_state frame');
  return { definition, initialState, transitionFirings };
}
