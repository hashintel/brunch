/**
 * Writer authority under contention over the production TUI PTY.
 *
 * The landed companion and structured-ask witnesses prove what a second
 * composition may *observe*. This one proves who is allowed to *write*: while a
 * real `runBrunchTui` holds the per-target writer lock inside a PTY, a
 * production standalone-web composition booted in this parent process is
 * refused the same durable target by the fail-closed writer guard before any
 * second runtime exists — and the incumbent completes a further ordinary turn
 * afterwards.
 *
 * The rival is exercised through the production path only (`runBrunchWeb` plus
 * the browser's own `createWebSocketRpcClient` over `/rpc`), never by calling
 * `acquireSessionWriter` directly, so the refusal proved here is the one a
 * second Brunch window would actually meet.
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

import { beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { removeSession, stopSession } from '../../dev/tui-driver.js';
import type { WorkspaceState } from '../../projections/workspace/workspace-state.js';
import type { RunningWebHost } from '../../rpc/web-host.js';
import type { SessionTarget } from '../../session/live-session-host.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';
import { inspectCanonicalSessionFiles } from '../../session/workspace-session-coordinator/canonical-session-files.js';
import {
  createWebSocketRpcClient,
  JsonRpcClientError,
  type WebSocketRpcClient,
} from '../../web/rpc-client.js';
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
  TRACER_REPORT_FILE,
  TRACER_RIVAL_PROMPT,
  TRACER_RIVAL_REPLY,
} from './session-runtime-contract-tracer-support.js';

/** See the companion witness: `ws` satisfies the client port structurally, not nominally. */
type RpcWebSocketConstructor = NonNullable<Parameters<typeof createWebSocketRpcClient>[0]['WebSocketImpl']>;
const RpcWebSocket = WebSocket as unknown as RpcWebSocketConstructor;

const ECHO_TIMEOUT_MS = 30_000;

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

  let rivalHost: RunningWebHost | undefined;
  let rivalClient: WebSocketRpcClient | undefined;
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
      rivalHost = host;
      rivalHostUrl = host.url;
      const client = createWebSocketRpcClient({
        url: `${host.url.replace(/^http/u, 'ws')}/rpc`,
        WebSocketImpl: RpcWebSocket,
      });
      rivalClient = client;
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
    rivalClient?.close();
    rivalClient = undefined;
    await rivalHost?.close();
    rivalHost = undefined;

    await typeAndSubmit(name, TRACER_RIVAL_PROMPT, ECHO_TIMEOUT_MS);
    const rivalReplyScreen = await requireScreen(name, TRACER_RIVAL_REPLY, TURN_TIMEOUT_MS);

    const aliveAfterQuit = await quitAndAwaitExit(name);
    const afterQuit = await canonicalSnapshot(cwd);
    const writerLockExistsAfterQuit = await sessionWriterLockExists(cwd, target);

    removeSession(name, { force: false });
    return {
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
    rivalClient?.close();
    await rivalHost?.close();
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
});
