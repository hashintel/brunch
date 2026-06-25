/**
 * Elicitation tool registrar — wires read_elicitation_gaps and
 * update_elicitation_gaps as Pi tools.
 *
 * The elicitation register is a distinct agent surface from the graph
 * register (read_graph / mutate_graph): gaps are a flat obligation table
 * (D65-L/D75-L), not graph nodes/edges. Reads expose the full ranked agenda
 * — the same canonical ordering the per-turn driver uses to surface the top
 * recommendation. Writes go through the existing CommandExecutor gap methods
 * on the one {specId, lsn} clock; the tool takes one write per call so each
 * call is atomic (no partial writes by construction).
 *
 * Reads here are narrow: they never advance the global assistant-visible
 * watermark (D76-L) and append no continuity entries. Reflection *behavior*
 * (when the live agent should spawn/close gaps) is deliberately not prompted
 * here — it belongs to the generalized-capture frontier.
 */

import type { Static } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { sortElicitationGapsForAsking } from '../../../../graph/elicitation-driver.js';
import type {
  CommandExecutor,
  Diagnostic,
  ElicitationGap,
  StructuralIllegal,
} from '../../../../graph/index.js';
import { GAP_DISPOSITIONS, NODE_KINDS, READINESS_BANDS } from '../../../../graph/index.js';

export const READ_ELICITATION_GAPS_TOOL = 'read_elicitation_gaps';
export const UPDATE_ELICITATION_GAPS_TOOL = 'update_elicitation_gaps';

/** Observed-shape id this tool owns in the graph observed-shapes ledger. */
export const READ_ELICITATION_GAPS_SHAPE = 'elicitation_gaps';

