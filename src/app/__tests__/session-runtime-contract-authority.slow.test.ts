/**
 * Writer authority under contention over the production TUI PTY.
 *
 * The landed companion and structured-ask witnesses prove what a second
 * composition may *observe*. This one proves who is allowed to *write*: while a
 * real `runBrunchTui` holds the per-target writer lock inside a PTY, a
 * production standalone-web composition booted in this parent process is
 * refused the same durable target by the fail-closed writer guard before any
 * second runtime exists — and the incumbent completes a further ordinary turn
 * afterwards. Then Ctrl-D releases ownership and the same standalone-web
 * composition takes the target over, continuing the TUI's own canonical JSONL
 * rather than starting a second one.
 *
 * Both halves are exercised through the production path only (`runBrunchWeb`
 * plus the browser's own `createWebSocketRpcClient` over `/rpc`), never by
 * calling `acquireSessionWriter`, `createStandaloneSessionRuntime`, or
 * `SessionManager.open` directly, so what is proved here is what a second
 * Brunch window would actually meet.
 *
 * This file must stay DOM-free. Declaring a browser environment for it also
 * switches Vite to its client transform, which rewrites `src/dev/tui-driver`'s
 * `new URL('./driver.exp', import.meta.url)` into a served asset URL and breaks
 * the PTY spawn — and vitest decides that from the file text, so even naming
 * that declaration in a comment would switch it back. Nothing here renders
 * React: do not import `@testing-library/react` or vitest's built-in
 * environments.
 */

import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { fauxAssistantMessage, type FauxProviderRegistration } from '@earendil-works/pi-ai';
import { registerFauxProvider } from '@earendil-works/pi-ai/compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { removeSession, stopSession } from '../../dev/tui-driver.js';
import { createBrunchFauxModelRuntime, defaultBrunchFauxModel } from '../../probes/faux-provider.js';
import type {
  SessionPresentationEntry,
  SessionPresentationResult,
} from '../../projections/session/session-presentation.js';
import { projectSessionPresentationFile } from '../../projections/session/session-presentation.js';
import type { WorkspaceState } from '../../projections/workspace/workspace-state.js';
import type { RunningWebHost } from '../../rpc/web-host.js';
import type { LiveSessionHostResult, SessionTarget } from '../../session/live-session-host.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';
import { inspectCanonicalSessionFiles } from '../../session/workspace-session-coordinator/canonical-session-files.js';
import {
  createWebSocketRpcClient,
  JsonRpcClientError,
  type WebSocketRpcClient,
} from '../../web/rpc-client.js';
import type { BrunchAgentServicesOverride } from '../brunch-tui.js';
import { runBrunchWeb } from '../brunch-web.js';
import {
  BOOT_TIMEOUT_MS,
  TURN_TIMEOUT_MS,
  dismissModeChooser,
  quitAndAwaitExit,
  readSessionWriterOwnerRecord,
  requireScreen,
  sessionWriterLockExists,
  startProductionTui,
  typeAndSubmit,
} from './session-runtime-contract-pty-journey.js';
import {
  TRACER_PROBE_PROMPT,
  TRACER_PROBE_REPLY,
  TRACER_REOPEN_OPENING_REPLY,
  TRACER_REOPEN_PROMPT,
  TRACER_REOPEN_REPLY,
  TRACER_REPORT_FILE,
  TRACER_RIVAL_PROMPT,
  TRACER_RIVAL_REPLY,
} from './session-runtime-contract-tracer-support.js';

/** See the companion witness: `ws` satisfies the client port structurally, not nominally. */
type RpcWebSocketConstructor = NonNullable<Parameters<typeof createWebSocketRpcClient>[0]['WebSocketImpl']>;
const RpcWebSocket = WebSocket as unknown as RpcWebSocketConstructor;

const ECHO_TIMEOUT_MS = 30_000;
const CONVERGENCE_TIMEOUT_MS = 30_000;
/** Live-event silence that counts as "the standalone composition has settled". */
const LIVE_QUIET_MS = 2_000;
/** File-unique, so the registration cannot collide with another suite's in this process. */
const REOPEN_PROVIDER_API_SUFFIX = 'authority-reopen';

