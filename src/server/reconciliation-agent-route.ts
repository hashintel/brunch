// V3.1 slice 4 (memory/CARDS.md): the run-agent endpoint.
//
// Walks every open `reconciliation_need` row in a specification whose
// `agent_status` is null through the classifier. The lifecycle is the
// observable contract (I114): each row transitions
//
//   null → queued → classifying → classified | failed
//
// The route returns the summary { classifiedCount, failedCount } once the
// loop completes; partial progress is durable because each transition is its
// own UPDATE. Re-invoking the endpoint while rows are in flight is safe but
// will skip every row that already left `null` — slice 5 wires the per-row
// Re-run button that resets `agent_status` back to `null`.
//
// V3.1 first cut runs in-process. The N+1-ish loop is bounded by per-spec
// open-need counts (single-digit in practice); if outer-loop walkthroughs
// surface user-visible blocking, promote to a queue substrate without
// changing this contract.

import type { Request, Response } from 'express';

import type { MutationErrorResponse } from '@/shared/api-types.js';

import {
  claimReconciliationNeedForClassification,
  getCascadeRelationBetween,
  getKnowledgeItem,
  getReconciliationNeed,
  getSpecification,
  listOpenReconciliationNeedsAwaitingClassification,
  updateReconciliationNeedAgentFields,
  type DB,
  type ReconciliationNeed,
  type ReconciliationNeedAgentClassification,
  type ReconciliationNeedAgentStatus,
} from './db.js';
import { classifyNeed, defaultRunModel } from './reconciliation-agent.js';

export interface RunReconciliationAgentResponse {
  specId: number;
  ranAt: string;
  classifiedCount: number;
  failedCount: number;
}

export interface ResetReconciliationNeedAgentResponse {
  specId: number;
  needId: number;
  ranAt: string;
  agentStatus: ReconciliationNeedAgentStatus | null;
  agentClassification: ReconciliationNeedAgentClassification | null;
  agentProposal: string | null;
}

async function classifyClaimedNeed(
  db: DB,
  need: ReconciliationNeed,
  runModel: (prompt: string) => Promise<unknown>,
): Promise<'classified' | 'failed'> {
  const sourceItem = getKnowledgeItem(db, need.source_item_id);
  const targetItem = getKnowledgeItem(db, need.target_item_id);

  if (!sourceItem || !targetItem) {
    // Orphan need: items deleted between the listing query and now. Mark
    // failed with a structured note so the user sees what happened on
    // refresh; per I114 the row stays recoverable via per-row Re-run.
    updateReconciliationNeedAgentFields(db, need.id, {
      agent_status: 'failed',
      agent_classification: null,
      agent_proposal: 'Source or target item missing at classification time',
    });
    return 'failed';
  }

  updateReconciliationNeedAgentFields(db, need.id, { agent_status: 'classifying' });

  const result = await classifyNeed(
    {
      need,
      sourceItem,
      targetItem,
      sourcePreviousContent: need.source_previous_content,
      sourceCurrentContent: need.source_current_content,
      relationKind: getCascadeRelationBetween(db, need.source_item_id, need.target_item_id),
    },
    runModel,
  );

  updateReconciliationNeedAgentFields(db, need.id, {
    agent_status: result.status,
    agent_classification: result.classification,
    agent_proposal: result.proposal,
  });

  return result.status;
}

export async function handleRunReconciliationAgent(
  db: DB,
  req: Request,
  res: Response,
  runModel: (prompt: string) => Promise<unknown> = defaultRunModel,
): Promise<void> {
  const specificationId = Number(req.params.id);
  if (Number.isNaN(specificationId)) {
    res.status(400).json({ error: 'Invalid specification ID' } satisfies MutationErrorResponse);
    return;
  }

  const specification = getSpecification(db, specificationId);
  if (!specification) {
    res.status(404).json({ error: 'Specification not found' } satisfies MutationErrorResponse);
    return;
  }

  const ranAt = new Date().toISOString();
  const needs = listOpenReconciliationNeedsAwaitingClassification(db, specificationId);

  let classifiedCount = 0;
  let failedCount = 0;

  for (const need of needs) {
    if (!claimReconciliationNeedForClassification(db, need.id)) continue;

    const outcome = await classifyClaimedNeed(db, need, runModel);
    if (outcome === 'classified') classifiedCount += 1;
    else failedCount += 1;
  }

  res.json({
    specId: specificationId,
    ranAt,
    classifiedCount,
    failedCount,
  } satisfies RunReconciliationAgentResponse);
}

export async function handleResetReconciliationNeedAgent(
  db: DB,
  req: Request,
  res: Response,
  runModel: (prompt: string) => Promise<unknown> = defaultRunModel,
): Promise<void> {
  const specificationId = Number(req.params.id);
  const needId = Number(req.params.needId);
  if (Number.isNaN(specificationId) || Number.isNaN(needId)) {
    res.status(400).json({ error: 'Invalid IDs' } satisfies MutationErrorResponse);
    return;
  }

  const specification = getSpecification(db, specificationId);
  if (!specification) {
    res.status(404).json({ error: 'Specification not found' } satisfies MutationErrorResponse);
    return;
  }

  const need = getReconciliationNeed(db, needId);
  if (!need || need.specification_id !== specificationId) {
    res.status(404).json({ error: 'Reconciliation need not found' } satisfies MutationErrorResponse);
    return;
  }

  if (need.status !== 'open') {
    res.status(409).json({
      error: 'Reconciliation need is not open; reset-agent applies only to open rows.',
    } satisfies MutationErrorResponse);
    return;
  }

  const ranAt = new Date().toISOString();

  updateReconciliationNeedAgentFields(db, need.id, {
    agent_status: null,
    agent_classification: null,
    agent_proposal: null,
  });

  if (!claimReconciliationNeedForClassification(db, need.id)) {
    res.status(409).json({
      error: 'Could not claim this need for classification; it may already be queued elsewhere.',
    } satisfies MutationErrorResponse);
    return;
  }

  const refreshed = getReconciliationNeed(db, need.id);
  if (!refreshed) {
    res.status(404).json({ error: 'Reconciliation need not found' } satisfies MutationErrorResponse);
    return;
  }

  await classifyClaimedNeed(db, refreshed, runModel);

  const after = getReconciliationNeed(db, need.id);
  res.json({
    specId: specificationId,
    needId: need.id,
    ranAt,
    agentStatus: after?.agent_status ?? null,
    agentClassification: after?.agent_classification ?? null,
    agentProposal: after?.agent_proposal ?? null,
  } satisfies ResetReconciliationNeedAgentResponse);
}
