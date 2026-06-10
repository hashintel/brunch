import { defineTool, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import * as z from 'zod';

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

export const BRUNCH_SESSION_QUERY_TOOL = 'brunch_session_query';
const DEFAULT_LAST_MATCHING = 1;

type BrunchSessionEntry = Record<string, unknown>;

const zFind = z
  .object({
    role: z.enum(['user', 'assistant', 'toolResult', 'custom', 'bashExecution']).optional(),
    toolName: z.string().optional(),
    toolCallId: z.string().optional(),
    customType: z.string().optional(),
    isError: z.boolean().optional(),
    contains: z.string().optional(),
    last: z.number().min(1).optional(),
    range: z.tuple([z.number().min(0), z.number().min(0)]).optional(),
  })
  .strict();

const zBrunchSessionQueryParams = z
  .object({
    find: zFind,
    select: z.union([z.string(), z.array(z.string())]).optional(),
    maxBytes: z.number().min(1).optional(),
    format: z.enum(['json', 'text']).optional(),
  })
  .strict();

export type BrunchSessionQueryParams = z.infer<typeof zBrunchSessionQueryParams>;

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

export function createBrunchSessionQueryTool() {
  return defineTool<ReturnType<typeof devToolParameters>, BrunchSessionQueryDetails>({
    name: BRUNCH_SESSION_QUERY_TOOL,
    label: 'Brunch session query',
    description: [
      'Read-only dev tool for querying the current Pi session branch. Finds entries by predicate and returns verbatim projected value(s).',
      'Use brunch_session_query when the user asks you to inspect or quote prior session messages, tool calls/results, or custom entries. Echo returned values verbatim in a fenced block when asked for exact bytes.',
      'select is a dotted/indexed path rooted at the matched entry (the object returned when select is omitted, a flat view where message fields and entry sidecars are merged), e.g. "content[0].text" for a tool result\'s text, "content[*].text" for every text block, or "details" for the structured sidecar. Omit select to see the whole entry first.',
      `Output is truncated to maxBytes (default ${formatSize(DEFAULT_MAX_BYTES)}) or ${DEFAULT_MAX_LINES} lines; truncated full output is saved to a temp file.`,
    ].join(' '),
    promptSnippet:
      'Query the current session branch by predicate and project verbatim values from matching entries.',
    promptGuidelines: [
      'Use brunch_session_query when the user asks for exact prior session-log values; quote returned values verbatim rather than paraphrasing when exactness matters.',
    ],
    parameters: devToolParameters(zBrunchSessionQueryParams),
    async execute(_toolCallId, rawParams, _signal, _onUpdate, ctx) {
      const params = zBrunchSessionQueryParams.parse(rawParams);
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
  });
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

// Project over one normalized queryable view so a `select` path addresses the
// same object returned when `select` is omitted. Pi entry shapes differ by kind
// — message entries (user/assistant/toolResult) nest payload under `.message`
// with sidecars like `details`/`data` at the entry level, while custom entries
// are already flat — so the view flattens message fields and entry-level
// sidecars together. The result: `content[0].text` and `details` resolve
// uniformly across entry kinds.
function projectEntry(entry: BrunchSessionEntry, select: BrunchSessionQueryParams['select']): unknown {
  return projectSelection(queryableEntry(entry), select);
}

function queryableEntry(entry: BrunchSessionEntry): BrunchSessionEntry {
  const message = messageForEntry(entry);
  if (message === entry) return entry;
  const { message: _nestedMessage, ...entrySidecars } = entry;
  return { ...entrySidecars, ...message };
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
