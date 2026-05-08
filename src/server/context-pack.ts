import type { SpecificationMode } from '@/shared/api-types.js';
import { knowledgeKindRegistry, type KnowledgeKind } from '@/shared/knowledge.js';
import { getTurnPreface } from '@/shared/specification-state.js';

import type { TurnWithOptions } from './core.js';
import { formatProjectedTurnResponse, projectTurnResponse } from './turn-response.js';

export type ContextPackScenarioId = 'observer-capture';

export interface ContextPack<TScenario extends ContextPackScenarioId, TData> {
  scenario: TScenario;
  data: TData;
}

export interface ObserverKnowledgeAnchor {
  id: number;
  kind: KnowledgeKind;
  content: string;
  preview: string;
}

export interface ObserverCurrentTurnEvidence {
  id: number;
  phase: TurnWithOptions['phase'];
  preface?: {
    observation: string;
    elaboration?: string;
  };
  question?: string;
  why?: string;
  impact?: TurnWithOptions['impact'];
  response?: string;
}

export interface ObserverCaptureContextPackData {
  specification?: {
    mode?: SpecificationMode;
    workspaceDirectory?: string | null;
  };
  existingKnowledgeAnchors: ObserverKnowledgeAnchor[];
  activePathSummary?: string;
  currentTurn: ObserverCurrentTurnEvidence;
}

export type ObserverCaptureContextPack = ContextPack<'observer-capture', ObserverCaptureContextPackData>;

export interface ObserverContextPackInput {
  turn: TurnWithOptions;
  activePathSummary: string;
  specificationMode?: SpecificationMode;
  workspaceDirectory?: string | null;
  entities: Record<
    (typeof knowledgeKindRegistry)[number]['collectionKey'],
    Array<{ id: number; content: string }>
  >;
}

const OBSERVER_ANCHOR_PREVIEW_MAX_LENGTH = 160;

function formatObserverAnchorPreview(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= OBSERVER_ANCHOR_PREVIEW_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, OBSERVER_ANCHOR_PREVIEW_MAX_LENGTH - 1).trimEnd()}…`;
}

export function buildObserverCaptureContextPack(input: ObserverContextPackInput): ObserverCaptureContextPack {
  const preface = getTurnPreface(input.turn);
  const projectedResponse = projectTurnResponse(input.turn);
  const existingKnowledgeAnchors: ObserverKnowledgeAnchor[] = [];

  for (const entry of knowledgeKindRegistry) {
    for (const item of input.entities[entry.collectionKey]) {
      existingKnowledgeAnchors.push({
        id: item.id,
        kind: entry.kind,
        content: item.content,
        preview: formatObserverAnchorPreview(item.content),
      });
    }
  }

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

function formatExistingKnowledgeAnchors(anchors: readonly ObserverKnowledgeAnchor[]): string | null {
  const lines = anchors.map((item) => `#${item.id} ${item.kind} | ${item.preview}`);
  return lines.length > 0 ? `Existing knowledge anchors:\n${lines.join('\n')}` : null;
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
