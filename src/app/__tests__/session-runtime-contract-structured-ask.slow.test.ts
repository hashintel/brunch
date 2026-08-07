/**
 * Structured ask and TUI-only interaction over the production TUI PTY.
 *
 * The landed companion witness proves an ordinary turn. This one proves the two
 * interaction classes only the TUI can drive: an extension-owned structured
 * `ask`, which a real `InteractiveMode` collects through its own editor, and a
 * product command whose effect has no browser affordance at all.
 *
 * The ask is the interesting case. Under a real TUI the ask collector takes its
 * UI branch, so the ask never joins the live registry's answerable pending set.
 * It is *announced* instead: companion React sees one `ask_opened` delta and
 * renders the question live, a browser answer attempt is refused as
 * `ask_closed`, and the answer that reaches canonical truth is the one typed
 * into the TUI. One writable runtime therefore also means one answering
 * authority per open ask.
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
import type {
  LiveSessionEvent,
  LiveSessionHostResult,
  SessionTarget,
} from '../../session/live-session-host.js';
import { inspectCanonicalSessionFiles } from '../../session/workspace-session-coordinator/canonical-session-files.js';
import {
  createWebSocketRpcClient,
  type WebSocketRpcClient,
  type WebSocketRpcNotification,
} from '../../web/rpc-client.js';
import {
  BOOT_TIMEOUT_MS,
  TURN_TIMEOUT_MS,
  commitModeChoice,
  dismissModeChooser,
  quitAndAwaitExit,
  requireScreen,
  sessionWriterLockExists,
  startProductionTui,
  waitForScreen,
} from './session-runtime-contract-pty-journey.js';
import {
  TRACER_ASK_ANSWER,
  TRACER_ASK_BODY,
  TRACER_ASK_EXCHANGE_ID,
  TRACER_ASK_PROMPT,
  TRACER_ASK_REPLY,
  TRACER_REPORT_FILE,
  type ProductionTracerReport,
} from './session-runtime-contract-tracer-support.js';

const jsdomEnvironment = await builtinEnvironments.jsdom.setup(globalThis, {});
const { cleanup, render, screen, waitFor } = await import('@testing-library/react');
const { BrunchWebApp, createBrunchWebRuntime } = await import('../../web/app.js');

/** See the companion witness: `ws` satisfies the port structurally, not nominally. */
type RpcWebSocketConstructor = NonNullable<Parameters<typeof createWebSocketRpcClient>[0]['WebSocketImpl']>;
const RpcWebSocket = WebSocket as unknown as RpcWebSocketConstructor;

const ATTACH_TIMEOUT_MS = 30_000;
const CONVERGENCE_TIMEOUT_MS = 30_000;

/** The real ask editor's own help line — proof the TUI picker is still holding the ask. */
const ASK_EDITOR_HELP = 'enter submits';
/** The product command that raises the orientation juncture from the editor. */
const CONSULT_COMMAND = '/brunch:consult';
/** Custom entry type the committed orientation style appends to the canonical JSONL. */
const ELICITATION_STYLE_ENTRY = 'brunch.elicitation_style';

interface TranscriptMessage {
  readonly role: string;
  readonly text: string;
}

interface StructuredAskJourney {
  readonly target: SessionTarget;
  readonly notifications: readonly WebSocketRpcNotification[];
  readonly askDelta: Extract<LiveSessionEvent['delta'], { type: 'ask_opened' }> | undefined;
  readonly askDeltaTargets: readonly SessionTarget[];
  readonly askDeltaCount: number;
  readonly renderedAskQuestion: string | undefined;
  readonly askEditorHeldWhileRendered: boolean;
  readonly browserAnswerOutcome: LiveSessionHostResult;
  readonly renderedMessages: readonly TranscriptMessage[];
  readonly renderedEntryCount: number;
  readonly renderedTranscriptText: string;
  readonly freshMessages: readonly TranscriptMessage[];
  readonly freshEntryCount: number;
  readonly freshAnsweredAskText: string | undefined;
  readonly elicitationStyleEntryCount: number;
  readonly messagesAfterStyle: readonly TranscriptMessage[];
  readonly renderedMessagesAfterStyle: readonly TranscriptMessage[];
  readonly entryCountAfterStyle: number;
  readonly renderedEntryCountAfterStyle: number;
  readonly aliveAfterQuit: boolean;
  readonly writerLockExists: boolean;
}

