/**
 * Companion React over the production TUI PTY.
 *
 * A real `runBrunchTui` boots inside a PTY (through `src/dev/tui-driver`, the
 * sole PTY surface) and the production React app attaches to its web sidecar
 * over a real WebSocket, speaking only canonical target-addressed Brunch
 * semantic RPC. A turn typed into the real Pi editor must reach the browser as
 * semantic deltas and, at `agent_settled`, the rendered transcript must equal a
 * fresh canonical-JSONL projection computed independently by this parent.
 *
 * Nothing here drives the turn from the browser: the PTY keyboard is the only
 * driver, so the companion is proved as an observer of the TUI-owned session.
 *
 * The DOM is installed at runtime rather than by declaring jsdom as this file's
 * vitest environment. That declaration also switches Vite to its client
 * transform, which rewrites `src/dev/tui-driver`'s
 * `new URL('./driver.exp', import.meta.url)` into a served asset URL and breaks
 * the PTY spawn. Booting vitest's own jsdom environment from here keeps the
 * node transform for the driver while giving React the same DOM globals.
 * (Do not name that docblock directive in this comment — vitest scans the file
 * for it and would switch the environment back.)
 */

import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createElement } from 'react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { builtinEnvironments } from 'vitest/runtime';
import { WebSocket } from 'ws';

import { removeSession, sendKeys, sendText, stopSession } from '../../dev/tui-driver.js';
import type { SessionPresentationEntry } from '../../projections/session/session-presentation.js';
import { projectSessionPresentationFile } from '../../projections/session/session-presentation.js';
import type { WorkspaceState } from '../../projections/workspace/workspace-state.js';
import type { LiveSessionEvent, SessionTarget } from '../../session/live-session-host.js';
import { inspectCanonicalSessionFiles } from '../../session/workspace-session-coordinator/canonical-session-files.js';
import {
  createWebSocketRpcClient,
  type WebSocketRpcClient,
  type WebSocketRpcNotification,
} from '../../web/rpc-client.js';
import {
  BOOT_TIMEOUT_MS,
  TURN_TIMEOUT_MS,
  dismissModeChooser,
  quitAndAwaitExit,
  requireScreen,
  sessionWriterLockExists,
  startProductionTui,
  waitForScreen,
} from './session-runtime-contract-pty-journey.js';
import {
  TRACER_PROBE_PROMPT,
  TRACER_PROBE_REPLY,
  TRACER_REPORT_FILE,
  type ProductionTracerReport,
} from './session-runtime-contract-tracer-support.js';

// Both the React testing library and the web app read `document` while their
// modules evaluate, so the DOM has to exist before they are imported.
const jsdomEnvironment = await builtinEnvironments.jsdom.setup(globalThis, {});
const { cleanup, render, screen, waitFor } = await import('@testing-library/react');
const { BrunchWebApp, createBrunchWebRuntime } = await import('../../web/app.js');

/**
 * `ws` types its `addEventListener` as a per-event overload set, which does not
 * structurally satisfy the client's generic `(event: string, listener)` port
 * even though the runtime behaviour is exactly what the port asks for. Name the
 * conversion once, here, rather than casting at the call site.
 */
type RpcWebSocketConstructor = NonNullable<Parameters<typeof createWebSocketRpcClient>[0]['WebSocketImpl']>;
const RpcWebSocket = WebSocket as unknown as RpcWebSocketConstructor;

const ATTACH_TIMEOUT_MS = 30_000;
const CONVERGENCE_TIMEOUT_MS = 30_000;
/** Footer chrome the real Pi editor keeps rendering once the model resolves. */
const EDITOR_FOOTER = /model brunch-faux-model/u;

interface TranscriptMessage {
  readonly role: string;
  readonly text: string;
}