interface TranscriptMessage {
  readonly role: string;
  readonly text: string;
}

/** Durable truth as the parent reads it, independently of any running host. */
interface CanonicalSnapshot {
  readonly sessionCount: number;
  readonly availableCount: number;
  readonly target: SessionTarget;
  readonly file: string;
  readonly jsonl: string;
}

interface AuthorityJourney {
  readonly rivalHostUrl: string;
  readonly rivalWorkspaceStatus: string;
  readonly rivalOpenRefused: boolean;
  readonly rivalOpenOutcome: unknown;
  readonly beforeProbe: CanonicalSnapshot;
  readonly afterProbe: CanonicalSnapshot;
  readonly ownerRecordBeforeProbe: string | undefined;
  readonly ownerRecordAfterProbe: string | undefined;
  readonly rivalReplyScreen: readonly string[];
  readonly aliveAfterQuit: boolean;
  readonly jsonlAfterQuit: string;
  readonly writerLockExistsAfterQuit: boolean;
  readonly reopenOpenResult: unknown;
  readonly reopenOwnerRecord: string | undefined;
  readonly reopenSnapshot: CanonicalSnapshot;
  readonly reopenPresentationMessages: readonly TranscriptMessage[];
  readonly reopenDriveResult: LiveSessionHostResult;
  readonly jsonlAfterDrivenTurn: string;
  readonly sessionsAfterDrivenTurn: number;
  readonly settledPresentationMessages: readonly TranscriptMessage[];
  readonly settledPresentationEntryCount: number;
  readonly freshProjectionMessages: readonly TranscriptMessage[];
  readonly freshProjectionEntryCount: number;
  readonly writerLockExistsAfterHostClose: boolean;
}

async function canonicalSnapshot(cwd: string): Promise<CanonicalSnapshot> {
  const sessions = await inspectCanonicalSessionFiles(cwd);
  const [first] = sessions;
  if (!first?.available) throw new Error('production TUI left no readable canonical session');
  return {
    sessionCount: sessions.length,
    availableCount: sessions.filter((session) => session.available).length,
    target: { specId: first.specId, sessionId: first.id },
    file: first.file,
    jsonl: await readFile(first.file, 'utf8'),
  };
}

function jsonlMessages(jsonl: string): TranscriptMessage[] {
  return jsonl
    .trim()
    .split('\n')
    .flatMap((line) => {
      const entry = JSON.parse(line) as { type?: string; message?: { role?: string; content?: unknown } };
      const message = entry.message;
      if (entry.type !== 'message' || !message?.role || !Array.isArray(message.content)) return [];
      return [
        {
          role: message.role,
          text: message.content
            .flatMap((part: { type?: string; text?: string }) =>
              part.type === 'text' && typeof part.text === 'string' ? [part.text] : [],
            )
            .join('\n'),
        },
      ];
    });
}

function projectionMessages(entries: readonly SessionPresentationEntry[]): TranscriptMessage[] {
  return entries.flatMap((entry) =>
    entry.kind === 'message' ? [{ role: entry.role, text: entry.text }] : [],
  );
}

function readyPresentation(result: SessionPresentationResult): readonly SessionPresentationEntry[] {
  if (result.status !== 'ready') throw new Error(`session.presentation was ${result.status}, not ready`);
  return result.presentation.entries;
}

/**
 * A standalone `session.open` may fire its own orientation kick, and whether it
 * does so on a session that already has history is one of the things this
 * witness is here to observe — so neither branch may be assumed. Wait for the
 * live event stream to fall silent instead, which covers both.
 */
async function waitForLiveQuiet(frameCount: () => number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let seen = frameCount();
  let quietSince = Date.now();
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const now = frameCount();
    if (now !== seen) {
      seen = now;
      quietSince = Date.now();
      continue;
    }
    if (Date.now() - quietSince >= LIVE_QUIET_MS) return;
  }
  throw new Error('standalone composition never fell quiet after session.open');
}

