import { table, h3 } from 'md-pen';

import type { TurnWithOptions } from './core.js';
import type { Turn } from './db.js';
import { safeDeserializeUserParts, type UserPart } from './parts.js';

/**
 * Build interviewer context from active-path turns.
 * Drop-in replacement for formatHistory() — same output, typed interface.
 * Reads from the turn domain model, including persisted structured response parts
 * while there is no dedicated response table yet.
 */
export function buildInterviewerContext(turns: TurnWithOptions[], currentPrompt: string): string {
  if (turns.length === 0) return currentPrompt;
  const lines: string[] = [];
  for (const turn of turns) {
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
    const selectedOptions =
      turn.options?.filter((option) => option.is_selected).map((option) => option.content) ?? [];
    const freeText = safeDeserializeUserParts(turn.user_parts).find(
      (part): part is Extract<UserPart, { type: 'data-turn-response' }> => part.type === 'data-turn-response',
    )?.data.freeText;
    if (selectedOptions.length > 0 || freeText) {
      const responseLines = ['Turn response:'];
      if (selectedOptions.length > 0) {
        responseLines.push(`  Chosen options: ${selectedOptions.join(', ')}`);
      }
      if (freeText) {
        responseLines.push(`  Free-text response: ${freeText}`);
      }
      lines.push(responseLines.join('\n'));
    } else if (turn.answer) {
      lines.push(`Answer: ${turn.answer}`);
    }
  }
  if (lines.length === 0) return currentPrompt;
  return `Previous conversation:\n${lines.join('\n')}\n\n---\nUser: ${currentPrompt}`;
}

export interface ObserverContextInput {
  turn: Turn;
  activePathSummary: string;
  entities: {
    framing: Array<{ id: number; content: string }>;
    constraints: Array<{ id: number; content: string }>;
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

  if (
    input.entities.framing.length > 0 ||
    input.entities.constraints.length > 0 ||
    input.entities.decisions.length > 0 ||
    input.entities.assumptions.length > 0
  ) {
    if (input.entities.framing.length > 0) {
      sections.push(
        h3('Existing Framing') +
          '\n' +
          table(
            input.entities.framing.map((item) => ({ ID: item.id, Content: item.content })),
            { columns: ['ID', 'Content'] },
          ),
      );
    }
    if (input.entities.constraints.length > 0) {
      sections.push(
        h3('Existing Constraints') +
          '\n' +
          table(
            input.entities.constraints.map((item) => ({ ID: item.id, Content: item.content })),
            { columns: ['ID', 'Content'] },
          ),
      );
    }
    if (input.entities.decisions.length > 0) {
      sections.push(
        h3('Existing Decisions') +
          '\n' +
          table(
            input.entities.decisions.map((d) => ({ ID: d.id, Content: d.content })),
            { columns: ['ID', 'Content'] },
          ),
      );
    }
    if (input.entities.assumptions.length > 0) {
      sections.push(
        h3('Existing Assumptions') +
          '\n' +
          table(
            input.entities.assumptions.map((a) => ({ ID: a.id, Content: a.content })),
            { columns: ['ID', 'Content'] },
          ),
      );
    }
  }

  if (input.activePathSummary) {
    sections.push(`Interview summary:\n${input.activePathSummary}`);
  }

  const turnLines = [`Current turn #${input.turn.id}:`, `  Phase: ${input.turn.phase}`];
  if (input.turn.question) turnLines.push(`  Question: ${input.turn.question}`);
  if (input.turn.why) turnLines.push(`  Why: ${input.turn.why}`);
  if (input.turn.impact) turnLines.push(`  Impact: ${input.turn.impact}`);
  if (input.turn.answer) turnLines.push(`  Answer: ${input.turn.answer}`);
  sections.push(turnLines.join('\n'));

  return sections.join('\n\n');
}
