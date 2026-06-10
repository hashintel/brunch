import { type ExtensionAPI, type ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  projectSelection,
  rowsToText,
  truncateQueryOutput,
  type TruncationResult,
} from '../shared/query-projection.js';

export const BRUNCH_SESSION_QUERY_TOOL = 'brunch_session_query';
const DEFAULT_LAST_MATCHING = 1;

type BrunchSessionEntry = Record<string, unknown>;

const FindSchema = Type.Object({
  role: Type.Optional(
    Type.Union([
      Type.Literal('user'),
      Type.Literal('assistant'),
      Type.Literal('toolResult'),
      Type.Literal('custom'),
      Type.Literal('bashExecution'),
    ]),
  ),
  toolName: Type.Optional(Type.String()),
  toolCallId: Type.Optional(Type.String()),
  customType: Type.Optional(Type.String()),
  isError: Type.Optional(Type.Boolean()),
  contains: Type.Optional(Type.String()),
  last: Type.Optional(Type.Number({ minimum: 1 })),
  range: Type.Optional(Type.Tuple([Type.Number({ minimum: 0 }), Type.Number({ minimum: 0 })])),
});

const BrunchSessionQueryParams = Type.Object({
  find: FindSchema,
  select: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])),
  maxBytes: Type.Optional(Type.Number({ minimum: 1 })),
  format: Type.Optional(Type.Union([Type.Literal('json'), Type.Literal('text')])),
});

export type BrunchSessionQueryParams = Static<typeof BrunchSessionQueryParams>;

export interface BrunchSessionQueryRef {
  readonly id?: string;
  readonly index: number;
  readonly role?: string;
  readonly toolName?: string;
  readonly customType?: string;
}

export interface BrunchSessionQueryRow {
  readonly ref: BrunchSessionQueryRef;
  readonly value: unknown;
}

export interface BrunchSessionQueryDetails {
  readonly matched: number;
  readonly returned: number;
  readonly selected?: string | readonly string[];
  readonly truncation?: TruncationResult;
  readonly fullOutputPath?: string;
}

export function registerBrunchSessionQuery(pi: ExtensionAPI): void {
  pi.registerTool(createBrunchSessionQueryTool());
}

export function createBrunchSessionQueryTool(): ToolDefinition<
  typeof BrunchSessionQueryParams,
  BrunchSessionQueryDetails
> {
  return {
    name: BRUNCH_SESSION_QUERY_TOOL,
    label: 'Brunch session query',
    description: [
      'Read-only dev tool for querying the current Pi session branch. Finds entries by predicate and returns verbatim projected value(s).',
      'Use brunch_session_query when the user asks you to inspect or quote prior session messages, tool calls/results, or custom entries. Echo returned values verbatim in a fenced block when asked for exact bytes.',
      `Output is truncated to maxBytes (default ${formatSize(DEFAULT_MAX_BYTES)}) or ${DEFAULT_MAX_LINES} lines; truncated full output is saved to a temp file.`,
    ].join(' '),
    promptSnippet:
      'Query the current session branch by predicate and project verbatim values from matching entries.',
    promptGuidelines: [
      'Use brunch_session_query when the user asks for exact prior session-log values; quote returned values verbatim rather than paraphrasing when exactness matters.',
    ],
    parameters: BrunchSessionQueryParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const branch = ctx.sessionManager.getBranch().map((entry) => entry as unknown as BrunchSessionEntry);
      const rows = querySessionBranch(branch, params);
      const serialized = params.format === 'text' ? rowsToSessionText(rows) : JSON.stringify(rows, null, 2);
      const maxBytes = params.maxBytes ?? DEFAULT_MAX_BYTES;
      const { content, details } = await truncateQueryOutput(
        serialized,
        maxBytes,
        {
          matched: countMatchingEntries(branch, params.find),
          returned: rows.length,
          ...(params.select === undefined ? {} : { selected: params.select }),
        },
        'brunch-session-query-',
      );

      return {
        content: [{ type: 'text', text: content }],
        details,
      };
    },
  };
}

