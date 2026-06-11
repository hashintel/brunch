import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
  type TruncationResult,
  withFileMutationQueue,
} from '@earendil-works/pi-coding-agent';

export { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize };
export type { TruncationResult };

export interface TruncatedQueryOutput<TDetails extends Record<string, unknown>> {
  readonly content: string;
  readonly details: TDetails & { readonly truncation?: TruncationResult; readonly fullOutputPath?: string };
}

export function projectPath(value: unknown, path: string): unknown {
  const segments = parsePath(path);
  const values = projectSegments([value], segments);
  return values.length === 1 ? values[0] : values;
}

export function parsePath(path: string): string[] {
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

export function projectSelection(value: unknown, select: string | readonly string[] | undefined): unknown {
  if (select === undefined) return value;
  if (typeof select === 'string') return projectPath(value, select);
  return Object.fromEntries(select.map((path) => [path, projectPath(value, path)]));
}

export function rowsToText<TRef>(
  rows: readonly { readonly ref: TRef; readonly value: unknown }[],
  labelForRef: (ref: TRef) => string,
): string {
  return rows
    .map((row) =>
      [
        `# ${labelForRef(row.ref)}`,
        typeof row.value === 'string' ? row.value : JSON.stringify(row.value, null, 2),
      ].join('\n'),
    )
    .join('\n\n');
}

export async function truncateQueryOutput<TDetails extends Record<string, unknown>>(
  output: string,
  maxBytes: number,
  details: TDetails,
  tempPrefix: string,
): Promise<TruncatedQueryOutput<TDetails>> {
  const truncation = truncateHead(output, { maxLines: DEFAULT_MAX_LINES, maxBytes });
  if (!truncation.truncated) return { content: truncation.content, details };

  const tempDir = await mkdtemp(join(tmpdir(), tempPrefix));
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
