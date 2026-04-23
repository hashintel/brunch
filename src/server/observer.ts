import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import * as z from 'zod/v4';

import { type ObserverEntityIds } from '@/shared/chat.js';
import {
  createKnowledgeCollectionRecord,
  knowledgeKindRegistry,
  knowledgeKinds,
  knowledgeKindSemanticRoles,
  observerPhaseOntologyPolicies,
  type KnowledgeKind,
} from '@/shared/knowledge.js';

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
  getEntitiesForSpecification,
  getOptionsForTurn,
  getSpecification,
  type DB,
  type Turn,
} from './db.js';

const observerTextItemSchema = z.object({
  content: z.string().min(1),
  rationale: z.string().nullable(),
});

function createObserverOutputItemSchema(kind: KnowledgeKind) {
  return kind === 'constraint'
    ? observerTextItemSchema.extend({
        subtype: z.string().nullable(),
      })
    : kind === 'decision'
      ? observerTextItemSchema.extend({
          parentDecisionIds: z.array(z.number()),
          parentAssumptionIds: z.array(z.number()),
        })
      : kind === 'assumption'
        ? z.object({
            content: z.string().min(1),
            parentAssumptionIds: z.array(z.number()),
          })
        : observerTextItemSchema;
}

/** Schema for observer structured output. */
export const observerOutputSchema = z.object(
  createKnowledgeCollectionRecord((entry) => z.array(createObserverOutputItemSchema(entry.kind))),
);

type ObserverTextItem = z.infer<typeof observerTextItemSchema>;
type ObserverConstraintItem = ObserverTextItem & { subtype: string | null };
type ObserverDecisionItem = ObserverTextItem & {
  parentDecisionIds: number[];
  parentAssumptionIds: number[];
};
type ObserverAssumptionItem = {
  content: string;
  parentAssumptionIds: number[];
};

export interface ObserverOutput {
  goals: ObserverTextItem[];
  terms: ObserverTextItem[];
  contexts: ObserverTextItem[];
  constraints: ObserverConstraintItem[];
  requirements: ObserverTextItem[];
  criteria: ObserverTextItem[];
  decisions: ObserverDecisionItem[];
  assumptions: ObserverAssumptionItem[];
}

function formatKindList(kinds: readonly KnowledgeKind[]): string {
  const labels = kinds.map((kind) => `**${kind}**`);

  return labels.length < 3 ? labels.join(' and ') : `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`;
}

function buildObserverPhaseBias(phase: Turn['phase']): string {
  const policy = observerPhaseOntologyPolicies[phase];
  const allowedKinds = policy.allowedKinds as readonly KnowledgeKind[];
  const correctionKindList = policy.correctionKinds as readonly KnowledgeKind[];
  const deferredKindList =
    'deferredKinds' in policy ? (policy.deferredKinds as readonly KnowledgeKind[]) : [];
  const focusKinds = new Set<KnowledgeKind>(policy.focusKinds as readonly KnowledgeKind[]);
  const correctionKinds = new Set<KnowledgeKind>(correctionKindList);
  const deferredKinds = new Set<KnowledgeKind>(deferredKindList);
  const supportingKinds = allowedKinds.filter((kind) => !focusKinds.has(kind) && !correctionKinds.has(kind));
  const disallowedKinds = knowledgeKinds.filter(
    (kind) => !allowedKinds.includes(kind) && !deferredKinds.has(kind),
  );

  const lines = [`For ${phase}-mode turns, prioritize ${formatKindList(policy.focusKinds)} items.`];

  if (correctionKindList.length > 0) {
    lines.push(
      `Still allow ${formatKindList(correctionKindList)} corrections when the turn clearly revises grounding understanding.`,
    );
  }

  if (supportingKinds.length > 0) {
    lines.push(
      `Leave ${formatKindList(supportingKinds)} empty unless the turn makes them genuinely explicit.`,
    );
  }

  if (deferredKindList.length > 0) {
    lines.push(
      `In this phase, defer ${formatKindList(deferredKindList)} extraction until a later phase that focuses on those items unless the turn truly cannot be represented without it.`,
    );
  }

  if (disallowedKinds.length > 0) {
    lines.push(`Leave ${formatKindList(disallowedKinds)} empty in this phase.`);
  }

  if (phase === 'requirements' || phase === 'criteria') {
    lines.push(
      `Distinguish criteria from requirements: a **requirement** is ${knowledgeKindSemanticRoles.requirement}, while a **criterion** is ${knowledgeKindSemanticRoles.criterion}.`,
    );
  }

  if (phase === 'grounding') {
    lines.push(
      'When the user selects options, treat those selections as resonance signals — indicators of their direction or thinking — and capture them as context, goals, or constraints rather than as decisive commitments.',
    );
  } else if (phase === 'design') {
    lines.push(
      'When the user selects options, treat those selections as commitment signals and capture them as decisions or assumptions.',
    );
  }

  return lines.join(' ');
}

