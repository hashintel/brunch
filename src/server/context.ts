import type { TurnWithOptions } from './core.js';
import type { Turn } from './db.js';

/**
 * Build interviewer context from active-path turns.
 * Drop-in replacement for formatHistory() — same output, typed interface.
 * Reads from domain model (turn scalars + options), NOT from persisted parts.
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
    if (turn.answer) lines.push(`Answer: ${turn.answer}`);
  }
  if (lines.length === 0) return currentPrompt;
  return `Previous conversation:\n${lines.join('\n')}\n\n---\nUser: ${currentPrompt}`;
}

export interface ObserverContextInput {
  turn: Turn;
  activePathSummary: string;
  entities: {
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

  if (input.entities.decisions.length > 0 || input.entities.assumptions.length > 0) {
    const entityLines: string[] = ['Existing entities:'];
    for (const d of input.entities.decisions) {
      entityLines.push(`  Decision #${d.id}: ${d.content}`);
    }
    for (const a of input.entities.assumptions) {
      entityLines.push(`  Assumption #${a.id}: ${a.content}`);
    }
    sections.push(entityLines.join('\n'));
  }

  if (input.activePathSummary) {
    sections.push(`Interview summary:\n${input.activePathSummary}`);
  }

  const turnLines = [`Current turn #${input.turn.id}:`];
  if (input.turn.question) turnLines.push(`  Question: ${input.turn.question}`);
  if (input.turn.why) turnLines.push(`  Why: ${input.turn.why}`);
  if (input.turn.impact) turnLines.push(`  Impact: ${input.turn.impact}`);
  if (input.turn.answer) turnLines.push(`  Answer: ${input.turn.answer}`);
  sections.push(turnLines.join('\n'));

  return sections.join('\n\n');
}
