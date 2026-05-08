// V3.1 slice 4 (memory/CARDS.md): reconciliation classifier.
//
// Pure function that takes one open `reconciliation_need` plus its source +
// target item snapshots, asks the LLM to classify it into one of three
// labels, and returns a parsed result. The route layer in
// `reconciliation-agent-route.ts` walks the lifecycle (null → queued →
// classifying → classified | failed) around this call.
//
// The classifier is structurally recoverable per I114: invalid labels and
// thrown LLM errors both transition to `failed` with the diagnostic in
// `agent_proposal`; `agent_proposal` is text-only and is never auto-applied
// by the server. That recoverability is what lets the inner-loop tests
// stay shallow (state machine + parser, no semantic correctness).

import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import * as z from 'zod/v4';

import type { ReconciliationNeed, ReconciliationNeedAgentClassification } from './db.js';
import type { KnowledgeItem } from './db.js';
import { renderPromptAsset } from './prompt-loader.js';

// The label vocabulary mirrors the `agent_classification` schema enum and
// the I114 invariant. Re-declared as a Zod schema so the AI SDK's structured
// `Output.object` adapter can validate the model response inline.
export const reconciliationClassificationSchema = z.object({
  classification: z.enum(['auto-confirm', 'auto-edit', 'substantive']),
  proposal: z.string().nullable().optional(),
});

export type ReconciliationClassifierOutput = z.infer<typeof reconciliationClassificationSchema>;

export interface ClassifyNeedInput {
  need: Pick<ReconciliationNeed, 'id' | 'kind' | 'source_item_id' | 'target_item_id'>;
  sourceItem: Pick<KnowledgeItem, 'id' | 'content'>;
  targetItem: Pick<KnowledgeItem, 'id' | 'content'>;
  // Frozen at need-open time by the cascade producer (Card 1). May be null
  // for legacy rows or test seeds; the prompt collapses both fields to '(no
  // recorded snapshot)' rather than failing — the user can still re-classify
  // by hand.
  sourcePreviousContent: string | null;
  sourceCurrentContent: string | null;
  // The typed dependency edge between target and source (e.g. depends_on,
  // refines, derived_from). Undefined when the edge is gone (race / orphan
  // need); the prompt falls back to '(unknown)' rather than failing.
  relationKind: string | undefined;
}

export interface ClassifyNeedResult {
  status: 'classified' | 'failed';
  classification: ReconciliationNeedAgentClassification | null;
  proposal: string | null;
}

/**
 * One-shot LLM classification. The injected `runModel` function exists so
 * tests can stub the LLM seam without touching any provider; production
 * callers pass {@link defaultRunModel} which routes through the AI SDK
 * adapter already used by side-chat-route + observer.
 */
export async function classifyNeed(
  input: ClassifyNeedInput,
  runModel: (prompt: string) => Promise<unknown>,
): Promise<ClassifyNeedResult> {
  const prompt = renderPromptAsset('reconciliation.classifier', {
    source_previous: input.sourcePreviousContent ?? '(no recorded snapshot)',
    source_current: input.sourceCurrentContent ?? '(no recorded snapshot)',
    target_current: input.targetItem.content,
    relation_kind: input.relationKind ?? '(unknown)',
    need_kind: input.need.kind,
  });

  let raw: unknown;
  try {
    raw = await runModel(prompt);
  } catch (error) {
    return {
      status: 'failed',
      classification: null,
      proposal: errorMessage(error),
    };
  }

  const parsed = reconciliationClassificationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 'failed',
      classification: null,
      proposal: `Parse error: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
    };
  }

  return {
    status: 'classified',
    classification: parsed.data.classification,
    proposal: parsed.data.proposal ?? null,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Production LLM seam. Threads the prompt through the AI SDK adapter
 * (`generateText` + `Output.object`) using the same model knob as the
 * observer. Single-shot, no tools, no multi-turn.
 *
 * Returned value is the raw structured object from the model — `classifyNeed`
 * still parses it through the Zod schema so a model that bypasses
 * `Output.object` can't sneak past the label vocabulary.
 */
export async function defaultRunModel(prompt: string): Promise<unknown> {
  const result = await generateText({
    model: anthropic(process.env.RECONCILIATION_CLASSIFIER_MODEL || 'claude-haiku-4-5-20251001'),
    maxOutputTokens: 1024,
    prompt,
    output: Output.object({ schema: reconciliationClassificationSchema }),
  });
  return result.output;
}
