import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import * as z from 'zod/v4';

import { buildObserverContext } from './context.js';
import {
  createDecision,
  createAssumption,
  createKnowledgeItem,
  linkDecisionToTurn,
  linkAssumptionToTurn,
  linkKnowledgeItemToTurn,
  addDecisionParentDecision,
  addDecisionParentAssumption,
  addAssumptionParentAssumption,
  getEntitiesForProject,
  type DB,
  type Turn,
} from './db.js';

/** Schema for observer structured output. */
export const observerOutputSchema = z.object({
  framing: z.array(
    z.object({
      content: z.string().min(1),
      rationale: z.string().nullable(),
    }),
  ),
  constraints: z.array(
    z.object({
      content: z.string().min(1),
      rationale: z.string().nullable(),
      subtype: z.string().nullable(),
    }),
  ),
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

function buildObserverSystemPrompt(phase: Turn['phase']): string {
  const phaseBias =
    phase === 'scope'
      ? `For scope-mode turns, prioritize **framing** and **constraint** items. Framing captures contextual truth, project intent, and problem context. Constraints capture boundaries on the acceptable solution space, including hard limits and non-goals. Do not force ordinary framing facts into assumptions, and do not force constraints into requirements. Leave decisions and assumptions empty unless the turn makes them genuinely explicit.`
      : `For non-scope turns, decisions and assumptions remain primary. Only emit framing when the turn clearly revises or adds project context rather than making a commitment or stating a belief.`;

  return `You are an observer agent analyzing a spec elicitation interview turn.

Your job is to extract framing, constraints, decisions, and assumptions from the Q&A exchange. For each turn, identify:

1. **Framing** — contextual truth, project intent, or problem context that clarifies what the project is about.
2. **Constraints** — boundaries on the acceptable solution space, including hard limits, exclusions, and non-goals. Include a subtype when useful (for example "non-goal").
3. **Decisions** — explicit choices the user made (e.g., "use SQLite", "support only macOS"). Include the rationale if stated.
4. **Assumptions** — implicit or explicit beliefs underlying the decisions (e.g., "single-user tool", "users have API keys").

${phaseBias}

For decisions and assumptions, identify dependency edges to previously extracted entities by their IDs.

Rules:
- Only extract entities that are NEW in this turn — do not re-extract existing entities.
- Be precise: framing is context, a constraint is a boundary or non-goal, a decision is a concrete choice, and an assumption is a belief that could be wrong.
- If no new entities are evident in this turn, return empty arrays.
- Reference parent entity IDs only when a clear dependency exists.
- Return ONLY valid JSON matching this exact schema: { "framing": [...], "constraints": [...], "decisions": [...], "assumptions": [...] }
- Do NOT wrap the JSON in markdown code fences.`;
}

/**
 * Run the observer agent. Extracts entities from the completed turn,
 * persists them to the DB, and returns created entity IDs.
 */
export async function runObserver(
  db: DB,
  turn: Turn,
  projectId: number,
): Promise<{ framing: number[]; constraints: number[]; decisions: number[]; assumptions: number[] }> {
  const entities = getEntitiesForProject(db, projectId);
  const context = buildObserverContext({
    turn,
    activePathSummary: '',
    entities,
  });

  const result = await generateText({
    model: anthropic(process.env.OBSERVER_MODEL || 'claude-haiku-4-5-20251001'),
    maxOutputTokens: 2048,
    system: buildObserverSystemPrompt(turn.phase),
    prompt: context,
    output: Output.object({ schema: observerOutputSchema }),
  });

  const parsed = result.output;

  // Persist entities in a transaction-like sequence
  const createdFramingIds: number[] = [];
  const createdConstraintIds: number[] = [];
  const createdDecisionIds: number[] = [];
  const createdAssumptionIds: number[] = [];

  for (const item of parsed.framing) {
    const framing = createKnowledgeItem(db, projectId, 'framing', item.content, {
      rationale: item.rationale,
    });
    linkKnowledgeItemToTurn(db, framing.id, turn.id);
    createdFramingIds.push(framing.id);
  }

  for (const item of parsed.constraints) {
    const constraint = createKnowledgeItem(db, projectId, 'constraint', item.content, {
      subtype: item.subtype,
      rationale: item.rationale,
    });
    linkKnowledgeItemToTurn(db, constraint.id, turn.id);
    createdConstraintIds.push(constraint.id);
  }

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

  return {
    framing: createdFramingIds,
    constraints: createdConstraintIds,
    decisions: createdDecisionIds,
    assumptions: createdAssumptionIds,
  };
}
