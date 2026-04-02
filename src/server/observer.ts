/**
 * Observer agent — extracts decisions and assumptions from answered turns.
 *
 * Runs silently after the interviewer completes. Uses client.messages.create()
 * with system-prompt-guided JSON extraction + Zod parse.
 * No streaming, no MCP tools.
 * Persists entities to the DB in a transaction, then yields observer-complete.
 */
import { z } from 'zod';

import { buildObserverContext } from './context.js';
import type { DomainEvent } from './core.js';
import {
  createDecision,
  createAssumption,
  linkDecisionToTurn,
  linkAssumptionToTurn,
  addDecisionParentDecision,
  addDecisionParentAssumption,
  addAssumptionParentAssumption,
  getEntitiesForProject,
  type DB,
  type Turn,
} from './db.js';
import { createAnthropicClient, extractMetrics } from './sdk.js';

/** Schema for observer structured output. */
export const observerOutputSchema = z.object({
  decisions: z.array(
    z.object({
      content: z.string().min(1),
      rationale: z.string().nullable(),
      parentDecisionIds: z.array(z.number()),
      parentAssumptionIds: z.array(z.number()),
    }),
  ),
  assumptions: z.array(
    z.object({
      content: z.string().min(1),
      parentAssumptionIds: z.array(z.number()),
    }),
  ),
});

export type ObserverOutput = z.infer<typeof observerOutputSchema>;

const OBSERVER_SYSTEM_PROMPT = `You are an observer agent analyzing a spec elicitation interview turn.

Your job is to extract decisions and assumptions from the Q&A exchange. For each turn, identify:

1. **Decisions** — explicit choices the user made (e.g., "use SQLite", "support only macOS"). Include the rationale if stated.
2. **Assumptions** — implicit or explicit beliefs underlying the decisions (e.g., "single-user tool", "users have API keys").

For each entity, identify dependency edges to previously extracted entities by their IDs.

Rules:
- Only extract entities that are NEW in this turn — do not re-extract existing entities.
- Be precise: a decision is a concrete choice; an assumption is a belief that could be wrong.
- If no new entities are evident in this turn, return empty arrays.
- Reference parent entity IDs only when a clear dependency exists.
- Return ONLY valid JSON matching this exact schema: { "decisions": [...], "assumptions": [...] }
- Do NOT wrap the JSON in markdown code fences.`;

/**
 * Run the observer agent. Extracts entities from the completed turn,
 * persists them to the DB, and yields observer-complete with entity IDs.
 */
export async function* runObserver(db: DB, turn: Turn, projectId: number): AsyncGenerator<DomainEvent> {
  const client = createAnthropicClient();
  const entities = getEntitiesForProject(db, projectId);
  const context = buildObserverContext({
    turn,
    activePathSummary: '',
    entities,
  });

  const startMs = Date.now();

  const response = await client.messages.create({
    model: process.env.OBSERVER_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: OBSERVER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: context }],
  });

  const durationMs = Date.now() - startMs;

  // Extract text content from response
  const textBlock = response.content.find(
    (block): block is Extract<(typeof response.content)[number], { type: 'text' }> => block.type === 'text',
  );

  if (!textBlock) {
    throw new Error('Observer extraction failed: no text block in response');
  }

  // Parse JSON — strip markdown code fences if present
  const jsonStr = textBlock.text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  const parsed = observerOutputSchema.parse(JSON.parse(jsonStr));

  // Persist entities in a transaction-like sequence
  const createdDecisionIds: number[] = [];
  const createdAssumptionIds: number[] = [];

  for (const d of parsed.decisions) {
    const decision = createDecision(db, projectId, d.content, d.rationale);
    linkDecisionToTurn(db, decision.id, turn.id);
    createdDecisionIds.push(decision.id);

    for (const parentId of d.parentDecisionIds) {
      addDecisionParentDecision(db, decision.id, parentId);
    }
    for (const parentId of d.parentAssumptionIds) {
      addDecisionParentAssumption(db, decision.id, parentId);
    }
  }

  for (const a of parsed.assumptions) {
    const assumption = createAssumption(db, projectId, a.content);
    linkAssumptionToTurn(db, assumption.id, turn.id);
    createdAssumptionIds.push(assumption.id);

    for (const parentId of a.parentAssumptionIds) {
      addAssumptionParentAssumption(db, assumption.id, parentId);
    }
  }

  // Yield observer-complete post-commit
  yield {
    type: 'observer-complete',
    entityIds: { decisions: createdDecisionIds, assumptions: createdAssumptionIds },
  };

  // Yield agent metrics
  yield extractMetrics('observer', {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    durationMs,
  });
}