/** The parent's independent truth: production reader plus production projector. */
async function freshCanonicalProjection(cwd: string): Promise<{
  readonly target: SessionTarget;
  readonly sessionFile: string;
  readonly entries: readonly SessionPresentationEntry[];
}> {
  const [only] = await inspectCanonicalSessionFiles(cwd);
  if (!only?.available) throw new Error('production TUI left no readable canonical session');
  const target = { specId: only.specId, sessionId: only.id };
  const projection = await projectSessionPresentationFile({ target, sessionFile: only.file });
  if (projection.status !== 'ready') {
    throw new Error(`canonical projection was ${projection.status}, not ready`);
  }
  return { target, sessionFile: only.file, entries: projection.presentation.entries };
}

/** Raw JSONL read, because a committed style is exactly what the projector drops. */
async function countCustomEntries(sessionFile: string, customType: string): Promise<number> {
  const lines = (await readFile(sessionFile, 'utf8')).split('\n').filter((line) => line.trim().length > 0);
  return lines.filter((line) => {
    const entry = JSON.parse(line) as { readonly type?: unknown; readonly customType?: unknown };
    return entry.type === 'custom' && entry.customType === customType;
  }).length;
}

function projectionMessages(entries: readonly SessionPresentationEntry[]): TranscriptMessage[] {
  return entries.flatMap((entry) =>
    entry.kind === 'message' ? [{ role: entry.role, text: entry.text }] : [],
  );
}

function answeredAskText(entries: readonly SessionPresentationEntry[]): string | undefined {
  for (const entry of entries) {
    if (entry.kind !== 'ask') continue;
    const terminal = entry.terminal;
    if (terminal?.status === 'answered' && 'text' in terminal.value) return terminal.value.text;
  }
  return undefined;
}

function transcriptList(): HTMLElement {
  return screen.getByRole('list', { name: 'Session transcript' });
}

/** Message entries as the browser shows them; see the companion witness. */
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

function askOpenedEvents(
  notifications: readonly WebSocketRpcNotification[],
): { readonly event: LiveSessionEvent; readonly ask: { readonly exchangeId: string } }[] {
  return notifications.flatMap((notification) => {
    if (notification.method !== 'brunch.liveSessionEvent') return [];
    const event = notification.params as LiveSessionEvent;
    return event.delta.type === 'ask_opened' ? [{ event, ask: event.delta.ask }] : [];
  });
}

/** Type into the real Pi editor and submit only once it has echoed the text back. */
async function typeAndSubmit(name: string, text: string): Promise<void> {
  sendText(name, text);
  if (!(await waitForScreen(name, text, ATTACH_TIMEOUT_MS)).matched) {
    throw new Error(`production Pi editor never echoed ${text}`);
  }
  sendKeys(name, ['Enter']);
}

async function waitForSettled(
  notifications: readonly WebSocketRpcNotification[],
  alreadySeen: number,
): Promise<void> {
  await waitFor(
    () =>
      expect(
        liveSessionDeltas(notifications).filter((delta) => delta.type === 'agent_settled').length,
      ).toBeGreaterThan(alreadySeen),
    { timeout: CONVERGENCE_TIMEOUT_MS },
  );
}

