import {
  groundingStrategyChoices,
  groundingStrategyKickoffDescription,
  groundingStrategyKickoffQuestion,
} from '@/shared/grounding-strategy.js';

import {
  advanceHead,
  createOption,
  createTurn,
  getSpecification,
  updateTurn,
  type DB,
  type Turn,
} from '../db.js';

export async function createLegacyKickoffTurnForTesting(db: DB, projectId: number): Promise<Turn | null> {
  const project = await getSpecification(db, projectId);
  if (!project) {
    return null;
  }

  const kickoffTurn = await createTurn(db, projectId, {
    parent_turn_id: project.active_turn_id ?? null,
    phase: 'grounding',
    turn_kind: 'kickoff',
    question: '',
    answer: null,
    user_parts: null,
    assistant_parts: null,
    why: null,
  });

  await updateTurn(db, kickoffTurn.id, {
    question: groundingStrategyKickoffQuestion,
    why: groundingStrategyKickoffDescription,
  });
  for (const choice of groundingStrategyChoices) {
    await createOption(db, kickoffTurn.id, {
      position: choice.position,
      content: choice.title,
      is_recommended: choice.isRecommended,
    });
  }

  await advanceHead(db, projectId, kickoffTurn.id);
  return kickoffTurn;
}