/**
 * The parent's own deterministic backend for the reopen leg. The PTY child's
 * provider died with the TUI, so the transferred target is driven by a
 * content-addressed responder registered here — same discipline as the child's,
 * so no ordering accident can make the driven turn pass.
 */
async function registerReopenProvider(): Promise<{
  readonly provider: FauxProviderRegistration;
  readonly agentServices: BrunchAgentServicesOverride;
}> {
  const model = defaultBrunchFauxModel();
  const provider = registerFauxProvider({
    provider: model.provider,
    api: `${model.api}-${REOPEN_PROVIDER_API_SUFFIX}`,
    models: [{ id: model.modelId, name: model.modelName, input: ['text'] }],
  });
  provider.setResponses(
    Array.from(
      { length: 8 },
      () => (context: unknown) =>
        JSON.stringify(context).includes(TRACER_REOPEN_PROMPT)
          ? fauxAssistantMessage(TRACER_REOPEN_REPLY)
          : fauxAssistantMessage(TRACER_REOPEN_OPENING_REPLY),
    ),
  );
  const { modelRuntime, registeredModel } = await createBrunchFauxModelRuntime(model, provider);
  return { provider, agentServices: { modelRuntime, model: registeredModel } };
}

/**
 * The parent must not resolve the developer's real Pi agent directory:
 * `getAgentDir()` reads this variable at call time, and a standalone
 * composition booted here would otherwise reach real machine state. Nothing
 * else enforces it, and the PTY child only gets the scratch dir because
 * `startProductionTui` passes it on the command line.
 */
