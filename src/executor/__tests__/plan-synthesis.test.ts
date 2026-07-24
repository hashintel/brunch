import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PlannerPort } from '../execution-ports.js';
import { readSliceRequestContext } from '../isolated-slice-operations.js';
import { planFilePayload } from '../plan-file.js';
import { previewPlan } from '../plan-preview.js';
import { PLAN_SYNTHESIS_ROUND_TIMEOUT_MS, synthesizePlan } from '../plan-synthesis.js';
import { coherentCandidate, projection, PYTEST_PROVIDER } from './plan-synthesis-fixture.js';

const providers = [PYTEST_PROVIDER];

function scriptedPlanner(responses: readonly unknown[]): PlannerPort & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    async synthesize(args) {
      calls.push(args);
      const candidate = responses[Math.min(calls.length - 1, responses.length - 1)];
      return { status: 'synthesized', candidate };
    },
  };
}

describe('synthesizePlan', () => {
  afterEach(() => vi.useRealTimers());

  it('admits a coherent candidate and lowers it onto the executable plan chain', async () => {
    const planner = scriptedPlanner([coherentCandidate()]);

    const result = await synthesizePlan({ projection, detected: [], providers, planner });

    expect(result.status).toBe('admitted');
    if (result.status !== 'admitted') return;
    expect(result.history).toEqual([{ round: 0, findings: [] }]);
    expect(result.draft.epics[0]).toMatchObject({
      id: 'F1',
      sliceIds: ['task-1', 'task-2'],
      verification: [{ kind: 'criterion', criterionId: 'AC2', target: 'Feature wired end to end' }],
    });
    expect(result.draft.slices[0]).toMatchObject({
      id: 'task-1',
      scopeId: 'SCP1',
      definition: 'Build the feature core.\n\nDone when:\n- Feature core compiles and is importable.',
      designContext: [{ itemId: 'MOD1', title: 'Feature module', content: 'Feature module' }],
      verificationContext: [{ itemId: 'CH1', title: 'Smoke test', content: 'Smoke test' }],
    });
    const payload = planFilePayload(
      previewPlan(result.draft, { executionContract: result.executionContract }),
    );
    expect(payload.execution_contract?.resolvedActions.verify[0]).toMatchObject({ command: 'pytest' });
    expect(payload.slices.map((slice) => slice.id)).toEqual(['task-1', 'task-2']);
  });

  it('repairs an invalid candidate with exact findings and admits on a later round (oracle 7)', async () => {
    const base = coherentCandidate();
    const cyclic = {
      ...base,
      slices: [
        { ...base.slices[0]!, dependsOn: ['task-2'] },
        { ...base.slices[1]!, dependsOn: ['task-1'] },
      ],
    };
    const planner = scriptedPlanner([cyclic, coherentCandidate()]);

    const result = await synthesizePlan({ projection, detected: [], providers, planner });

    expect(result.status).toBe('admitted');
    if (result.status !== 'admitted') return;
    expect(result.history).toHaveLength(2);
    expect(result.history[0]!.findings.map((finding) => finding.code)).toContain('dependency_cycle');
    const repairCall = planner.calls[1] as {
      findings?: readonly { code: string }[];
      priorCandidate?: unknown;
    };
    expect(repairCall.findings?.map((finding) => finding.code)).toContain('dependency_cycle');
    expect(repairCall.priorCandidate).toEqual(cyclic);
  });

  it('repairs incomplete scoped-slice context before every admitted slice reaches execution', async () => {
    const base = coherentCandidate();
    const invalid = {
      ...base,
      slices: [
        { ...base.slices[0]!, criterionIds: [] },
        { ...base.slices[1]!, criterionIds: ['AC1', 'AC2'] },
      ],
    };
    const planner = scriptedPlanner([invalid, coherentCandidate()]);

    const result = await synthesizePlan({ projection, detected: [], providers, planner });

    expect(result.status).toBe('admitted');
    if (result.status !== 'admitted') return;
    expect(result.history[0]!.findings.map((finding) => finding.code)).toContain('slice_without_criterion');
    const repairCall = planner.calls[1] as {
      findings?: readonly { code: string; itemId?: string }[];
      priorCandidate?: unknown;
    };
    expect(repairCall.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'slice_without_criterion', itemId: 'task-1' }),
      ]),
    );
    expect(repairCall.priorCandidate).toEqual(invalid);

    const cwd = await mkdtemp(join(tmpdir(), 'brunch-plan-admission-parity-'));
    const populatedPath = join(cwd, 'plan.json');
    await writeFile(
      populatedPath,
      JSON.stringify(
        planFilePayload(previewPlan(result.draft, { executionContract: result.executionContract })),
      ),
      'utf8',
    );
    const contexts = await Promise.all(
      result.draft.slices.map((slice) =>
        readSliceRequestContext({
          cwd,
          runId: 'admission-parity',
          populatedPlanPath: populatedPath,
          sliceId: slice.id,
        }),
      ),
    );

    expect(contexts).toEqual(
      result.draft.slices.map((slice, index) =>
        expect.objectContaining({
          status: 'ok',
          requestContext: expect.objectContaining({
            scopeId: slice.scopeId,
            requirements:
              index === 0
                ? [expect.objectContaining({ itemId: 'REQ1', content: 'Build feature' })]
                : [
                    expect.objectContaining({ itemId: 'REQ1', content: 'Build feature' }),
                    expect.objectContaining({ itemId: 'REQ2', content: 'Wire feature' }),
                  ],
          }),
        }),
      ),
    );
    const terminalContext = contexts[1];
    if (terminalContext?.status !== 'ok') throw new Error('expected terminal worker context');

    const paraphrasedPath = join(cwd, 'paraphrased-plan.json');
    await writeFile(
      paraphrasedPath,
      JSON.stringify(
        planFilePayload(
          previewPlan(
            {
              ...result.draft,
              slices: result.draft.slices.map((slice) => ({
                ...slice,
                definition: `Planner summary changed for ${slice.id}.`,
              })),
            },
            { executionContract: result.executionContract },
          ),
        ),
      ),
      'utf8',
    );
    const paraphrased = await readSliceRequestContext({
      cwd,
      runId: 'admission-parity',
      populatedPlanPath: paraphrasedPath,
      sliceId: 'task-2',
    });
    expect(paraphrased).toMatchObject({
      status: 'ok',
      requestContext: {
        definition: 'Planner summary changed for task-2.',
        requirements: terminalContext.requestContext.requirements,
      },
    });
  });

  it('feeds an unreconciled frontier-level epic back through bounded repair', async () => {
    const base = coherentCandidate();
    const invalid = {
      ...base,
      slices: [base.slices[0]!, { ...base.slices[1]!, dependsOn: [] }],
    };
    const planner = scriptedPlanner([invalid, coherentCandidate()]);

    const result = await synthesizePlan({ projection, detected: [], providers, planner });

    expect(result.status).toBe('admitted');
    if (result.status !== 'admitted') return;
    expect(result.history[0]!.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'epic_integration_unreconciled', itemId: 'F1' }),
      ]),
    );
    const repairCall = planner.calls[1] as {
      findings?: readonly { code: string; itemId?: string }[];
      priorCandidate?: unknown;
    };
    expect(repairCall.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'epic_integration_unreconciled', itemId: 'F1' }),
      ]),
    );
    expect(repairCall.priorCandidate).toEqual(invalid);
  });

  it('blocks after the bounded repair rounds with no fallback plan on any path', async () => {
    const base = coherentCandidate();
    const invalid = { ...base, requiredCapabilities: [] };
    const planner = scriptedPlanner([invalid]);

    const result = await synthesizePlan({ projection, detected: [], providers, planner });

    expect(result.status).toBe('blocked');
    if (result.status !== 'blocked') return;
    expect(result.findings.map((finding) => finding.code)).toContain('no_verification_capability');
    expect(result.history).toHaveLength(3);
    expect(result).not.toHaveProperty('draft');
  });

  it('treats malformed planner output as a findings round, feedable to repair', async () => {
    const planner = scriptedPlanner(['{ not json', coherentCandidate()]);

    const result = await synthesizePlan({ projection, detected: [], providers, planner });

    expect(result.status).toBe('admitted');
    if (result.status !== 'admitted') return;
    expect(result.history[0]!.findings[0]).toMatchObject({ code: 'malformed_candidate' });
  });

  it('keeps spec-mandated base requirements even when the candidate drops them', async () => {
    const base = coherentCandidate();
    const dropped = { ...base, requiredCapabilities: [] };
    const planner = scriptedPlanner([dropped]);

    const result = await synthesizePlan({
      projection,
      detected: [],
      providers,
      baseRequired: [{ id: 'python.pytest', source: { kind: 'elicited', itemId: 'DEC1' } }],
      planner,
    });

    expect(result.status).toBe('admitted');
    if (result.status !== 'admitted') return;
    expect(result.executionContract.resolvedActions.verify.map((action) => action.capabilityId)).toEqual([
      'python.pytest',
    ]);
  });

  it('blocks a never-settling planner at one round deadline without starting another invocation', async () => {
    vi.useFakeTimers();
    let calls = 0;
    let plannerSignal: AbortSignal | undefined;
    const progress: { round: number; phase: string }[] = [];
    const planner: PlannerPort = {
      synthesize: async ({ runtime }) => {
        calls += 1;
        plannerSignal = runtime?.signal;
        return new Promise(() => undefined);
      },
    };

    const pending = synthesizePlan({
      projection,
      detected: [],
      providers,
      planner,
      onProgress: (update) => progress.push(update),
    });
    await vi.advanceTimersByTimeAsync(PLAN_SYNTHESIS_ROUND_TIMEOUT_MS);
    const result = await pending;

    expect(result).toMatchObject({
      status: 'blocked',
      findings: [{ code: 'planner_timeout' }],
      history: [{ round: 0, findings: [{ code: 'planner_timeout' }] }],
    });
    expect(calls).toBe(1);
    expect(plannerSignal?.aborted).toBe(true);
    expect(progress).toEqual([
      { round: 0, phase: 'started' },
      { round: 0, phase: 'timed_out' },
    ]);
  });
});
