import { defineTool, type ExtensionAPI, type SessionEntry } from '@earendil-works/pi-coding-agent';
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

// The query `role` predicate matches `roleFor(entry)`, which surfaces a message
// entry's `message.role`. Anchor the predicate vocabulary to that canonical
// union: `satisfies Record<EntryRole, true>` makes a new Pi role a build error
// until it is listed here, and the Zod enum is constructed from these keys so the
// runtime contract cannot drift from the type.
type EntryRole = Extract<SessionEntry, { type: 'message' }>['message']['role'];
const ENTRY_ROLES = {
  user: true,
  assistant: true,
  toolResult: true,
  custom: true,
  bashExecution: true,
  branchSummary: true,
  compactionSummary: true,
} as const satisfies Record<EntryRole, true>;
const ENTRY_ROLE_NAMES = Object.keys(ENTRY_ROLES) as [EntryRole, ...EntryRole[]];

const zFind = z
  .object({
    role: z.enum(ENTRY_ROLE_NAMES).optional(),
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
      const branch = ctx.sessionManager.getBranch();
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
  branch: readonly SessionEntry[],
  params: BrunchSessionQueryParams,
): BrunchSessionQueryRow[] {
  const matches = branch
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entryMatchesFind(entry, params.find));
  const windowed = windowMatches(matches, params.find);

  return windowed.map(({ entry, index }) => ({
    ref: refForEntry(entry, index),
    value: projectSelection(queryableEntry(entry), params.select),
  }));
}

function countMatchingEntries(
  branch: readonly SessionEntry[],
  find: BrunchSessionQueryParams['find'],
): number {
  return branch.filter((entry) => entryMatchesFind(entry, find)).length;
}

function entryMatchesFind(entry: SessionEntry, find: BrunchSessionQueryParams['find']): boolean {
  const view = queryableEntry(entry);
  if (find.role !== undefined && roleFor(entry) !== find.role) return false;
  if (find.toolName !== undefined && valueAt(view, ['toolName']) !== find.toolName) return false;
  if (find.toolCallId !== undefined && valueAt(view, ['toolCallId']) !== find.toolCallId) return false;
  if (find.customType !== undefined && customTypeFor(entry) !== find.customType) return false;
  if (find.isError !== undefined && valueAt(view, ['isError']) !== find.isError) return false;
  if (find.contains !== undefined && !textForContains(entry).includes(find.contains)) return false;
  return true;
}

function windowMatches<T>(matches: readonly T[], find: BrunchSessionQueryParams['find']): readonly T[] {
  const ranged = find.range ? matches.slice(find.range[0], find.range[1]) : matches;
  if (find.last !== undefined) return ranged.slice(-find.last);
  return find.range ? ranged : ranged.slice(-DEFAULT_LAST_MATCHING);
}

// One normalized queryable view per entry so a `select` path addresses the same
// object returned when `select` is omitted. `SessionEntry` is Pi's canonical
// discriminated union (`getBranch(): SessionEntry[]`): only `message` entries
// nest their payload under `.message`, while custom/bash/summary entries keep
// their fields and sidecars (`details`/`data`) at the entry level. Narrowing on
// `entry.type` flattens the message variant so `content[0].text`, `role`, and
// `details` resolve uniformly across entry kinds.
function queryableEntry(entry: SessionEntry): Record<string, unknown> {
  if (entry.type === 'message') {
    const { message, ...sidecars } = entry;
    return { ...sidecars, ...message };
  }
  return { ...entry };
}

function refForEntry(entry: SessionEntry, index: number): BrunchSessionQueryRef {
  const role = roleFor(entry);
  const toolName = valueAt(queryableEntry(entry), ['toolName']);
  const customType = customTypeFor(entry);
  return {
    id: entry.id,
    index,
    ...(role ? { role } : {}),
    ...(typeof toolName === 'string' ? { toolName } : {}),
    ...(customType ? { customType } : {}),
  };
}

function roleFor(entry: SessionEntry): string | undefined {
  const role = valueAt(queryableEntry(entry), ['role']);
  if (typeof role === 'string') return role;
  if (entry.type === 'custom' || entry.type === 'custom_message') return 'custom';
  return undefined;
}

function customTypeFor(entry: SessionEntry): string | undefined {
  const customType = valueAt(queryableEntry(entry), ['customType']);
  return typeof customType === 'string' ? customType : undefined;
}

function textForContains(entry: SessionEntry): string {
  const view = queryableEntry(entry);
  const chunks = [
    ...textChunks(valueAt(view, ['content'])),
    valueAt(view, ['output']),
    valueAt(view, ['command']),
    valueAt(view, ['summary']),
    valueAt(view, ['data']),
    valueAt(view, ['details']),
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