export function querySessionBranch(
  branch: readonly BrunchSessionEntry[],
  params: BrunchSessionQueryParams,
): BrunchSessionQueryRow[] {
  const matches = branch
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entryMatchesFind(entry, params.find));
  const windowed = windowMatches(matches, params.find);

  return windowed.map(({ entry, index }) => ({
    ref: refForEntry(entry, index),
    value: projectEntry(entry, params.select),
  }));
}

function countMatchingEntries(
  branch: readonly BrunchSessionEntry[],
  find: BrunchSessionQueryParams['find'],
): number {
  return branch.filter((entry) => entryMatchesFind(entry, find)).length;
}

function entryMatchesFind(entry: BrunchSessionEntry, find: BrunchSessionQueryParams['find']): boolean {
  const message = messageForEntry(entry);
  if (find.role !== undefined && roleFor(entry) !== find.role) return false;
  if (find.toolName !== undefined && valueAt(message, ['toolName']) !== find.toolName) return false;
  if (find.toolCallId !== undefined && valueAt(message, ['toolCallId']) !== find.toolCallId) return false;
  if (find.customType !== undefined && customTypeFor(entry) !== find.customType) return false;
  if (find.isError !== undefined && valueAt(message, ['isError']) !== find.isError) return false;
  if (find.contains !== undefined && !textForContains(entry).includes(find.contains)) return false;
  return true;
}

function windowMatches<T>(matches: readonly T[], find: BrunchSessionQueryParams['find']): readonly T[] {
  const ranged = find.range ? matches.slice(find.range[0], find.range[1]) : matches;
  if (find.last !== undefined) return ranged.slice(-find.last);
  return find.range ? ranged : ranged.slice(-DEFAULT_LAST_MATCHING);
}

function projectEntry(entry: BrunchSessionEntry, select: BrunchSessionQueryParams['select']): unknown {
  if (select === undefined) return entry;
  return projectSelection(messageForEntry(entry), select);
}

function refForEntry(entry: BrunchSessionEntry, index: number): BrunchSessionQueryRef {
  const message = messageForEntry(entry);
  const role = roleFor(entry);
  const toolName = valueAt(message, ['toolName']);
  const customType = customTypeFor(entry);
  return {
    ...(typeof entry.id === 'string' ? { id: entry.id } : {}),
    index,
    ...(role ? { role } : {}),
    ...(typeof toolName === 'string' ? { toolName } : {}),
    ...(customType ? { customType } : {}),
  };
}

function messageForEntry(entry: BrunchSessionEntry): Record<string, unknown> {
  return isRecord(entry.message) ? entry.message : entry;
}

function roleFor(entry: BrunchSessionEntry): string | undefined {
  const message = messageForEntry(entry);
  const role = valueAt(message, ['role']);
  if (typeof role === 'string') return role;
  if (entry.type === 'custom_message' || entry.type === 'custom') return 'custom';
  return undefined;
}

function customTypeFor(entry: BrunchSessionEntry): string | undefined {
  const message = messageForEntry(entry);
  const customType = valueAt(message, ['customType']) ?? entry.customType;
  return typeof customType === 'string' ? customType : undefined;
}

function textForContains(entry: BrunchSessionEntry): string {
  const message = messageForEntry(entry);
  const chunks = [
    ...textChunks(valueAt(message, ['content'])),
    valueAt(message, ['output']),
    valueAt(message, ['command']),
    valueAt(message, ['summary']),
    valueAt(entry, ['data']),
    valueAt(entry, ['details']),
  ];
  return chunks
    .filter((chunk) => chunk !== undefined)
    .map((chunk) => (typeof chunk === 'string' ? chunk : JSON.stringify(chunk)))
    .join('\n');
}

function textChunks(content: unknown): unknown[] {
  if (typeof content === 'string') return [content];
  if (!Array.isArray(content)) return [];
  return content.flatMap((block) => {
    if (!isRecord(block)) return [];
    if (block.type === 'text' && typeof block.text === 'string') return [block.text];
    if (block.type === 'toolCall') return [block.name, block.arguments];
    return [];
  });
}

function valueAt(value: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), value);
}

function rowsToSessionText(rows: readonly BrunchSessionQueryRow[]): string {
  return rowsToText(rows, (ref) =>
    [ref.index, ref.role, ref.toolName, ref.customType]
      .filter((part) => part !== undefined)
      .map((part) => String(part))
      .join(' '),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export default registerBrunchSessionQuery;
