import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import * as z from 'zod/v4';

import { edgeRelationSchema } from '@/shared/api-types.js';
import { type ObserverEntityIds } from '@/shared/chat.js';
import {
  createKnowledgeCollectionRecord,
  knowledgeKindRegistry,
  knowledgeKinds,
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
  addKnowledgeRelationship,
  getEntitiesForSpecification,
  getKnowledgeItem,
  getOptionsForTurn,
  getSpecification,
  type KnowledgeItem,
  type DB,
  type InterviewTurn,
} from './db.js';
import { supportsKnowledgeRelationship } from './knowledge-relationship-policy.js';
import { buildObserverSystemPrompt } from './observer-prompt.js';

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

const observerExistingRefSchema = z.object({
  source: z.literal('existing'),
  id: z.number().int().positive(),
});

const observerCurrentTurnRefSchema = z.object({
  source: z.literal('current_turn'),
  kind: z.enum(knowledgeKinds),
  index: z.number().int().min(0),
});

const observerRelationshipCandidateSchema = z.object({
  relation: edgeRelationSchema,
  source: z.discriminatedUnion('source', [observerExistingRefSchema, observerCurrentTurnRefSchema]),
  target: z.discriminatedUnion('source', [observerExistingRefSchema, observerCurrentTurnRefSchema]),
});

/** Schema for observer structured output. */
export const observerOutputSchema = z.object({
  ...createKnowledgeCollectionRecord((entry) => z.array(createObserverOutputItemSchema(entry.kind))),
  relationships: z.array(observerRelationshipCandidateSchema).default([]),
});

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
type ObserverRelationshipCandidate = z.infer<typeof observerRelationshipCandidateSchema>;
type ObserverRelationshipRef = ObserverRelationshipCandidate['source'];

export interface ObserverOutput {
  goals: ObserverTextItem[];
  terms: ObserverTextItem[];
  contexts: ObserverTextItem[];
  constraints: ObserverConstraintItem[];
  requirements: ObserverTextItem[];
  criteria: ObserverTextItem[];
  decisions: ObserverDecisionItem[];
  assumptions: ObserverAssumptionItem[];
  relationships?: ObserverRelationshipCandidate[];
}

type CurrentTurnEntityIds = {
  [K in KnowledgeKind]: number[];
};

function buildCurrentTurnEntityIds(createdEntityIds: ObserverEntityIds): CurrentTurnEntityIds {
  return Object.fromEntries(
    knowledgeKindRegistry.map((entry) => [entry.kind, createdEntityIds[entry.collectionKey]]),
  ) as CurrentTurnEntityIds;
}

function resolveObserverRelationshipRef({
  db,
  specificationId,
  currentTurnEntityIds,
  ref,
}: {
  db: DB;
  specificationId: number;
  currentTurnEntityIds: CurrentTurnEntityIds;
  ref: ObserverRelationshipRef;
}): KnowledgeItem | null {
  if (ref.source === 'current_turn') {
    const id = currentTurnEntityIds[ref.kind][ref.index];
    return id ? (getKnowledgeItem(db, id) ?? null) : null;
  }

  const item = getKnowledgeItem(db, ref.id);
  return item?.specification_id === specificationId ? item : null;
}

function persistObserverRelationships({
  db,
  specificationId,
  createdEntityIds,
  candidates,
}: {
  db: DB;
  specificationId: number;
  createdEntityIds: ObserverEntityIds;
  candidates: readonly ObserverRelationshipCandidate[];
}): void {
  const currentTurnEntityIds = buildCurrentTurnEntityIds(createdEntityIds);

  for (const candidate of candidates) {
    const source = resolveObserverRelationshipRef({
      db,
      specificationId,
      currentTurnEntityIds,
      ref: candidate.source,
    });
    const target = resolveObserverRelationshipRef({
      db,
      specificationId,
      currentTurnEntityIds,
      ref: candidate.target,
    });

    if (
      !source ||
      !target ||
      source.id === target.id ||
      !supportsKnowledgeRelationship(candidate.relation, source.kind, target.kind)
    ) {
      continue;
    }

    addKnowledgeRelationship(db, source.id, target.id, candidate.relation);
  }
}

/**
 * Run the observer agent. Extracts entities from the completed turn,
 * persists them to the DB, and returns created entity IDs.
 */
export async function runObserver(
  db: DB,
  turn: InterviewTurn,
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

  persistObserverRelationships({
    db,
    specificationId,
    createdEntityIds,
    candidates: parsed.relationships ?? [],
  });

  return {
    entityIds: createdEntityIds,
  };
}
