import type { SpecificationMode } from '@/shared/api-types.js';
import type { ReviewSetData } from '@/shared/chat.js';
import { knowledgeKindRegistry } from '@/shared/knowledge.js';
import { getReviewItemIdentity } from '@/shared/review-diffing.js';
import { getTurnPreface, getPersistedReviewSet } from '@/shared/specification-state.js';

import type { TurnWithOptions } from './core.js';
import { formatProjectedTurnResponse, projectTurnResponse } from './turn-response.js';

interface InterviewerContextOptions {
  phase?: TurnWithOptions['phase'];
  entities?: {
    requirements?: Array<{ id: number; content: string }>;
    approvedRequirements?: Array<{ id: number; content: string }>;
    criteria?: Array<{ id: number; content: string }>;
  };
}

function formatApprovedRequirementInventory(
  approvedRequirements: NonNullable<InterviewerContextOptions['entities']>['approvedRequirements'],
): string | null {
  if (!approvedRequirements || approvedRequirements.length === 0) {
    return null;
  }

  return `Approved requirements for criteria review:\n${approvedRequirements
    .map((requirement) => `- [${requirement.id}] ${requirement.content}`)
    .join('\n')}`;
}

function formatRequirementReviewInventory(
  requirements: NonNullable<InterviewerContextOptions['entities']>['requirements'],
): string | null {
  if (!requirements || requirements.length === 0) {
    return null;
  }

  return `Current requirements under review:\n${requirements
    .map((requirement) => `- [${requirement.id}] ${requirement.content}`)
    .join('\n')}`;
}

function formatCriterionReviewInventory(
  criteria: NonNullable<InterviewerContextOptions['entities']>['criteria'],
): string | null {
  if (!criteria || criteria.length === 0) {
    return null;
  }

  return `Current criteria under review:\n${criteria
    .map((criterion) => `- [${criterion.id}] ${criterion.content}`)
    .join('\n')}`;
}

function formatReviewSetInventory(reviewSet: ReviewSetData): string {
  const lines = [`Review set: ${reviewSet.title}`];

  for (const item of reviewSet.items) {
    const identity = getReviewItemIdentity(item);
    lines.push(`  - Item ${identity}`);

    if (item.referenceCode) {
      lines.push(`    Reference code: ${item.referenceCode}`);
    }

    lines.push(`    Content: ${item.content}`);

    if (item.rationale) {
      lines.push(`    Rationale: ${item.rationale}`);
    }

    if (item.grounding?.length) {
      lines.push(`    Grounding refs: ${item.grounding.map((groundingRef) => groundingRef.code).join(', ')}`);
    }

    if (item.isUserCreated) {
      lines.push('    Badge: Added in revision');
    }

    if (item.isRevised) {
      lines.push('    Badge: Revised');
    }
  }

  return lines.join('\n');
}

/**
 * Build interviewer context from active-path turns.
 * Drop-in replacement for formatHistory() — same output, typed interface.
 * Reads from the turn domain model, including persisted structured response parts
 * while there is no dedicated response table yet.
 */
export function buildInterviewerContext(
  turns: TurnWithOptions[],
  currentPrompt: string,
  options: InterviewerContextOptions = {},
): string {
  const sections: string[] = [];
  const lines: string[] = [];
  for (const turn of turns) {
    const preface = getTurnPreface(turn);
    const reviewSet = getPersistedReviewSet(turn);
    if (preface) {
      lines.push(`Preface: ${preface.observation}`);
      if (preface.elaboration) {
        lines.push(`  Elaboration: ${preface.elaboration}`);
      }
    }

    if (turn.question) {
      let questionLine = `Question: ${turn.question}`;
      if (turn.why) questionLine += `\n  Why it matters: ${turn.why}`;
      if (turn.impact) questionLine += `\n  Impact: ${turn.impact}`;
      if (turn.options?.length) {
        const optionList = turn.options
          .map((o, i) => {
            const rec = o.is_recommended ? ' (recommended)' : '';
            const sel = o.is_selected ? ' [selected]' : '';
            return `    ${i + 1}. ${o.content}${rec}${sel}`;
          })
          .join('\n');
        questionLine += `\n  Options:\n${optionList}`;
      }
      lines.push(questionLine);
    }
    if (reviewSet) {
      lines.push(formatReviewSetInventory(reviewSet));
    }
    const projectedResponse = projectTurnResponse(turn);
    if (projectedResponse) {
      lines.push(formatProjectedTurnResponse(projectedResponse));
    } else if (turn.answer) {
      lines.push(`Answer: ${turn.answer}`);
    }
  }
  if (lines.length > 0) {
    sections.push(`Previous conversation:\n${lines.join('\n')}`);
  }

  const requirementInventory =
    options.phase === 'requirements'
      ? formatRequirementReviewInventory(options.entities?.requirements)
      : null;
  if (requirementInventory) {
    sections.push(requirementInventory);
  }

  const approvedRequirementInventory =
    options.phase === 'criteria'
      ? formatApprovedRequirementInventory(options.entities?.approvedRequirements)
      : null;
  if (approvedRequirementInventory) {
    sections.push(approvedRequirementInventory);
  }

  const criterionInventory =
    options.phase === 'criteria' ? formatCriterionReviewInventory(options.entities?.criteria) : null;
  if (criterionInventory) {
    sections.push(criterionInventory);
  }

  if (sections.length === 0) {
    return currentPrompt;
  }

  return `${sections.join('\n\n')}\n\n---\nUser: ${currentPrompt}`;
}

