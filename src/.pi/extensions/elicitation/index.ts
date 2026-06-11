/**
 * Elicitation tool registrar — wires read_elicitation_gaps as a Pi tool.
 *
 * The elicitation register is a distinct agent surface from the graph
 * register (read_graph): gaps are a flat obligation table (D65-L/D75-L),
 * not graph nodes/edges. The tool exposes the full ranked agenda — the
 * same canonical ordering the per-turn driver uses to surface the top
 * recommendation — so the agent can see beyond the prompt's top-1.
 *
 * Reads here are narrow: they never advance the global assistant-visible
 * watermark (D76-L) and append no continuity entries.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { sortElicitationGapsForAsking } from '../../../graph/elicitation-driver.js';
import type { ElicitationGap } from '../../../graph/index.js';

export const READ_ELICITATION_GAPS_TOOL = 'read_elicitation_gaps';

/** Observed-shape id this tool owns in the graph observed-shapes ledger. */
export const READ_ELICITATION_GAPS_SHAPE = 'elicitation_gaps';

export interface BrunchElicitationDeps {
  readonly specId: number;
  readonly reads: {
    readonly getElicitationGaps: (specId: number) => readonly ElicitationGap[];
  };
}

const ReadElicitationGapsParams = {
  type: 'object',
  additionalProperties: false,
  properties: {
    include: {
      enum: ['eligible', 'all'],
      description:
        "Which gaps to return: 'eligible' (default) lists only the open/reopened unanswered agenda; 'all' also reports answered and dispositioned gaps",
    },
  },
  description:
    'Read the ranked elicitation agenda for the selected spec: open coverage-obligation questions in canonical asking order.',
} as const;

export function registerBrunchElicitation(pi: ExtensionAPI, deps: BrunchElicitationDeps): void {
  pi.registerTool({
    name: READ_ELICITATION_GAPS_TOOL,
    label: 'Read Elicitation Gaps',
    description:
      'Read the ranked elicitation agenda for the selected spec. ' +
      'Returns open coverage-obligation questions in canonical asking order (band, importance, coverage). ' +
      "Set include to 'all' to also see answered and dispositioned gaps.",
    promptSnippet: 'Read the ranked elicitation agenda (open coverage-obligation questions)',
    promptGuidelines: [
      'Use read_elicitation_gaps to see the full ranked elicitation agenda beyond the single recommended next question.',
    ],
    parameters: ReadElicitationGapsParams,

    async execute(_toolCallId, params: { include?: 'eligible' | 'all' }) {
      const gaps = deps.reads.getElicitationGaps(deps.specId);
      const agenda = sortElicitationGapsForAsking(gaps);
      const includeAll = params.include === 'all';
      const agendaIds = new Set(agenda.map((entry) => entry.id));
      const others = includeAll ? gaps.filter((entry) => !agendaIds.has(entry.id)) : undefined;

      const details = { agenda, ...(others ? { others } : {}) };
      return {
        content: [{ type: 'text' as const, text: formatElicitationAgenda(agenda, others) }],
        details,
      };
    },
  });
}

function formatElicitationAgenda(
  agenda: readonly ElicitationGap[],
  others: readonly ElicitationGap[] | undefined,
): string {
  const lines: string[] = [];
  if (agenda.length === 0) {
    lines.push('[Elicitation agenda] No elicitation gaps are currently open for the selected spec.');
  } else {
    lines.push(`[Elicitation agenda] ${agenda.length} open question(s), ranked:`);
    agenda.forEach((gap, index) => {
      lines.push(
        `${index + 1}. ${oneLine(gap.question)} (refers to: ${gap.refersTo} · band: ${gap.band} · importance: ${gap.importance} · coverage: ${gap.coverage})`,
      );
    });
  }
  if (others && others.length > 0) {
    lines.push('');
    lines.push(`[Not on the agenda] ${others.length} gap(s):`);
    for (const gap of others) {
      const state = gap.answered ? 'answered' : gap.disposition;
      lines.push(`- ${oneLine(gap.question)} (${state})`);
    }
  }
  return lines.join('\n');
}

function oneLine(value: string): string {
  return value.trim().replaceAll(/\s+/g, ' ');
}