export interface BrunchElicitationDeps {
  readonly specId: number;
  readonly commandExecutor: CommandExecutor;
  readonly reads: {
    readonly getElicitationGaps: (specId: number) => readonly ElicitationGap[];
    readonly resolveNodeCode: (code: string) => number | undefined;
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

const UpdateElicitationGapsParams = {
  type: 'object',
  additionalProperties: false,
  required: ['action'],
  properties: {
    action: {
      enum: ['spawn', 'set_disposition'],
      description: "One write per call: 'spawn' creates a new gap; 'set_disposition' updates an existing one",
    },
    refersTo: {
      enum: [...NODE_KINDS],
      description: 'spawn: node kind the new gap obligates (its question elicits material of this kind)',
    },
    question: { type: 'string', description: 'spawn: the question that would close the gap' },
    rationale: { type: 'string', description: 'spawn: why this gap exists / what revealed it' },
    band: {
      enum: [...READINESS_BANDS],
      description: 'spawn: readiness band the obligation belongs to',
    },
    importance: { type: 'number', description: 'spawn: ranking weight (higher asks sooner)' },
    manualRubric: {
      type: 'string',
      description:
        'spawn: provide to create a manually-judged gap with this rubric instead of the default structural presence predicate',
    },
    aroseFromGapId: {
      type: 'string',
      description: 'spawn: id of the gap whose answer revealed this one',
    },
    gapId: { type: 'string', description: 'set_disposition: id of the gap to update' },
    disposition: {
      enum: [...GAP_DISPOSITIONS],
      description: 'set_disposition: new disposition state',
    },
    resolvedByNodeCode: {
      type: 'string',
      description: 'set_disposition: projected code (e.g. G1) of the node that resolved the gap',
    },
  },
  description:
    'Update the elicitation register for the selected spec: spawn a newly-revealed gap or set the disposition of an existing one. One write per call; each call is atomic.',
} as const;

/**
 * Tool wire type — inferred from the schema (the registration-time source
 * of truth), never declared in parallel. The schema enums themselves derive
 * from the canonical kind/band/disposition const arrays.
 */
type UpdateElicitationGapsParamValues = Static<typeof UpdateElicitationGapsParams>;

type SpawnResult = ReturnType<CommandExecutor['createElicitationGap']>;
type DispositionResult = ReturnType<CommandExecutor['setElicitationGapDisposition']>;

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

  pi.registerTool({
    name: UPDATE_ELICITATION_GAPS_TOOL,
    label: 'Update Elicitation Gaps',
    description:
      'Update the elicitation register for the selected spec through the Brunch command layer. ' +
      "action 'spawn' creates a newly-revealed gap; action 'set_disposition' marks an existing gap " +
      '(answered, not_applicable, irrelevant, reopened, or open). One write per call.',
    promptSnippet: 'Spawn an elicitation gap or set the disposition of an existing one',
    promptGuidelines: [
      'update_elicitation_gaps performs one register write per call; on STRUCTURAL_ILLEGAL read the diagnostics, fix the input, and retry.',
    ],
    parameters: UpdateElicitationGapsParams,

    async execute(_toolCallId, params) {
      const result: SpawnResult | DispositionResult =
        params.action === 'spawn' ? executeSpawn(deps, params) : executeSetDisposition(deps, params);

      const text =
        result.status === 'success'
          ? `${params.action === 'spawn' ? 'Spawned gap' : 'Updated gap disposition'} (lsn ${result.lsn}).`
          : `STRUCTURAL_ILLEGAL\n${result.diagnostics.map((d) => `- ${d.field}: ${d.message}`).join('\n')}`;

      return { content: [{ type: 'text' as const, text }], details: result };
    },
  });
}

function structuralIllegal(diagnostics: readonly Diagnostic[]): StructuralIllegal {
  return { status: 'structural_illegal', diagnostics };
}

function executeSpawn(deps: BrunchElicitationDeps, params: UpdateElicitationGapsParamValues): SpawnResult {
  const missing = (['refersTo', 'question', 'rationale', 'band'] as const).filter(
    (field) => params[field] == null || params[field] === '',
  );
  if (missing.length > 0) {
    return structuralIllegal(missing.map((field) => ({ field, message: `${field} is required for spawn` })));
  }

  const aroseFromGapId = params.aroseFromGapId === undefined ? undefined : Number(params.aroseFromGapId);
  if (aroseFromGapId !== undefined && !Number.isInteger(aroseFromGapId)) {
    return structuralIllegal([
      { field: 'aroseFromGapId', message: `not a gap id: ${params.aroseFromGapId}` },
    ]);
  }

  return deps.commandExecutor.createElicitationGap({
    specId: deps.specId,
    refersTo: params.refersTo!,
    question: params.question!,
    rationale: params.rationale!,
    band: params.band!,
    predicate: params.manualRubric
      ? { kind: 'manual', rubric: params.manualRubric }
      : { kind: 'presence', nodeKind: params.refersTo!, minimum: 1 },
    importance: params.importance,
    aroseFromGapId,
  });
}

function executeSetDisposition(
  deps: BrunchElicitationDeps,
  params: UpdateElicitationGapsParamValues,
): DispositionResult {
  if (params.gapId == null || params.disposition == null) {
    return structuralIllegal([
      ...(params.gapId == null ? [{ field: 'gapId', message: 'gapId is required for set_disposition' }] : []),
      ...(params.disposition == null
        ? [{ field: 'disposition', message: 'disposition is required for set_disposition' }]
        : []),
    ]);
  }
  const id = Number(params.gapId);
  if (!Number.isInteger(id)) {
    return structuralIllegal([{ field: 'gapId', message: `not a gap id: ${params.gapId}` }]);
  }

  let resolvedByNodeId: number | undefined;
  if (params.resolvedByNodeCode !== undefined) {
    resolvedByNodeId = deps.reads.resolveNodeCode(params.resolvedByNodeCode);
    if (resolvedByNodeId === undefined) {
      return structuralIllegal([
        {
          field: 'resolvedByNodeCode',
          message: `unknown node code in the selected spec: ${params.resolvedByNodeCode}`,
        },
      ]);
    }
  }

  return deps.commandExecutor.setElicitationGapDisposition({
    specId: deps.specId,
    id,
    disposition: params.disposition,
    resolvedByNodeId,
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
