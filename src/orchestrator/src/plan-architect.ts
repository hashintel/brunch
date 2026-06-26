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
import { PROFILE_IDS, type ProfileId } from './project-profile.js';
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
    /**
     * Toolchain profile classified from the spec prose alone (D160-K: no
     * host introspection). `null` when the spec names no stack. Lowest rung
     * of the emitter's selection chain — flag and spec profile both win.
     */
    profile: z
      .enum(PROFILE_IDS as [ProfileId, ...ProfileId[]])
      .nullable()
      .optional(),
    /**
     * Harness prior-art (FE-894 ①): concise project build/framework seams the
     * cook agents would otherwise rediscover per slice (code-split→router
     * wiring, headless-render limits, shared-module conventions). Injected into
     * every slice/epic agent task. Optional — absent leaves tasks unchanged.
     */
    harnessNotes: z.string().optional(),
  })
  .superRefine((draft, ctx) => {
    const seenSliceIds = new Set<string>();
    for (const [index, slice] of draft.slices.entries()) {
      if (seenSliceIds.has(slice.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate slice id: ${slice.id}`,
          path: ['slices', index, 'id'],
        });
      } else {
        seenSliceIds.add(slice.id);
      }
    }

    const seenEpicIds = new Set<string>();
    for (const [index, epic] of draft.epics.entries()) {
      if (seenEpicIds.has(epic.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate epic id: ${epic.id}`,
          path: ['epics', index, 'id'],
        });
      } else {
        seenEpicIds.add(epic.id);
      }
    }
  });

export type ArchitectDraft = z.infer<typeof architectDraftSchema>;

export type ArchitectResult =
  | { status: 'succeeded'; draft: ArchitectDraft }
  | { status: 'failed'; reason: string };

export type RunModel = (prompt: string) => Promise<unknown>;

export const DEFAULT_ARCHITECT_MODEL_ID = 'claude-opus-4-8';

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
    '   repository yourself — use only the repository context supplied below, the',
    '   spec, conventions, and the exemplars. The cook agent writes tests at run time.',
    '7. `profile`: if the requirement/criteria prose names a tech stack, classify it',
    `   as one of: ${PROFILE_IDS.join(', ')}. Set null when the spec is silent or`,
    '   names a stack outside that list — never guess.',
    '8. `harnessNotes` (optional): the build/framework prior-art the per-slice',
    '   agents would otherwise rediscover independently — the seams that bite when',
    '   slices are composed (e.g. how code-split units wire into the real router,',
    '   headless/test-environment limits of the chosen UI libraries, shared-module',
    '   or state conventions the join slices must honour). Write a few concise',
    '   sentences of cross-cutting guidance that apply across slices. This is NOT',
    '   test-runner setup (that comes from the toolchain) and NOT per-slice detail.',
    '   Omit when the spec implies no non-obvious harness seams — never pad it.',
    '',
    'Requirements (id + definition + acceptance criteria):',
    requirementBlocks,
    '',
    'Spec relation hints (epistemic, NOT automatic build dependencies):',
    relationLines,
    '',
    'Brownfield repository context (package anchors, if supplied):',
    formatProjectContext(context),
    '',
    'When package anchors are supplied, anchor product `writes` under the matching',
    'workspace package named or implied by the requirement. Do not put product',
    'implementation work in an unrelated integration-test package; integration-test',
    'paths are oracle targets, not product-write anchors, unless the requirement is',
    'explicitly test-only.',
    '',
    'Reference exemplars — the target dependency/epic/file-ownership shape',
    '(scaffold → file-disjoint behaviours → join owning the shared file). Use them',
    'as STRUCTURAL guidance only; do not copy their ids, paths, or domain terms:',
    buildExemplarBlock(),
    '',
    'Output the authored `epics`, `slices` (each with `writes` + `derivedFrom`),',
    '`nonBuildableRequirementIds`, `profile`, and (optionally) `harnessNotes`.',
  ].join('\n');
}

function formatProjectContext(context: PlanningContext): string {
  const packages = context.project?.packages ?? [];
  if (packages.length === 0) return '(none)';
  return packages.map((pkg) => `- ${pkg.name ? `${pkg.name} at ` : ''}${pkg.dir}`).join('\n');
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
    model: anthropic(process.env.SPEC_TO_COOK_PLAN_MODEL || DEFAULT_ARCHITECT_MODEL_ID),
    maxOutputTokens: 4096,
    prompt,
    output: Output.object({ schema: architectDraftSchema }),
  });
  return result.output;
};
