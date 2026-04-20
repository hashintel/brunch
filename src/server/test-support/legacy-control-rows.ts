import {
  groundingStrategyChoices,
  groundingStrategyKickoffDescription,
  groundingStrategyKickoffQuestion,
} from '@/shared/grounding-strategy.js';

import { advanceHead, createOption, createTurn, getProject, updateTurn, type DB, type Turn } from '../db.js';

export function createLegacyKickoffTurnForTesting(db: DB, projectId: number): Turn | null {
  const project = getProject(db, projectId);
  if (!project) {
    return null;
  }

  const kickoffTurn = createTurn(db, projectId, {
    parent_turn_id: project.active_turn_id ?? null,
    phase: 'grounding',
    turn_kind: 'kickoff',
    question: '',
    answer: null,
    user_parts: null,
    assistant_parts: null,
    why: null,
  });

  updateTurn(db, kickoffTurn.id, {
    question: groundingStrategyKickoffQuestion,
    why: groundingStrategyKickoffDescription,
  });
  for (const choice of groundingStrategyChoices) {
    createOption(db, kickoffTurn.id, {
      position: choice.position,
      content: choice.title,
      is_recommended: choice.isRecommended,
    });
  }

  advanceHead(db, projectId, kickoffTurn.id);
  return kickoffTurn;
}
