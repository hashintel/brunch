/**
 * Session-local elicitation scratchpad tools — read/write access to the
 * `brunch.elicitation_scratchpad` custom entry projection
 * (`session/elicitation-scratchpad.ts`). Replaces the retired persisted
 * `elicitation_gaps` register per D101-L.
 *
 * Reads/writes go through exactly one fold projection
 * (`latestElicitationScratchpad`); the tool result content describes the
 * write but is never itself read back as state (I56-L / one-carrier rule).
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

import {
  formatElicitationScratchpad,
  formatElicitationScratchpadUpdateResult,
} from '../../../../agents/contexts/data-model/elicitation-scratchpad.js';
import {
  appendElicitationScratchpadSnapshot,
  latestElicitationScratchpad,
  parseElicitationScratchpadEntryData,
  type ElicitationScratchpadEntrySessionManager,
  type ElicitationScratchpadItem,
} from '../../../../session/elicitation-scratchpad.js';
import { toolParameters } from '../../shared/tool-schema.js';

export const READ_ELICITATION_SCRATCHPAD_TOOL = 'read_elicitation_scratchpad';
export const UPDATE_ELICITATION_SCRATCHPAD_TOOL = 'update_elicitation_scratchpad';

interface CustomEntryLike {
  type?: unknown;
  customType?: unknown;
  data?: unknown;
}

interface SessionManagerLike {
  getEntries(): readonly CustomEntryLike[];
}

function supportsScratchpadEntries(
  sessionManager: SessionManagerLike | undefined,
): sessionManager is ElicitationScratchpadEntrySessionManager {
  return (
    sessionManager !== undefined &&
    typeof (sessionManager as Partial<ElicitationScratchpadEntrySessionManager>).appendCustomEntry ===
      'function'
  );
}

function currentScratchpad(
  sessionManager: SessionManagerLike | undefined,
): readonly ElicitationScratchpadItem[] {
  return latestElicitationScratchpad(sessionManager?.getEntries() ?? []);
}

const ReadElicitationScratchpadParamsSchema = Type.Object(
  {},
  {
    additionalProperties: false,
    description:
      'Read the current session-local elicitation scratchpad: obligations the agent has noted still need asking, reconstructed from this session branch. Non-authoritative — durable truth is the graph.',
  },
);
const ReadElicitationScratchpadParams = toolParameters(
  ReadElicitationScratchpadParamsSchema,
) as typeof ReadElicitationScratchpadParamsSchema;

const UpdateElicitationScratchpadParamsSchema = Type.Object(
  {
    operation: Type.Unsafe<'add' | 'resolve' | 'update'>({
      enum: ['add', 'resolve', 'update'],
      description:
        "'add' appends a new open obligation; 'resolve' marks an existing obligation resolved; 'update' replaces an obligation's text/rationale/meta",
    }),
    id: Type.Optional(
      Type.String({
        description: 'add: id for the new obligation; resolve/update: id of the existing one',
      }),
    ),
    obligation: Type.Optional(
      Type.String({ description: 'add/update: the obligation text (what still needs asking)' }),
    ),
    rationale: Type.Optional(Type.String({ description: 'add/update: why this obligation exists' })),
    meta: Type.Optional(
      Type.Unsafe<Record<string, unknown>>({
        type: 'object',
        description: 'add/update: free-form non-authoritative reference data',
      }),
    ),
  },
  {
    additionalProperties: false,
    description:
      'Write the session-local elicitation scratchpad. Always appends a full-replacement snapshot of the current scratchpad; never persists to the graph.',
  },
);
const UpdateElicitationScratchpadParams = toolParameters(
  UpdateElicitationScratchpadParamsSchema,
) as typeof UpdateElicitationScratchpadParamsSchema;

export interface UpdateElicitationScratchpadParamValues {
  operation: 'add' | 'resolve' | 'update';
  id?: string;
  obligation?: string;
  rationale?: string;
  meta?: Record<string, unknown>;
}

export type ScratchpadUpdateResult =
  | { status: 'ok'; items: readonly ElicitationScratchpadItem[] }
  | { status: 'structural_illegal'; diagnostics: readonly { field: string; message: string }[] };

function hasText(value: string | undefined): value is string {
  return value !== undefined && value !== '';
}

export function applyElicitationScratchpadUpdate(
  current: readonly ElicitationScratchpadItem[],
  params: UpdateElicitationScratchpadParamValues,
): ScratchpadUpdateResult {
  if (params.operation === 'add') {
    if (!hasText(params.id) || !hasText(params.obligation)) {
      return {
        status: 'structural_illegal',
        diagnostics: [
          ...(!hasText(params.id) ? [{ field: 'id', message: 'id is required for add' }] : []),
          ...(!hasText(params.obligation)
            ? [{ field: 'obligation', message: 'obligation is required for add' }]
            : []),
        ],
      };
    }
    const id = params.id;
    const obligation = params.obligation;
    if (current.some((item) => item.id === id)) {
      return {
        status: 'structural_illegal',
        diagnostics: [{ field: 'id', message: `an obligation with id ${id} already exists` }],
      };
    }
    const added: ElicitationScratchpadItem = {
      id,
      obligation,
      disposition: 'open',
      ...(params.rationale !== undefined ? { rationale: params.rationale } : {}),
      ...(params.meta !== undefined ? { meta: params.meta } : {}),
    };
    return { status: 'ok', items: [...current, added] };
  }

  if (!hasText(params.id)) {
    return {
      status: 'structural_illegal',
      diagnostics: [{ field: 'id', message: `id is required for ${params.operation}` }],
    };
  }

  const index = current.findIndex((item) => item.id === params.id);
  if (index === -1) {
    return {
      status: 'structural_illegal',
      diagnostics: [{ field: 'id', message: `no scratchpad obligation with id ${params.id}` }],
    };
  }

  if (params.operation === 'resolve') {
    const next = [...current];
    next[index] = { ...next[index]!, disposition: 'resolved' };
    return { status: 'ok', items: next };
  }

  if (params.obligation === '') {
    return {
      status: 'structural_illegal',
      diagnostics: [{ field: 'obligation', message: 'obligation cannot be empty for update' }],
    };
  }

  const next = [...current];
  const existing = next[index]!;
  next[index] = {
    ...existing,
    ...(params.obligation !== undefined ? { obligation: params.obligation } : {}),
    ...(params.rationale !== undefined ? { rationale: params.rationale } : {}),
    ...(params.meta !== undefined ? { meta: params.meta } : {}),
  };
  return { status: 'ok', items: next };
}

export function registerBrunchElicitationScratchpad(pi: ExtensionAPI): void {
  pi.registerTool({
    name: READ_ELICITATION_SCRATCHPAD_TOOL,
    label: 'Read Elicitation Scratchpad',
    description:
      'Read the session-local elicitation scratchpad: obligations noted as still needing to be asked, reconstructed from this session branch. Non-authoritative — durable truth is the graph.',
    promptSnippet: 'Read the current session-local elicitation scratchpad',
    promptGuidelines: [
      'Use read_elicitation_scratchpad to see what this session has noted still needs asking.',
      'The scratchpad is session-local and non-authoritative; it never overrides graph facts.',
    ],
    parameters: ReadElicitationScratchpadParams,

    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      const items = currentScratchpad(ctx?.sessionManager);
      return {
        content: [{ type: 'text' as const, text: formatElicitationScratchpad(items) }],
        details: { items },
      };
    },
  });

  pi.registerTool({
    name: UPDATE_ELICITATION_SCRATCHPAD_TOOL,
    label: 'Update Elicitation Scratchpad',
    description:
      "Update the session-local elicitation scratchpad. 'add' appends a new open obligation, 'resolve' marks one resolved, 'update' edits its text/rationale/meta. Always appends a full-replacement snapshot; never writes the graph.",
    promptSnippet: 'Add, resolve, or update a session-local elicitation scratchpad obligation',
    promptGuidelines: [
      'update_elicitation_scratchpad only changes session-local scratch state, never graph truth.',
      'Route low-confidence noticings here instead of committing them to the graph (D81-L).',
    ],
    parameters: UpdateElicitationScratchpadParams,

    async execute(_toolCallId, params: UpdateElicitationScratchpadParamValues, _signal, _onUpdate, ctx) {
      const current = currentScratchpad(ctx?.sessionManager);
      const result = applyElicitationScratchpadUpdate(current, params);

      if (result.status === 'structural_illegal') {
        return {
          content: [
            {
              type: 'text' as const,
              text: `STRUCTURAL_ILLEGAL\n${result.diagnostics.map((d) => `- ${d.field}: ${d.message}`).join('\n')}`,
            },
          ],
          details: result,
        };
      }

      if (!supportsScratchpadEntries(ctx?.sessionManager)) {
        const unavailableResult: ScratchpadUpdateResult = {
          status: 'structural_illegal',
          diagnostics: [
            {
              field: 'sessionManager.appendCustomEntry',
              message: 'session manager cannot persist elicitation scratchpad snapshots',
            },
          ],
        };
        return {
          content: [
            {
              type: 'text' as const,
              text: `STRUCTURAL_ILLEGAL\n${unavailableResult.diagnostics
                .map((d) => `- ${d.field}: ${d.message}`)
                .join('\n')}`,
            },
          ],
          details: unavailableResult,
        };
      }

      const snapshotData = { schemaVersion: 1 as const, items: result.items };
      if (!parseElicitationScratchpadEntryData(snapshotData)) {
        const invalidResult: ScratchpadUpdateResult = {
          status: 'structural_illegal',
          diagnostics: [
            { field: 'items', message: 'updated scratchpad would not parse as a valid snapshot' },
          ],
        };
        return {
          content: [
            {
              type: 'text' as const,
              text: `STRUCTURAL_ILLEGAL\n${invalidResult.diagnostics
                .map((d) => `- ${d.field}: ${d.message}`)
                .join('\n')}`,
            },
          ],
          details: invalidResult,
        };
      }

      appendElicitationScratchpadSnapshot(ctx.sessionManager, result.items);

      return {
        content: [
          {
            type: 'text' as const,
            text: formatElicitationScratchpadUpdateResult(result.items, params.operation),
          },
        ],
        details: result,
      };
    },
  });
}