interface CompanionJourney {
  readonly target: SessionTarget;
  readonly workspaceState: WorkspaceState;
  readonly canonicalTargets: readonly SessionTarget[];
  readonly openResult: unknown;
  readonly notifications: readonly WebSocketRpcNotification[];
  readonly outboundMethods: readonly string[];
  readonly settledTranscriptText: string;
  readonly renderedMessages: readonly TranscriptMessage[];
  readonly renderedEntryCount: number;
  readonly freshMessages: readonly TranscriptMessage[];
  readonly freshEntryCount: number;
  readonly freshProjectionLagMs: number;
  readonly messagesBeforeDetach: readonly TranscriptMessage[];
  readonly messagesAfterDetach: readonly TranscriptMessage[];
  readonly editorRenderedAfterDetach: boolean;
  readonly aliveAfterQuit: boolean;
  readonly writerLockExists: boolean;
}

/**
 * The production client, with an outbound-method ledger so the observer-only
 * claim is checked against what the browser actually sent rather than against
 * the absence of a UI affordance.
 */
function recordOutbound(client: WebSocketRpcClient): {
  readonly client: WebSocketRpcClient;
  readonly methods: readonly string[];
} {
  const methods: string[] = [];
  return {
    methods,
    client: {
      request<T>(method: string, params?: unknown): Promise<T> {
        methods.push(method);
        return client.request<T>(method, params);
      },
      subscribe: (listener) => client.subscribe(listener),
      subscribeSessionEvents: (target, handler, options) =>
        client.subscribeSessionEvents(target, handler, options),
      close: () => client.close(),
    },
  };
}

/** The parent's independent truth: production reader plus production projector. */
async function freshCanonicalProjection(cwd: string): Promise<{
  readonly target: SessionTarget;
  readonly entries: readonly SessionPresentationEntry[];
}> {
  const [only] = await inspectCanonicalSessionFiles(cwd);
  if (!only?.available) throw new Error('production TUI left no readable canonical session');
  const target = { specId: only.specId, sessionId: only.id };
  const projection = await projectSessionPresentationFile({ target, sessionFile: only.file });
  if (projection.status !== 'ready') {
    throw new Error(`canonical projection was ${projection.status}, not ready`);
  }
  return { target, entries: projection.presentation.entries };
}

function projectionMessages(entries: readonly SessionPresentationEntry[]): TranscriptMessage[] {
  return entries.flatMap((entry) =>
    entry.kind === 'message' ? [{ role: entry.role, text: entry.text }] : [],
  );
}

function transcriptList(): HTMLElement {
  return screen.getByRole('list', { name: 'Session transcript' });
}

/**
 * Message entries as the browser actually shows them. Each renders as
 * `<strong>{role}</strong>: {text}`, so the role prefix plus its separator is
 * stripped back off rather than re-deriving text from React internals.
 */
function renderedMessages(): TranscriptMessage[] {
  return [...transcriptList().querySelectorAll(':scope > li > p')].flatMap((paragraph) => {
    const role = paragraph.querySelector('strong')?.textContent;
    if (!role) return [];
    return [{ role, text: (paragraph.textContent ?? '').slice(role.length + 2) }];
  });
}

function liveSessionDeltas(notifications: readonly WebSocketRpcNotification[]): LiveSessionEvent['delta'][] {
  return notifications.flatMap((notification) =>
    notification.method === 'brunch.liveSessionEvent'
      ? [(notification.params as LiveSessionEvent).delta]
      : [],
  );
}

/**
 * One PTY + browser journey feeds every leaf. Booting the real product under a
 * PTY is the expensive part; re-running it per assertion would buy nothing but
 * minutes.
 */
