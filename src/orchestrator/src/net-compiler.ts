// ---------------------------------------------------------------------------
// Net compiler — two-pass pipeline:
//   1. compileTopology(plan, policy) → NetBlueprint  (pure, no runtime refs)
//   2. wireHandlers(blueprint, input, ctx) → PetriNet (attaches fire closures)
//   3. compilePlan(input, ctx) → PetriNet            (convenience wrapper)
// ---------------------------------------------------------------------------

import type { NetBlueprint, TokenSeed, TransitionSkeleton } from './net-blueprint.js';
import { PetriNet } from './petri-net.js';
import type { Token } from './petri-net.js';
import { createReport } from './report-helpers.js';
import type { ActionContext, OrchestratorInput, Plan, RunCtx, RunPolicy } from './types.js';

// ---------------------------------------------------------------------------
// Place-id helpers
// ---------------------------------------------------------------------------

function p(sliceId: string, place: string): string {
  return `slice:${sliceId}:${place}`;
}

function ep(epicId: string, place: string): string {
  return `epic:${epicId}:${place}`;
}

// ---------------------------------------------------------------------------
// Pass 1 — compileTopology: pure function, no closures over runtime state.
// Same Plan + Policy → same blueprint. Trivially snapshot-testable.
// ---------------------------------------------------------------------------

