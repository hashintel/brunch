// FE-800 slice 2: LLM planning pass.
// FE-829 slice 3: build-architect prompt — enriches the call with each
// slice's requirement criteria, spec relation hints projected into
// slice-id space (`PlanningContext`), and the reference fixtures inlined
// as few-shot exemplars. The OUTPUT schema is unchanged: the planner
// still only classifies, groups, and orders the existing `req-*` slices.
// Requirement decomposition / file-ownership is slice 4 (needs
// `Slice.writes` + the D160-K amendment).
//
// Pure function that takes a slice-1 projected Plan plus an injected
// `runModel` LLM seam, performs one structured LLM round-trip, and
// returns a typed enrichment with per-slice depends_on, epic grouping,
// and non-buildable slice ids.
//
// Slice 2 enforces SHAPE only — id existence, cycles, dangling deps
// onto constraint slices, and epic-coverage gaps are the deterministic
// reconciliation/contract stages. Failures (thrown LLM, parse error,
// malformed shape) collapse to a recoverable `{ status: 'failed' }`
// result so the emitter can fall back instead of crashing.

import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import * as z from 'zod/v4';

import { buildExemplarBlock } from './plan-exemplars.js';
import { EMPTY_PLANNING_CONTEXT, type PlanningContext } from './plan-planning-context.js';
import type { Plan } from './types.js';

export const planningEnrichmentSchema = z.object({
  sliceDependencies: z.array(
    z.object({
      sliceId: z.string(),
      dependsOn: z.array(z.string()),
    }),
  ),
  epics: z.array(
    z.object({
      id: z.string(),
      summary: z.string(),
      sliceIds: z.array(z.string()),
    }),
  ),
  nonBuildableSliceIds: z.array(z.string()),
});

export type PlanningEnrichment = z.infer<typeof planningEnrichmentSchema>;

export type PlanningResult =
  | { status: 'succeeded'; enrichment: PlanningEnrichment }
  | { status: 'failed'; reason: string };

export type RunModel = (prompt: string) => Promise<unknown>;

export async function planExecutionOrdering(
  plan: Plan,
  runModel: RunModel,
  context: PlanningContext = EMPTY_PLANNING_CONTEXT,
): Promise<PlanningResult> {
  if (plan.slices.length === 0) {
    return {
      status: 'succeeded',
      enrichment: { sliceDependencies: [], epics: [], nonBuildableSliceIds: [] },
    };
  }

  const prompt = buildPlanningPrompt(plan, context);

  let raw: unknown;
  try {
    raw = await runModel(prompt);
  } catch (error) {
    return { status: 'failed', reason: errorMessage(error) };
  }

  const parsed = planningEnrichmentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 'failed',
      reason: `Parse error: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
    };
  }

  return { status: 'succeeded', enrichment: parsed.data };
}

function buildPlanningPrompt(plan: Plan, context: PlanningContext): string {
  const allSliceIds = plan.slices.map((slice) => slice.id).join(', ');

  const sliceBlocks = plan.slices
    .map((slice) => {
      const criteria = slice.verification
        .filter((target) => target.kind === 'criterion')
        .map((target) => `    - ${target.target}`);
      const criteriaBlock =
        criteria.length > 0
          ? ['  Acceptance criteria:', ...criteria].join('\n')
          : '  Acceptance criteria: (none)';
      return [`- ${slice.id}: ${slice.definition}`, criteriaBlock].join('\n');
    })
    .join('\n');

  const relationLines =
    context.relations.length > 0
      ? context.relations
          .map((relation) => `- ${relation.fromSliceId} ${relation.relation} ${relation.toSliceId}`)
          .join('\n')
      : '(none)';

  return [
    'You are a build architect turning a completed product specification into an',
    'executable build plan. The slices below already exist — one per requirement.',
    'You may only CLASSIFY, GROUP, and ORDER them. Do NOT invent, split, merge,',
    'rename, or remove slices, and do not emit file paths. Produce three things:',
    '',
    '1. `sliceDependencies`: for each slice, the list of OTHER slice ids it must be built AFTER.',
    '   Only emit ordering edges that are real engineering prerequisites (e.g. a slice that',
    '   establishes a schema must precede slices that query it). Avoid edges that just reflect',
    '   topical similarity. Aim for a sparse, acyclic DAG. If a slice is independent, emit an',
    '   empty `dependsOn` array.',
    '',
    '2. `epics`: a grouping of slices into a small number (typically 2–5) of named epics.',
    '   Each epic has an id (kebab-case slug), a short human summary, and the list of slice',
    '   ids it contains. Every slice should appear in exactly one epic.',
    '',
    '3. `nonBuildableSliceIds`: slice ids whose requirement text reads as a CONSTRAINT or',
    '   architectural policy rather than a buildable unit of work (e.g. "the system must',
    '   never lose data" is a constraint; "implement durable storage for X" is buildable).',
    '   Constraints should NOT be built directly; they shape how buildable slices are',
    '   implemented. Be conservative — only flag a slice as non-buildable if its definition',
    '   clearly describes a policy, invariant, or constraint rather than an action.',
    '',
    `Available slice ids: ${allSliceIds}`,
    '',
    'Plan slices (definition + acceptance criteria):',
    sliceBlocks,
    '',
    'Spec relation hints (epistemic, NOT automatic build dependencies — use them to',
    'infer real engineering prerequisites, ignore those that are merely topical):',
    relationLines,
    '',
    'Reference exemplars — these hand-authored plans show the target DEPENDENCY and',
    'EPIC shape (scaffold→fan-out→join, diamonds, cross-epic gates). Use them as',
    'STRUCTURAL guidance only; do not copy their ids, file paths, or domain terms.',
    buildExemplarBlock(),
    '',
    'Output only the three fields described above (`sliceDependencies`, `epics`,',
    '`nonBuildableSliceIds`) over the existing slice ids.',
  ].join('\n');
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Production LLM seam. Threads the prompt through the AI SDK adapter
 * (`generateText` + `Output.object`) using the same model knob shape
 * as the server-side reconciliation classifier. Single-shot, no tools,
 * no multi-turn.
 *
 * Returned value is the raw structured object from the model;
 * `planExecutionOrdering` still parses it through the Zod schema so a
 * model that bypasses `Output.object` cannot smuggle past the contract.
 */
export const defaultRunModel: RunModel = async (prompt) => {
  const result = await generateText({
    model: anthropic(process.env.SPEC_TO_COOK_PLAN_MODEL || 'claude-sonnet-4-20250514'),
    maxOutputTokens: 2048,
    prompt,
    output: Output.object({ schema: planningEnrichmentSchema }),
  });
  return result.output;
};