async function driveCompanionJourney(): Promise<CompanionJourney> {
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-companion-pty-'));
  const agentDir = await mkdtemp(join(tmpdir(), 'brunch-companion-pty-agent-'));
  const reportPath = join(agentDir, TRACER_REPORT_FILE);
  const name = `companion-pty-${randomUUID()}`;

  await startProductionTui({ name, cwd, agentDir, reportPath });

  let rpcClient: WebSocketRpcClient | undefined;
  try {
    await requireScreen(name, 'Welcome to Brunch.', BOOT_TIMEOUT_MS);
    await dismissModeChooser(name);

    const report = JSON.parse(await readFile(reportPath, 'utf8')) as ProductionTracerReport;
    if (report.status !== 'ready') throw new Error(`production TUI reported ${report.status}`);

    // Production transport only: jsdom's own WebSocket is never used, so the
    // frames below are the same ones a browser would receive.
    const notifications: WebSocketRpcNotification[] = [];
    rpcClient = createWebSocketRpcClient({
      url: `ws://${new URL(report.webSidecarUrl).host}/rpc`,
      WebSocketImpl: RpcWebSocket,
    });
    const recording = recordOutbound(rpcClient);
    recording.client.subscribe((notification) => notifications.push(notification));

    const workspaceState = await recording.client.request<WorkspaceState>('workspace.state');
    if (workspaceState.status !== 'ready' || !workspaceState.spec || !workspaceState.session) {
      throw new Error(`web sidecar workspace.state was ${workspaceState.status}`);
    }
    const target = { specId: workspaceState.spec.id, sessionId: workspaceState.session.id };
    const canonical = await freshCanonicalProjection(cwd);
    const openResult = await recording.client.request('session.open', target);

    window.history.pushState(null, '', `/session/${target.specId}/${target.sessionId}`);
    const runtime = createBrunchWebRuntime({ rpcClient: recording.client });
    render(createElement(BrunchWebApp, { runtime }));
    await waitFor(() => expect(transcriptList()).toBeDefined(), { timeout: ATTACH_TIMEOUT_MS });

    // The turn is typed into the real Pi editor; the browser only watches.
    sendText(name, TRACER_PROBE_PROMPT);
    if (!(await waitForScreen(name, TRACER_PROBE_PROMPT, ATTACH_TIMEOUT_MS)).matched) {
      throw new Error('production Pi editor never echoed the typed prompt');
    }
    sendKeys(name, ['Enter']);
    await requireScreen(name, TRACER_PROBE_REPLY, TURN_TIMEOUT_MS);

    await waitFor(
      () =>
        expect(liveSessionDeltas(notifications).some((delta) => delta.type === 'agent_settled')).toBe(true),
      { timeout: CONVERGENCE_TIMEOUT_MS },
    );

    // Bounded retry on the parent-computed fresh projection. If the canonical
    // JSONL lags settlement, that is a production I65-L finding for the TUI
    // composition — not something to sleep past.
    const settledAt = Date.now();
    let fresh = await freshCanonicalProjection(cwd);
    while (
      !projectionMessages(fresh.entries).some((message) => message.text.includes(TRACER_PROBE_REPLY)) &&
      Date.now() - settledAt < CONVERGENCE_TIMEOUT_MS
    ) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      fresh = await freshCanonicalProjection(cwd);
    }
    const freshProjectionLagMs = Date.now() - settledAt;

    await waitFor(() => expect(transcriptList().textContent ?? '').toContain(TRACER_PROBE_REPLY), {
      timeout: CONVERGENCE_TIMEOUT_MS,
    });

    const settledTranscriptText = transcriptList().textContent ?? '';
    const settled = {
      renderedMessages: renderedMessages(),
      renderedEntryCount: transcriptList().querySelectorAll(':scope > li').length,
    };
    const freshAtSettlement = await freshCanonicalProjection(cwd);
    const messagesBeforeDetach = projectionMessages(freshAtSettlement.entries);

    // Detach: the browser goes away, the TUI-owned session must not.
    cleanup();
    runtime.dispose();
    const editorRenderedAfterDetach = (await waitForScreen(name, EDITOR_FOOTER, ATTACH_TIMEOUT_MS)).matched;
    const messagesAfterDetach = projectionMessages((await freshCanonicalProjection(cwd)).entries);

    const aliveAfterQuit = await quitAndAwaitExit(name);
    const writerLockExists = await sessionWriterLockExists(cwd, target);

    removeSession(name, { force: false });
    return {
      target,
      workspaceState,
      canonicalTargets: [canonical.target],
      openResult,
      notifications,
      outboundMethods: recording.methods,
      settledTranscriptText,
      ...settled,
      freshMessages: projectionMessages(freshAtSettlement.entries),
      freshEntryCount: freshAtSettlement.entries.length,
      freshProjectionLagMs,
      messagesBeforeDetach,
      messagesAfterDetach,
      editorRenderedAfterDetach,
      aliveAfterQuit,
      writerLockExists,
    };
  } finally {
    cleanup();
    rpcClient?.close();
    await stopSession(name);
    removeSession(name, { force: true });
    await rm(cwd, { recursive: true, force: true });
    await rm(agentDir, { recursive: true, force: true });
  }
}

