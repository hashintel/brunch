import { createHash } from 'node:crypto';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { LIVE_ELICITOR_DIRECTIVES } from '../../../../agents/runtime/elicitor/compose-live-prompt.js';
import { systemPromptFromProviderPayload } from '../../shared/provider-system-prompt.js';

export interface AdvertisedDirective {
  readonly category: 'skill' | 'reference';
  readonly name: string;
  readonly location: string;
}

export type BrunchTrajectoryEvent =
  | {
      readonly ordinal: number;
      readonly kind: 'provider_request';
      readonly turnIndex?: number;
      readonly advertised: readonly AdvertisedDirective[];
      readonly contentHashes: readonly string[];
      readonly agentBodyHashes: readonly string[];
      readonly controlHashes: readonly string[];
      readonly unknownPromptHashes: readonly string[];
      readonly promptDirectives: readonly {
        id: 'warrant-before-commit';
        hash: string;
        present: boolean;
      }[];
      readonly gaps: readonly string[];
    }
  | {
      readonly ordinal: number;
      readonly kind: 'resource_read';
      readonly turnIndex?: number;
      readonly toolCallId?: string;
      readonly resource?: string;
      readonly resultHash?: string;
      readonly gaps: readonly string[];
    }
  | {
      readonly ordinal: number;
      readonly kind: 'assistant_message';
      readonly turnIndex?: number;
      readonly textHash?: string;
      readonly gaps: readonly string[];
    };

type EventInput = BrunchTrajectoryEvent extends infer Event
  ? Event extends { readonly ordinal: number }
    ? Omit<Event, 'ordinal'>
    : never
  : never;

export interface BrunchTrajectoryRecorder {
  recordProviderRequest(turnIndex: number | undefined, event: unknown): Promise<void>;
  recordToolResult(turnIndex: number | undefined, event: unknown): Promise<void>;
  recordMessageEnd(turnIndex: number | undefined, event: unknown): Promise<void>;
}

export function createBrunchTrajectoryRecorder(cwd: string): BrunchTrajectoryRecorder {
  let ordinal = 0;
  let firstWrite = true;
  let writes = Promise.resolve();
  const record = async (event: EventInput) => {
    writes = writes.then(async () => {
      const directory = join(cwd, '.brunch', 'debug');
      const file = join(directory, 'trajectory.ndjson');
      await mkdir(directory, { recursive: true });
      const line = `${JSON.stringify({ ordinal: ++ordinal, ...event })}\n`;
      if (firstWrite) {
        firstWrite = false;
        await writeFile(file, line);
      } else {
        await appendFile(file, line);
      }
    });
    await writes;
  };
  return {
    recordProviderRequest: async (turnIndex, event) => {
      const strings = collectStrings(field(event, 'payload'));
      const prompt = systemPromptFromProviderPayload(field(event, 'payload'));
      const advertised = prompt ? advertisedDirectives(prompt) : [];
      const identities = prompt
        ? promptIdentities(prompt)
        : { agentBodyHashes: [], controlHashes: [], unknownPromptHashes: [] };
      await record({
        kind: 'provider_request',
        ...(turnIndex === undefined ? {} : { turnIndex }),
        advertised,
        // ceiling: 1,024 content identities per request; move to a streaming set if provider payloads exceed this bound.
        contentHashes: unique(strings.map(hash)).slice(0, 1_024),
        ...identities,
        promptDirectives: [
          {
            id: 'warrant-before-commit',
            hash: LIVE_ELICITOR_DIRECTIVES['warrant-before-commit'].hash,
            present:
              prompt?.includes(LIVE_ELICITOR_DIRECTIVES['warrant-before-commit'].providerVisibleText) ??
              false,
          },
        ],
        gaps: turnIndex === undefined ? ['missing_turn_index'] : [],
      });
    },
    recordToolResult: async (turnIndex, event) => {
      if (field(event, 'toolName') !== 'read') return;
      const toolCallId = stringField(event, 'toolCallId');
      const resource = resourceFromEvent(event);
      const result = text(field(event, 'content'));
      await record({
        kind: 'resource_read',
        ...(turnIndex === undefined ? {} : { turnIndex }),
        ...(toolCallId ? { toolCallId } : {}),
        ...(resource ? { resource } : {}),
        ...(result ? { resultHash: hash(result) } : {}),
        gaps: [
          ...(turnIndex === undefined ? ['missing_turn_index'] : []),
          ...(!toolCallId ? ['missing_tool_call_id'] : []),
          ...(!resource ? ['missing_resource'] : []),
          ...(!result ? ['missing_result_text'] : []),
        ],
      });
    },
    recordMessageEnd: async (turnIndex, event) => {
      const value = text(field(field(event, 'message'), 'content'));
      await record({
        kind: 'assistant_message',
        ...(turnIndex === undefined ? {} : { turnIndex }),
        ...(value ? { textHash: hash(value) } : {}),
        gaps: turnIndex === undefined ? ['missing_turn_index'] : [],
      });
    },
  };
}

function advertisedDirectives(prompt: string): AdvertisedDirective[] {
  return [
    ...prompt.matchAll(
      /<(skill|reference)>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<location>([^<]+)<\/location>[\s\S]*?<\/\1>/gu,
    ),
  ].map((match) => ({
    category: match[1] as 'skill' | 'reference',
    name: unescapeXml(match[2]!),
    location: unescapeXml(match[3]!),
  }));
}
function promptIdentities(
  prompt: string,
): Pick<
  Extract<BrunchTrajectoryEvent, { kind: 'provider_request' }>,
  'agentBodyHashes' | 'controlHashes' | 'unknownPromptHashes'
> {
  const withoutManifests = prompt.replaceAll(
    /<brunch-(?:skills|references)>[\s\S]*?<\/brunch-(?:skills|references)>/gu,
    '',
  );
  const controlMatch = withoutManifests.match(
    /^\[Brunch (?:live elicitor|executor) control\]$[\s\S]*?(?=\n\n|$)/mu,
  );
  const control = controlMatch?.[0];
  const beforeControl = controlMatch ? withoutManifests.slice(0, controlMatch.index).trim() : '';
  const remainder = controlMatch
    ? `${withoutManifests.slice((controlMatch.index ?? 0) + controlMatch[0].length)}`.trim()
    : withoutManifests.trim();
  return {
    agentBodyHashes: beforeControl ? [hash(beforeControl)] : [],
    controlHashes: control ? [hash(control)] : [],
    unknownPromptHashes: remainder ? [hash(remainder)] : [],
  };
}
function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, nested]) =>
    /authorization|api[-_]?key|headers?|token|secret|cookie|environment|env/iu.test(key)
      ? []
      : collectStrings(nested),
  );
}
function resourceFromEvent(event: unknown): string | undefined {
  const input = field(event, 'input') ?? field(event, 'args');
  return stringField(input, 'path') ?? stringField(input, 'file_path');
}
function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value
    .flatMap((item) => (isRecord(item) && typeof item.text === 'string' ? [item.text] : []))
    .join('\n');
}
function hash(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}
function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}
function unescapeXml(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&');
}
function field(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}
function stringField(value: unknown, key: string): string | undefined {
  const result = field(value, key);
  return typeof result === 'string' ? result : undefined;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
