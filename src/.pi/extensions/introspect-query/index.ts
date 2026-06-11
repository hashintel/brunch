import { defineTool, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import * as z from 'zod';

import {
  type BrunchIntrospectionStore,
  type BrunchIntrospectionTurnCapture,
} from '../introspection/index.js';
import { devToolParameters } from '../shared/pi-tool-schema.js';
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  projectSelection,
  rowsToText,
  truncateQueryOutput,
  type TruncationResult,
} from '../shared/query-projection.js';

export const BRUNCH_INTROSPECT_QUERY_TOOL = 'brunch_introspect_query';

const zFind = z
  .object({
    capture: z.literal('latest').optional(),
    turnId: z.string().optional(),
    nth: z.number().min(1).optional(),
  })
  .strict()
  .optional();

const zBrunchIntrospectQueryParams = z
  .object({
    find: zFind,
    select: z.union([z.string(), z.array(z.string())]).optional(),
    maxBytes: z.number().min(1).optional(),
    format: z.enum(['json', 'text']).optional(),
  })
  .strict();

export type BrunchIntrospectQueryParams = z.infer<typeof zBrunchIntrospectQueryParams>;

export interface BrunchIntrospectQueryRef {
  readonly turnId: string;
  readonly capturedAt: string;
}

export interface BrunchIntrospectQueryRow {
  readonly ref: BrunchIntrospectQueryRef;
  readonly value: unknown;
}

export interface BrunchIntrospectQueryDetails {
  readonly matched: number;
  readonly returned: number;
  readonly selected?: string | readonly string[];
  readonly truncation?: TruncationResult;
  readonly fullOutputPath?: string;
}

interface BrunchIntrospectionQueryableCapture {
  readonly turnId: string;
  readonly capturedAt: string;
  readonly payload: unknown;
  readonly baseOptions: unknown;
}

export function registerBrunchIntrospectQuery(
  pi: ExtensionAPI,
  options: { store: BrunchIntrospectionStore },
): void {
  pi.registerTool(createBrunchIntrospectQueryTool(options.store));
}

export function createBrunchIntrospectQueryTool(store: BrunchIntrospectionStore) {
  return defineTool<ReturnType<typeof devToolParameters>, BrunchIntrospectQueryDetails>({
    name: BRUNCH_INTROSPECT_QUERY_TOOL,
    label: 'Brunch introspect query',
    description: [
      'Read-only dev tool for querying the provider payload captured by Brunch introspection.',
      'Use brunch_introspect_query when the user asks what system prompt, tool schemas, messages, or prompt options you were actually given. Echo returned values verbatim in a fenced block when asked for exact bytes.',
      'The payload field is the final provider-serialized before_provider_request payload; baseOptions is only Pi getSystemPromptOptions base input and does not include later prompt/context/payload mutations.',
      `Output is truncated to maxBytes (default ${formatSize(DEFAULT_MAX_BYTES)}) or ${DEFAULT_MAX_LINES} lines; truncated full output is saved to a temp file.`,
    ].join(' '),
    promptSnippet: 'Query the latest captured provider payload and base prompt options.',
    promptGuidelines: [
      'Use brunch_introspect_query when the user asks what prompt, tools, or provider payload you actually received; quote returned values verbatim rather than paraphrasing when exactness matters.',
      'Treat baseOptions as base prompt inputs only; use payload for the final provider-serialized request.',
    ],
    parameters: devToolParameters(zBrunchIntrospectQueryParams),
    async execute(_toolCallId, rawParams) {
      const params = zBrunchIntrospectQueryParams.parse(rawParams);
      const rows = queryIntrospectionCaptures(store, params);
      const serialized =
        params.format === 'text' ? rowsToIntrospectText(rows) : JSON.stringify(rows, null, 2);
      const maxBytes = params.maxBytes ?? DEFAULT_MAX_BYTES;
      const { content, details } = await truncateQueryOutput(
        serialized,
        maxBytes,
        {
          matched: matchedCaptureCount(store, params.find),
          returned: rows.length,
          ...(params.select === undefined ? {} : { selected: params.select }),
        },
        'brunch-introspect-query-',
      );

      return { content: [{ type: 'text', text: content }], details };
    },
  });
}

export function queryIntrospectionCaptures(
  store: BrunchIntrospectionStore,
  params: BrunchIntrospectQueryParams,
): BrunchIntrospectQueryRow[] {
  const baseOptions = store.latestBaseReport()?.baseSystemPromptOptions;
  return findCaptures(store, params.find).map((capture) => {
    const queryable: BrunchIntrospectionQueryableCapture = {
      turnId: capture.turnId,
      capturedAt: capture.capturedAt,
      payload: capture.payload,
      baseOptions,
    };
    return {
      ref: { turnId: capture.turnId, capturedAt: capture.capturedAt },
      value: projectSelection(queryable, params.select),
    };
  });
}

function matchedCaptureCount(
  store: BrunchIntrospectionStore,
  find: BrunchIntrospectQueryParams['find'],
): number {
  return findCaptures(store, find).length;
}

function findCaptures(
  store: BrunchIntrospectionStore,
  find: BrunchIntrospectQueryParams['find'],
): readonly BrunchIntrospectionTurnCapture[] {
  const captures = store.allPassiveCaptures();
  if (find?.turnId !== undefined) return captures.filter((capture) => capture.turnId === find.turnId);
  if (find?.nth !== undefined) {
    const capture = captures.at(-find.nth);
    return capture ? [capture] : [];
  }
  const latest = store.latestPassiveCapture();
  return latest ? [latest] : [];
}

function rowsToIntrospectText(rows: readonly BrunchIntrospectQueryRow[]): string {
  return rowsToText(rows, (ref) => `${ref.turnId} ${ref.capturedAt}`);
}

export default registerBrunchIntrospectQuery;
