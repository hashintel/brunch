import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { and, eq } from 'drizzle-orm';

import {
  advanceHead,
  confirmPhaseOutcome,
  createKnowledgeItem,
  createOption,
  createPhaseOutcome,
  createProject,
  createTurn,
  linkKnowledgeItemToTurn,
  applyTurnResponseSelections,
  type DB,
} from '../db.js';
import * as schema from '../schema.js';
import type { ScenarioFn } from './scenarios.js';

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

export interface ManifestOption {
  content: string;
  is_recommended: boolean;
}

export interface ManifestTurn {
  phase: 'scope' | 'design' | 'requirements' | 'criteria';
  question: string;
  answer: string;
  why?: string | null;
  impact?: 'high' | 'medium' | 'low' | null;
  options?: ManifestOption[];
  selectedOptionPositions?: number[];
  freeText?: string | null;
  isProposal?: boolean;
  isConfirmation?: boolean;
}

export interface ManifestKnowledgeItem {
  kind: 'goal' | 'term' | 'context' | 'constraint' | 'decision' | 'assumption' | 'requirement' | 'criterion';
  content: string;
  rationale?: string | null;
  capturedAtTurn: number;
  reviewAction?: 'reviewed' | 'rejected';
  reviewedAtTurn?: number;
}

export interface ManifestEdge {
  fromItemIndex: number;
  toItemIndex: number;
  relation: 'depends_on' | 'derived_from' | 'constrains' | 'verifies' | 'refines';
}

export interface ManifestScenario {
  turns: ManifestTurn[];
  knowledgeItems: ManifestKnowledgeItem[];
  edges: ManifestEdge[];
}

export interface Manifest {
  name: string;
  description: string;
  scenarios: Record<string, ManifestScenario>;
}

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------

