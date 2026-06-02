import {
  type CustomEntry,
  type CustomMessageEntry,
  type SessionEntry,
  type SessionMessageEntry,
} from '@earendil-works/pi-coding-agent';

import type {
  StructuredExchangePresentDetails,
  StructuredExchangeRequestDetails,
} from './.pi/extensions/structured-exchange/shared/model.js';
import {
  isStructuredExchangePresentDetails,
  isStructuredExchangeRequestDetails,
} from './.pi/extensions/structured-exchange/shared/recovery.js';
import {
  assertLinearBrunchSessionEnvelope,
  loadJsonlTranscriptEntries,
  NonLinearTranscriptError,
  readBrunchSessionEnvelope,
  type BrunchSessionEnvelope,
} from './brunch-session-envelope.js';
import { isTerminalStructuredExchangeResultDetails } from './structured-exchange.js';

const PROMPT_SIDE_CUSTOM_TYPES = new Set([
  'brunch.elicitation_prompt',
  'brunch.elicitor_intent_hint',
  'brunch.establishment_offer',
  'brunch.review_set_proposal',
]);

const STRUCTURED_RESPONSE_TYPES = new Set([
  'brunch.elicitation_response',
  'brunch.action_response',
  'brunch.choice_response',
]);

export interface EntryRange {
  start: string;
  end: string;
}

export interface ElicitationExchange {
  promptRange: EntryRange;
  responseRange: EntryRange;
  promptEntryIds: string[];
  responseEntryIds: string[];
}

export interface OpenPromptProjection {
  promptRange: EntryRange;
  promptEntryIds: string[];
}

export interface ElicitationExchangeProjection {
  status: 'empty' | 'open_prompt' | 'ready';
  exchanges: ElicitationExchange[];
  openPrompt: OpenPromptProjection | null;
}

export interface TranscriptDisplayRow {
  id: string;
  role: 'prompt' | 'assistant' | 'user';
  text: string;
}

export interface TranscriptDisplayProjection {
  rows: TranscriptDisplayRow[];
}

export { loadJsonlTranscriptEntries, NonLinearTranscriptError };

export async function loadLinearElicitationExchangeProjection(
  file: string,
): Promise<ElicitationExchangeProjection> {
  return projectLinearElicitationExchangeProjection(await loadBrunchSessionEnvelope(file));
}

export async function loadLinearTranscriptDisplayProjection(
  file: string,
): Promise<TranscriptDisplayProjection> {
  return projectLinearTranscriptDisplayProjection(await loadBrunchSessionEnvelope(file));
}

export function projectLinearElicitationExchangeProjection(
  envelope: BrunchSessionEnvelope,
): ElicitationExchangeProjection {
  assertLinearBrunchSessionEnvelope(envelope);
  return projectElicitationExchanges(envelope.entries);
}

export function projectLinearTranscriptDisplayProjection(
  envelope: BrunchSessionEnvelope,
): TranscriptDisplayProjection {
  assertLinearBrunchSessionEnvelope(envelope);
  return projectTranscriptDisplay(envelope.entries);
}

async function loadBrunchSessionEnvelope(file: string): Promise<BrunchSessionEnvelope> {
  const readResult = await readBrunchSessionEnvelope(file);
  if (!readResult.ok) {
    throw new Error('Brunch session self-description is invalid');
  }
  return readResult.envelope;
}

export function projectTranscriptDisplay(entries: readonly unknown[]): TranscriptDisplayProjection {
  const rows: TranscriptDisplayRow[] = [];
  for (const entry of entries) {
    if (!isSessionEntry(entry)) {
      continue;
    }

    if (isDisplayableElicitationPrompt(entry)) {
      const text = textContent(entry.content);
      if (text.length > 0) {
        rows.push({ id: entry.id, role: 'prompt', text });
      }
      continue;
    }

    if (!isMessageEntry(entry)) {
      continue;
    }

    const text = textContent((entry.message as { content?: unknown }).content);
    if (text.length === 0) {
      continue;
    }

    if (isStructuredExchangePresentToolResult(entry)) {
      rows.push({ id: entry.id, role: 'prompt', text });
      continue;
    }

    if (isStructuredExchangeRequestToolResult(entry)) {
      rows.push({ id: entry.id, role: 'user', text });
      continue;
    }

    const role = entry.message.role;
    if (role !== 'assistant' && role !== 'user') {
      continue;
    }

    rows.push({ id: entry.id, role, text });
  }
  return { rows };
}