function buildObserverSystemPrompt(phase: Turn['phase']): string {
  const phaseBias = buildObserverPhaseBias(phase);
  const kindSemantics = knowledgeKindRegistry
    .map((entry, index) => `${index + 1}. **${entry.kind}** — ${knowledgeKindSemanticRoles[entry.kind]}.`)
    .join('\n');
  const schemaShape = JSON.stringify(
    Object.fromEntries(knowledgeKindRegistry.map((entry) => [entry.collectionKey, ['...']])),
  );

  return `You are an observer agent analyzing a spec elicitation interview turn.

Your job is to extract typed knowledge items from the Q&A exchange. Canonical kind semantics:

${kindSemantics}

${phaseBias}

For decisions and assumptions, identify dependency edges to previously extracted entities by their IDs.

Rules:
- Only extract entities that are NEW in this turn — do not re-extract existing entities.
- If no new entities are evident in this turn, return empty arrays.
- Reference parent entity IDs only when a clear dependency exists.
- Return ONLY valid JSON matching this exact schema shape: ${schemaShape}
- Do NOT wrap the JSON in markdown code fences.`;
}

/**
 * Run the observer agent. Extracts entities from the completed turn,
 * persists them to the DB, and returns created entity IDs.
 */
export async function runObserver(
  db: DB,
  turn: Turn,
  specificationId: number,
  workspaceDirectory?: string,
): Promise<{ entityIds: ObserverEntityIds }> {
  const entities = getEntitiesForSpecification(db, specificationId);
  const specification = getSpecification(db, specificationId);
  const context = buildObserverContext({
    turn: {
      ...turn,
      options: getOptionsForTurn(db, turn.id),
    },
    activePathSummary: '',
    specificationMode: specification?.mode,
    workspaceDirectory,
    entities,
  });

  const result = await generateText({
    model: anthropic(process.env.OBSERVER_MODEL || 'claude-haiku-4-5-20251001'),
    maxOutputTokens: 2048,
    system: buildObserverSystemPrompt(turn.phase),
    prompt: context,
    output: Output.object({ schema: observerOutputSchema }),
  });

  const parsed = result.output as ObserverOutput;

  // Persist entities in a transaction-like sequence
  const createdEntityIds = createKnowledgeCollectionRecord(() => [] as number[]);

  for (const item of parsed.goals) {
    const goal = createKnowledgeItem(db, specificationId, 'goal', item.content, {
      rationale: item.rationale,
    });
    linkKnowledgeItemToTurn(db, goal.id, turn.id);
    createdEntityIds.goals.push(goal.id);
  }

  for (const item of parsed.terms) {
    const term = createKnowledgeItem(db, specificationId, 'term', item.content, {
      rationale: item.rationale,
    });
    linkKnowledgeItemToTurn(db, term.id, turn.id);
    createdEntityIds.terms.push(term.id);
  }

  for (const item of parsed.contexts) {
    const context = createKnowledgeItem(db, specificationId, 'context', item.content, {
      rationale: item.rationale,
    });
    linkKnowledgeItemToTurn(db, context.id, turn.id);
    createdEntityIds.contexts.push(context.id);
  }

  for (const item of parsed.constraints) {
    const constraint = createKnowledgeItem(db, specificationId, 'constraint', item.content, {
      subtype: item.subtype,
      rationale: item.rationale,
    });
    linkKnowledgeItemToTurn(db, constraint.id, turn.id);
    createdEntityIds.constraints.push(constraint.id);
  }

  for (const d of parsed.decisions) {
    const decision = createDecision(db, specificationId, d.content, d.rationale);
    linkDecisionToTurn(db, decision.id, turn.id);
    createdEntityIds.decisions.push(decision.id);

    for (const parentId of d.parentDecisionIds) {
      addDecisionParentDecision(db, decision.id, parentId);
    }
    for (const parentId of d.parentAssumptionIds) {
      addDecisionParentAssumption(db, decision.id, parentId);
    }
  }

  for (const a of parsed.assumptions) {
    const assumption = createAssumption(db, specificationId, a.content);
    linkAssumptionToTurn(db, assumption.id, turn.id);
    createdEntityIds.assumptions.push(assumption.id);

    for (const parentId of a.parentAssumptionIds) {
      addAssumptionParentAssumption(db, assumption.id, parentId);
    }
  }

  return {
    entityIds: createdEntityIds,
  };
}
