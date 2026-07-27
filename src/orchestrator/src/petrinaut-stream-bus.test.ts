import { describe, expect, it } from 'vitest';

import type { PetrinautEvent } from './petrinaut-events.js';
import type { SdcpnFile } from './petrinaut-sdcpn.js';
import { type BrunchExecutionExportFrame, createPetrinautStreamBus } from './petrinaut-stream-bus.js';
import { type BrunchExecutionExport, reduceBrunchExecutionExport } from './petrinaut-stream-export.js';

// ---------------------------------------------------------------------------
// Minimal SdcpnFile fixture — three-place / two-transition net mirroring the
// arc-scoped delta oracle in petrinaut-stream-export.test.ts. The bus is
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
      'status',
      'definition',
      'initial_state',
      'transition_firing',
      'transition_firing',
      'transition_firing',
      'transition_firing', // synthetic run:finish (Card C)
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
    // Three real firings, then the synthetic run:finish (Card C).
    expect(firings.map((f) => f.firing.transitionId)).toEqual([
      't-consume',
      't-consume',
      't-emit',
      'run:finish',
    ]);
    // Arc-scoped deltas (FE-819, A99): `input` is only the tokens consumed
    // from the transition's input-arc places, `output` only the new tokens
    // produced into its output-arc places — never untouched places.
    expect(firings[0]!.firing.input).toEqual({ src: 1 });
    expect(firings[0]!.firing.output).toEqual({ middle: 1 });
    expect(firings[0]!.firing.ts).toBe('2026-06-02T00:00:00.100Z');
    expect(firings[1]!.firing.input).toEqual({ src: 1 });
    expect(firings[1]!.firing.output).toEqual({ middle: 1 });
    expect(firings[2]!.firing.input).toEqual({ middle: 1 });
    expect(firings[2]!.firing.output).toEqual({ dst: 1 });
    // The synthetic run:finish consumes nothing and produces one status token
    // (the `halted` fixture carries no reason → run:halted).
    expect(firings[3]!.firing.input).toEqual({});
    expect(firings[3]!.firing.output).toEqual({ 'run:halted': 1 });
  });

  it('delivers independent firing objects — mutating one frame does not affect another', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));

    bus.publish(initialEvent);
    bus.publish(consumeA);
    const firstFiring = frames.find(
      (f): f is Extract<BrunchExecutionExportFrame, { kind: 'transition_firing' }> =>
        f.kind === 'transition_firing',
    );
    expect(firstFiring).toBeDefined();

    firstFiring!.firing.output.src = 99;
    firstFiring!.firing.output.middle = 99;

    bus.publish(consumeB);
    const firings = frames.filter(
      (f): f is Extract<BrunchExecutionExportFrame, { kind: 'transition_firing' }> =>
        f.kind === 'transition_firing',
    );
    expect(firings[1]!.firing.input).toEqual({ src: 1 });
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

    expect(frames.map((f) => f.kind)).toEqual([
      'status',
      'definition',
      'initial_state',
      'transition_firing', // synthetic run:finish (Card C)
      'terminal',
    ]);
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
      'status',
      'definition',
      'initial_state',
      'transition_firing',
      'transition_firing',
      'transition_firing',
      'transition_firing', // synthetic run:finish (Card C)
      'terminal',
    ]);
  });

  it('replays buffered frames then delivers subsequent live frames', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    bus.publish(initialEvent);
    bus.publish(consumeA);

    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));
    // synchronous replay of status + definition + initial_state + 1 firing
    const replayLength = frames.length;
    expect(replayLength).toBe(4);

    bus.publish(consumeB);
    bus.publish(emitC);
    bus.publish(halted);

    expect(frames.map((f) => f.kind)).toEqual([
      'status',
      'definition',
      'initial_state',
      'transition_firing',
      'transition_firing',
      'transition_firing',
      'transition_firing', // synthetic run:finish (Card C)
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
    expect(b.map((f) => f.kind)).toEqual([
      'status',
      'definition',
      'initial_state',
      'transition_firing',
      'transition_firing', // synthetic run:finish (Card C)
      'terminal',
    ]);
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
// FE-819 Card B — terminal status fidelity + leading status frame.
//
// The wire must let any consumer observe the run's terminal state
// (completed | halted | deadlocked) and halt reason both at connect time
// (leading `status` frame) and at run end (enriched `terminal` frame), and a
// halted run's definition title must reflect the halt — without breaking the
// current consumer (terminal still closes the stream; `status` is additive).
// ---------------------------------------------------------------------------

const haltedWithReason: PetrinautEvent = {
  kind: 'net_halted',
  ts: '2026-06-02T00:00:00.500Z',
  runId: 'run-bus',
  reason: 'unique retry exhaustion on 2 slices',
};

describe('createPetrinautStreamBus — terminal status fidelity (Card B)', () => {
  it('terminal frame carries state=halted + the verbatim halt reason', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));
    bus.publish(initialEvent);
    bus.publish(haltedWithReason);

    const terminal = frames.find((f) => f.kind === 'terminal');
    expect(terminal).toMatchObject({
      kind: 'terminal',
      state: 'halted',
      reason: 'unique retry exhaustion on 2 slices',
    });
  });

  it('terminal frame carries state=completed with no reason for a clean run', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));
    bus.publish(initialEvent);
    bus.publish(completed);

    const terminal = frames.find((f) => f.kind === 'terminal');
    expect(terminal).toEqual({ kind: 'terminal', state: 'completed' });
  });

  it('terminal frame carries state=deadlocked', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));
    bus.publish(initialEvent);
    bus.publish({ kind: 'net_deadlocked', ts: '2026-06-02T00:00:00.600Z', runId: 'run-bus' });

    const terminal = frames.find((f) => f.kind === 'terminal');
    expect(terminal).toEqual({ kind: 'terminal', state: 'deadlocked' });
  });

  it('every connection leads with a status frame — running mid-run', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));
    bus.publish(initialEvent);

    expect(frames[0]).toEqual({ kind: 'status', state: 'running' });
  });

  it('a late joiner to a halted run leads with a status frame carrying the terminal state + reason', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    bus.publish(initialEvent);
    bus.publish(haltedWithReason);

    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));

    expect(frames[0]).toEqual({
      kind: 'status',
      state: 'halted',
      reason: 'unique retry exhaustion on 2 slices',
    });
  });

  it('at a halt, the definition re-emits with the title suffixed "— halted: <reason>"', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));
    bus.publish(initialEvent);
    bus.publish(haltedWithReason);

    const definitions = frames.filter(
      (f): f is Extract<BrunchExecutionExportFrame, { kind: 'definition' }> => f.kind === 'definition',
    );
    // Original definition on subscribe, then a re-emit with the halt-suffixed title before terminal.
    expect(definitions.at(-1)!.definition.title).toBe(
      'stream-bus-fixture — halted: unique retry exhaustion on 2 slices',
    );
  });

  it('a late joiner to a halted run replays a single definition with the halt-suffixed title', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    bus.publish(initialEvent);
    bus.publish(haltedWithReason);

    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));

    const definitions = frames.filter(
      (f): f is Extract<BrunchExecutionExportFrame, { kind: 'definition' }> => f.kind === 'definition',
    );
    expect(definitions).toHaveLength(1);
    expect(definitions[0]!.definition.title).toBe(
      'stream-bus-fixture — halted: unique retry exhaustion on 2 slices',
    );
  });

  it('a completed run keeps the original definition title', () => {
    const bus = createPetrinautStreamBus({ runId: 'run-bus', sdcpnFile });
    const frames: BrunchExecutionExportFrame[] = [];
    bus.subscribe((f) => frames.push(f));
    bus.publish(initialEvent);
    bus.publish(completed);

    const definitions = frames.filter(
      (f): f is Extract<BrunchExecutionExportFrame, { kind: 'definition' }> => f.kind === 'definition',
    );
    for (const d of definitions) expect(d.definition.title).toBe('stream-bus-fixture');
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
      },
    };
    const status: BrunchExecutionExportFrame = { kind: 'status', state: 'running' };
    const init: BrunchExecutionExportFrame = { kind: 'initial_state', initialState: { p: 1 } };
    const firing: BrunchExecutionExportFrame = {
      kind: 'transition_firing',
      firing: { transitionId: 't', input: { p: 1 }, output: { q: 1 }, ts: '2026' },
    };
    const term: BrunchExecutionExportFrame = { kind: 'terminal', state: 'halted', reason: 'boom' };
    expect([def.kind, status.kind, init.kind, firing.kind, term.kind]).toEqual([
      'definition',
      'status',
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