export function compileTopology(plan: Plan, policy: RunPolicy): NetBlueprint {
  const places: string[] = [];
  const transitions: TransitionSkeleton[] = [];
  const initialTokens: { place: string; token: TokenSeed }[] = [];

  // Epic-level places
  for (const epic of plan.epics) {
    places.push(ep(epic.id, 'done'));
  }

  // Epic dependency wiring
  for (const epic of plan.epics) {
    if (epic.depends_on.length > 0) {
      const signalPlaces = epic.depends_on.map((depId) => {
        const signalPlace = ep(depId, `dep-signal:${epic.id}`);
        places.push(signalPlace);
        return signalPlace;
      });
      // Fan out epic readiness to all its slices' eligible places
      const sliceOutputs = plan.slices
        .filter((s) => s.epic_id === epic.id)
        .map((s) => ({ place: p(s.id, 'eligible'), sliceId: s.id, epicId: epic.id }));
      transitions.push({
        id: `epic-deps-met:${epic.id}`,
        inputs: signalPlaces,
        contract: { kind: 'structural', lane: 'epic', guard: 'all epic dependencies done' },
        handler: { kind: 'passthrough', outputs: sliceOutputs },
      });
    }
  }

  // Per-slice inner loop
  for (const slice of plan.slices) {
    const epic = plan.epics.find((e) => e.id === slice.epic_id)!;
    const sid = slice.id;
    const base: TokenSeed = { sliceId: sid, epicId: epic.id };

    // Places — mechanical lane
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
      places.push(p(sid, name));
    }

    // Places — semantic lane
    places.push(p(sid, 'semantic-budget'));
    places.push(p(sid, 'semantic-satisfied'));

    // Retry + semantic budget places
    places.push(p(sid, 'retry-budget'));

    // Eligibility gate
    places.push(p(sid, 'eligible'));

    // Initial tokens
    initialTokens.push(
      { place: p(sid, 'test-agent'), token: { ...base } },
      { place: p(sid, 'code-agent'), token: { ...base } },
      { place: p(sid, 'semantic-budget'), token: { ...base, reworkCount: 0 } },
      { place: p(sid, 'retry-budget'), token: { ...base, retryCount: 0 } },
    );

    // Slice readiness gate
    if (slice.depends_on.length === 0) {
      transitions.push({
        id: `slice-ready:${sid}`,
        inputs: [p(sid, 'eligible')],
        contract: { kind: 'structural', lane: 'mechanical', guard: 'slice eligible' },
        handler: {
          kind: 'passthrough',
          outputs: [{ place: p(sid, 'spec-ready'), sliceId: sid, epicId: epic.id }],
        },
      });
    } else {
      const gateInputs = [p(sid, 'eligible'), ...slice.depends_on.map((d) => p(d, `dep-signal:${sid}`))];
      for (const depId of slice.depends_on) {
        places.push(p(depId, `dep-signal:${sid}`));
      }
      transitions.push({
        id: `slice-ready:${sid}`,
        inputs: gateInputs,
        contract: { kind: 'structural', lane: 'mechanical', guard: 'slice eligible + all deps done' },
        handler: {
          kind: 'passthrough',
          outputs: [{ place: p(sid, 'spec-ready'), sliceId: sid, epicId: epic.id }],
        },
      });
    }

    // Evaluate
    transitions.push({
      id: `${sid}:evaluate`,
      inputs: [p(sid, 'spec-ready'), p(sid, 'test-agent')],
      contract: {
        kind: 'mechanical',
        lane: 'mechanical',
        actor: 'evaluator',
        guard: 'spec-ready + test-agent available',
      },
      handler: {
        kind: 'action',
        actionKey: 'evaluate-done',
        sliceId: sid,
        epicId: epic.id,
        routeField: 'done',
        onTrue: [p(sid, 'done-spec')],
        onFalse: [p(sid, 'needs-more')],
        agentReturnPlace: p(sid, 'test-agent'),
      },
    });

    // Write tests
    transitions.push({
      id: `${sid}:write-tests`,
      inputs: [p(sid, 'needs-more'), p(sid, 'test-agent')],
      contract: { kind: 'mechanical', lane: 'mechanical', actor: 'test-agent' },
      handler: {
        kind: 'action',
        actionKey: 'write-tests',
        sliceId: sid,
        epicId: epic.id,
        onTrue: [p(sid, 'failing-tests')],
        onFalse: [],
        agentReturnPlace: p(sid, 'test-agent'),
      },
    });

    // Write code
    transitions.push({
      id: `${sid}:write-code`,
      inputs: [p(sid, 'failing-tests'), p(sid, 'code-agent')],
      contract: { kind: 'mechanical', lane: 'mechanical', actor: 'coding-agent' },
      handler: {
        kind: 'action',
        actionKey: 'write-code',
        sliceId: sid,
        epicId: epic.id,
        onTrue: [p(sid, 'untested-code')],
        onFalse: [],
        agentReturnPlace: p(sid, 'code-agent'),
      },
    });

    // Run tests
    transitions.push({
      id: `${sid}:run-tests`,
      inputs: [p(sid, 'untested-code'), p(sid, 'retry-budget')],
      contract: {
        kind: 'mechanical',
        lane: 'mechanical',
        actor: 'test-runner',
        guard: 'untested-code + retry-budget available',
      },
      handler: {
        kind: 'run-tests',
        sliceId: sid,
        epicId: epic.id,
        target: slice.verification[0]?.target ?? '',
        onPass: [p(sid, 'spec-ready')],
        onFail: [p(sid, 'failing-tests')],
        budgetPlace: p(sid, 'retry-budget'),
        maxRetries: policy.maxRetries,
      },
    });

    // Assess semantic
    const maxSemantic = policy.maxSemanticReworks ?? policy.maxRetries;
    transitions.push({
      id: `${sid}:assess-semantic`,
      inputs: [p(sid, 'done-spec'), p(sid, 'semantic-budget')],
      contract: {
        kind: 'semantic',
        lane: 'semantic',
        actor: 'semantic-assessor',
        guard: 'done-spec + semantic-budget available',
      },
      handler: {
        kind: 'assess-semantic',
        actionKey: 'assess-semantic',
        sliceId: sid,
        epicId: epic.id,
        onSatisfied: [p(sid, 'semantic-satisfied')],
        onRejected: [p(sid, 'needs-more')],
        budgetPlace: p(sid, 'semantic-budget'),
        maxReworks: maxSemantic,
      },
    });

    // Return DONE
    const dependents = plan.slices.filter((s) => s.depends_on.includes(sid));
    transitions.push({
      id: `${sid}:return-done`,
      inputs: [p(sid, 'semantic-satisfied')],
      contract: { kind: 'structural', lane: 'semantic', guard: 'semantic-satisfied' },
      handler: {
        kind: 'complete-slice',
        sliceId: sid,
        epicId: epic.id,
        completedPlace: p(sid, 'completed'),
        depSignals: dependents.map((d) => p(sid, `dep-signal:${d.id}`)),
      },
    });
  }

  // Seed eligible places for epics with no dependencies
  const seedEpics = plan.epics.filter((e) => e.depends_on.length === 0);
  for (const epic of seedEpics) {
    for (const slice of plan.slices.filter((s) => s.epic_id === epic.id)) {
      initialTokens.push({ place: p(slice.id, 'eligible'), token: { sliceId: slice.id, epicId: epic.id } });
    }
  }

  // Epic completion
  for (const epic of plan.epics) {
    const epicSlices = plan.slices.filter((s) => s.epic_id === epic.id);
    if (epicSlices.length === 0) continue;

    const completedPlaces = epicSlices.map((s) => p(s.id, 'completed'));
    const epicDependents = plan.epics.filter((e) => e.depends_on.includes(epic.id));
    const depSignals = epicDependents.map((dep) => ep(epic.id, `dep-signal:${dep.id}`));

    if (epic.verification.length === 0) {
      transitions.push({
        id: `epic-complete:${epic.id}`,
        inputs: completedPlaces,
        contract: { kind: 'structural', lane: 'epic', guard: 'all slices completed' },
        handler: {
          kind: 'complete-epic',
          epicId: epic.id,
          donePlace: ep(epic.id, 'done'),
          depSignals,
        },
      });
    } else {
      const verifyPlace = ep(epic.id, 'verify-ready');
      places.push(verifyPlace);

      transitions.push({
        id: `epic-slices-done:${epic.id}`,
        inputs: completedPlaces,
        contract: { kind: 'structural', lane: 'epic', guard: 'all slices completed' },
        handler: { kind: 'passthrough', outputs: [{ place: verifyPlace, sliceId: '', epicId: epic.id }] },
      });

      const onPassOutputs = [
        { place: ep(epic.id, 'done'), sliceId: '', epicId: epic.id },
        ...depSignals.map((sig) => ({ place: sig, sliceId: '', epicId: epic.id })),
      ];
      transitions.push({
        id: `epic-verify:${epic.id}`,
        inputs: [verifyPlace],
        contract: { kind: 'mechanical', lane: 'epic', actor: 'orchestrator', guard: 'verify-ready' },
        handler: {
          kind: 'verify-epic',
          actionKey: 'verify-epic',
          epicId: epic.id,
          representativeSliceId: epicSlices[0]!.id,
          onPassOutputs,
        },
      });
    }
  }

  return { places, transitions, initialTokens };
}

