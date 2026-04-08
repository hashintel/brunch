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
  getOptionsForTurn,
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
  requirements: z.array(
    z.object({
      content: z.string().min(1),
      rationale: z.string().nullable(),
    }),
  ),
  criteria: z.array(
    z.object({
      content: z.string().min(1),
      rationale: z.string().nullable(),
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
      : phase === 'design'
        ? `For design-mode turns, prioritize **decisions** and **assumptions**. Decisions capture explicit commitments in the design tree. Assumptions capture beliefs those commitments rely on. Still allow **framing corrections** when the turn revises project context and **constraint spillover** when it introduces a new boundary or non-goal. Do not force every boundary into a decision, and do not force every design preference into an assumption.`
        : phase === 'requirements'
          ? `For requirements-mode turns, prioritize **requirement** items. Requirements capture must-do capabilities or obligations implied by the review conversation. You may still emit framing or constraints when the turn clearly revises context or introduces a new boundary, but defer **criterion** extraction until a later criteria-focused slice unless the turn truly cannot be represented without it.`
          : phase === 'criteria'
            ? `For criteria-mode turns, prioritize **criterion** items. Criteria capture verifiable success conditions and concrete evidence that would prove a requirement is satisfied. Distinguish criteria from requirements: a requirement states what the system must do, while a criterion states how someone will verify that success. You may still emit framing or constraints when the turn clearly revises context or introduces a new boundary, but do not collapse a verification condition back into a requirement.`
            : `For later-mode turns, keep the extraction grounded in explicit commitments and beliefs from the current exchange. Only emit framing or constraints when the turn clearly revises project context or introduces a new boundary rather than merely reviewing prior knowledge.`;

  return `You are an observer agent analyzing a spec elicitation interview turn.

Your job is to extract framing, constraints, requirements, criteria, decisions, and assumptions from the Q&A exchange. For each turn, identify:

1. **Framing** — contextual truth, project intent, or problem context that clarifies what the project is about.
2. **Constraints** — boundaries on the acceptable solution space, including hard limits, exclusions, and non-goals. Include a subtype when useful (for example "non-goal").
3. **Requirements** — must-do capabilities or obligations the product needs to satisfy.
4. **Criteria** — verifiable success conditions or observable checks that prove a requirement is satisfied.
5. **Decisions** — explicit choices the user made (e.g., "use SQLite", "support only macOS"). Include the rationale if stated.
6. **Assumptions** — implicit or explicit beliefs underlying the decisions (e.g., "single-user tool", "users have API keys").

${phaseBias}

For decisions and assumptions, identify dependency edges to previously extracted entities by their IDs.

Rules:
- Only extract entities that are NEW in this turn — do not re-extract existing entities.
- Be precise: framing is context, a constraint is a boundary or non-goal, a requirement is a must-do capability, a criterion is a verifiable success condition, a decision is a concrete choice, and an assumption is a belief that could be wrong.
- If no new entities are evident in this turn, return empty arrays.
- Reference parent entity IDs only when a clear dependency exists.
- Return ONLY valid JSON matching this exact schema: { "framing": [...], "constraints": [...], "requirements": [...], "criteria": [...], "decisions": [...], "assumptions": [...] }
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
): Promise<{
  framing: number[];
  constraints: number[];
  requirements: number[];
  criteria: number[];
  decisions: number[];
  assumptions: number[];
}> {
  const entities = getEntitiesForProject(db, projectId);
  const context = buildObserverContext({
    turn: {
      ...turn,
      options: getOptionsForTurn(db, turn.id),
    },
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
  const createdRequirementIds: number[] = [];
  const createdCriterionIds: number[] = [];
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

  for (const item of parsed.requirements) {
    const requirement = createKnowledgeItem(db, projectId, 'requirement', item.content, {
      rationale: item.rationale,
    });
    linkKnowledgeItemToTurn(db, requirement.id, turn.id);
    createdRequirementIds.push(requirement.id);
  }

  for (const item of parsed.criteria) {
    const criterion = createKnowledgeItem(db, projectId, 'criterion', item.content, {
      rationale: item.rationale,
    });
    linkKnowledgeItemToTurn(db, criterion.id, turn.id);
    createdCriterionIds.push(criterion.id);
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
    requirements: createdRequirementIds,
    criteria: createdCriterionIds,
    decisions: createdDecisionIds,
    assumptions: createdAssumptionIds,
  };
}
