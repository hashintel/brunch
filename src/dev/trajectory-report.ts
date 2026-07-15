import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import type {
  AdvertisedDirective,
  BrunchTrajectoryEvent,
} from '../.pi/extensions/dev-mode/introspection/trajectory.js';
import { openActiveSessionBranch } from '../session/active-session-branch.js';

export interface TrajectoryReportInput {
  readonly repoRoot: string;
  readonly workspace: string;
  readonly sessionFile: string;
  readonly runId: string;
  readonly viewport?: string;
}
export interface TrajectoryReport {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly directives: readonly {
    id: string;
    category?: 'skill' | 'reference' | 'agent_body' | 'runtime_control' | 'unclassified' | 'prompt_directive';
    state: readonly ('advertised' | 'read' | 'provider_visible' | 'absent' | 'unknown')[];
    resource?: string;
  }[];
  readonly transcriptEffects: readonly { role: string; text: string }[];
  readonly viewport?: string;
}

export function parseTrajectoryReport(value: unknown): TrajectoryReport {
  if (!record(value) || value.schemaVersion !== 1 || !portableRunId(value.runId)) {
    throw new Error('invalid trajectory report identity');
  }
  if (
    !Array.isArray(value.directives) ||
    !value.directives.every(validReportDirective) ||
    !Array.isArray(value.transcriptEffects) ||
    !value.transcriptEffects.every(
      (item) => record(item) && typeof item.role === 'string' && typeof item.text === 'string',
    ) ||
    (value.viewport !== undefined && typeof value.viewport !== 'string')
  ) {
    throw new Error('malformed trajectory report');
  }
  return value as unknown as TrajectoryReport;
}

export async function writeTrajectoryReport(input: TrajectoryReportInput): Promise<string> {
  validateInput(input);
  const events = await readEvents(resolve(input.workspace, '.brunch/debug/trajectory.ndjson'));
  const report = await projectTrajectoryReport(input, events);
  const output = resolve(input.repoRoot, '.fixtures/scratch/trajectory', input.runId);
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'trajectory.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(resolve(output, 'report.md'), markdown(report));
  return output;
}

export async function projectTrajectoryReport(
  input: TrajectoryReportInput,
  events: readonly BrunchTrajectoryEvent[],
): Promise<TrajectoryReport> {
  assertOrderedAndCorrelated(events);
  const branch = openActiveSessionBranch(input.sessionFile).entries;
  const providers = events.filter((event) => event.kind === 'provider_request');
  const reads = events.filter((event) => event.kind === 'resource_read');
  const advertised = new Map<string, AdvertisedDirective>();
  for (const event of providers)
    for (const item of event.advertised) advertised.set(`${item.category}:${item.name}`, item);
  const directives: Array<TrajectoryReport['directives'][number]> = [...advertised.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => {
      const matchingReads = reads.filter((event) => event.resource === item.location);
      const read = matchingReads[0];
      const visible = matchingReads.some(
        (candidate) =>
          candidate.resultHash !== undefined &&
          providers.some(
            (event) =>
              event.ordinal > candidate.ordinal && event.contentHashes.includes(candidate.resultHash!),
          ),
      );
      return {
        id: item.name,
        category: item.category,
        state: [
          'advertised',
          ...(read ? ['read' as const] : []),
          ...(visible ? ['provider_visible' as const] : []),
        ],
        ...(read?.resource ? { resource: read.resource } : {}),
      };
    });
  const promptDirectiveEvidence = providers.flatMap((event) => event.promptDirectives);
  for (const id of [...new Set(promptDirectiveEvidence.map((item) => item.id))].sort()) {
    const evidence = promptDirectiveEvidence.filter((item) => item.id === id);
    const identities = new Set(evidence.map((item) => item.hash));
    const states = new Set(evidence.map((item) => item.present));
    if (identities.size !== 1 || states.size !== 1) {
      throw new Error(`trajectory directive evidence is inconsistent for ${id}`);
    }
    directives.push({
      id,
      category: 'prompt_directive',
      state: [evidence[0]!.present ? 'provider_visible' : 'absent'],
      resource: evidence[0]!.hash,
    });
  }
  const stableCategories = [
    ['agent_body', providers.flatMap((event) => event.agentBodyHashes)],
    ['runtime_control', providers.flatMap((event) => event.controlHashes)],
    ['unclassified', providers.flatMap((event) => event.unknownPromptHashes)],
  ] as const;
  for (const [category, hashes] of stableCategories) {
    for (const id of [...new Set(hashes)].sort()) {
      directives.push({
        id,
        category,
        state: [category === 'unclassified' ? 'unknown' : 'provider_visible'],
      });
    }
  }
  let remainingTranscriptBytes = 65_536;
  // ceiling: at most 128 effects / 64 KiB total; move to paginated report attachments if trajectory review needs more history.
  const transcriptEffects: Array<{ role: string; text: string }> = [];
  for (const entry of branch) {
    if (transcriptEffects.length >= 128 || remainingTranscriptBytes <= 0) break;
    if (entry.type !== 'message' || !('message' in entry)) continue;
    const message = entry.message as { role?: unknown; content?: unknown };
    const value = textContent(message.content);
    if (typeof message.role !== 'string' || !value) continue;
    const text = value.slice(0, Math.min(16_384, remainingTranscriptBytes));
    remainingTranscriptBytes -= text.length;
    transcriptEffects.push({ role: message.role, text });
  }
  const viewport = input.viewport ? (await readFile(input.viewport, 'utf8')).slice(0, 32_768) : undefined;
  return {
    schemaVersion: 1,
    runId: input.runId,
    directives,
    transcriptEffects,
    ...(viewport ? { viewport } : {}),
  };
}