// ---------------------------------------------------------------------------
// Pass 2 — wireHandlers: reads a blueprint, attaches fire closures.
// ---------------------------------------------------------------------------

export function wireHandlers(blueprint: NetBlueprint, input: OrchestratorInput, ctx: RunCtx): PetriNet {
  const net = new PetriNet();
  const { plan, actions, testRunner, reports, policy } = input;

  // Register places
  for (const place of blueprint.places) {
    net.addPlace(place);
  }

  // Register transitions with wired fire handlers
  for (const skel of blueprint.transitions) {
    const h = skel.handler;
    let fire: (consumed: Token[]) => Promise<{ place: string; token: Token }[]>;

    switch (h.kind) {
      case 'passthrough': {
        const outputs = h.outputs;
        fire = async () =>
          outputs.map((o) => ({ place: o.place, token: { sliceId: o.sliceId, epicId: o.epicId } }));
        break;
      }

      case 'action': {
        const { actionKey, sliceId, epicId, routeField, onTrue, onFalse, agentReturnPlace } = h;
        const slice = plan.slices.find((s) => s.id === sliceId)!;
        const epic = plan.epics.find((e) => e.id === epicId)!;
        const actCtx: ActionContext = { slice, epic, plan, worktreeDir: input.worktreeDir, reports };
        const baseToken: Token = { sliceId, epicId };

        fire = async (consumed) => {
          const reportId = await actions[actionKey]!(actCtx);
          ctx.reportIds.push(reportId);
          const tok: Token = { ...consumed[0]!, reportId };

          let route: string[];
          if (routeField) {
            const report = reports.getById(reportId);
            const val = !!(report?.payload as Record<string, unknown>)?.[routeField];
            route = val ? onTrue : onFalse;
          } else {
            route = onTrue;
          }

          const outputs: { place: string; token: Token }[] = route.map((pl) => ({ place: pl, token: tok }));
          if (agentReturnPlace) {
            outputs.push({ place: agentReturnPlace, token: { ...baseToken } });
          }
          return outputs;
        };
        break;
      }

      case 'run-tests': {
        const { sliceId, epicId, target, onPass, onFail, budgetPlace, maxRetries } = h;
        const baseToken: Token = { sliceId, epicId };

        fire = async (consumed) => {
          const retryToken = consumed[1]!;
          const retryCount = retryToken.retryCount ?? 0;

          const result = await testRunner.run(target, input.worktreeDir);
          const reportId = createReport(reports, {
            epicId,
            sliceId,
            actor: 'test-runner',
            event: 'tests-run',
            payload: { passed: result.passed, output: result.output },
          });
          ctx.reportIds.push(reportId);

          const tok: Token = { ...consumed[0]!, reportId };
          if (result.passed) {
            return [
              ...onPass.map((pl) => ({ place: pl, token: tok })),
              { place: budgetPlace, token: { ...baseToken, retryCount: 0 } },
            ];
          }
          if (retryCount >= maxRetries) {
            ctx.sliceOutcomes.set(sliceId, { sliceId, status: 'halted' });
            ctx.halted = true;
            ctx.haltReason = `Slice ${sliceId} retry exhaustion`;
            return [];
          }
          return [
            ...onFail.map((pl) => ({ place: pl, token: tok })),
            { place: budgetPlace, token: { ...baseToken, retryCount: retryCount + 1 } },
          ];
        };
        break;
      }

      case 'assess-semantic': {
        const { actionKey, sliceId, epicId, onSatisfied, onRejected, budgetPlace, maxReworks } = h;
        const slice = plan.slices.find((s) => s.id === sliceId)!;
        const epic = plan.epics.find((e) => e.id === epicId)!;
        const actCtx: ActionContext = { slice, epic, plan, worktreeDir: input.worktreeDir, reports };
        const baseToken: Token = { sliceId, epicId };

        fire = async (consumed) => {
          const budgetToken = consumed[1]!;
          const reworkCount = budgetToken.reworkCount ?? 0;

          const reportId = await actions[actionKey]!(actCtx);
          ctx.reportIds.push(reportId);
          const report = reports.getById(reportId);
          const satisfied = !!(report?.payload as { satisfied?: boolean })?.satisfied;

          if (satisfied) {
            return onSatisfied.map((pl) => ({ place: pl, token: { ...consumed[0]!, reportId } }));
          }
          if (reworkCount >= maxReworks) {
            ctx.sliceOutcomes.set(sliceId, { sliceId, status: 'halted' });
            ctx.halted = true;
            ctx.haltReason = `Slice ${sliceId} semantic rework exhaustion`;
            return [];
          }
          return [
            ...onRejected.map((pl) => ({ place: pl, token: { ...consumed[0]!, reportId } })),
            { place: budgetPlace, token: { ...baseToken, reworkCount: reworkCount + 1 } },
          ];
        };
        break;
      }

      case 'complete-slice': {
        const { sliceId, epicId, completedPlace, depSignals } = h;
        const baseToken: Token = { sliceId, epicId };

        fire = async () => {
          ctx.sliceOutcomes.set(sliceId, { sliceId, status: 'completed' });
          return [
            { place: completedPlace, token: { ...baseToken } },
            ...depSignals.map((sig) => ({ place: sig, token: { ...baseToken } })),
          ];
        };
        break;
      }

      case 'complete-epic': {
        const { epicId, donePlace, depSignals } = h;
        const baseToken: Token = { sliceId: '', epicId };

        fire = async () => {
          ctx.epicOutcomes.set(epicId, { epicId, status: 'completed' });
          return [
            { place: donePlace, token: { ...baseToken } },
            ...depSignals.map((sig) => ({ place: sig, token: { ...baseToken } })),
          ];
        };
        break;
      }

      case 'verify-epic': {
        const { actionKey, epicId, representativeSliceId, onPassOutputs } = h;
        const epic = plan.epics.find((e) => e.id === epicId)!;
        const slice = plan.slices.find((s) => s.id === representativeSliceId)!;
        const actCtx: ActionContext = { slice, epic, plan, worktreeDir: input.worktreeDir, reports };

        fire = async () => {
          const reportId = await actions[actionKey]!(actCtx);
          ctx.reportIds.push(reportId);
          const report = reports.getById(reportId);
          const passed = !!(report?.payload as { passed?: boolean })?.passed;
          if (passed) {
            ctx.epicOutcomes.set(epicId, { epicId, status: 'completed' });
            return onPassOutputs.map((o) => ({
              place: o.place,
              token: { sliceId: o.sliceId, epicId: o.epicId },
            }));
          }
          ctx.epicOutcomes.set(epicId, { epicId, status: 'halted' });
          ctx.halted = true;
          ctx.haltReason = `Epic ${epicId} verification failed`;
          return [];
        };
        break;
      }
    }

    net.addTransition({
      id: skel.id,
      inputs: skel.inputs,
      contract: skel.contract,
      fire,
    });
  }

  // Seed initial tokens
  for (const { place, token } of blueprint.initialTokens) {
    net.addToken(place, token as Token);
  }

  return net;
}

// ---------------------------------------------------------------------------
// compilePlan — convenience wrapper: compileTopology + wireHandlers.
// ---------------------------------------------------------------------------

export function compilePlan(input: OrchestratorInput, ctx: RunCtx): PetriNet {
  const blueprint = compileTopology(input.plan, input.policy);
  return wireHandlers(blueprint, input, ctx);
}