export interface ObserverContextInput {
  turn: TurnWithOptions;
  activePathSummary: string;
  specificationMode?: SpecificationMode;
  workspaceDirectory?: string | null;
  entities: {
    goals: Array<{ id: number; content: string }>;
    terms: Array<{ id: number; content: string }>;
    contexts: Array<{ id: number; content: string }>;
    constraints: Array<{ id: number; content: string }>;
    requirements: Array<{ id: number; content: string }>;
    criteria: Array<{ id: number; content: string }>;
    decisions: Array<{ id: number; content: string }>;
    assumptions: Array<{ id: number; content: string }>;
  };
}

const OBSERVER_ANCHOR_PREVIEW_MAX_LENGTH = 160;

function formatObserverAnchorPreview(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= OBSERVER_ANCHOR_PREVIEW_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, OBSERVER_ANCHOR_PREVIEW_MAX_LENGTH - 1).trimEnd()}…`;
}

function formatExistingKnowledgeAnchors(input: ObserverContextInput['entities']): string | null {
  const lines: string[] = [];

  for (const entry of knowledgeKindRegistry) {
    for (const item of input[entry.collectionKey]) {
      lines.push(`#${item.id} ${entry.kind} | ${formatObserverAnchorPreview(item.content)}`);
    }
  }

  return lines.length > 0 ? `Existing knowledge anchors:\n${lines.join('\n')}` : null;
}

/**
 * Build observer context optimized for entity extraction.
 * Provides the current turn's Q&A plus existing entity graph — NOT full
 * conversational history. This makes each extraction incremental:
 * "given what we already know, what did *this turn* add?"
 */
export function buildObserverContext(input: ObserverContextInput): string {
  const sections: string[] = [];

  if (input.specificationMode === 'brownfield') {
    const specificationContextLines = [
      'This specification is scoped to a feature or change within an existing codebase.',
    ];
    if (input.workspaceDirectory) {
      specificationContextLines.push(`Workspace directory: ${input.workspaceDirectory}`);
    }
    sections.push(specificationContextLines.join('\n'));
  }

  const existingKnowledgeAnchors = formatExistingKnowledgeAnchors(input.entities);
  if (existingKnowledgeAnchors) {
    sections.push(existingKnowledgeAnchors);
  }

  if (input.activePathSummary) {
    sections.push(`Interview summary:\n${input.activePathSummary}`);
  }

  const turnLines = [`Current turn #${input.turn.id}:`, `  Phase: ${input.turn.phase}`];
  const preface = getTurnPreface(input.turn);
  if (preface) {
    turnLines.push(`  Preface: ${preface.observation}`);
    if (preface.elaboration) {
      turnLines.push(`  Preface elaboration: ${preface.elaboration}`);
    }
  }
  if (input.turn.question) turnLines.push(`  Question: ${input.turn.question}`);
  if (input.turn.why) turnLines.push(`  Why: ${input.turn.why}`);
  if (input.turn.impact) turnLines.push(`  Impact: ${input.turn.impact}`);
  const projectedResponse = projectTurnResponse(input.turn);
  if (projectedResponse) {
    turnLines.push(formatProjectedTurnResponse(projectedResponse));
  } else if (input.turn.answer) {
    turnLines.push(`  Answer: ${input.turn.answer}`);
  }
  sections.push(turnLines.join('\n'));

  return sections.join('\n\n');
}
