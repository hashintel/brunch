import { getTurnPreface } from '@/shared/specification-state.js';

import type { ObserverCaptureContextPack, ObserverContextPackInput } from '../context-pack.js';
import { formatProjectedTurnResponse, projectTurnResponse } from '../turn-response.js';
import { buildIntentAnchors, formatExistingKnowledgeAnchors } from './anchors.js';

export function buildObserverCaptureContextPack(input: ObserverContextPackInput): ObserverCaptureContextPack {
  const preface = getTurnPreface(input.turn);
  const projectedResponse = projectTurnResponse(input.turn);
  const existingKnowledgeAnchors = buildIntentAnchors(input.entities);

  return {
    scenario: 'observer-capture',
    data: {
      specification: {
        mode: input.specificationMode,
        workspaceDirectory: input.workspaceDirectory,
      },
      existingKnowledgeAnchors,
      activePathSummary: input.activePathSummary || undefined,
      currentTurn: {
        id: input.turn.id,
        phase: input.turn.phase,
        preface: preface
          ? {
              observation: preface.observation,
              elaboration: preface.elaboration || undefined,
            }
          : undefined,
        question: input.turn.question || undefined,
        why: input.turn.why || undefined,
        impact: input.turn.impact || undefined,
        response: projectedResponse
          ? formatProjectedTurnResponse(projectedResponse)
          : input.turn.answer
            ? `  Answer: ${input.turn.answer}`
            : undefined,
      },
    },
  };
}

export function renderObserverCaptureContextPack(pack: ObserverCaptureContextPack): string {
  const sections: string[] = [];

  if (pack.data.specification?.mode === 'brownfield') {
    const specificationContextLines = [
      'This specification is scoped to a feature or change within an existing codebase.',
    ];
    if (pack.data.specification.workspaceDirectory) {
      specificationContextLines.push(`Workspace directory: ${pack.data.specification.workspaceDirectory}`);
    }
    sections.push(specificationContextLines.join('\n'));
  }

  const existingKnowledgeAnchors = formatExistingKnowledgeAnchors(pack.data.existingKnowledgeAnchors);
  if (existingKnowledgeAnchors) {
    sections.push(existingKnowledgeAnchors);
  }

  if (pack.data.activePathSummary) {
    sections.push(`Interview summary:\n${pack.data.activePathSummary}`);
  }

  const turn = pack.data.currentTurn;
  const turnLines = [`Current turn #${turn.id}:`, `  Phase: ${turn.phase}`];
  if (turn.preface) {
    turnLines.push(`  Preface: ${turn.preface.observation}`);
    if (turn.preface.elaboration) {
      turnLines.push(`  Preface elaboration: ${turn.preface.elaboration}`);
    }
  }
  if (turn.question) turnLines.push(`  Question: ${turn.question}`);
  if (turn.why) turnLines.push(`  Why: ${turn.why}`);
  if (turn.impact) turnLines.push(`  Impact: ${turn.impact}`);
  if (turn.response) turnLines.push(turn.response);
  sections.push(turnLines.join('\n'));

  return sections.join('\n\n');
}
