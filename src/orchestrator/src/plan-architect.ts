// FE-829 slice 4B: the build-architect AUTHORING stage.
//
// Where the retired slice-3 planner only classified/grouped/ordered the
// pre-projected 1:1 `req-*` slices, the architect AUTHORS a fresh
// slice set: it may decompose one requirement into a scaffold slice, N
// file-disjoint per-behaviour slices, and a join slice that owns shared
// coordination files. Each authored slice declares the repo-relative file
// paths it writes (`writes`) and the requirement ids it derives from
// (`derivedFrom`, used for deterministic coverage — never persisted on the
// emitted `Plan`).
//
// Per D160-K (amended) the architect performs NO host introspection and
// authors NO test content: verification targets are synthesized
// deterministically downstream (`materializeArchitectedPlan`) and the cook
// agent authors the tests at run time (A98).
//
// Single structured round-trip through the injected `runModel`. Any
// failure (thrown LLM, parse error, malformed shape) collapses to a
// recoverable `{ status: 'failed' }` so the emitter can fall back to the
// deterministic projected plan rather than crash.

import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import * as z from 'zod/v4';

import { buildExemplarBlock } from './plan-exemplars.js';
import { EMPTY_PLANNING_CONTEXT, type PlanningContext } from './plan-planning-context.js';
import type { Plan } from './types.js';

const architectSliceSchema = z.object({
  id: z.string(),
  epic_id: z.string(),
  definition: z.string(),
  depends_on: z.array(z.string()),
  writes: z.array(z.string()),
  derivedFrom: z.array(z.string()),
});

export const architectDraftSchema = z
  .object({
    epics: z.array(
      z.object({
        id: z.string(),
        summary: z.string(),
        depends_on: z.array(z.string()).optional(),
      }),
    ),
    slices: z.array(architectSliceSchema),
    nonBuildableRequirementIds: z.array(z.string()),
  })
  .superRefine((draft, ctx) => {
    const seen = new Set<string>();
    for (const [index, slice] of draft.slices.entries()) {
      if (seen.has(slice.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate slice id: ${slice.id}`,
          path: ['slices', index, 'id'],
        });
      } else {
        seen.add(slice.id);
      }
    }
  });

export type ArchitectDraft = z.infer<typeof architectDraftSchema>;

export type ArchitectResult =
  | { status: 'succeeded'; draft: ArchitectDraft }
  | { status: 'failed'; reason: string };

export type RunModel = (prompt: string) => Promise<unknown>;

const EMPTY_DRAFT: ArchitectDraft = { epics: [], slices: [], nonBuildableRequirementIds: [] };

/**
 * Author a decomposed, file-disjoint plan draft from the projected
 * requirement universe. `projected` carries one `req-<id>` slice per
 * requirement with acceptance criteria attached as `kind:'criterion'`
 * verification entries — the architect's input, not its output.
 */
export async function architectPlan(
  projected: Plan,
  runModel: RunModel,
  context: PlanningContext = EMPTY_PLANNING_CONTEXT,
): Promise<ArchitectResult> {
  if (projected.slices.length === 0) {
    return { status: 'succeeded', draft: EMPTY_DRAFT };
  }

  const prompt = buildArchitectPrompt(projected, context);

  let raw: unknown;
  try {
    raw = await runModel(prompt);
  } catch (error) {
    return { status: 'failed', reason: errorMessage(error) };
  }

  const parsed = architectDraftSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 'failed',
      reason: `Parse error: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
    };
  }

  return { status: 'succeeded', draft: parsed.data };
}

function buildArchitectPrompt(projected: Plan, context: PlanningContext): string {
  const requirementBlocks = projected.slices
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
    'You are a build architect. Turn the completed product specification below',
    'into an executable, file-disjoint build plan (plan.yaml shape).',
    '',
    'You AUTHOR the slices — you are not limited to the requirement ids. Decompose',
    'each requirement into the smallest buildable units:',
    '- a scaffold slice for project/package setup when needed,',
    '- one file-disjoint slice per behaviour (each owns its own source file(s)),',
    '- a join slice that owns any SHARED coordination file (e.g. a barrel/index,',
    '  a route registry, app wiring) and `depends_on` every slice it composes.',
    '',
    'Hard rules:',
    '1. `writes`: every slice lists the repo-relative POSIX file paths it exclusively',
    '   mutates (exact paths, no globs, no directories). A file may be written by',
    '   exactly ONE slice — the sole writer of a shared file IS the join slice; other',
    '   slices must NOT list that file. Scaffold must not write a file the join owns.',
    '2. `derivedFrom`: every slice lists the requirement id(s) (from the list below)',
    '   it implements. Infrastructure-only slices (scaffold/join) may use [] if they',
    '   implement no requirement directly. Every requirement must appear in some',
    "   slice's `derivedFrom` unless it is a constraint listed in",
    '   `nonBuildableRequirementIds`.',
    '3. `depends_on`: real engineering prerequisites only — a sparse, acyclic DAG.',
    '4. `epics`: group slices into a few named epics; set each slice\u2019s `epic_id`.',
    '5. `nonBuildableRequirementIds`: requirement ids whose text is a CONSTRAINT or',
    '   policy rather than a buildable unit of work.',
    '6. Do NOT author tests or verification entries, and do NOT inspect the target',
    '   repository — reason only from the spec, conventions, and the exemplars. The',
    '   cook agent writes the tests at run time.',
    '',
    'Requirements (id + definition + acceptance criteria):',
    requirementBlocks,
    '',
    'Spec relation hints (epistemic, NOT automatic build dependencies):',
    relationLines,
    '',
    'Reference exemplars — the target dependency/epic/file-ownership shape',
    '(scaffold → file-disjoint behaviours → join owning the shared file). Use them',
    'as STRUCTURAL guidance only; do not copy their ids, paths, or domain terms:',
    buildExemplarBlock(),
    '',
    'Output the authored `epics`, `slices` (each with `writes` + `derivedFrom`),',
    'and `nonBuildableRequirementIds`.',
  ].join('\n');
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Production LLM seam: a single structured round-trip, no tools,
 * schema-validated downstream.
 */
export const defaultArchitectRunModel: RunModel = async (prompt) => {
  const result = await generateText({
    model: anthropic(process.env.SPEC_TO_COOK_PLAN_MODEL || 'claude-sonnet-4-20250514'),
    maxOutputTokens: 4096,
    prompt,
    output: Output.object({ schema: architectDraftSchema }),
  });
  return result.output;
};