describe('companion React over the production TUI PTY', () => {
  let journey: CompanionJourney;

  beforeAll(async () => {
    journey = await driveCompanionJourney();
  }, 300_000);

  afterAll(async () => {
    await jsdomEnvironment.teardown(globalThis);
  });

  it('companion attach — the browser reaches the TUI-owned target through production RPC only', () => {
    expect(journey.workspaceState.status).toBe('ready');
    expect(journey.workspaceState.spec).not.toBeNull();
    expect(journey.workspaceState.session).toBeDefined();
    // The durable target the browser addressed is the one canonical JSONL the
    // TUI process left behind, not a host-local handle.
    expect(journey.canonicalTargets).toEqual([journey.target]);
    // `attached`, never `opened`: the sidecar adapts the InteractiveMode-owned
    // session instead of constructing a second runtime.
    expect(journey.openResult).toEqual({ status: 'attached' });
  });

  it('semantic-only transport — no raw Pi frame reaches the companion client', () => {
    const methods = new Set(journey.notifications.map((notification) => notification.method));
    expect(methods.has('brunch.sessionEvent')).toBe(false);
    expect(
      [...methods].every((method) => method === 'brunch.liveSessionEvent' || method === 'brunch.updated'),
    ).toBe(true);
    for (const notification of journey.notifications) {
      if (notification.method !== 'brunch.liveSessionEvent') continue;
      expect((notification.params as LiveSessionEvent).target).toEqual(journey.target);
    }
  });

  it('TUI-driven turn arrives as semantic deltas — assistant_text_delta carries the reply', () => {
    const deltas = liveSessionDeltas(journey.notifications);
    const text = deltas
      .flatMap((delta) => (delta.type === 'assistant_text_delta' ? [delta.text] : []))
      .join('');
    expect(text).toContain(TRACER_PROBE_REPLY);
    expect(deltas.findIndex((delta) => delta.type === 'agent_settled')).toBeGreaterThan(
      deltas.findIndex((delta) => delta.type === 'assistant_text_delta'),
    );
  });

  it('observer-only — the companion never drove the turn', () => {
    expect(journey.outboundMethods).not.toContain('session.driveTurn');
    expect(journey.outboundMethods).not.toContain('session.answerExchange');
    expect(journey.outboundMethods).toContain('session.presentation');
  });

  it('companion React renders the TUI turn', () => {
    expect(journey.settledTranscriptText).toContain(TRACER_PROBE_PROMPT);
    expect(journey.settledTranscriptText).toContain(TRACER_PROBE_REPLY);
  });

  it('settled convergence — the rendered transcript equals a fresh canonical-JSONL projection', () => {
    // Pinned, so the comparison below cannot pass by both sides being empty.
    expect(journey.renderedMessages).toEqual([
      { role: 'user', text: TRACER_PROBE_PROMPT },
      { role: 'assistant', text: TRACER_PROBE_REPLY },
    ]);
    expect(journey.renderedMessages).toEqual(journey.freshMessages);
    // No live-overlay residue: the browser is showing the durable projection
    // and nothing else.
    expect(journey.renderedEntryCount).toBe(journey.freshEntryCount);
    // The canonical JSONL was current at settlement rather than lagging past
    // the bounded retry — the I65-L claim this composition has to hold.
    expect(journey.freshProjectionLagMs).toBeLessThan(CONVERGENCE_TIMEOUT_MS);
  });

  it('detach is inert — unmounting the companion does not disturb the TUI-owned session', () => {
    expect(journey.editorRenderedAfterDetach).toBe(true);
    expect(journey.messagesAfterDetach.slice(0, journey.messagesBeforeDetach.length)).toEqual(
      journey.messagesBeforeDetach,
    );
  });

  it('journey cleanup — Ctrl-D with a companion attached still releases the writer lock', () => {
    expect(journey.aliveAfterQuit).toBe(false);
    expect(journey.writerLockExists).toBe(false);
  });
});
