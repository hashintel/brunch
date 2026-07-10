/**
 * Reconciliation-need tool registrar — wires read_reconciliation_needs and
 * update_reconciliation_needs as Pi tools.
 *
 * Reconciliation needs are the retrospective sibling of elicitation gaps: a
 * contradiction or impasse over existing graph truth, not a prospective coverage
 * obligation. Writes route through CommandExecutor so they share the selected
 * spec's {specId, lsn} / change_log clock.
 */

import type { Static } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

import {
  formatReconciliationNeeds,
  formatReconciliationUpdateResult,
} from '../../../../agents/contexts/data-model/graph/reconciliation-needs.js';
import type {
  CommandExecutor,
  CreateReconNeedResult,
  Diagnostic,
  ReconciliationNeed,
  ResolveReconNeedResult,
  StructuralIllegal,
} from '../../../../graph/index.js';
import { defineBrunchTool } from '../../shared/define-brunch-tool.js';
import { toolParameters } from '../../shared/tool-schema.js';

export const READ_RECONCILIATION_NEEDS_TOOL = 'read_reconciliation_needs';
export const UPDATE_RECONCILIATION_NEEDS_TOOL = 'update_reconciliation_needs';

const RECONCILIATION_NEED_KINDS = [
  'edge_revalidation',
  'possible_relation',
  'possible_duplicate',
  'semantic_conflict',
] as const;

export interface BrunchReconciliationDeps {
  readonly specId: number;
  readonly commandExecutor: CommandExecutor;
  readonly reads: {
    readonly getOpenReconciliationNeeds: (specId: number) => readonly ReconciliationNeed[];
  };
}

const ReadReconciliationNeedsParamsSchema = Type.Object(
  {},
  {
    additionalProperties: false,
    description: 'Read the open reconciliation-need agenda for the selected spec.',
  },
);
const ReadReconciliationNeedsParams = toolParameters(
  ReadReconciliationNeedsParamsSchema,
) as typeof ReadReconciliationNeedsParamsSchema;

const UpdateReconciliationNeedsParamsSchema = Type.Object(
  {
    action: Type.Unsafe<'create' | 'resolve'>({
      enum: ['create', 'resolve'],
      description: "One write per call: 'create' records a new impasse; 'resolve' closes one.",
    }),
    needKind: Type.Optional(
      Type.Unsafe<(typeof RECONCILIATION_NEED_KINDS)[number]>({
        enum: [...RECONCILIATION_NEED_KINDS],
        description: 'create: kind of reconciliation need to record.',
      }),
    ),
    target: Type.Optional(
      Type.Unsafe<{ kind: 'edge'; edgeId: number } | { kind: 'node_pair'; aId: number; bId: number }>({
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'edgeId'],
            properties: { kind: { const: 'edge' }, edgeId: { type: 'number' } },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'aId', 'bId'],
            properties: { kind: { const: 'node_pair' }, aId: { type: 'number' }, bId: { type: 'number' } },
          },
        ],
        description: 'create: existing edge or pair of existing nodes this impasse is about.',
      }),
    ),
    reason: Type.Optional(
      Type.String({
        description: 'create: brief reason for the impasse. Do not encode replacement graph truth here.',
      }),
    ),
    needId: Type.Optional(Type.String({ description: 'resolve: id of the reconciliation need to close.' })),
  },
  {
    additionalProperties: false,
    description:
      'Update the reconciliation register for the selected spec: create or resolve one impasse per call.',
  },
);
const UpdateReconciliationNeedsParams = toolParameters(
  UpdateReconciliationNeedsParamsSchema,
) as typeof UpdateReconciliationNeedsParamsSchema;

type UpdateReconciliationNeedsParamValues = Static<typeof UpdateReconciliationNeedsParamsSchema>;

type UpdateResult = CreateReconNeedResult | ResolveReconNeedResult;

export function registerBrunchReconciliation(pi: ExtensionAPI, deps: BrunchReconciliationDeps): void {
  pi.registerTool(
    defineBrunchTool({
      name: READ_RECONCILIATION_NEEDS_TOOL,
      label: 'Read Reconciliation Needs',
      description:
        'Read open reconciliation needs for the selected spec: contradictions, possible duplicates, edge revalidation, and other retrospective impasses.',
      promptSnippet: 'Read the open reconciliation-need agenda',
      promptGuidelines: [
        'Use read_reconciliation_needs to inspect retrospective impasses over existing graph truth. These are distinct from elicitation gaps.',
      ],
      parameters: ReadReconciliationNeedsParams,

      async execute() {
        const needs = deps.reads.getOpenReconciliationNeeds(deps.specId);
        return {
          content: [{ type: 'text' as const, text: formatReconciliationNeeds(needs) }],
          details: { needs },
        };
      },
    }),
  );

  pi.registerTool(
    defineBrunchTool({
      name: UPDATE_RECONCILIATION_NEEDS_TOOL,
      label: 'Update Reconciliation Needs',
      description:
        'Create or resolve a reconciliation need through the Brunch command layer. ' +
        'Use this for contradictions over existing graph truth; it records the impasse and never overwrites graph nodes.',
      promptSnippet: 'Create or resolve a reconciliation need',
      promptGuidelines: [
        'For a contradiction between two existing nodes, create a semantic_conflict reconciliation need with a node_pair target.',
        'Do not use reconciliation needs as graph truth. The reason records why repair is needed, not the replacement fact.',
        'update_reconciliation_needs performs one register write per call; on STRUCTURAL_ILLEGAL read the diagnostics, fix the input, and retry.',
      ],
      parameters: UpdateReconciliationNeedsParams,

      async execute(_toolCallId, params) {
        const result = executeUpdate(deps, params);
        return {
          content: [{ type: 'text' as const, text: formatReconciliationUpdateResult(result, params.action) }],
          details: result,
        };
      },
    }),
  );
}

function executeUpdate(
  deps: BrunchReconciliationDeps,
  params: UpdateReconciliationNeedsParamValues,
): UpdateResult {
  if (params.action === 'create') return executeCreate(deps, params);
  return executeResolve(deps, params);
}

function executeCreate(
  deps: BrunchReconciliationDeps,
  params: UpdateReconciliationNeedsParamValues,
): CreateReconNeedResult {
  const diagnostics: Diagnostic[] = [];
  if (params.needKind == null)
    diagnostics.push({ field: 'needKind', message: 'needKind is required for create' });
  if (params.target == null) diagnostics.push({ field: 'target', message: 'target is required for create' });
  if (diagnostics.length > 0) return structuralIllegal(diagnostics);

  return deps.commandExecutor.createReconciliationNeed({
    specId: deps.specId,
    needKind: params.needKind!,
    target: params.target!,
    reason: params.reason,
  });
}

function executeResolve(
  deps: BrunchReconciliationDeps,
  params: UpdateReconciliationNeedsParamValues,
): ResolveReconNeedResult {
  if (params.needId == null) {
    return structuralIllegal([{ field: 'needId', message: 'needId is required for resolve' }]);
  }
  const id = Number(params.needId);
  if (!Number.isInteger(id)) {
    return structuralIllegal([
      { field: 'needId', message: `not a reconciliation need id: ${params.needId}` },
    ]);
  }
  return deps.commandExecutor.resolveReconciliationNeed({ specId: deps.specId, id });
}

function structuralIllegal(diagnostics: readonly Diagnostic[]): StructuralIllegal {
  return { status: 'structural_illegal', diagnostics };
}