/** One PTY + browser journey feeds every leaf; booting the real product is the expensive part. */
async function driveStructuredAskJourney(): Promise<StructuredAskJourney> {
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-structured-ask-pty-'));
  const agentDir = await mkdtemp(join(tmpdir(), 'brunch-structured-ask-pty-agent-'));
  const reportPath = join(agentDir, TRACER_REPORT_FILE);
  const name = `structured-ask-pty-${randomUUID()}`;

  await startProductionTui({ name, cwd, agentDir, reportPath });

  let rpcClient: WebSocketRpcClient | undefined;
  try {
    await requireScreen(name, 'Welcome to Brunch.', BOOT_TIMEOUT_MS);
    await dismissModeChooser(name);

    const report = JSON.parse(await readFile(reportPath, 'utf8')) as ProductionTracerReport;
    if (report.status !== 'ready') throw new Error(`production TUI reported ${report.status}`);

    const notifications: WebSocketRpcNotification[] = [];
    rpcClient = createWebSocketRpcClient({
      url: `ws://${new URL(report.webSidecarUrl).host}/rpc`,
      WebSocketImpl: RpcWebSocket,
    });
    rpcClient.subscribe((notification) => notifications.push(notification));

    const workspaceState = await rpcClient.request<WorkspaceState>('workspace.state');
    if (workspaceState.status !== 'ready' || !workspaceState.spec || !workspaceState.session) {
      throw new Error(`web sidecar workspace.state was ${workspaceState.status}`);
    }
    const target = { specId: workspaceState.spec.id, sessionId: workspaceState.session.id };
    await rpcClient.request('session.open', target);

    window.history.pushState(null, '', `/session/${target.specId}/${target.sessionId}`);
    const runtime = createBrunchWebRuntime({ rpcClient });
    render(createElement(BrunchWebApp, { runtime }));
    await waitFor(() => expect(transcriptList()).toBeDefined(), { timeout: ATTACH_TIMEOUT_MS });

    // The assistant's ask is provoked from the PTY keyboard; the browser watches.
    await typeAndSubmit(name, TRACER_ASK_PROMPT);
    await requireScreen(name, TRACER_ASK_BODY, TURN_TIMEOUT_MS);

    await waitFor(() => expect(askOpenedEvents(notifications).length).toBeGreaterThan(0), {
      timeout: CONVERGENCE_TIMEOUT_MS,
    });
    const opened = askOpenedEvents(notifications);
    const askDelta = opened[0]?.event.delta as
      | Extract<LiveSessionEvent['delta'], { type: 'ask_opened' }>
      | undefined;

    // Rendered live, from the delta alone — the answered ask is not in the
    // canonical JSONL yet, so nothing here can come from a settled read-back.
    const renderedAsk = await waitFor(() => screen.getByRole('form', { name: TRACER_ASK_BODY }), {
      timeout: CONVERGENCE_TIMEOUT_MS,
    });
    const renderedAskQuestion = renderedAsk.getAttribute('aria-label') ?? undefined;
    const askEditorHeldWhileRendered = (await waitForScreen(name, ASK_EDITOR_HELP, ATTACH_TIMEOUT_MS))
      .matched;

    // Single answering authority: the browser is refused while the TUI holds it.
    const browserAnswerOutcome = await rpcClient.request<LiveSessionHostResult>('session.answerExchange', {
      ...target,
      driverId: randomUUID(),
      exchangeId: askDelta?.ask.exchangeId ?? TRACER_ASK_EXCHANGE_ID,
      answer: 'Answered from the browser.',
    });

    const settledBeforeAnswer = liveSessionDeltas(notifications).filter(
      (delta) => delta.type === 'agent_settled',
    ).length;
    await typeAndSubmit(name, TRACER_ASK_ANSWER);
    await requireScreen(name, TRACER_ASK_REPLY, TURN_TIMEOUT_MS);
    await waitForSettled(notifications, settledBeforeAnswer);

    // Bounded retry on the parent-computed truth. A canonical JSONL that lags
    // settlement is a production I65-L finding, not something to sleep past.
    const settledAt = Date.now();
    let fresh = await freshCanonicalProjection(cwd);
    while (
      answeredAskText(fresh.entries) !== TRACER_ASK_ANSWER &&
      Date.now() - settledAt < CONVERGENCE_TIMEOUT_MS
    ) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      fresh = await freshCanonicalProjection(cwd);
    }
    await waitFor(() => expect(transcriptList().textContent ?? '').toContain(TRACER_ASK_REPLY), {
      timeout: CONVERGENCE_TIMEOUT_MS,
    });

    const settled = {
      renderedMessages: renderedMessages(),
      renderedEntryCount: transcriptList().querySelectorAll(':scope > li').length,
      renderedTranscriptText: transcriptList().textContent ?? '',
    };
    const freshAtSettlement = await freshCanonicalProjection(cwd);

    // TUI-only interaction: a committed orientation style has no browser
    // affordance whatsoever, and the projector drops the entry it writes, so
    // both sides must drop it identically.
    const settledBeforeStyle = liveSessionDeltas(notifications).filter(
      (delta) => delta.type === 'agent_settled',
    ).length;
    await typeAndSubmit(name, CONSULT_COMMAND);
    await commitModeChoice(name);
    await waitForSettled(notifications, settledBeforeStyle);

    const afterStyle = await freshCanonicalProjection(cwd);
    const elicitationStyleEntryCount = await countCustomEntries(
      afterStyle.sessionFile,
      ELICITATION_STYLE_ENTRY,
    );
    await waitFor(
      () => expect(transcriptList().querySelectorAll(':scope > li').length).toBe(afterStyle.entries.length),
      { timeout: CONVERGENCE_TIMEOUT_MS },
    );

    const aliveAfterQuit = await quitAndAwaitExit(name);
    const writerLockExists = await sessionWriterLockExists(cwd, target);

    removeSession(name, { force: false });
    return {
      target,
      notifications,
      askDelta,
      askDeltaTargets: opened.map((entry) => entry.event.target),
      askDeltaCount: opened.length,
      renderedAskQuestion,
      askEditorHeldWhileRendered,
      browserAnswerOutcome,
      ...settled,
      freshMessages: projectionMessages(freshAtSettlement.entries),
      freshEntryCount: freshAtSettlement.entries.length,
      freshAnsweredAskText: answeredAskText(freshAtSettlement.entries),
      elicitationStyleEntryCount,
      messagesAfterStyle: projectionMessages(afterStyle.entries),
      renderedMessagesAfterStyle: renderedMessages(),
      entryCountAfterStyle: afterStyle.entries.length,
      renderedEntryCountAfterStyle: transcriptList().querySelectorAll(':scope > li').length,
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

describe('structured ask and TUI-only interaction over the production TUI PTY', () => {
  let journey: StructuredAskJourney;

  beforeAll(async () => {
    journey = await driveStructuredAskJourney();
  }, 300_000);

  afterAll(async () => {
    await jsdomEnvironment.teardown(globalThis);
  });

  it('ask delta — one target-addressed ask_opened carries the exact exchange and question', () => {
    expect(journey.askDeltaCount).toBe(1);
    expect(journey.askDeltaTargets).toEqual([journey.target]);
    expect(journey.askDelta?.ask).toMatchObject({
      exchangeId: TRACER_ASK_EXCHANGE_ID,
      mode: 'text',
      question: { body: TRACER_ASK_BODY },
    });
  });

  it('semantic-only transport — no raw Pi frame reaches the companion client', () => {
    const methods = new Set(journey.notifications.map((notification) => notification.method));
    expect(methods.has('brunch.sessionEvent')).toBe(false);
    expect(
      [...methods].every((method) => method === 'brunch.liveSessionEvent' || method === 'brunch.updated'),
    ).toBe(true);
  });

  it('live render — the companion shows the open ask while the TUI picker still holds it', () => {
    expect(journey.renderedAskQuestion).toBe(TRACER_ASK_BODY);
    expect(journey.askEditorHeldWhileRendered).toBe(true);
  });

  it('single answering authority — a browser answer is refused and the TUI answer is what lands', () => {
    expect(journey.browserAnswerOutcome).toEqual({ status: 'ask_closed' });
    expect(journey.freshAnsweredAskText).toBe(TRACER_ASK_ANSWER);
    expect(journey.renderedTranscriptText).toContain(TRACER_ASK_ANSWER);
    expect(journey.renderedTranscriptText).not.toContain('Answered from the browser.');
  });

  it('settled convergence — the rendered transcript equals a fresh canonical-JSONL projection', () => {
    // Pinned, so the comparison below cannot pass by both sides being empty.
    expect(journey.freshMessages).toEqual([
      { role: 'user', text: TRACER_ASK_PROMPT },
      { role: 'assistant', text: TRACER_ASK_REPLY },
    ]);
    expect(journey.renderedMessages).toEqual(journey.freshMessages);
    expect(journey.renderedEntryCount).toBe(journey.freshEntryCount);
  });

  it('TUI-only interaction — a committed style lands in canonical truth and both sides drop it', () => {
    expect(journey.elicitationStyleEntryCount).toBe(1);
    expect(journey.renderedMessagesAfterStyle).toEqual(journey.messagesAfterStyle);
    expect(journey.renderedEntryCountAfterStyle).toBe(journey.entryCountAfterStyle);
    // The kick the juncture fires is a real turn, so the transcript moved on.
    expect(journey.messagesAfterStyle.length).toBeGreaterThan(journey.freshMessages.length);
  });

  it('journey cleanup — Ctrl-D exits within the bounded wait and releases the writer lock', () => {
    expect(journey.aliveAfterQuit).toBe(false);
    expect(journey.writerLockExists).toBe(false);
  });
});
