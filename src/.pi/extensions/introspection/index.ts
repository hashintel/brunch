import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';

import {
  appendToolContentToDebugCache,
  mirrorSystemPromptToDebugCache,
  type BrunchDebugCacheOptions,
} from './debug-cache.js';

export {
  appendEntryContentToDebugCache,
  appendOriginationRecordToDebugCache,
  mirrorSystemPromptToDebugCache,
  type BrunchDebugCacheOptions,
} from './debug-cache.js';

export const BRUNCH_INTROSPECTION_COMMAND = 'introspect';

export interface BrunchIntrospectionTurnCapture {
  readonly turnId: string;
  readonly capturedAt: string;
  readonly event: 'before_provider_request';
  readonly payload: unknown;
}

export interface BrunchIntrospectionBaseReport {
  readonly reportedAt: string;
  readonly command: typeof BRUNCH_INTROSPECTION_COMMAND;
  readonly baseSystemPromptOptions: unknown;
  readonly latestPassiveCapture?: BrunchIntrospectionTurnCapture;
}

export interface BrunchIntrospectionStore {
  recordPassiveCapture(capture: BrunchIntrospectionTurnCapture): void;
  recordBaseReport(report: BrunchIntrospectionBaseReport): void;
  allPassiveCaptures(): readonly BrunchIntrospectionTurnCapture[];
  latestPassiveCapture(): BrunchIntrospectionTurnCapture | undefined;
  latestPassiveCaptureAfter(cursor: number): BrunchIntrospectionTurnCapture | undefined;
  passiveCaptureCursor(): number;
  latestBaseReport(): BrunchIntrospectionBaseReport | undefined;
}

export interface BrunchIntrospectionOptions {
  readonly store?: BrunchIntrospectionStore;
  readonly clock?: () => Date;
  readonly debugCache?: BrunchDebugCacheOptions;
}

export interface InMemoryBrunchIntrospectionStore extends BrunchIntrospectionStore {
  readonly passiveCaptures: readonly BrunchIntrospectionTurnCapture[];
  readonly baseReports: readonly BrunchIntrospectionBaseReport[];
}

class InMemoryStore implements InMemoryBrunchIntrospectionStore {
  readonly passiveCaptures: BrunchIntrospectionTurnCapture[] = [];
  readonly baseReports: BrunchIntrospectionBaseReport[] = [];

  recordPassiveCapture(capture: BrunchIntrospectionTurnCapture): void {
    this.passiveCaptures.push(capture);
  }

  recordBaseReport(report: BrunchIntrospectionBaseReport): void {
    this.baseReports.push(report);
  }

  allPassiveCaptures(): readonly BrunchIntrospectionTurnCapture[] {
    return this.passiveCaptures;
  }

  latestPassiveCapture(): BrunchIntrospectionTurnCapture | undefined {
    return this.passiveCaptures.at(-1);
  }

  latestPassiveCaptureAfter(cursor: number): BrunchIntrospectionTurnCapture | undefined {
    return this.passiveCaptures.slice(cursor).at(-1);
  }

  passiveCaptureCursor(): number {
    return this.passiveCaptures.length;
  }

  latestBaseReport(): BrunchIntrospectionBaseReport | undefined {
    return this.baseReports.at(-1);
  }
}

export function createInMemoryBrunchIntrospectionStore(): InMemoryBrunchIntrospectionStore {
  return new InMemoryStore();
}

export function registerBrunchIntrospection(
  pi: ExtensionAPI,
  options: BrunchIntrospectionOptions = {},
): BrunchIntrospectionStore {
  const store = options.store ?? createInMemoryBrunchIntrospectionStore();
  const now = () => (options.clock ?? (() => new Date()))().toISOString();
  let nextTurnOrdinal = 1;
  let activeTurnId = `turn-${nextTurnOrdinal}`;

  pi.on('before_agent_start', () => {
    activeTurnId = `turn-${nextTurnOrdinal}`;
    nextTurnOrdinal += 1;
  });

  pi.on('before_provider_request', async (event) => {
    const payload = isRecord(event) && 'payload' in event ? event.payload : undefined;
    store.recordPassiveCapture({
      turnId: activeTurnId,
      capturedAt: now(),
      event: 'before_provider_request',
      payload,
    });
    if (options.debugCache) await mirrorSystemPromptToDebugCache(options.debugCache, payload);
    return undefined;
  });

  pi.on('tool_result', async (event) => {
    if (options.debugCache) await appendToolContentToDebugCache(options.debugCache, event);
    return undefined;
  });

  pi.registerCommand(BRUNCH_INTROSPECTION_COMMAND, {
    description: 'Report Brunch base prompt inputs plus the latest passive provider payload capture',
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const report = buildBrunchIntrospectionReport(ctx, store, now());
      store.recordBaseReport(report);
      ctx.ui.notify(formatBrunchIntrospectionReport(report), 'info');
    },
  });

  return store;
}

export function buildBrunchIntrospectionReport(
  ctx: unknown,
  store: BrunchIntrospectionStore,
  reportedAt: string,
): BrunchIntrospectionBaseReport {
  const latestPassiveCapture = store.latestPassiveCapture();
  const getSystemPromptOptions = isRecord(ctx) ? ctx.getSystemPromptOptions : undefined;
  return {
    reportedAt,
    command: BRUNCH_INTROSPECTION_COMMAND,
    baseSystemPromptOptions:
      typeof getSystemPromptOptions === 'function' ? getSystemPromptOptions() : undefined,
    ...(latestPassiveCapture ? { latestPassiveCapture } : {}),
  };
}

function formatBrunchIntrospectionReport(report: BrunchIntrospectionBaseReport): string {
  const capture = report.latestPassiveCapture;
  return [
    'Brunch introspection report captured.',
    `basePromptOptions=${summarizeValue(report.baseSystemPromptOptions)}`,
    capture
      ? `latestPassiveCapture=${capture.turnId} ${summarizeValue(capture.payload)}`
      : 'latestPassiveCapture=none',
  ].join('\n');
}

function summarizeValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  if (isRecord(value)) return `object(${Object.keys(value).length})`;
  return typeof value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export default registerBrunchIntrospection;
