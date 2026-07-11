import type { ServerResponse } from 'node:http';

import { readRunDetail } from '../../executor/observer-read.js';
import { subscribePetriEvents } from '../../executor/petri-events.js';
import { resolvePetrinautUrl } from '../../executor/petrinaut/launcher-url.js';
import { serializePetrinautSseFrame, serializePetrinautSseFrames } from '../../executor/petrinaut/sse.js';
import {
  projectPetrinautStreamFrames,
  type PetrinautStreamFrame,
  type PetrinautTerminalState,
} from '../../executor/petrinaut/stream-frames.js';

interface ActiveStream {
  close(): void;
}

export interface PetrinautStreamHost {
  serve(response: ServerResponse, requestUrl: string | undefined, origin: string | undefined): Promise<void>;
  closeAll(): void;
}

export function createPetrinautStreamHost(cwd: string): PetrinautStreamHost {
  const activeStreams = new Set<ActiveStream>();
  return {
    serve(response, requestUrl, origin) {
      return servePetrinautStream({ response, cwd, requestUrl, origin, activeStreams });
    },
    closeAll() {
      for (const stream of activeStreams) stream.close();
    },
  };
}

export function petrinautStreamRunId(requestUrl: string | undefined): string | undefined {
  if (!requestUrl) return undefined;
  try {
    const runId = new URL(requestUrl, 'http://brunch.local').searchParams.get('runId')?.trim();
    return runId && runId.length > 0 ? runId : undefined;
  } catch {
    return undefined;
  }
}

async function servePetrinautStream(args: {
  readonly response: ServerResponse;
  readonly cwd: string;
  readonly requestUrl: string | undefined;
  readonly origin: string | undefined;
  readonly activeStreams: Set<ActiveStream>;
}): Promise<void> {
  const runId = petrinautStreamRunId(args.requestUrl);
  if (runId === undefined) {
    args.response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    args.response.end('Missing runId');
    return;
  }
  const resolvedRunId = runId;

  let initialized = false;
  let dirty = false;
  let disposed = false;
  let sentFiringCount = 0;
  let terminalSent = false;
  let sendQueue = Promise.resolve();
  const activeStream: ActiveStream = { close: () => dispose(true) };
  const unsubscribe = subscribePetriEvents({
    cwd: args.cwd,
    runId: resolvedRunId,
    listener: () => {
      dirty = true;
      if (initialized) enqueueRefresh();
    },
  });
  args.activeStreams.add(activeStream);
  args.response.on('close', () => dispose(false));

  function dispose(endResponse: boolean): void {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    args.activeStreams.delete(activeStream);
    if (endResponse && !args.response.writableEnded) args.response.end();
  }

  function enqueueRefresh(): void {
    sendQueue = sendQueue
      .then(async () => {
        if (disposed || !dirty) return;
        dirty = false;
        const detail = await readRunDetail(args.cwd, resolvedRunId).catch(() => undefined);
        if (detail === undefined || 'unreadable' in detail || detail.petrinautReplayExport === undefined)
          return;
        const terminal = petrinautTerminalFromDetail(detail);
        const frames = projectPetrinautStreamFrames({
          replayExport: detail.petrinautReplayExport,
          ...(terminal === undefined ? {} : { terminal }),
        });
        const nextFrames = newPetrinautFrames(frames, sentFiringCount, terminalSent);
        for (const frame of nextFrames) {
          await writeChunk(args.response, serializePetrinautSseFrame(frame));
        }
        sentFiringCount = detail.petrinautReplayExport.transitionFirings.length;
        terminalSent ||= nextFrames.some((frame) => frame.kind === 'terminal');
        if (terminalSent) dispose(true);
      })
      .catch(() => {
        // Failed observer delivery must not poison later journal notifications.
      });
  }

  const detail = await readRunDetail(args.cwd, resolvedRunId).catch(() => undefined);
  if (disposed) return;
  if (detail === undefined || 'unreadable' in detail || detail.petrinautReplayExport === undefined) {
    dispose(false);
    args.response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    args.response.end('Petrinaut stream not available');
    return;
  }

  const terminal = petrinautTerminalFromDetail(detail);
  const initialFrames = projectPetrinautStreamFrames({
    replayExport: detail.petrinautReplayExport,
    ...(terminal === undefined ? {} : { terminal }),
  });
  const corsOrigin = allowedPetrinautOrigin(args.origin);
  args.response.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: terminal === undefined ? 'keep-alive' : 'close',
    vary: 'Origin',
    ...(corsOrigin === undefined ? {} : { 'access-control-allow-origin': corsOrigin }),
  });
  await writeChunk(args.response, serializePetrinautSseFrames(initialFrames));
  sentFiringCount = detail.petrinautReplayExport.transitionFirings.length;
  terminalSent = terminal !== undefined;
  if (terminalSent) {
    dispose(true);
    return;
  }

  initialized = true;
  if (dirty) enqueueRefresh();
}

function newPetrinautFrames(
  frames: readonly PetrinautStreamFrame[],
  sentFiringCount: number,
  terminalSent: boolean,
): readonly PetrinautStreamFrame[] {
  let seenFirings = 0;
  const next: PetrinautStreamFrame[] = [];
  for (const frame of frames) {
    if (frame.kind === 'transition_firing') {
      if (seenFirings >= sentFiringCount) next.push(frame);
      seenFirings += 1;
    } else if (frame.kind === 'terminal' && !terminalSent) {
      next.push(frame);
    }
  }
  return next;
}

function petrinautTerminalFromDetail(detail: {
  readonly status?: string;
  readonly abandonReason?: string;
  readonly petriProjection?: { readonly terminalEventKind?: string; readonly haltedReason?: string };
}): { readonly state: PetrinautTerminalState; readonly reason?: string } | undefined {
  if (detail.status === 'promotion_prepared') return { state: 'completed' };
  if (detail.status === 'abandoned') {
    return {
      state: 'halted',
      ...(detail.abandonReason === undefined ? {} : { reason: detail.abandonReason }),
    };
  }
  switch (detail.petriProjection?.terminalEventKind) {
    case 'net_completed':
      return { state: 'completed' };
    case 'net_halted':
      return {
        state: 'halted',
        ...(detail.petriProjection.haltedReason === undefined
          ? {}
          : { reason: detail.petriProjection.haltedReason }),
      };
    case 'net_deadlocked':
      return { state: 'deadlocked' };
    default:
      return undefined;
  }
}

function allowedPetrinautOrigin(origin: string | undefined): string | undefined {
  if (origin === undefined) return undefined;
  const resolved = resolvePetrinautUrl({ env: process.env });
  if ('error' in resolved) return undefined;
  return new URL(resolved.url).origin === origin ? origin : undefined;
}

function writeChunk(response: ServerResponse, chunk: string): Promise<void> {
  if (response.writableEnded || response.write(chunk)) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = (): void => {
      response.off('drain', finish);
      response.off('close', finish);
      resolve();
    };
    response.once('drain', finish);
    response.once('close', finish);
  });
}
