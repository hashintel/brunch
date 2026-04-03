import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import * as z from 'zod/v4';

import { buildObserverContext } from './context.js';
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
 * persists them to the DB, and returns created entity IDs.
 */
export async function runObserver(
  db: DB,
  turn: Turn,
  projectId: number,
): Promise<{ decisions: number[]; assumptions: number[] }> {
  const entities = getEntitiesForProject(db, projectId);
  const context = buildObserverContext({
    turn,
    activePathSummary: '',
    entities,
  });

  const result = await generateObject({
    model: anthropic(process.env.OBSERVER_MODEL || 'claude-haiku-4-5-20251001'),
    maxOutputTokens: 2048,
    system: OBSERVER_SYSTEM_PROMPT,
    prompt: context,
    schema: observerOutputSchema,
  });

  const parsed = result.object;

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

  return { decisions: createdDecisionIds, assumptions: createdAssumptionIds };
}
