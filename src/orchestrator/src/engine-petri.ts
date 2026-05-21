import { createReport } from './report-helpers.js';
import type {
  ActionContext,
  EpicOutcome,
  Orchestrator,
  OrchestratorInput,
  OrchestratorResult,
  ReportSink,
  SliceOutcome,
} from './types.js';

// ---------------------------------------------------------------------------
// Petri net primitives
// ---------------------------------------------------------------------------

type Token = {
  reportId?: string;
  sliceId: string;
  epicId: string;
};

type TransitionDef = {
  id: string;
  inputs: string[];
  fire: (consumed: Token[]) => Promise<{ place: string; token: Token }[]>;
};

class PetriNet {
  private places = new Map<string, Token[]>();
  private transitions: TransitionDef[] = [];

  addPlace(id: string): void {
    this.places.set(id, []);
  }

  addToken(placeId: string, token: Token): void {
    const tokens = this.places.get(placeId);
    if (!tokens) throw new Error(`Unknown place: ${placeId}`);
    tokens.push(token);
  }

  addTransition(def: TransitionDef): void {
    this.transitions.push(def);
  }

  hasTokens(placeId: string): boolean {
    const tokens = this.places.get(placeId);
    return !!tokens && tokens.length > 0;
  }

  async run(shouldHalt?: () => boolean): Promise<void> {
    while (true) {
      if (shouldHalt?.()) break;

      const enabled = this.transitions.find((t) =>
        t.inputs.every((p) => {
          const tokens = this.places.get(p);
          return tokens && tokens.length > 0;
        }),
      );
      if (!enabled) break;

      // Consume one token per input place
      const consumed: Token[] = [];
      for (const p of enabled.inputs) {
        consumed.push(this.places.get(p)!.shift()!);
      }

      // Fire — handler decides outputs
      const outputs = await enabled.fire(consumed);
      for (const { place, token } of outputs) {
        this.addToken(place, token);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Net compiler — plan → petri net
// ---------------------------------------------------------------------------

function p(sliceId: string, place: string): string {
  return `slice:${sliceId}:${place}`;
}

function ep(epicId: string, place: string): string {
  return `epic:${epicId}:${place}`;
}

function compilePlan(input: OrchestratorInput, ctx: RunCtx): PetriNet {
  const net = new PetriNet();
  const { plan, actions, testRunner, reports, policy } = input;

  // Epic-level places
  for (const epic of plan.epics) {
    net.addPlace(ep(epic.id, 'done'));
  }

  // Helper: fan out epic readiness to all its slices' eligible places
  function epicReadyOutputs(epicId: string): { place: string; token: Token }[] {
    return plan.slices
      .filter((s) => s.epic_id === epicId)
      .map((s) => ({ place: p(s.id, 'eligible'), token: { sliceId: s.id, epicId } }));
  }

  // Seed epic readiness — epics with no deps start ready
  // (deferred until eligible places exist — see below)
  const seedEpics = plan.epics.filter((e) => e.depends_on.length === 0);

  // Epic dependency wiring — per-dependent signal places (avoids token starvation
  // when multiple epics depend on the same predecessor)
  for (const epic of plan.epics) {
    if (epic.depends_on.length > 0) {
      const signalPlaces = epic.depends_on.map((depId) => {
        const signalPlace = ep(depId, `dep-signal:${epic.id}`);
        net.addPlace(signalPlace);
        return signalPlace;
      });
      net.addTransition({
        id: `epic-deps-met:${epic.id}`,
        inputs: signalPlaces,
        fire: async () => epicReadyOutputs(epic.id),
      });
    }
  }

  // Per-slice inner loop
  for (const slice of plan.slices) {
    const epic = plan.epics.find((e) => e.id === slice.epic_id)!;
    const sid = slice.id;
    const baseToken: Token = { sliceId: sid, epicId: epic.id };

    // Places
    for (const name of [
      'spec-ready',
      'test-agent',
      'code-agent',
      'failing-tests',
      'untested-code',
      'needs-more',
      'done-spec',
      'completed',
    ]) {
      net.addPlace(p(sid, name));
    }

    // Initial tokens (agent resources)
    net.addToken(p(sid, 'test-agent'), { ...baseToken });
    net.addToken(p(sid, 'code-agent'), { ...baseToken });

    // Slice readiness gate — collects per-slice prerequisite tokens
    net.addPlace(p(sid, 'eligible'));

    if (slice.depends_on.length === 0) {
      // No slice deps — eligible when epic is ready (token seeded below)
      net.addTransition({
        id: `slice-ready:${sid}`,
        inputs: [p(sid, 'eligible')],
        fire: async () => [{ place: p(sid, 'spec-ready'), token: { ...baseToken } }],
      });
    } else {
      // Has slice deps — eligible needs its own token AND all dep completions
      const gateInputs = [p(sid, 'eligible'), ...slice.depends_on.map((d) => p(d, 'dep-signal:' + sid))];
      for (const depId of slice.depends_on) {
        net.addPlace(p(depId, 'dep-signal:' + sid));
      }
      net.addTransition({
        id: `slice-ready:${sid}`,
        inputs: gateInputs,
        fire: async () => [{ place: p(sid, 'spec-ready'), token: { ...baseToken } }],
      });
    }

    const actCtx: ActionContext = {
      slice,
      epic,
      plan,
      worktreeDir: input.worktreeDir,
      reports,
    };

    // Evaluate — conditional: NO → needs-more, YES → done-spec
    net.addTransition({
      id: `${sid}:evaluate`,
      inputs: [p(sid, 'spec-ready'), p(sid, 'test-agent')],
      fire: async (consumed) => {
        const reportId = await actions['evaluate-done'](actCtx);
        ctx.reportIds.push(reportId);
        const report = reports.getById(reportId);
        const done = !!(report?.payload as { done?: boolean })?.done;
        const tok: Token = { ...consumed[0]!, reportId };
        if (done) {
          return [
            { place: p(sid, 'done-spec'), token: tok },
            { place: p(sid, 'test-agent'), token: { ...baseToken } },
          ];
        }
        return [
          { place: p(sid, 'needs-more'), token: tok },
          { place: p(sid, 'test-agent'), token: { ...baseToken } },
        ];
      },
    });

    // Write tests
    net.addTransition({
      id: `${sid}:write-tests`,
      inputs: [p(sid, 'needs-more'), p(sid, 'test-agent')],
      fire: async (consumed) => {
        const reportId = await actions['write-tests'](actCtx);
        ctx.reportIds.push(reportId);
        return [
          { place: p(sid, 'failing-tests'), token: { ...consumed[0]!, reportId } },
          { place: p(sid, 'test-agent'), token: { ...baseToken } },
        ];
      },
    });

    // Write code
    net.addTransition({
      id: `${sid}:write-code`,
      inputs: [p(sid, 'failing-tests'), p(sid, 'code-agent')],
      fire: async (consumed) => {
        const reportId = await actions['write-code'](actCtx);
        ctx.reportIds.push(reportId);
        return [
          { place: p(sid, 'untested-code'), token: { ...consumed[0]!, reportId } },
          { place: p(sid, 'code-agent'), token: { ...baseToken } },
        ];
      },
    });

    // Run tests — orchestrator-owned, deterministic
    const retryKey = `retry:${sid}`;
    ctx.retries.set(retryKey, 0);

    net.addTransition({
      id: `${sid}:run-tests`,
      inputs: [p(sid, 'untested-code')],
      fire: async (consumed) => {
        const target = slice.verification[0]?.target ?? '';
        const result = await testRunner.run(target, input.worktreeDir);
        const reportId = createReport(reports, {
          epicId: epic.id,
          sliceId: sid,
          actor: 'test-runner',
          event: 'tests-run',
          payload: { passed: result.passed, output: result.output },
        });
        ctx.reportIds.push(reportId);

        const tok: Token = { ...consumed[0]!, reportId };
        if (result.passed) {
          ctx.retries.set(retryKey, 0);
          return [{ place: p(sid, 'spec-ready'), token: tok }];
        }
        const retryCount = ctx.retries.get(retryKey)!;
        if (retryCount >= policy.maxRetries) {
          ctx.sliceOutcomes.set(sid, { sliceId: sid, status: 'halted' });
          ctx.halted = true;
          ctx.haltReason = `Slice ${sid} retry exhaustion`;
          return []; // dead end — no output tokens
        }
        ctx.retries.set(retryKey, retryCount + 1);
        return [{ place: p(sid, 'failing-tests'), token: tok }];
      },
    });

    // Return DONE — also emit dep-signal tokens for downstream slices
    const dependents = plan.slices.filter((s) => s.depends_on.includes(sid));
    net.addTransition({
      id: `${sid}:return-done`,
      inputs: [p(sid, 'done-spec')],
      fire: async () => {
        ctx.sliceOutcomes.set(sid, { sliceId: sid, status: 'completed' });
        const outputs: { place: string; token: Token }[] = [
          { place: p(sid, 'completed'), token: { ...baseToken } },
        ];
        for (const dep of dependents) {
          outputs.push({ place: p(sid, 'dep-signal:' + dep.id), token: { ...baseToken } });
        }
        return outputs;
      },
    });
  }

  // Seed eligible places for epics with no dependencies
  for (const epic of seedEpics) {
    for (const output of epicReadyOutputs(epic.id)) {
      net.addToken(output.place, output.token);
    }
  }

  // Epic completion — all slices done → epic verification → epic done
  for (const epic of plan.epics) {
    const epicSlices = plan.slices.filter((s) => s.epic_id === epic.id);
    const completedPlaces = epicSlices.map((s) => p(s.id, 'completed'));

    if (epicSlices.length === 0) continue;

    // Find epics that depend on this one — emit dep-signal tokens on completion
    const epicDependents = plan.epics.filter((e) => e.depends_on.includes(epic.id));
    function epicDoneOutputs(): { place: string; token: Token }[] {
      const outputs: { place: string; token: Token }[] = [
        { place: ep(epic.id, 'done'), token: { sliceId: '', epicId: epic.id } },
      ];
      for (const dep of epicDependents) {
        outputs.push({ place: ep(epic.id, `dep-signal:${dep.id}`), token: { sliceId: '', epicId: epic.id } });
      }
      return outputs;
    }

    if (epic.verification.length === 0) {
      // No verification — slices done → epic done
      net.addTransition({
        id: `epic-complete:${epic.id}`,
        inputs: completedPlaces,
        fire: async () => {
          ctx.epicOutcomes.set(epic.id, { epicId: epic.id, status: 'completed' });
          return epicDoneOutputs();
        },
      });
    } else {
      // With verification — slices done → verify → epic done
      const verifyPlace = ep(epic.id, 'verify-ready');
      net.addPlace(verifyPlace);

      net.addTransition({
        id: `epic-slices-done:${epic.id}`,
        inputs: completedPlaces,
        fire: async () => [{ place: verifyPlace, token: { sliceId: '', epicId: epic.id } }],
      });

      net.addTransition({
        id: `epic-verify:${epic.id}`,
        inputs: [verifyPlace],
        fire: async () => {
          const verifyCtx: ActionContext = {
            slice: epicSlices[0]!,
            epic,
            plan,
            worktreeDir: input.worktreeDir,
            reports,
          };
          const reportId = await actions['verify-epic'](verifyCtx);
          ctx.reportIds.push(reportId);
          const report = reports.getById(reportId);
          const passed = !!(report?.payload as { passed?: boolean })?.passed;
          if (passed) {
            ctx.epicOutcomes.set(epic.id, { epicId: epic.id, status: 'completed' });
            return epicDoneOutputs();
          }
          ctx.epicOutcomes.set(epic.id, { epicId: epic.id, status: 'halted' });
          ctx.halted = true;
          ctx.haltReason = `Epic ${epic.id} verification failed`;
          return []; // dead end
        },
      });
    }
  }

  return net;
}

// ---------------------------------------------------------------------------
// Mutable run context
// ---------------------------------------------------------------------------

type RunCtx = {
  reportIds: string[];
  sliceOutcomes: Map<string, SliceOutcome>;
  epicOutcomes: Map<string, EpicOutcome>;
  retries: Map<string, number>;
  halted: boolean;
  haltReason?: string;
};

// ---------------------------------------------------------------------------
// PetriOrchestrator — implements Orchestrator
// ---------------------------------------------------------------------------

export class PetriOrchestrator implements Orchestrator {
  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    const ctx: RunCtx = {
      reportIds: [],
      sliceOutcomes: new Map(),
      epicOutcomes: new Map(),
      retries: new Map(),
      halted: false,
    };

    try {
      const net = compilePlan(input, ctx);
      await net.run(() => ctx.halted);
    } catch (err) {
      return {
        status: 'halted',
        reason: err instanceof Error ? err.message : String(err),
        reports: ctx.reportIds,
        epics: input.plan.epics.map(
          (e) => ctx.epicOutcomes.get(e.id) ?? { epicId: e.id, status: 'halted' as const },
        ),
        slices: input.plan.slices.map(
          (s) => ctx.sliceOutcomes.get(s.id) ?? { sliceId: s.id, status: 'halted' as const },
        ),
      };
    }

    // Fill in any slices/epics not yet in outcomes (e.g. never reached)
    for (const slice of input.plan.slices) {
      if (!ctx.sliceOutcomes.has(slice.id)) {
        ctx.sliceOutcomes.set(slice.id, { sliceId: slice.id, status: 'halted' });
        ctx.halted = true;
        ctx.haltReason ??= 'Some slices were never reached';
      }
    }
    for (const epic of input.plan.epics) {
      if (!ctx.epicOutcomes.has(epic.id)) {
        ctx.epicOutcomes.set(epic.id, { epicId: epic.id, status: 'halted' });
        ctx.halted = true;
        ctx.haltReason ??= 'Some epics were never reached';
      }
    }

    return {
      status: ctx.halted ? 'halted' : 'completed',
      reason: ctx.haltReason,
      reports: ctx.reportIds,
      epics: input.plan.epics.map((e) => ctx.epicOutcomes.get(e.id)!),
      slices: input.plan.slices.map((s) => ctx.sliceOutcomes.get(s.id)!),
    };
  }
}