function applyScratchPiEnvironment(agentDir: string): () => void {
  const previous = {
    PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR,
    PI_OFFLINE: process.env.PI_OFFLINE,
  };
  process.env.PI_CODING_AGENT_DIR = agentDir;
  process.env.PI_OFFLINE = '1';
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

/**
 * One PTY journey feeds every leaf. Booting the real product under a PTY is the
 * expensive part; re-running it per assertion would buy nothing but minutes.
 */
async function driveAuthorityJourney(): Promise<AuthorityJourney> {
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-authority-pty-'));
  const agentDir = await mkdtemp(join(tmpdir(), 'brunch-authority-pty-agent-'));
  const reportPath = join(agentDir, TRACER_REPORT_FILE);
  const name = `authority-pty-${randomUUID()}`;

  await startProductionTui({ name, cwd, agentDir, reportPath });

  // One pair of handles serves both web legs — the refused rival and the
  // successful reopen — so a failure anywhere strands neither port nor lock.
  let webHost: RunningWebHost | undefined;
  let webClient: WebSocketRpcClient | undefined;
  let reopenProvider: FauxProviderRegistration | undefined;
  try {
    await requireScreen(name, 'Welcome to Brunch.', BOOT_TIMEOUT_MS);
    await dismissModeChooser(name);

    // One ordinary TUI turn first, so the contested target carries durable
    // TUI-era truth rather than only a lock.
    await typeAndSubmit(name, TRACER_PROBE_PROMPT, ECHO_TIMEOUT_MS);
    await requireScreen(name, TRACER_PROBE_REPLY, TURN_TIMEOUT_MS);

    const beforeProbe = await canonicalSnapshot(cwd);
    const target = beforeProbe.target;
    const ownerRecordBeforeProbe = await readSessionWriterOwnerRecord(cwd, target);

    const restorePiEnvironment = applyScratchPiEnvironment(agentDir);
    let rivalHostUrl: string;
    let rivalWorkspaceStatus: string;
    let rivalOpen: { readonly refused: boolean; readonly outcome: unknown };
    try {
      // No `agentServices`: a refusal that lands before runtime construction
      // cannot need a provider backend, and withholding one keeps the
      // no-second-runtime leaf from being satisfiable by a working runtime.
      const host = await runBrunchWeb({ cwd, coordinator: createWorkspaceSessionCoordinator({ cwd }) });
      webHost = host;
      rivalHostUrl = host.url;
      const client = createWebSocketRpcClient({
        url: `${host.url.replace(/^http/u, 'ws')}/rpc`,
        WebSocketImpl: RpcWebSocket,
      });
      webClient = client;
      // A real request round-trip, not just a socket: the host is only proved
      // startable if it answers production RPC over its own /rpc.
      rivalWorkspaceStatus = (await client.request<WorkspaceState>('workspace.state')).status;
      rivalOpen = await client.request('session.open', target).then(
        (outcome: unknown) => ({ refused: false, outcome }),
        (outcome: unknown) => ({ refused: true, outcome }),
      );
    } finally {
      restorePiEnvironment();
    }

    const afterProbe = await canonicalSnapshot(cwd);
    const ownerRecordAfterProbe = await readSessionWriterOwnerRecord(cwd, target);

    // Release the rival before the incumbent's next turn, so a stranded port or
    // half-open socket cannot be mistaken for continued contention pressure.
    webClient?.close();
    webClient = undefined;
    await webHost?.close();
    webHost = undefined;

    await typeAndSubmit(name, TRACER_RIVAL_PROMPT, ECHO_TIMEOUT_MS);
    const rivalReplyScreen = await requireScreen(name, TRACER_RIVAL_REPLY, TURN_TIMEOUT_MS);

    const aliveAfterQuit = await quitAndAwaitExit(name);
    const afterQuit = await canonicalSnapshot(cwd);
    const writerLockExistsAfterQuit = await sessionWriterLockExists(cwd, target);

    // Transfer leg: the TUI is gone and the lock is free, so a production
    // standalone-web composition must take the same durable target over and
    // continue its one canonical JSONL rather than starting a second.
    const restoreReopenEnvironment = applyScratchPiEnvironment(agentDir);
    let reopenOpenResult: unknown;
    let reopenOwnerRecord: string | undefined;
    let reopenSnapshot: CanonicalSnapshot;
    let reopenPresentationMessages: readonly TranscriptMessage[];
    let reopenDriveResult: LiveSessionHostResult;
    let jsonlAfterDrivenTurn: string;
    let sessionsAfterDrivenTurn: number;
    let settledPresentation: readonly SessionPresentationEntry[];
    let freshProjection: readonly SessionPresentationEntry[];
    let writerLockExistsAfterHostClose: boolean;
    try {
      const registration = await registerReopenProvider();
      reopenProvider = registration.provider;
      const host = await runBrunchWeb({
        cwd,
        coordinator: createWorkspaceSessionCoordinator({ cwd }),
        agentServices: registration.agentServices,
      });
      webHost = host;
      const client = createWebSocketRpcClient({
        url: `${host.url.replace(/^http/u, 'ws')}/rpc`,
        WebSocketImpl: RpcWebSocket,
      });
      webClient = client;
      let liveFrames = 0;
      client.subscribe(() => {
        liveFrames += 1;
      });

      reopenOpenResult = await client.request('session.open', target);
      reopenOwnerRecord = await readSessionWriterOwnerRecord(cwd, target);
      reopenSnapshot = await canonicalSnapshot(cwd);
      await waitForLiveQuiet(() => liveFrames, CONVERGENCE_TIMEOUT_MS);
      reopenPresentationMessages = projectionMessages(
        readyPresentation(await client.request<SessionPresentationResult>('session.presentation', target)),
      );

      reopenDriveResult = await client.request<LiveSessionHostResult>('session.driveTurn', {
        ...target,
        driverId: 'standalone-web-takeover',
        prompt: TRACER_REOPEN_PROMPT,
      });

      // Bounded retry on the parent-computed truth. A canonical JSONL that lags
      // settlement is a production I65-L finding, not something to sleep past.
      const settledAt = Date.now();
      let fresh = await projectSessionPresentationFile({ target, sessionFile: afterQuit.file });
      while (
        !projectionMessages(readyPresentation(fresh)).some(
          (message) => message.text === TRACER_REOPEN_REPLY,
        ) &&
        Date.now() - settledAt < CONVERGENCE_TIMEOUT_MS
      ) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        fresh = await projectSessionPresentationFile({ target, sessionFile: afterQuit.file });
      }
      freshProjection = readyPresentation(fresh);
      settledPresentation = readyPresentation(
        await client.request<SessionPresentationResult>('session.presentation', target),
      );
      const afterDrivenTurn = await canonicalSnapshot(cwd);
      jsonlAfterDrivenTurn = afterDrivenTurn.jsonl;
      sessionsAfterDrivenTurn = afterDrivenTurn.availableCount;

      client.close();
      webClient = undefined;
      await host.close();
      webHost = undefined;
      writerLockExistsAfterHostClose = await sessionWriterLockExists(cwd, target);
    } finally {
      restoreReopenEnvironment();
    }

    removeSession(name, { force: false });
    return {
      reopenOpenResult,
      reopenOwnerRecord,
      reopenSnapshot,
      reopenPresentationMessages,
      reopenDriveResult,
      jsonlAfterDrivenTurn,
      sessionsAfterDrivenTurn,
      settledPresentationMessages: projectionMessages(settledPresentation),
      settledPresentationEntryCount: settledPresentation.length,
      freshProjectionMessages: projectionMessages(freshProjection),
      freshProjectionEntryCount: freshProjection.length,
      writerLockExistsAfterHostClose,
      rivalHostUrl,
      rivalWorkspaceStatus,
      rivalOpenRefused: rivalOpen.refused,
      rivalOpenOutcome: rivalOpen.outcome,
      beforeProbe,
      afterProbe,
      ownerRecordBeforeProbe,
      ownerRecordAfterProbe,
      rivalReplyScreen,
      aliveAfterQuit,
      jsonlAfterQuit: afterQuit.jsonl,
      writerLockExistsAfterQuit,
    };
  } finally {
    webClient?.close();
    await webHost?.close();
    reopenProvider?.unregister();
    await stopSession(name);
    removeSession(name, { force: true });
    await rm(cwd, { recursive: true, force: true });
    await rm(agentDir, { recursive: true, force: true });
  }
}