function validateInput(input: TrajectoryReportInput): void {
  if (!portableRunId(input.runId)) throw new Error('trajectory run id must be portable');
  const workspace = resolve(input.workspace);
  const sessionsRoot = resolve(workspace, '.brunch', 'sessions');
  const session = resolve(input.sessionFile);
  if (!contained(sessionsRoot, session))
    throw new Error('trajectory session file must belong to the workspace sessions root');
  if (input.viewport && !contained(workspace, resolve(input.viewport)))
    throw new Error('trajectory viewport must belong to the workspace');
}
function contained(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path !== '' && !path.startsWith('..') && !isAbsolute(path);
}
function assertOrderedAndCorrelated(events: readonly BrunchTrajectoryEvent[]): void {
  events.forEach((event, index) => {
    if (event.ordinal !== index + 1)
      throw new Error('trajectory correlation: event ordinals are missing or ambiguous');
  });
  const requiredGaps = events.flatMap((event) =>
    event.gaps.map((gap) => `${event.kind}#${event.ordinal}:${gap}`),
  );
  if (requiredGaps.length) throw new Error(`trajectory correlation unresolved: ${requiredGaps.join(', ')}`);
  const ids = events.filter((event) => event.kind === 'resource_read').map((event) => event.toolCallId!);
  if (new Set(ids).size !== ids.length) throw new Error('trajectory correlation: duplicate read toolCallId');
}
export async function readEvents(file: string): Promise<BrunchTrajectoryEvent[]> {
  const lines = (await readFile(file, 'utf8')).split('\n');
  return lines.flatMap((line, index) => {
    if (!line.trim()) return [];
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error(`trajectory source line ${index + 1}: invalid JSON`);
    }
    return [parseEvent(value, index + 1)];
  });
}
function parseEvent(value: unknown, line: number): BrunchTrajectoryEvent {
  if (
    !record(value) ||
    !positiveInteger(value.ordinal) ||
    !['provider_request', 'resource_read', 'assistant_message'].includes(String(value.kind))
  )
    throw new Error(`trajectory source line ${line}: invalid event kind or ordinal`);
  if (value.turnIndex !== undefined && !nonnegativeInteger(value.turnIndex))
    throw new Error(`trajectory source line ${line}: invalid turnIndex`);
  if (!stringArray(value.gaps)) throw new Error(`trajectory source line ${line}: invalid gaps`);
  if (value.kind === 'provider_request') {
    if (
      !Array.isArray(value.advertised) ||
      !value.advertised.every(directive) ||
      !stringArray(value.contentHashes) ||
      !stringArray(value.agentBodyHashes) ||
      !stringArray(value.controlHashes) ||
      !stringArray(value.unknownPromptHashes) ||
      !Array.isArray(value.promptDirectives) ||
      !value.promptDirectives.every(promptDirective)
    )
      throw new Error(`trajectory source line ${line}: invalid provider_request fields`);
  } else if (value.kind === 'resource_read') {
    if (![value.toolCallId, value.resource, value.resultHash].every(optionalString))
      throw new Error(`trajectory source line ${line}: invalid resource_read fields`);
  } else if (!optionalString(value.textHash))
    throw new Error(`trajectory source line ${line}: invalid assistant_message fields`);
  return value as BrunchTrajectoryEvent;
}
function directive(value: unknown): boolean {
  return (
    record(value) &&
    (value.category === 'skill' || value.category === 'reference') &&
    typeof value.name === 'string' &&
    typeof value.location === 'string' &&
    isAbsolute(value.location)
  );
}
function promptDirective(value: unknown): boolean {
  return (
    record(value) &&
    value.id === 'warrant-before-commit' &&
    typeof value.hash === 'string' &&
    typeof value.present === 'boolean'
  );
}
function validReportDirective(value: unknown): boolean {
  return (
    record(value) &&
    typeof value.id === 'string' &&
    (value.category === undefined ||
      (typeof value.category === 'string' &&
        ['skill', 'reference', 'agent_body', 'runtime_control', 'unclassified', 'prompt_directive'].includes(
          value.category,
        ))) &&
    Array.isArray(value.state) &&
    value.state.every((state) =>
      ['advertised', 'read', 'provider_visible', 'absent', 'unknown'].includes(String(state)),
    ) &&
    (value.resource === undefined || typeof value.resource === 'string')
  );
}
function portableRunId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(value);
}
function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}
function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
function positiveInteger(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) > 0;
}
function nonnegativeInteger(value: unknown): boolean {
  return Number.isInteger(value) && Number(value) >= 0;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function textContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value
    .flatMap((item) => (record(item) && typeof item.text === 'string' ? [item.text] : []))
    .join('\n');
}
function markdown(report: TrajectoryReport): string {
  const viewport = report.viewport ? `\n## Bounded viewport\n\n${fenced(report.viewport)}\n` : '';
  return `# Trajectory ${report.runId}\n\n## Directives\n\n${report.directives.map((item) => `- ${item.category ? `**${item.category}:** ` : ''}\`${item.id}\`: ${item.state.join(' → ')}`).join('\n')}\n\n## Transcript effects\n\n${report.transcriptEffects.map((item) => `- **${item.role}:** ${item.text}`).join('\n')}\n${viewport}`;
}

function fenced(value: string): string {
  const longest = Math.max(0, ...[...value.matchAll(/`+/gu)].map((match) => match[0].length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}text\n${value}\n${fence}`;
}