export function seedFromManifest(db: DB, scenario: ManifestScenario, projectName: string): number {
  const project = createProject(db, projectName);
  const projectId = project.id;

  // Track manifest turn index → actual turn ID
  const turnIdMap = new Map<number, number>();
  let prevTurnId: number | null = null;

  for (let i = 0; i < scenario.turns.length; i++) {
    const mt = scenario.turns[i]!;

    if (mt.isConfirmation) {
      // Find the most recent proposal turn in the same phase
      let proposalTurnId: number | null = null;
      for (let j = i - 1; j >= 0; j--) {
        if (scenario.turns[j]!.isProposal && scenario.turns[j]!.phase === mt.phase) {
          proposalTurnId = turnIdMap.get(j) ?? null;
          break;
        }
      }

      const userParts = JSON.stringify([
        { type: 'text', text: `Confirm ${mt.phase} closure` },
        {
          type: 'data-confirmation',
          data: {
            kind: 'confirm-proposed-phase-closure',
            proposalTurnId,
            phase: mt.phase,
          },
        },
      ]);

      const turn = createTurn(db, projectId, {
        phase: mt.phase,
        parent_turn_id: prevTurnId,
        question: '',
        answer: `Confirm ${mt.phase} closure`,
        user_parts: userParts,
      });
      turnIdMap.set(i, turn.id);

      // Find the phase outcome created by the proposal turn and confirm it
      const outcome =
        proposalTurnId != null
          ? (db
              .select()
              .from(schema.phaseOutcome)
              .where(
                and(
                  eq(schema.phaseOutcome.project_id, projectId),
                  eq(schema.phaseOutcome.proposal_turn_id, proposalTurnId),
                  eq(schema.phaseOutcome.status, 'proposed'),
                ),
              )
              .get() as { id: number } | undefined)
          : undefined;
      if (outcome) {
        confirmPhaseOutcome(db, outcome.id, turn.id);
      }

      advanceHead(db, projectId, turn.id);
      prevTurnId = turn.id;
      continue;
    }

    if (mt.isProposal) {
      const assistantParts = JSON.stringify([
        { type: 'text', text: '' },
        {
          type: 'tool-propose_phase_closure',
          toolCallId: `tc_proposal_${i}`,
          state: 'output-available',
          input: { phase: mt.phase, summary: mt.answer },
          output: { ok: true, turnId: -1, phase: mt.phase }, // placeholder, updated below
        },
      ]);

      const turn = createTurn(db, projectId, {
        phase: mt.phase,
        parent_turn_id: prevTurnId,
        question: '',
        answer: mt.answer,
        assistant_parts: assistantParts,
      });
      turnIdMap.set(i, turn.id);

      createPhaseOutcome(db, {
        projectId,
        phase: mt.phase,
        proposal_turn_id: turn.id,
        summary: mt.answer,
      });

      advanceHead(db, projectId, turn.id);
      prevTurnId = turn.id;
      continue;
    }

    // Regular turn
    const options = mt.options ?? [];
    const assistantParts = JSON.stringify([
      { type: 'text', text: '' },
      {
        type: 'tool-ask_question',
        toolCallId: `tc_${i}`,
        state: 'output-available',
        input: {
          question: mt.question,
          why: mt.why ?? null,
          impact: mt.impact ?? null,
          options,
        },
        output: { ok: true, turnId: -1, optionCount: options.length },
      },
    ]);

    // We need the turn ID for user_parts, so create first then update user_parts
    const turn = createTurn(db, projectId, {
      phase: mt.phase,
      parent_turn_id: prevTurnId,
      question: mt.question,
      why: mt.why ?? null,
      impact: mt.impact ?? null,
      answer: mt.answer,
      assistant_parts: assistantParts,
    });
    turnIdMap.set(i, turn.id);

    // Create options in DB and retain their row IDs for user_parts rehydration.
    const optionIdsByPosition = new Map<number, number>();
    for (let p = 0; p < options.length; p++) {
      const opt = options[p]!;
      const createdOption = createOption(db, turn.id, {
        position: p,
        content: opt.content,
        is_recommended: opt.is_recommended,
      });
      optionIdsByPosition.set(p, createdOption.id);
    }

    // Apply selections
    if (mt.selectedOptionPositions && mt.selectedOptionPositions.length > 0) {
      applyTurnResponseSelections(db, turn.id, mt.selectedOptionPositions);
    }

    // Set user_parts (needs actual turn.id, so done after creation)
    const selectedIds = (mt.selectedOptionPositions ?? [])
      .map((position) => optionIdsByPosition.get(position))
      .filter((optionId): optionId is number => optionId != null);
    const userParts = JSON.stringify([
      { type: 'text', text: mt.answer },
      {
        type: 'data-turn-response',
        data: {
          turnId: turn.id,
          selectedOptionIds: selectedIds,
          freeText: mt.freeText ?? undefined,
        },
      },
    ]);
    db.update(schema.turn).set({ user_parts: userParts }).where(eq(schema.turn.id, turn.id)).run();

    advanceHead(db, projectId, turn.id);
    prevTurnId = turn.id;
  }

  // --- Knowledge items ---
  const itemIdMap = new Map<number, number>();

  for (let k = 0; k < scenario.knowledgeItems.length; k++) {
    const mi = scenario.knowledgeItems[k]!;
    const item = createKnowledgeItem(db, projectId, mi.kind, mi.content, {
      rationale: mi.rationale ?? null,
    });
    itemIdMap.set(k, item.id);

    // Link to capturing turn
    const captureTurnId = turnIdMap.get(mi.capturedAtTurn);
    if (captureTurnId != null) {
      linkKnowledgeItemToTurn(db, item.id, captureTurnId, 'captured');
    }

    // Link review action
    if (mi.reviewAction && mi.reviewedAtTurn != null) {
      const reviewTurnId = turnIdMap.get(mi.reviewedAtTurn);
      if (reviewTurnId != null) {
        linkKnowledgeItemToTurn(db, item.id, reviewTurnId, mi.reviewAction);
      }
    }
  }

  // --- Edges ---
  for (const edge of scenario.edges) {
    const fromId = itemIdMap.get(edge.fromItemIndex);
    const toId = itemIdMap.get(edge.toItemIndex);
    if (fromId != null && toId != null) {
      db.insert(schema.knowledgeEdge)
        .values({ from_item_id: fromId, to_item_id: toId, relation: edge.relation })
        .run();
    }
  }

  return projectId;
}

// ---------------------------------------------------------------------------
// Manifest loader
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadManifestScenarios(manifestName: string): Record<string, ScenarioFn> {
  const filePath = join(__dirname, 'manifests', `${manifestName}.json`);
  const raw = readFileSync(filePath, 'utf-8');
  const manifest: Manifest = JSON.parse(raw);

  const result: Record<string, ScenarioFn> = {};

  for (const scenarioKey of Object.keys(manifest.scenarios)) {
    const scenario = manifest.scenarios[scenarioKey]!;
    const fullKey = `${manifestName}-${scenarioKey}`;
    const defaultName = `${manifest.name} (${scenarioKey})`;

    result[fullKey] = (db: DB, projectName?: string) => {
      return seedFromManifest(db, scenario, projectName ?? defaultName);
    };
  }

  return result;
}