describe('writer authority under contention over the production TUI PTY', () => {
  let journey: AuthorityJourney;

  beforeAll(async () => {
    journey = await driveAuthorityJourney();
  }, 300_000);

  it('rival — a standalone web host may start against a TUI-owned cwd', () => {
    // D141-L keeps two legitimate compositions: starting a host is not itself a
    // writer claim, so only opening the target may be refused.
    expect(journey.rivalHostUrl).toMatch(/^http:\/\//u);
    expect(journey.rivalWorkspaceStatus).toBe('ready');
  });

  it('rival — session.open on the TUI-owned target is refused by the writer guard', () => {
    expect(journey.rivalOpenRefused).toBe(true);
    expect(journey.rivalOpenOutcome).toBeInstanceOf(JsonRpcClientError);
    const rejection = journey.rivalOpenOutcome as JsonRpcClientError;
    expect(rejection.code).toBe(-32020);
    // Error identity, not merely presence. A target-lookup, schema, or host
    // wiring failure would also reject here and must not read as a writer-guard
    // refusal.
    expect(rejection.message).toMatch(/already has a writer/u);
  });

  it('rival — no second runtime and no second session are constructed', () => {
    expect(journey.beforeProbe.sessionCount).toBe(1);
    expect(journey.beforeProbe.availableCount).toBe(1);
    expect(journey.afterProbe.sessionCount).toBe(1);
    expect(journey.afterProbe.availableCount).toBe(1);
    expect(journey.afterProbe.file).toBe(journey.beforeProbe.file);
    expect(Buffer.byteLength(journey.afterProbe.jsonl)).toBe(Buffer.byteLength(journey.beforeProbe.jsonl));
  });

  it('rival — the incumbent lock is neither stolen nor re-acquired', () => {
    expect(journey.ownerRecordBeforeProbe).toBeDefined();
    expect(journey.ownerRecordAfterProbe).toBe(journey.ownerRecordBeforeProbe);
    // Cross-process incumbency, stated explicitly: the lock belongs to the PTY
    // child, so the composition refused above was an honest rival rather than
    // this process conflicting with itself.
    const owner = JSON.parse(journey.ownerRecordBeforeProbe ?? 'null') as { pid?: unknown };
    expect(typeof owner.pid).toBe('number');
    expect(owner.pid).not.toBe(process.pid);
  });

  it('contention — the TUI completes a further ordinary turn afterwards', () => {
    expect(journey.rivalReplyScreen.join('\n')).toContain(TRACER_RIVAL_REPLY);
    expect(jsonlMessages(journey.jsonlAfterQuit)).toEqual([
      { role: 'user', text: TRACER_PROBE_PROMPT },
      { role: 'assistant', text: TRACER_PROBE_REPLY },
      { role: 'user', text: TRACER_RIVAL_PROMPT },
      { role: 'assistant', text: TRACER_RIVAL_REPLY },
    ]);
  });

  it('cleanup — Ctrl-D still ends the PTY and releases the target writer lock', () => {
    expect(journey.aliveAfterQuit).toBe(false);
    expect(journey.writerLockExistsAfterQuit).toBe(false);
  });

  it('reopen — the released target is acquirable by a standalone web composition', () => {
    // `opened`, not `attached`: this composition constructs the runtime the TUI
    // gave up, rather than adapting one that is already live.
    expect(journey.reopenOpenResult).toEqual({ status: 'opened' });
    expect(journey.reopenOwnerRecord).toBeDefined();
    const owner = JSON.parse(journey.reopenOwnerRecord ?? 'null') as { pid?: unknown };
    expect(owner.pid).toBe(process.pid);
  });

  it('reopen — the standalone opened the TUI’s own session file, not a new one', () => {
    expect(journey.reopenSnapshot.sessionCount).toBe(1);
    expect(journey.reopenSnapshot.availableCount).toBe(1);
    expect(journey.reopenSnapshot.file).toBe(journey.beforeProbe.file);
  });

  it('reopen — the TUI-era transcript survives the transfer', () => {
    const tuiEra = jsonlMessages(journey.jsonlAfterQuit);
    // Pinned, so the comparison below cannot pass by both sides being empty.
    expect(tuiEra).toHaveLength(4);
    expect(journey.reopenPresentationMessages.slice(0, tuiEra.length)).toEqual(tuiEra);
  });

  it('reopen — a driven turn appends to that same JSONL', () => {
    expect(journey.reopenDriveResult).toEqual({ status: 'completed' });
    const tuiEra = jsonlMessages(journey.jsonlAfterQuit);
    const messages = jsonlMessages(journey.jsonlAfterDrivenTurn);
    expect(messages.slice(0, tuiEra.length)).toEqual(tuiEra);
    expect(messages.slice(-2)).toEqual([
      { role: 'user', text: TRACER_REOPEN_PROMPT },
      { role: 'assistant', text: TRACER_REOPEN_REPLY },
    ]);
    // One truth store (D141-L): reopening extends the TUI's file textually. A
    // rewrite or truncation here is a stop-the-line respec signal, never a
    // reason to loosen this assertion.
    expect(journey.jsonlAfterDrivenTurn.startsWith(journey.jsonlAfterQuit)).toBe(true);
    expect(journey.sessionsAfterDrivenTurn).toBe(1);
  });

  it('reopen — session.presentation equals a parent-computed fresh projection at settlement', () => {
    // Supporting convergence check (I65-L) over the same file, not the primary
    // evidence: the host projects through the same reader the parent uses.
    expect(journey.settledPresentationMessages).toEqual(journey.freshProjectionMessages);
    expect(journey.settledPresentationEntryCount).toBe(journey.freshProjectionEntryCount);
  });

  it('reopen — closing the standalone host releases the writer lock again', () => {
    expect(journey.writerLockExistsAfterHostClose).toBe(false);
  });
});
