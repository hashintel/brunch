import { table, h3 } from 'md-pen';

import type { SpecificationMode } from '@/shared/api-types.js';
import { knowledgeKindRegistry } from '@/shared/knowledge.js';
import { getPersistedGroundingCard } from '@/shared/specification-state.js';

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
    const groundingCard = getPersistedGroundingCard(turn);
    if (groundingCard) {
      lines.push(`Grounding card: ${groundingCard.summary}`);
      if (groundingCard.detail) {
        lines.push(`  Detail: ${groundingCard.detail}`);
      }
      if (!turn.question?.trim()) {
        const projectedGroundingResponse = projectTurnResponse(turn);
        if (projectedGroundingResponse) {
          lines.push(formatProjectedTurnResponse(projectedGroundingResponse));
        } else if (turn.answer) {
          lines.push(`Grounding response: ${turn.answer}`);
        }
        continue;
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
  projectMode?: SpecificationMode;
  projectCwd?: string | null;
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

/**
 * Build observer context optimized for entity extraction.
 * Provides the current turn's Q&A plus existing entity graph — NOT full
 * conversational history. This makes each extraction incremental:
 * "given what we already know, what did *this turn* add?"
 */
export function buildObserverContext(input: ObserverContextInput): string {
  const sections: string[] = [];

  if (input.projectMode === 'brownfield') {
    const projectContextLines = ['Project mode: brownfield'];
    if (input.projectCwd) {
      projectContextLines.push(`Project directory: ${input.projectCwd}`);
    }
    sections.push(projectContextLines.join('\n'));
  }

  for (const entry of knowledgeKindRegistry) {
    const items = input.entities[entry.collectionKey];
    if (items.length === 0) {
      continue;
    }

    sections.push(
      h3(entry.contextHeading) +
        '\n' +
        table(
          items.map((item) => ({ ID: item.id, Content: item.content })),
          { columns: ['ID', 'Content'] },
        ),
    );
  }

  if (input.activePathSummary) {
    sections.push(`Interview summary:\n${input.activePathSummary}`);
  }

  const turnLines = [`Current turn #${input.turn.id}:`, `  Phase: ${input.turn.phase}`];
  const groundingCard = getPersistedGroundingCard(input.turn);
  if (groundingCard) {
    turnLines.push(`  Grounding card: ${groundingCard.summary}`);
    if (groundingCard.detail) {
      turnLines.push(`  Grounding detail: ${groundingCard.detail}`);
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
