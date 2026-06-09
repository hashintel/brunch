import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
  type ExtensionAPI,
  type ToolDefinition,
  type TruncationResult,
  withFileMutationQueue,
} from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

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
      const serialized = params.format === 'text' ? rowsToText(rows) : JSON.stringify(rows, null, 2);
      const maxBytes = params.maxBytes ?? DEFAULT_MAX_BYTES;
      const { content, details } = await truncateSessionQueryOutput(serialized, maxBytes, {
        matched: countMatchingEntries(branch, params.find),
        returned: rows.length,
        ...(params.select === undefined ? {} : { selected: params.select }),
      });

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
  const base = messageForEntry(entry);
  if (typeof select === 'string') return projectPath(base, select);
  return Object.fromEntries(select.map((path) => [path, projectPath(base, path)]));
}

function projectPath(value: unknown, path: string): unknown {
  const segments = parsePath(path);
  const values = projectSegments([value], segments);
  return values.length === 1 ? values[0] : values;
}

function parsePath(path: string): string[] {
  if (!path.trim()) throw new Error('select path must not be empty');
  return path.split('.').flatMap((part) => {
    if (!part) throw new Error(`invalid select path: ${path}`);
    const match = /^(?<key>[^[\]]+)(?:\[(?<index>\d+|\*)\])?$/.exec(part);
    const key = match?.groups?.key;
    const index = match?.groups?.index;
    if (!key) throw new Error(`invalid select path: ${path}`);
    return index === undefined ? [key] : [key, `[${index}]`];
  });
}

function projectSegments(values: readonly unknown[], segments: readonly string[]): unknown[] {
  if (segments.length === 0) return [...values];
  const [segment, ...rest] = segments;
  if (segment === undefined) return [...values];
  const next = values.flatMap((value) => projectSegment(value, segment));
  return projectSegments(next, rest);
}

function projectSegment(value: unknown, segment: string): unknown[] {
  if (segment === '[*]') return Array.isArray(value) ? value : [];
  const indexMatch = /^\[(\d+)\]$/.exec(segment);
  if (indexMatch) {
    if (!Array.isArray(value)) return [];
    const item = value[Number(indexMatch[1])];
    return item === undefined ? [] : [item];
  }
  if (!isRecord(value)) return [];
  return segment in value ? [value[segment]] : [];
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

async function truncateSessionQueryOutput(
  output: string,
  maxBytes: number,
  details: BrunchSessionQueryDetails,
): Promise<{ content: string; details: BrunchSessionQueryDetails }> {
  const truncation = truncateHead(output, { maxLines: DEFAULT_MAX_LINES, maxBytes });
  if (!truncation.truncated) return { content: truncation.content, details };

  const tempDir = await mkdtemp(join(tmpdir(), 'brunch-session-query-'));
  const fullOutputPath = join(tempDir, 'output.txt');
  await withFileMutationQueue(fullOutputPath, async () => {
    await writeFile(fullOutputPath, output, 'utf8');
  });

  const notice = [
    '',
    `[Output truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines`,
    `(${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`,
    `Full output saved to: ${fullOutputPath}]`,
  ].join(' ');

  return {
    content: `${truncation.content}\n${notice}`,
    details: { ...details, truncation, fullOutputPath },
  };
}

function rowsToText(rows: readonly BrunchSessionQueryRow[]): string {
  return rows
    .map((row) => {
      const label = [row.ref.index, row.ref.role, row.ref.toolName, row.ref.customType]
        .filter((part) => part !== undefined)
        .join(' ');
      return `# ${label}\n${typeof row.value === 'string' ? row.value : JSON.stringify(row.value, null, 2)}`;
    })
    .join('\n\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export default registerBrunchSessionQuery;