export function projectElicitationExchanges(entries: readonly unknown[]): ElicitationExchangeProjection {
  const exchanges: ElicitationExchange[] = [];
  let promptIds: string[] = [];
  let responseIds: string[] = [];
  let openStructuredExchange: StructuredExchangePresentDetails | undefined;

  for (const entry of entries) {
    if (!isTranscriptEntry(entry)) {
      continue;
    }

    const presentDetails = structuredExchangePresentDetails(entry);
    if (presentDetails) {
      flushResponse();
      promptIds.push(entry.id);
      openStructuredExchange = presentDetails;
      continue;
    }

    const requestDetails = structuredExchangeRequestDetails(entry);
    if (requestDetails) {
      if (
        promptIds.length > 0 &&
        openStructuredExchange !== undefined &&
        requestClosesPresent(requestDetails, openStructuredExchange)
      ) {
        responseIds.push(entry.id);
      }
      continue;
    }

    if (isPromptSideEntry(entry)) {
      flushResponse();
      promptIds.push(entry.id);
      continue;
    }

    if (isResponseSideEntry(entry) && promptIds.length > 0) {
      responseIds.push(entry.id);
    }
  }

  flushResponse();

  if (promptIds.length > 0) {
    return {
      status: 'open_prompt',
      exchanges,
      openPrompt: {
        promptRange: rangeFor(promptIds),
        promptEntryIds: promptIds,
      },
    };
  }

  return {
    status: exchanges.length === 0 ? 'empty' : 'ready',
    exchanges,
    openPrompt: null,
  };

  function flushResponse(): void {
    if (promptIds.length === 0 || responseIds.length === 0) {
      return;
    }

    exchanges.push({
      promptRange: rangeFor(promptIds),
      responseRange: rangeFor(responseIds),
      promptEntryIds: promptIds,
      responseEntryIds: responseIds,
    });
    promptIds = [];
    responseIds = [];
    openStructuredExchange = undefined;
  }
}

function rangeFor(ids: string[]): EntryRange {
  return { start: ids[0]!, end: ids[ids.length - 1]! };
}

function isTranscriptEntry(value: unknown): value is SessionEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type !== 'session' &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

function isSessionEntry(value: unknown): value is SessionEntry {
  return isTranscriptEntry(value) && hasStringOrNullParentId(value);
}

function hasStringOrNullParentId(value: unknown): boolean {
  return (
    (value as { parentId?: unknown }).parentId === null ||
    typeof (value as { parentId?: unknown }).parentId === 'string'
  );
}

function requestClosesPresent(
  request: StructuredExchangeRequestDetails,
  present: StructuredExchangePresentDetails,
): boolean {
  return (
    (request.status === 'answered' || request.status === 'cancelled' || request.status === 'unavailable') &&
    request.exchangeId === present.exchangeId &&
    request.respondsTo.exchangeId === present.exchangeId &&
    request.respondsTo.presentTool === present.presentTool &&
    (present.expectedRequest === undefined || present.expectedRequest.tool === request.requestTool)
  );
}

function structuredExchangePresentDetails(entry: SessionEntry): StructuredExchangePresentDetails | undefined {
  if (!isStructuredExchangePresentToolResult(entry)) return undefined;
  return (entry.message as { details?: unknown }).details as StructuredExchangePresentDetails;
}

function structuredExchangeRequestDetails(entry: SessionEntry): StructuredExchangeRequestDetails | undefined {
  if (!isStructuredExchangeRequestToolResult(entry)) return undefined;
  return (entry.message as { details?: unknown }).details as StructuredExchangeRequestDetails;
}

function isStructuredExchangePresentToolResult(entry: SessionEntry): entry is SessionMessageEntry & {
  message: SessionMessageEntry['message'] & { details?: unknown };
} {
  return (
    isMessageEntry(entry) &&
    entry.message.role === 'toolResult' &&
    isStructuredExchangePresentDetails((entry.message as { details?: unknown }).details)
  );
}

function isStructuredExchangeRequestToolResult(entry: SessionEntry): entry is SessionMessageEntry & {
  message: SessionMessageEntry['message'] & { details?: unknown };
} {
  return (
    isMessageEntry(entry) &&
    entry.message.role === 'toolResult' &&
    isStructuredExchangeRequestDetails((entry.message as { details?: unknown }).details)
  );
}

function isPromptSideEntry(entry: SessionEntry): boolean {
  if (isCustomTranscriptEntry(entry)) {
    return PROMPT_SIDE_CUSTOM_TYPES.has(entry.customType);
  }

  const role = roleOf(entry);
  if (role === 'toolResult' && isTerminalStructuredExchangeToolResult(entry)) {
    return false;
  }
  return role === 'assistant' || role === 'toolResult';
}

function isResponseSideEntry(entry: SessionEntry): boolean {
  if (roleOf(entry) === 'user') {
    return true;
  }
  if (isTerminalStructuredExchangeToolResult(entry)) {
    return true;
  }
  return isCustomTranscriptEntry(entry) && STRUCTURED_RESPONSE_TYPES.has(entry.customType);
}

function isTerminalStructuredExchangeToolResult(entry: SessionEntry): boolean {
  return (
    isMessageEntry(entry) &&
    entry.message.role === 'toolResult' &&
    isTerminalStructuredExchangeResultDetails((entry.message as { details?: unknown }).details)
  );
}

function isCustomTranscriptEntry(entry: SessionEntry): entry is CustomEntry | CustomMessageEntry {
  return entry.type === 'custom' || entry.type === 'custom_message';
}

function isDisplayableElicitationPrompt(entry: SessionEntry): entry is CustomMessageEntry {
  return (
    entry.type === 'custom_message' &&
    entry.customType === 'brunch.elicitation_prompt' &&
    entry.display === true
  );
}

function roleOf(entry: SessionEntry): SessionMessageEntry['message']['role'] | undefined {
  if (isMessageEntry(entry)) {
    return entry.message.role;
  }
  return undefined;
}

function isMessageEntry(entry: SessionEntry): entry is SessionMessageEntry {
  return entry.type === 'message';
}

function textContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === 'object' && part !== null && typeof (part as { text?: unknown }).text === 'string'
          ? (part as { text: string }).text
          : '',
      )
      .filter((text) => text.length > 0)
      .join('\n');
  }

  return '';
}
