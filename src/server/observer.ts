/**
 * Observer agent — extracts decisions and assumptions from answered turns.
 *
 * Runs silently after the interviewer completes. Uses outputFormat (structured JSON)
 * for entity extraction — no MCP tools, no streaming events.
 * Persists entities to the DB in a transaction, then yields observer-complete.
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
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
import { extractMetrics, type SdkResultMessage } from './sdk.js';

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
- Reference parent entity IDs only when a clear dependency exists.`;

/**
 * Run the observer agent. Extracts entities from the completed turn,
 * persists them to the DB, and yields observer-complete with entity IDs.
 */
export async function* runObserver(db: DB, turn: Turn, projectId: number): AsyncGenerator<DomainEvent> {
  const entities = getEntitiesForProject(db, projectId);
  const context = buildObserverContext({
    turn,
    activePathSummary: '',
    entities,
  });

  const stream = query({
    prompt: context,
    options: {
      model: process.env.OBSERVER_MODEL || 'claude-haiku-4-5-20251001',
      maxTurns: 1,
      persistSession: false,
      effort: 'low',
      systemPrompt: OBSERVER_SYSTEM_PROMPT,
      outputFormat: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            decisions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  content: { type: 'string' },
                  rationale: { type: 'string', nullable: true },
                  parentDecisionIds: { type: 'array', items: { type: 'number' } },
                  parentAssumptionIds: { type: 'array', items: { type: 'number' } },
                },
                required: ['content', 'rationale', 'parentDecisionIds', 'parentAssumptionIds'],
              },
            },
            assumptions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  content: { type: 'string' },
                  parentAssumptionIds: { type: 'array', items: { type: 'number' } },
                },
                required: ['content', 'parentAssumptionIds'],
              },
            },
          },
          required: ['decisions', 'assumptions'],
        },
      },
    },
  });

  let resultMessage: SdkResultMessage | undefined;

  for await (const msg of stream) {
    if ((msg as Record<string, unknown>).type === 'result') {
      resultMessage = msg as unknown as SdkResultMessage;
    }
  }

  if (!resultMessage || resultMessage.is_error) {
    throw new Error(`Observer extraction failed: ${resultMessage ? 'SDK error' : 'no result message'}`);
  }

  // Parse structured output
  const parsed = observerOutputSchema.parse(resultMessage.structured_output);

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
  if (resultMessage) {
    yield extractMetrics('observer', resultMessage);
  }
}
