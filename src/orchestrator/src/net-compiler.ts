// ---------------------------------------------------------------------------
// Net compiler — two-pass pipeline:
//   1. compileTopology(plan, policy) → NetBlueprint  (pure, no runtime refs)
//   2. wireHandlers(blueprint, input, ctx) → PetriNet (attaches fire closures)
//   3. compilePlan(input, ctx) → PetriNet            (convenience wrapper)
// ---------------------------------------------------------------------------

import {
  ensureSliceWorktree,
  mergeSlicesIntoEpicSandbox,
  resolveEpicSandboxDir,
  seedSliceSandboxFromDeps,
  sliceIdsForEpicVerifyMerge,
} from './epic-sandbox-merge.js';
import { evalEnablingGuard } from './net-blueprint.js';
import type { NetBlueprint, TokenSeed, TransitionSkeleton } from './net-blueprint.js';
import { PetriNet } from './petri-net.js';
import type { Token } from './petri-net.js';
import { createReport } from './report-helpers.js';
import {
  captureFoldedChangeBaseline,
  materializeEpicVerifyTree,
  transferFoldedFixToSlice,
} from './run-artifact.js';
import { runVerification } from './test-runner.js';
import type {
  ActionContext,
  OrchestratorInput,
  Plan,
  RunCtx,
  RunPolicy,
  Slice,
  TestFailureKind,
} from './types.js';

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

  // Shared agent resource pool places
  const poolTestAgent = 'pool:test-agent';
  const poolCodeAgent = 'pool:code-agent';
  places.push(poolTestAgent, poolCodeAgent);

  const poolSize = policy.agentPoolSize ?? plan.slices.length;
  for (let i = 0; i < poolSize; i++) {
    initialTokens.push(
      { place: poolTestAgent, token: { sliceId: '', epicId: '' } },
      { place: poolCodeAgent, token: { sliceId: '', epicId: '' } },
    );
  }

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

    // Places — mechanical lane (agent tokens are in shared pools, not per-slice)
    for (const name of [
      'spec-ready',
      'failing-tests',
      'untested-code',
      'needs-more',
      'done-spec',
      'completed',
      // FE-761 Slice 1: intermediate report-bearing places between
      // conditional producers and their sibling passthroughs.
      'evaluate:reported',
      'run-tests:reported',
      // FE-761 Slice 4: explicit dispatch/running/complete topology
      // split for every long-running producer. The running:* place
      // is the in-flight sentinel between dispatch and complete; it
      // makes the async phase visible at the net level (Petrinaut
      // compatibility / FE-762).
      'evaluate:running',
      'write-tests:running',
      'write-code:running',
      'run-tests:running',
      'assess-semantic:running',
      // FE-761 Slice 2a: halt sink — receives a halt-token from any halt
      // path inside this slice (retry exhaustion, semantic rework
      // exhaustion). Halt becomes observable at topology level.
      'halted',
    ]) {
      places.push(p(sid, name));
    }

    // Places — semantic lane
    places.push(p(sid, 'semantic-budget'));
    places.push(p(sid, 'semantic-satisfied'));
    // FE-761 Slice 1: intermediate report-bearing place for assess-semantic
    // producer + sibling passthroughs (satisfied / rejected).
    places.push(p(sid, 'assess-semantic:reported'));

    // Retry budget + eligibility gate
    places.push(p(sid, 'retry-budget'));
    places.push(p(sid, 'eligible'));

    // Initial tokens (agent tokens seeded in pools above)
    initialTokens.push(
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

    // Evaluate — FE-761 Slice 4 explicit topology split:
    //   dispatch (sync, consumes work + agent) → running → complete (deferred handler).
    transitions.push({
      id: `${sid}:evaluate:dispatch`,
      inputs: [p(sid, 'spec-ready'), poolTestAgent],
      contract: {
        kind: 'structural',
        lane: 'mechanical',
        guard: 'spec-ready + test-agent available',
      },
      handler: {
        kind: 'dispatch',
        sliceId: sid,
        epicId: epic.id,
        runningPlace: p(sid, 'evaluate:running'),
      },
    });
    transitions.push({
      id: `${sid}:evaluate:complete`,
      inputs: [p(sid, 'evaluate:running')],
      contract: {
        kind: 'mechanical',
        lane: 'mechanical',
        actor: 'evaluator',
        guard: 'evaluate handler complete',
      },
      handler: {
        kind: 'action',
        actionKey: 'evaluate-done',
        sliceId: sid,
        epicId: epic.id,
        outputs: [p(sid, 'evaluate:reported')],
        agentReturnPlace: poolTestAgent,
      },
    });

    // Evaluate — sibling passthroughs. Complementary enabling guards over the
    // token's attached report decide which sibling fires per token.
    transitions.push({
      id: `${sid}:evaluate:done`,
      inputs: [p(sid, 'evaluate:reported')],
      contract: { kind: 'structural', lane: 'mechanical', guard: 'report.done truthy' },
      handler: {
        kind: 'sibling-passthrough',
        sliceId: sid,
        epicId: epic.id,
        input: p(sid, 'evaluate:reported'),
        outputs: [p(sid, 'done-spec')],
        enablingGuard: { kind: 'tokenReportFieldTruthy', field: 'done' },
      },
    });
    transitions.push({
      id: `${sid}:evaluate:more`,
      inputs: [p(sid, 'evaluate:reported')],
      contract: { kind: 'structural', lane: 'mechanical', guard: 'report.done falsy' },
      handler: {
        kind: 'sibling-passthrough',
        sliceId: sid,
        epicId: epic.id,
        input: p(sid, 'evaluate:reported'),
        outputs: [p(sid, 'needs-more')],
        enablingGuard: { kind: 'tokenReportFieldFalsy', field: 'done' },
      },
    });

    // Write tests — FE-761 Slice 4 explicit dispatch/running/complete split.
    transitions.push({
      id: `${sid}:write-tests:dispatch`,
      inputs: [p(sid, 'needs-more'), poolTestAgent],
      contract: { kind: 'structural', lane: 'mechanical', guard: 'needs-more + test-agent' },
      handler: {
        kind: 'dispatch',
        sliceId: sid,
        epicId: epic.id,
        runningPlace: p(sid, 'write-tests:running'),
      },
    });
    transitions.push({
      id: `${sid}:write-tests:complete`,
      inputs: [p(sid, 'write-tests:running')],
      contract: { kind: 'mechanical', lane: 'mechanical', actor: 'test-agent' },
      handler: {
        kind: 'action',
        actionKey: 'write-tests',
        sliceId: sid,
        epicId: epic.id,
        outputs: [p(sid, 'failing-tests')],
        agentReturnPlace: poolTestAgent,
      },
    });

    // Write code — FE-761 Slice 4 explicit dispatch/running/complete split.
    transitions.push({
      id: `${sid}:write-code:dispatch`,
      inputs: [p(sid, 'failing-tests'), poolCodeAgent],
      contract: { kind: 'structural', lane: 'mechanical', guard: 'failing-tests + code-agent' },
      handler: {
        kind: 'dispatch',
        sliceId: sid,
        epicId: epic.id,
        runningPlace: p(sid, 'write-code:running'),
      },
    });
    transitions.push({
      id: `${sid}:write-code:complete`,
      inputs: [p(sid, 'write-code:running')],
      contract: { kind: 'mechanical', lane: 'mechanical', actor: 'coding-agent' },
      handler: {
        kind: 'action',
        actionKey: 'write-code',
        sliceId: sid,
        epicId: epic.id,
        outputs: [p(sid, 'untested-code')],
        agentReturnPlace: poolCodeAgent,
      },
    });

    // Run tests — FE-761 Slice 4 explicit dispatch/running/complete split.
    // Dispatch stashes retryCount on the running token so complete can
    // read it back at handler time (budget remains "checked out").
    transitions.push({
      id: `${sid}:run-tests:dispatch`,
      inputs: [p(sid, 'untested-code'), p(sid, 'retry-budget')],
      contract: {
        kind: 'structural',
        lane: 'mechanical',
        guard: 'untested-code + retry-budget available',
      },
      handler: {
        kind: 'dispatch',
        sliceId: sid,
        epicId: epic.id,
        runningPlace: p(sid, 'run-tests:running'),
      },
    });
    transitions.push({
      id: `${sid}:run-tests:complete`,
      inputs: [p(sid, 'run-tests:running')],
      contract: {
        kind: 'mechanical',
        lane: 'mechanical',
        actor: 'test-runner',
        guard: 'run-tests handler complete',
      },
      handler: {
        kind: 'run-tests',
        sliceId: sid,
        epicId: epic.id,
        targets: slice.verification.map((v) => v.target),
        intermediatePlace: p(sid, 'run-tests:reported'),
        budgetPlace: p(sid, 'retry-budget'),
        maxRetries: policy.maxRetries,
      },
    });

    // Run tests — sibling passthroughs route by report.passed.
    transitions.push({
      id: `${sid}:run-tests:pass`,
      inputs: [p(sid, 'run-tests:reported')],
      contract: { kind: 'structural', lane: 'mechanical', guard: 'report.passed truthy' },
      handler: {
        kind: 'sibling-passthrough',
        sliceId: sid,
        epicId: epic.id,
        input: p(sid, 'run-tests:reported'),
        outputs: [p(sid, 'spec-ready')],
        enablingGuard: { kind: 'tokenReportFieldTruthy', field: 'passed' },
      },
    });
    transitions.push({
      id: `${sid}:run-tests:fail`,
      inputs: [p(sid, 'run-tests:reported')],
      contract: { kind: 'structural', lane: 'mechanical', guard: 'report.passed falsy' },
      handler: {
        kind: 'sibling-passthrough',
        sliceId: sid,
        epicId: epic.id,
        input: p(sid, 'run-tests:reported'),
        outputs: [p(sid, 'failing-tests')],
        enablingGuard: { kind: 'tokenReportFieldFalsy', field: 'passed' },
      },
    });

    // Assess semantic — FE-761 Slice 4 explicit dispatch/running/complete split.
    // Dispatch stashes reworkCount on the running token so complete can
    // read it back at handler time (budget remains "checked out").
    const maxSemantic = policy.maxSemanticReworks ?? policy.maxRetries;
    transitions.push({
      id: `${sid}:assess-semantic:dispatch`,
      inputs: [p(sid, 'done-spec'), p(sid, 'semantic-budget')],
      contract: {
        kind: 'structural',
        lane: 'semantic',
        guard: 'done-spec + semantic-budget available',
      },
      handler: {
        kind: 'dispatch',
        sliceId: sid,
        epicId: epic.id,
        runningPlace: p(sid, 'assess-semantic:running'),
      },
    });
    transitions.push({
      id: `${sid}:assess-semantic:complete`,
      inputs: [p(sid, 'assess-semantic:running')],
      contract: {
        kind: 'semantic',
        lane: 'semantic',
        actor: 'semantic-assessor',
        guard: 'assess-semantic handler complete',
      },
      handler: {
        kind: 'assess-semantic',
        actionKey: 'assess-semantic',
        sliceId: sid,
        epicId: epic.id,
        intermediatePlace: p(sid, 'assess-semantic:reported'),
        budgetPlace: p(sid, 'semantic-budget'),
        maxReworks: maxSemantic,
      },
    });

    // Assess semantic — sibling passthroughs route by report.satisfied.
    transitions.push({
      id: `${sid}:assess-semantic:satisfied`,
      inputs: [p(sid, 'assess-semantic:reported')],
      contract: { kind: 'structural', lane: 'semantic', guard: 'report.satisfied truthy' },
      handler: {
        kind: 'sibling-passthrough',
        sliceId: sid,
        epicId: epic.id,
        input: p(sid, 'assess-semantic:reported'),
        outputs: [p(sid, 'semantic-satisfied')],
        enablingGuard: { kind: 'tokenReportFieldTruthy', field: 'satisfied' },
      },
    });
    transitions.push({
      id: `${sid}:assess-semantic:rejected`,
      inputs: [p(sid, 'assess-semantic:reported')],
      contract: { kind: 'structural', lane: 'semantic', guard: 'report.satisfied falsy' },
      handler: {
        kind: 'sibling-passthrough',
        sliceId: sid,
        epicId: epic.id,
        input: p(sid, 'assess-semantic:reported'),
        outputs: [p(sid, 'needs-more')],
        enablingGuard: { kind: 'tokenReportFieldFalsy', field: 'satisfied' },
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
      const verifyReportedPlace = ep(epic.id, 'verify:reported');
      // FE-761 Slice 4: in-flight sentinel for the verify dispatch/complete split.
      const verifyRunningPlace = ep(epic.id, 'verify:running');
      // FE-761 Slice 2a: halt sink for epic verification failure.
      const epicHaltedPlace = ep(epic.id, 'halted');
      // FE-884: epic remediation loop. A failed verify (budget remaining) routes
      // to a code agent against the folded epic tree, then re-verifies — mirroring
      // the slice run-tests retry loop. Budget lives in the producer; the fail
      // sibling is a router to remediation, halt happens on exhaustion.
      const epicRetryBudgetPlace = ep(epic.id, 'retry-budget');
      const remediateReadyPlace = ep(epic.id, 'remediate:ready');
      const remediateRunningPlace = ep(epic.id, 'remediate:running');
      places.push(
        verifyPlace,
        verifyReportedPlace,
        verifyRunningPlace,
        epicHaltedPlace,
        epicRetryBudgetPlace,
        remediateReadyPlace,
        remediateRunningPlace,
      );

      // FE-884: seed the epic retry budget (mirrors the slice retry-budget seed).
      initialTokens.push({
        place: epicRetryBudgetPlace,
        token: { sliceId: '', epicId: epic.id, retryCount: 0 },
      });

      transitions.push({
        id: `epic-slices-done:${epic.id}`,
        inputs: completedPlaces,
        contract: { kind: 'structural', lane: 'epic', guard: 'all slices completed' },
        handler: { kind: 'passthrough', outputs: [{ place: verifyPlace, sliceId: '', epicId: epic.id }] },
      });

      // Verify-epic — FE-761 Slice 4 explicit dispatch/running/complete split.
      // FE-884: dispatch also consumes the epic retry-budget so the budget stays
      // "checked out" for the duration of the verify (mirrors run-tests:dispatch);
      // the dispatch handler stashes retryCount on the running token.
      transitions.push({
        id: `epic-verify:${epic.id}:dispatch`,
        inputs: [verifyPlace, epicRetryBudgetPlace],
        contract: { kind: 'structural', lane: 'epic', guard: 'verify-ready + retry-budget available' },
        handler: {
          kind: 'dispatch',
          sliceId: '',
          epicId: epic.id,
          runningPlace: verifyRunningPlace,
        },
      });
      transitions.push({
        id: `epic-verify:${epic.id}:complete`,
        inputs: [verifyRunningPlace],
        contract: {
          kind: 'mechanical',
          lane: 'epic',
          actor: 'orchestrator',
          guard: 'verify handler complete',
        },
        handler: {
          kind: 'verify-epic',
          actionKey: 'verify-epic',
          epicId: epic.id,
          representativeSliceId: epicSlices[0]!.id,
          intermediatePlace: verifyReportedPlace,
          budgetPlace: epicRetryBudgetPlace,
          maxRetries: policy.maxRetries,
          // FE-884 Slice B: an infra/timeout verdict re-runs verify (bounded)
          // without remediation, counted separately from remediation attempts.
          reverifyPlace: verifyPlace,
          maxInfraRetries: policy.maxInfraRetries ?? policy.maxRetries,
        },
      });

      // Verify-epic — pass sibling: emits to done + dep-signals, marks epic completed.
      transitions.push({
        id: `epic-verify:${epic.id}:pass`,
        inputs: [verifyReportedPlace],
        contract: { kind: 'structural', lane: 'epic', guard: 'report.passed truthy' },
        handler: {
          kind: 'sibling-passthrough',
          sliceId: '',
          epicId: epic.id,
          input: verifyReportedPlace,
          outputs: [ep(epic.id, 'done'), ...depSignals],
          enablingGuard: { kind: 'tokenReportFieldTruthy', field: 'passed' },
          onFire: { kind: 'mark-epic-completed' },
        },
      });

      // Verify-epic — fail sibling (FE-884): a failed verify with budget remaining
      // routes to remediation instead of halting. Halt is now the producer's job
      // on budget exhaustion (mirroring the slice run-tests loop), so this sibling
      // is a pure router — no attach-halt-reason.
      transitions.push({
        id: `epic-verify:${epic.id}:fail`,
        inputs: [verifyReportedPlace],
        contract: { kind: 'structural', lane: 'epic', guard: 'report.passed falsy' },
        handler: {
          kind: 'sibling-passthrough',
          sliceId: '',
          epicId: epic.id,
          input: verifyReportedPlace,
          outputs: [remediateReadyPlace],
          enablingGuard: { kind: 'tokenReportFieldFalsy', field: 'passed' },
        },
      });

      // Remediate-epic — FE-884 dispatch/complete split. Dispatch grabs a code
      // agent; complete runs the remediation agent against the folded epic tree,
      // applies detect-and-reject + round-trip, then loops back to re-verify.
      transitions.push({
        id: `epic-remediate:${epic.id}:dispatch`,
        inputs: [remediateReadyPlace, poolCodeAgent],
        contract: { kind: 'structural', lane: 'epic', guard: 'remediate-ready + code-agent' },
        handler: {
          kind: 'dispatch',
          sliceId: '',
          epicId: epic.id,
          runningPlace: remediateRunningPlace,
        },
      });
      transitions.push({
        id: `epic-remediate:${epic.id}:complete`,
        inputs: [remediateRunningPlace],
        contract: {
          kind: 'mechanical',
          lane: 'epic',
          actor: 'coding-agent',
          guard: 'remediate handler complete',
        },
        handler: {
          kind: 'remediate-epic',
          actionKey: 'remediate-epic',
          epicId: epic.id,
          representativeSliceId: epicSlices[0]!.id,
          outputs: [verifyPlace],
          agentReturnPlace: poolCodeAgent,
          epicTestTargets: epic.verification.map((v) => v.target),
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
  const { plan, actions, testRunner, reports } = input;

  // Register places
  for (const place of blueprint.places) {
    net.addPlace(place);
  }

  // Per-slice sandboxes are provisioned lazily at fire time (in resolveSliceCwd),
  // not eagerly here: a run that touches 2 of 8 slices pays for 2 worktrees, not
  // 8. Each slice dir is an independent root, so concurrent fires of distinct
  // slices never contend; repeat fires of the same slice (rework) are idempotent.
  // 'shared' (serial greenfield): all slices accrete into the run sandbox.
  // 'per-slice': each slice gets its own git worktree (codebase) or plain dir
  // (greenfield parallel), merged into __epic__ for verification.
  // Fail fast on the missing-runId precondition rather than at first fire.
  const sliceLayout = input.sliceLayout ?? 'per-slice';
  const { runId } = input;
  if (input.sandboxMode === 'codebase' && !runId) {
    throw new Error('codebase mode requires input.runId (used to name slice-level git branches)');
  }

  const resolveSliceCwd = (slice: Slice): string => {
    if (sliceLayout === 'shared') return input.sandboxDir;
    // Codebase mode: materialize the slice's git worktree (HEAD checkout +
    // symlinked node_modules) on first touch so pi-actions modify existing code
    // rather than an empty dir; greenfield per-slice gets a plain dir below.
    if (input.sandboxMode === 'codebase') {
      ensureSliceWorktree(input.sandboxDir, slice.id, plan, runId!);
    }
    return seedSliceSandboxFromDeps(input.sandboxDir, plan, slice, { preserveExisting: true });
  };

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

      case 'dispatch': {
        // FE-761 Slice 4: synchronous front-half. Forward the work token
        // (consumed[0]) to the running:* sentinel place, stashing budget
        // metadata (retryCount / reworkCount) from any companion budget
        // token (consumed[1]) so the complete-phase handler can read it
        // back without an extra input arc.
        const { runningPlace } = h;
        fire = async (consumed) => {
          const workToken = consumed[0]!;
          const companion = consumed[1];
          const running: Token = { ...workToken };
          if (companion?.retryCount !== undefined) running.retryCount = companion.retryCount;
          if (companion?.reworkCount !== undefined) running.reworkCount = companion.reworkCount;
          return [{ place: runningPlace, token: running }];
        };
        break;
      }

      case 'action': {
        const { actionKey, sliceId, epicId, outputs: outputPlaces, agentReturnPlace } = h;
        const slice = plan.slices.find((s) => s.id === sliceId)!;
        const epic = plan.epics.find((e) => e.id === epicId)!;
        const baseToken: Token = { sliceId, epicId };

        // FE-761 Slice 3: dispatch / deferred-completion split. The
        // synchronous part returns no tokens — the agent stays "checked
        // out" of its pool until the handler completes, preserving the
        // pool-size = handler-concurrency-limit invariant. The handler
        // invocation, report-bearing output, and agent return are all
        // deferred, freeing the run loop to step other independent
        // transitions (e.g. those that don't need this agent) while the
        // handler is in flight.
        fire = async (consumed) => {
          const inputToken = consumed[0]!;
          const deferred = (async () => {
            const actCtx: ActionContext = {
              slice,
              epic,
              plan,
              sandboxDir: resolveSliceCwd(slice),
              reports,
            };
            const reportId = await actions[actionKey]!(actCtx);
            ctx.reportIds.push(reportId);
            const tok: Token = { ...inputToken, reportId };
            const out: { place: string; token: Token }[] = outputPlaces.map((pl) => ({
              place: pl,
              token: tok,
            }));
            if (agentReturnPlace) {
              out.push({ place: agentReturnPlace, token: { ...baseToken } });
            }
            return out;
          })();
          net.scheduleDeferred(skel.id, skel.contract, { places: skel.inputs, tokens: consumed }, deferred);
          return [];
        };
        break;
      }

      case 'sibling-passthrough': {
        const { outputs: outputPlaces, enablingGuard, onFire, epicId } = h;
        fire = async (consumed) => {
          // Apply optional fire-time side effect before emitting outputs.
          let forwarded = consumed[0]!;
          if (onFire?.kind === 'mark-epic-completed') {
            ctx.epicOutcomes.set(epicId, { epicId, status: 'completed' });
          } else if (onFire?.kind === 'attach-halt-reason') {
            // FE-761 Slice 2b: halted-as-place — the epic outcome is marked
            // halted and the halt reason is stamped on the forwarded token
            // so the engine can derive `result.reason` from the halted:*
            // place via `net.getHaltTokens()`.
            ctx.epicOutcomes.set(epicId, { epicId, status: 'halted' });
            forwarded = { ...forwarded, haltReason: onFire.reason };
          }
          // Sibling fires by forwarding the (possibly halt-stamped) token
          // to its single fixed output set. Enabling-guard mutual exclusion
          // is enforced upstream in PetriNet.isEnabled (peek-time).
          return outputPlaces.map((pl) => ({ place: pl, token: forwarded }));
        };
        // Peek-time guard reads the token's attached reportId and evaluates
        // the enabling predicate against the report's payload. Mutually-
        // exclusive guards across siblings ensure exactly one sibling fires
        // per intermediate token.
        const peekGuard = (peeked: Token[]) => {
          const tok = peeked[0]!;
          const report = tok.reportId ? reports.getById(tok.reportId) : undefined;
          return evalEnablingGuard(enablingGuard, report);
        };
        net.addTransition({
          id: skel.id,
          inputs: skel.inputs,
          contract: skel.contract,
          guard: peekGuard,
          fire,
        });
        continue;
      }

      case 'run-tests': {
        const { sliceId, epicId, targets, intermediatePlace, budgetPlace, maxRetries } = h;
        const baseToken: Token = { sliceId, epicId };

        // FE-761 Slice 3: deferred-completion split. The synchronous part
        // returns no outputs (budget stays "checked out" until the test
        // run completes, which preserves retry-budget semantics). The
        // test-runner invocation + outcome routing is deferred.
        // FE-761 Slice 4: complete now consumes a single running:* token
        // whose retryCount was stashed by the dispatch phase.
        fire = async (consumed) => {
          const inputToken = consumed[0]!;
          const retryCount = inputToken.retryCount ?? 0;

          const deferred = (async () => {
            const slice = plan.slices.find((s) => s.id === sliceId)!;
            const sandboxDir = resolveSliceCwd(slice);
            input.emit?.({ kind: 'slice', id: sliceId, epicId, status: 'running', step: 'verify' });
            // Shared verification seam: same verdict rule + infra-dominates
            // aggregate as evaluate-done / verify-epic (FE-872 unification).
            const {
              done: passed,
              failureKind,
              results,
            } = await runVerification(
              targets.map((target) => ({ target })),
              testRunner,
              sandboxDir,
            );
            const output = results.map((result) => result.output).join('\n');
            const reportId = createReport(reports, {
              epicId,
              sliceId,
              actor: 'test-runner',
              event: 'tests-run',
              payload: { passed, output, failureKind, results },
            });
            ctx.reportIds.push(reportId);

            // Failed rows carry the same reason vocabulary as evaluate-done so
            // the slice grid shows why it failed (the presenter renders `reason`).
            const failedReason = failureKind === 'infra' ? 'infra error' : 'tests failed';
            const tok: Token = { ...inputToken, reportId };
            if (passed) {
              input.emit?.({ kind: 'slice', id: sliceId, epicId, status: 'passed' });
              return [
                { place: intermediatePlace, token: tok },
                { place: budgetPlace, token: { ...baseToken, retryCount: 0 } },
              ];
            }
            if (retryCount >= maxRetries) {
              // FE-761 Slice 2b: structural halt — emit a halt token
              // carrying its own reason. FE-872: when verification reports an
              // infra failure, name that cause — "retry exhaustion" would
              // misdirect the reader to the code.
              ctx.sliceOutcomes.set(sliceId, { sliceId, status: 'halted' });
              input.emit?.({ kind: 'slice', id: sliceId, epicId, status: 'failed', reason: failedReason });
              const haltReason =
                failureKind === 'infra'
                  ? `Slice ${sliceId} toolchain/install failure during verification`
                  : `Slice ${sliceId} retry exhaustion`;
              return [
                {
                  place: p(sliceId, 'halted'),
                  token: { ...tok, haltReason },
                },
              ];
            }
            input.emit?.({ kind: 'slice', id: sliceId, epicId, status: 'failed', reason: failedReason });
            return [
              { place: intermediatePlace, token: tok },
              { place: budgetPlace, token: { ...baseToken, retryCount: retryCount + 1 } },
            ];
          })();
          net.scheduleDeferred(skel.id, skel.contract, { places: skel.inputs, tokens: consumed }, deferred);
          return [];
        };
        break;
      }

      case 'assess-semantic': {
        const { actionKey, sliceId, epicId, intermediatePlace, budgetPlace, maxReworks } = h;
        const slice = plan.slices.find((s) => s.id === sliceId)!;
        const epic = plan.epics.find((e) => e.id === epicId)!;
        const baseToken: Token = { sliceId, epicId };

        // FE-761 Slice 3: deferred-completion split. Semantic budget stays
        // checked out for the duration of the assess-semantic handler.
        // FE-761 Slice 4: complete now consumes a single running:* token
        // whose reworkCount was stashed by the dispatch phase.
        fire = async (consumed) => {
          const inputToken = consumed[0]!;
          const reworkCount = inputToken.reworkCount ?? 0;

          const deferred = (async () => {
            const actCtx: ActionContext = {
              slice,
              epic,
              plan,
              sandboxDir: resolveSliceCwd(slice),
              reports,
            };
            const reportId = await actions[actionKey]!(actCtx);
            ctx.reportIds.push(reportId);

            const report = reports.getById(reportId);
            const satisfied = !!(report?.payload as { satisfied?: boolean } | undefined)?.satisfied;
            const tok: Token = { ...inputToken, reportId };

            if (satisfied) {
              // Budget is consumed and not returned on satisfaction.
              return [{ place: intermediatePlace, token: tok }];
            }
            if (reworkCount >= maxReworks) {
              ctx.sliceOutcomes.set(sliceId, { sliceId, status: 'halted' });
              return [
                {
                  place: p(sliceId, 'halted'),
                  token: { ...tok, haltReason: `Slice ${sliceId} semantic rework exhaustion` },
                },
              ];
            }
            return [
              { place: intermediatePlace, token: tok },
              { place: budgetPlace, token: { ...baseToken, reworkCount: reworkCount + 1 } },
            ];
          })();
          net.scheduleDeferred(skel.id, skel.contract, { places: skel.inputs, tokens: consumed }, deferred);
          return [];
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
        const {
          actionKey,
          epicId,
          representativeSliceId,
          intermediatePlace,
          budgetPlace,
          maxRetries,
          reverifyPlace,
          maxInfraRetries,
        } = h;
        const epic = plan.epics.find((e) => e.id === epicId)!;
        const slice = plan.slices.find((s) => s.id === representativeSliceId)!;
        const epicBaseToken: Token = { sliceId: '', epicId };
        // FE-884: route a verify report through the epic remediation budget.
        // Brownfield (codebase) is recoverable: a failing verify with budget
        // remaining loops to remediation via the intermediate place; exhaustion
        // halts with an honest reason. Greenfield is unchanged — a failing verify
        // halts immediately (the remediation round-trip is git-based, so it is a
        // brownfield-only capability; the greenfield-protecting invariant holds).
        const routeVerdict = (
          inputToken: Token,
          reportId: string,
          passed: boolean,
          failureKind?: TestFailureKind,
        ): { place: string; token: Token }[] => {
          const tok: Token = { ...inputToken, reportId };
          if (passed) {
            return [
              { place: intermediatePlace, token: tok },
              { place: budgetPlace, token: { ...epicBaseToken, retryCount: 0 } },
            ];
          }
          if (input.sandboxMode !== 'codebase') {
            ctx.epicOutcomes.set(epicId, { epicId, status: 'halted' });
            return [
              {
                place: ep(epicId, 'halted'),
                token: { ...tok, haltReason: `Epic ${epicId} verification failed` },
              },
            ];
          }
          // FE-884 Slice B: an infra/timeout failure is a toolchain blip, not a
          // logic red — re-run verify (bounded by a separate infra counter),
          // never the remediation agent. Exhaustion halts with an honest cause.
          if (failureKind === 'infra') {
            const infraCount = inputToken.infraRetryCount ?? 0;
            if (infraCount >= maxInfraRetries) {
              ctx.epicOutcomes.set(epicId, { epicId, status: 'halted' });
              return [
                {
                  place: ep(epicId, 'halted'),
                  token: {
                    ...tok,
                    haltReason: `Epic ${epicId} verification could not run after ${maxInfraRetries} infra retries (toolchain/timeout)`,
                  },
                },
              ];
            }
            return [
              { place: reverifyPlace, token: { ...inputToken, infraRetryCount: infraCount + 1 } },
              { place: budgetPlace, token: { ...epicBaseToken, retryCount: inputToken.retryCount ?? 0 } },
            ];
          }
          const retryCount = inputToken.retryCount ?? 0;
          if (retryCount >= maxRetries) {
            ctx.epicOutcomes.set(epicId, { epicId, status: 'halted' });
            return [
              {
                place: ep(epicId, 'halted'),
                token: {
                  ...tok,
                  haltReason: `Epic ${epicId} verification failed after ${maxRetries} remediation attempts`,
                },
              },
            ];
          }
          return [
            { place: intermediatePlace, token: tok },
            { place: budgetPlace, token: { ...epicBaseToken, retryCount: retryCount + 1 } },
          ];
        };
        // Epic verification runs against a freshly-merged `__epic__/<epicId>/`
        // dir built from completed slice worktrees (cross-epic slice deps included).
        const sliceIdsInMergeOrder = sliceIdsForEpicVerifyMerge(plan, epicId);

        // FE-761 Slice 3: deferred-completion split. Merge + verification
        // both happen asynchronously after dispatch returns.
        fire = async (consumed) => {
          const inputToken = consumed[0]!;
          const deferred = (async () => {
            // Per-slice layouts verify against a merged `__epic__/<epicId>/`;
            // the shared run sandbox is already the merged tree (verify in place).
            let epicSandboxDir: string;
            if (sliceLayout !== 'shared') {
              const mergeSliceIds = sliceIdsInMergeOrder.filter(
                (sid) => ctx.sliceOutcomes.get(sid)?.status === 'completed',
              );
              if (input.sandboxMode === 'codebase') {
                // Brownfield: compose by git merge-tree fold so verify-epic runs
                // against the same tree promotion will ship — not a file-copy union
                // that silently last-slice-wins on same-file edits (FE-883).
                const folded = materializeEpicVerifyTree({
                  parentSandboxDir: input.sandboxDir,
                  runId: runId!,
                  plan,
                  sliceIds: mergeSliceIds,
                  epicId,
                });
                ctx.reportIds.push(
                  createReport(reports, {
                    epicId,
                    sliceId: '',
                    actor: 'orchestrator',
                    event: 'epic-sandbox-merged',
                    payload: {
                      epicSandboxDir: folded.epicSandboxDir,
                      sliceIds: mergeSliceIds,
                      conflicts: folded.conflicts,
                    },
                  }),
                );
                // Fail-closed: a real cross-slice conflict leaves a partial tree;
                // fail the epic rather than verify it. Routes via the fail sibling.
                if (folded.conflicts.length > 0) {
                  const failId = createReport(reports, {
                    epicId,
                    sliceId: '',
                    actor: 'orchestrator',
                    event: 'epic-verified',
                    payload: { passed: false, reason: 'merge-conflict', conflicts: folded.conflicts },
                  });
                  ctx.reportIds.push(failId);
                  return routeVerdict(inputToken, failId, false);
                }
                epicSandboxDir = folded.epicSandboxDir;
              } else {
                const merge = mergeSlicesIntoEpicSandbox({
                  parentSandboxDir: input.sandboxDir,
                  epicId,
                  sliceIds: mergeSliceIds,
                });
                ctx.reportIds.push(
                  createReport(reports, {
                    epicId,
                    sliceId: '',
                    actor: 'orchestrator',
                    event: 'epic-sandbox-merged',
                    payload: {
                      epicSandboxDir: merge.epicSandboxDir,
                      sliceIds: mergeSliceIds,
                      conflicts: merge.conflicts,
                    },
                  }),
                );
                epicSandboxDir = merge.epicSandboxDir;
              }
            } else {
              epicSandboxDir = input.sandboxDir;
            }

            const actCtx: ActionContext = {
              slice,
              epic,
              plan,
              sandboxDir: epicSandboxDir,
              reports,
            };
            const reportId = await actions[actionKey]!(actCtx);
            ctx.reportIds.push(reportId);
            const epicPassed = !!(reports.getById(reportId)?.payload as { passed?: boolean } | undefined)
              ?.passed;
            // FE-884 dual re-verify (codebase-only): a remediation must not green
            // the epic integration test while breaking a slice. Re-run the slice
            // suites on the SAME folded tree and AND them with the epic verdict —
            // a fix that greens the seam but regresses a unit is rejected and burns
            // a budget unit, never promoted. Greenfield is untouched (its verify
            // halts immediately; re-running slice suites there would change behavior
            // and violate the greenfield-protecting invariant).
            let passed = epicPassed;
            // The pass/fail siblings route on the token's report `passed` field, so
            // the combined verdict must be carried by the report the token points at
            // — not the raw integration-test report (which a slice veto contradicts).
            let verdictReportId = reportId;
            if (epicPassed && input.sandboxMode === 'codebase') {
              const sliceTargets = plan.slices
                .filter((s) => s.epic_id === epicId)
                .flatMap((s) => s.verification.map((v) => ({ target: v.target })));
              if (sliceTargets.length > 0) {
                const sliceVerify = await runVerification(sliceTargets, testRunner, epicSandboxDir);
                if (!sliceVerify.done) {
                  passed = false;
                  verdictReportId = createReport(reports, {
                    epicId,
                    sliceId: '',
                    actor: 'orchestrator',
                    event: 'epic-slice-reverify',
                    payload: {
                      passed: false,
                      failureKind: sliceVerify.failureKind,
                      results: sliceVerify.results,
                    },
                  });
                  ctx.reportIds.push(verdictReportId);
                }
              }
            }
            // Route through the epic budgets. Pass → done (+ budget reset); infra
            // fail → re-verify (bounded, no remediation); test fail with budget →
            // re-loop to the fail sibling → remediation; exhausted → halt.
            const verdictPayload = reports.getById(verdictReportId)?.payload as
              | { failureKind?: TestFailureKind; reachability?: string }
              | undefined;
            const verdictFailureKind =
              verdictPayload?.failureKind ?? (verdictPayload?.reachability === 'infra' ? 'infra' : undefined);
            return routeVerdict(inputToken, verdictReportId, passed, verdictFailureKind);
          })();
          net.scheduleDeferred(skel.id, skel.contract, { places: skel.inputs, tokens: consumed }, deferred);
          return [];
        };
        break;
      }

      case 'remediate-epic': {
        const {
          actionKey,
          epicId,
          representativeSliceId,
          outputs: loopOutputs,
          agentReturnPlace,
          epicTestTargets,
        } = h;
        const epic = plan.epics.find((e) => e.id === epicId)!;
        const slice = plan.slices.find((s) => s.id === representativeSliceId)!;
        const baseToken: Token = { sliceId: '', epicId };

        // FE-884: run a code agent against the folded epic tree (where the
        // integration test actually runs), then detect-and-reject + round-trip
        // the fix onto the representative slice's branch so harvestCookRun folds
        // it. Always loops back to verify-ready — a rejected/no-op attempt simply
        // re-fails verify, burning a budget unit. Brownfield-only by construction.
        fire = async (consumed) => {
          const deferred = (async () => {
            const foldedDir = resolveEpicSandboxDir(input.sandboxDir, epicId);
            const baseline = captureFoldedChangeBaseline(foldedDir);
            const actCtx: ActionContext = { slice, epic, plan, sandboxDir: foldedDir, reports };
            await actions[actionKey]!(actCtx);
            const outcome = transferFoldedFixToSlice({
              parentSandboxDir: input.sandboxDir,
              foldedDir,
              slice,
              epicTestTargets,
              baseline,
            });
            ctx.reportIds.push(
              createReport(reports, {
                epicId,
                sliceId: representativeSliceId,
                actor: 'coding-agent',
                event: 'epic-remediated',
                payload: { accepted: outcome.accepted, reason: outcome.reason, touched: outcome.touched },
              }),
            );
            // Loop back to re-verify + return the code agent to its pool.
            return [
              ...loopOutputs.map((pl) => ({ place: pl, token: { ...baseToken } })),
              { place: agentReturnPlace, token: { ...baseToken } },
            ];
          })();
          net.scheduleDeferred(skel.id, skel.contract, { places: skel.inputs, tokens: consumed }, deferred);
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
