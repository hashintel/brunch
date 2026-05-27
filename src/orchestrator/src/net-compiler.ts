// ---------------------------------------------------------------------------
// Net compiler — two-pass pipeline:
//   1. compileTopology(plan, policy) → NetBlueprint  (pure, no runtime refs)
//   2. wireHandlers(blueprint, input, ctx) → PetriNet (attaches fire closures)
//   3. compilePlan(input, ctx) → PetriNet            (convenience wrapper)
// ---------------------------------------------------------------------------

import { mkdirSync } from 'node:fs';

import {
  mergeSlicesIntoEpicSandbox,
  resolveSliceWorktreeDir,
  seedSliceFromParentWorktree,
  seedSliceSandboxFromDeps,
  sliceIdsForEpicVerifyMerge,
} from './epic-sandbox-merge.js';
import { evalEnablingGuard, evalRouteGuard } from './net-blueprint.js';
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

    // Evaluate — producer (action) emits report-bearing token to intermediate place.
    transitions.push({
      id: `${sid}:evaluate`,
      inputs: [p(sid, 'spec-ready'), poolTestAgent],
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

    // Write tests
    transitions.push({
      id: `${sid}:write-tests`,
      inputs: [p(sid, 'needs-more'), poolTestAgent],
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

    // Write code
    transitions.push({
      id: `${sid}:write-code`,
      inputs: [p(sid, 'failing-tests'), poolCodeAgent],
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

    // Run tests — producer emits report-bearing token to intermediate place.
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

    // Assess semantic — producer emits report-bearing token to intermediate place.
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
      // FE-761 Slice 2a: halt sink for epic verification failure.
      const epicHaltedPlace = ep(epic.id, 'halted');
      places.push(verifyPlace, verifyReportedPlace, epicHaltedPlace);

      transitions.push({
        id: `epic-slices-done:${epic.id}`,
        inputs: completedPlaces,
        contract: { kind: 'structural', lane: 'epic', guard: 'all slices completed' },
        handler: { kind: 'passthrough', outputs: [{ place: verifyPlace, sliceId: '', epicId: epic.id }] },
      });

      // Verify-epic — producer emits report-bearing token to intermediate place.
      transitions.push({
        id: `epic-verify:${epic.id}`,
        inputs: [verifyPlace],
        contract: { kind: 'mechanical', lane: 'epic', actor: 'orchestrator', guard: 'verify-ready' },
        handler: {
          kind: 'verify-epic',
          actionKey: 'verify-epic',
          epicId: epic.id,
          representativeSliceId: epicSlices[0]!.id,
          intermediatePlace: verifyReportedPlace,
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

      // Verify-epic — fail halt-sibling: emits to the epic halted place
      // (FE-761 Slice 2a: halted-as-place). onFire still mutates ctx for now
      // so engine.shouldHalt() keeps working without further wiring; Slice 2b
      // will retire ctx.halted entirely.
      transitions.push({
        id: `epic-verify:${epic.id}:fail`,
        inputs: [verifyReportedPlace],
        contract: { kind: 'structural', lane: 'epic', guard: 'report.passed falsy' },
        handler: {
          kind: 'sibling-passthrough',
          sliceId: '',
          epicId: epic.id,
          input: verifyReportedPlace,
          outputs: [epicHaltedPlace],
          enablingGuard: { kind: 'tokenReportFieldFalsy', field: 'passed' },
          onFire: { kind: 'halt-epic', reason: `Epic ${epic.id} verification failed` },
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

  // Runtime filesystem preparation lives in wireHandlers so every action/test
  // cwd exists before any transition can fire. This is the one intentional side
  // effect in the wiring pass; a future prepareRunFilesystem step can split it
  // out if more provisioning responsibilities accumulate.
  // Per-slice dirs are parallel-safe; dependency seeding happens at fire time.
  // In codebase mode, seed each slice dir with the parent worktree's contents
  // (the source repo's HEAD via `git worktree add`) so pi-actions can modify
  // existing code instead of writing into an empty dir.
  for (const slice of plan.slices) {
    if (input.sandboxMode === 'codebase') {
      if (!input.runId) {
        throw new Error('codebase mode requires input.runId (used to name slice-level git branches)');
      }
      seedSliceFromParentWorktree(input.sandboxDir, slice.id, plan, input.runId);
    } else {
      mkdirSync(resolveSliceWorktreeDir(input.sandboxDir, slice.id), { recursive: true });
    }
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
        const { actionKey, sliceId, epicId, outputs: outputPlaces, agentReturnPlace } = h;
        const slice = plan.slices.find((s) => s.id === sliceId)!;
        const epic = plan.epics.find((e) => e.id === epicId)!;
        const baseToken: Token = { sliceId, epicId };

        fire = async (consumed) => {
          const actCtx: ActionContext = {
            slice,
            epic,
            plan,
            sandboxDir: seedSliceSandboxFromDeps(input.sandboxDir, plan, slice, {
              preserveExisting: true,
            }),
            reports,
          };
          const reportId = await actions[actionKey]!(actCtx);
          ctx.reportIds.push(reportId);
          const tok: Token = { ...consumed[0]!, reportId };

          const out: { place: string; token: Token }[] = outputPlaces.map((pl) => ({
            place: pl,
            token: tok,
          }));
          if (agentReturnPlace) {
            out.push({ place: agentReturnPlace, token: { ...baseToken } });
          }
          return out;
        };
        break;
      }

      case 'sibling-passthrough': {
        const { outputs: outputPlaces, enablingGuard, onFire, epicId } = h;
        fire = async (consumed) => {
          // Apply optional fire-time side effect before emitting outputs.
          if (onFire?.kind === 'mark-epic-completed') {
            ctx.epicOutcomes.set(epicId, { epicId, status: 'completed' });
          } else if (onFire?.kind === 'halt-epic') {
            ctx.epicOutcomes.set(epicId, { epicId, status: 'halted' });
            ctx.halted = true;
            ctx.haltReason = onFire.reason;
          }
          // Sibling fires by forwarding the report-bearing token unchanged
          // to its single fixed output set (or empty for halt-siblings).
          // Enabling-guard mutual exclusion is enforced upstream in
          // PetriNet.isEnabled (peek-time).
          return outputPlaces.map((pl) => ({ place: pl, token: consumed[0]! }));
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
        const { sliceId, epicId, target, intermediatePlace, budgetPlace, maxRetries } = h;
        const baseToken: Token = { sliceId, epicId };

        fire = async (consumed) => {
          const retryToken = consumed[1]!;
          const retryCount = retryToken.retryCount ?? 0;

          const slice = plan.slices.find((s) => s.id === sliceId)!;
          const sandboxDir = seedSliceSandboxFromDeps(input.sandboxDir, plan, slice, {
            preserveExisting: true,
          });
          const result = await testRunner.run(target, sandboxDir);
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
              { place: intermediatePlace, token: tok },
              { place: budgetPlace, token: { ...baseToken, retryCount: 0 } },
            ];
          }
          if (retryCount >= maxRetries) {
            // FE-761 Slice 2a: halt is now structural — emit to the slice
            // halted place in addition to the legacy ctx.halted mutation
            // (Slice 2b will retire ctx.halted entirely).
            ctx.sliceOutcomes.set(sliceId, { sliceId, status: 'halted' });
            ctx.halted = true;
            ctx.haltReason = `Slice ${sliceId} retry exhaustion`;
            return [{ place: p(sliceId, 'halted'), token: tok }];
          }
          return [
            { place: intermediatePlace, token: tok },
            { place: budgetPlace, token: { ...baseToken, retryCount: retryCount + 1 } },
          ];
        };
        break;
      }

      case 'assess-semantic': {
        const { actionKey, sliceId, epicId, intermediatePlace, budgetPlace, maxReworks } = h;
        const slice = plan.slices.find((s) => s.id === sliceId)!;
        const epic = plan.epics.find((e) => e.id === epicId)!;
        const baseToken: Token = { sliceId, epicId };

        fire = async (consumed) => {
          const budgetToken = consumed[1]!;
          const reworkCount = budgetToken.reworkCount ?? 0;

          const actCtx: ActionContext = {
            slice,
            epic,
            plan,
            sandboxDir: seedSliceSandboxFromDeps(input.sandboxDir, plan, slice, {
              preserveExisting: true,
            }),
            reports,
          };
          const reportId = await actions[actionKey]!(actCtx);
          ctx.reportIds.push(reportId);

          const report = reports.getById(reportId);
          const satisfied = !!(report?.payload as { satisfied?: boolean } | undefined)?.satisfied;
          const tok: Token = { ...consumed[0]!, reportId };

          if (satisfied) {
            // Budget is consumed and not returned on satisfaction.
            return [{ place: intermediatePlace, token: tok }];
          }
          if (reworkCount >= maxReworks) {
            // FE-761 Slice 2a: halt is now structural — emit to the slice
            // halted place in addition to the legacy ctx.halted mutation.
            ctx.sliceOutcomes.set(sliceId, { sliceId, status: 'halted' });
            ctx.halted = true;
            ctx.haltReason = `Slice ${sliceId} semantic rework exhaustion`;
            return [{ place: p(sliceId, 'halted'), token: tok }];
          }
          return [
            { place: intermediatePlace, token: tok },
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
        const { actionKey, epicId, representativeSliceId, intermediatePlace } = h;
        const epic = plan.epics.find((e) => e.id === epicId)!;
        const slice = plan.slices.find((s) => s.id === representativeSliceId)!;
        // Epic verification runs against a freshly-merged `__epic__/<epicId>/`
        // dir built from completed slice worktrees (cross-epic slice deps included).
        const sliceIdsInMergeOrder = sliceIdsForEpicVerifyMerge(plan, epicId);

        fire = async (consumed) => {
          const mergeSliceIds = sliceIdsInMergeOrder.filter(
            (sid) => ctx.sliceOutcomes.get(sid)?.status === 'completed',
          );
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

          const actCtx: ActionContext = {
            slice,
            epic,
            plan,
            sandboxDir: merge.epicSandboxDir,
            reports,
          };
          const reportId = await actions[actionKey]!(actCtx);
          ctx.reportIds.push(reportId);
          // Producer always emits to the intermediate place. Pass/fail
          // routing happens in sibling-passthrough transitions which read
          // the attached reportId to evaluate report.passed.
          return [{ place: intermediatePlace, token: { ...consumed[0]!, reportId } }];
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
