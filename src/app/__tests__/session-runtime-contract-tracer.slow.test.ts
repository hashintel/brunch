import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { removeSession, sendKeys, sendText, sessionStatus, stopSession } from '../../dev/tui-driver.js';
import type { HostedSessionRpcBoundary } from '../../rpc/methods/hosted-session.js';
import { acquireSessionWriter } from '../../session/session-writer-guard.js';
import type { WorkspaceSessionReadyState } from '../../session/workspace-session-coordinator.js';
import { inspectCanonicalSessionFiles } from '../../session/workspace-session-coordinator/canonical-session-files.js';
import { runBrunchTui } from '../brunch-tui.js';
import {
  BOOT_TIMEOUT_MS,
  CHILD_PATH,
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
  TRACER_SPEC_TITLE,
  type ProductionTracerReport,
} from './session-runtime-contract-tracer-support.js';

function workspace(cwd: string): WorkspaceSessionReadyState {
  const manager = SessionManager.create(cwd);
  const spec = {
    id: 1,
    title: 'Runtime contract tracer',
    kind: 'product',
    origin: 'greenfield',
    relatesToSpecId: null,
  } as const;
  return {
    status: 'ready',
    cwd,
    spec,
    session: { id: manager.getSessionId(), file: manager.getSessionFile()!, manager },
    chrome: { cwd, spec },
  };
}

describe('session runtime contract production tracer', () => {
  it('attaches the TUI-owned target semantically, excludes a rival, and transfers authority on shutdown', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-runtime-contract-'));
    const ready = workspace(cwd);
    const target = { specId: ready.spec.id, sessionId: ready.session.id };
    let boundary: HostedSessionRpcBoundary | undefined;
    const frames: unknown[] = [];

    await runBrunchTui({
      cwd,
      coordinator: {
        inspectWorkspace: async () => ({
          cwd,
          currentSpec: ready.spec,
          currentSessionFile: ready.session.file,
          needsNewSpec: false,
          specs: [],
          unavailableSessions: [],
          workspacePopulated: false,
        }),
        activateWorkspace: async () => ready,
        bindCurrentSpecToReplacementSession: async () => ready,
      },
      runWorkspaceDialogPreflight: async () => ({
        action: 'continue',
        specId: ready.spec.id,
        sessionFile: ready.session.file,
      }),
      webSidecarRunner: async (options) => {
        boundary = options.hostedSession;
        options.semanticSessionEvents?.subscribe((frame) => frames.push(frame));
        return { url: 'http://127.0.0.1:1', close: async () => {} };
      },
      launchInteractive: async ({ sessionEvents, tuiLiveSessionAdapter }) => {
        expect(boundary).toBeDefined();
        const rawListeners = new Set<(event: never) => void>();
        sessionEvents?.attachSession({
          subscribe(listener: (event: never) => void) {
            rawListeners.add(listener);
            return () => rawListeners.delete(listener);
          },
        });
        for (const listener of rawListeners) listener({ type: 'agent_start' } as never);

        const listeners = new Set<(event: never) => void>();
        const session = {
          isStreaming: false,
          prompt: vi.fn(async () => {}),
          subscribe(listener: (event: never) => void) {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
        };
        tuiLiveSessionAdapter?.attachSession(session);
        await expect(boundary!.liveSessions.open(target)).resolves.toEqual({ status: 'attached' });
        await expect(boundary!.liveSessions.driveTurn(target, 'browser', 'continue')).resolves.toEqual({
          status: 'completed',
        });
        for (const listener of listeners) {
          listener({ type: 'agent_start' } as never);
          listener({
            type: 'message_update',
            message: { role: 'assistant', content: [{ type: 'text', text: 'semantic companion' }] },
          } as never);
          listener({ type: 'agent_settled' } as never);
        }
        await expect(acquireSessionWriter({ cwd, target })).rejects.toThrow('already has a writer');
      },
    });

    expect(frames).not.toContainEqual(expect.objectContaining({ method: 'brunch.sessionEvent' }));
    expect(frames).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'brunch.liveSessionEvent',
          params: expect.objectContaining({ target, delta: { type: 'agent_settled' } }),
        }),
      ]),
    );
    const standalone = await acquireSessionWriter({ cwd, target });
    await standalone.release();
  });
});

/**
 * The real-TUI half of the same contract. Everything above runs the sealed
 * composition with an injected launcher; this journey supplies **no**
 * `launchInteractive`, so the production `launchPiInteractive` path builds the
 * runtime and a real Pi `InteractiveMode` inside a PTY.
 */
interface ProductionPtyJourney {
  readonly childSource: string;
  readonly report: ProductionTracerReport;
  readonly bootScreen: readonly string[];
  readonly promptEchoed: boolean;
  readonly replyScreen: readonly string[];
  readonly aliveAfterQuit: boolean;
  readonly sessionFilesAfterQuit: Awaited<ReturnType<typeof inspectCanonicalSessionFiles>>;
  readonly jsonl: string;
  readonly writerLockExists: boolean;
  readonly sessionDirRemoved: boolean;
}

/**
 * One PTY journey feeds every leaf below. Booting the real product under a PTY
 * is the expensive part; re-running it per assertion would buy nothing but
 * minutes.
 */
async function driveProductionPtyJourney(): Promise<ProductionPtyJourney> {
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-production-pty-'));
  const agentDir = await mkdtemp(join(tmpdir(), 'brunch-production-pty-agent-'));
  const reportPath = join(agentDir, TRACER_REPORT_FILE);
  const name = `production-pty-${randomUUID()}`;
  const childSource = await readFile(CHILD_PATH, 'utf8');

  await startProductionTui({ name, cwd, agentDir, reportPath });

  try {
    // Boot: real Brunch startup chrome plus the Pi editor frame.
    const bootScreen = await requireScreen(name, 'Welcome to Brunch.', BOOT_TIMEOUT_MS);

    // The product opens Specify mode with its own how-to-work chooser, which
    // holds the keyboard until dismissed.
    await dismissModeChooser(name);

    // Ordinary turn through the real editor: the prompt has to render before
    // Enter, or "editable prompt" is an untested claim.
    sendText(name, TRACER_PROBE_PROMPT);
    const promptEchoed = (await waitForScreen(name, TRACER_PROBE_PROMPT, 30_000)).matched;
    if (!promptEchoed) throw new Error('production Pi editor never echoed the typed prompt');
    sendKeys(name, ['Enter']);
    const replyScreen = await requireScreen(name, TRACER_PROBE_REPLY, TURN_TIMEOUT_MS);

    // Bounded cleanup: normal Ctrl-D quit, then durable postconditions.
    const aliveAfterQuit = await quitAndAwaitExit(name);

    const report = JSON.parse(await readFile(reportPath, 'utf8')) as ProductionTracerReport;
    const sessionFilesAfterQuit = await inspectCanonicalSessionFiles(cwd);
    const [only] = sessionFilesAfterQuit;
    if (!only?.available) throw new Error('production TUI left no readable canonical session');
    const jsonl = await readFile(only.file, 'utf8');
    const writerLockExists = await sessionWriterLockExists(cwd, {
      specId: only.specId,
      sessionId: only.id,
    });

    removeSession(name, { force: false });
    return {
      childSource,
      report,
      bootScreen,
      promptEchoed,
      replyScreen,
      aliveAfterQuit,
      sessionFilesAfterQuit,
      jsonl,
      writerLockExists,
      sessionDirRemoved: sessionStatus(name) === undefined,
    };
  } finally {
    await stopSession(name);
    removeSession(name, { force: true });
    await rm(cwd, { recursive: true, force: true });
    await rm(agentDir, { recursive: true, force: true });
  }
}

function jsonlMessages(jsonl: string): Array<{ readonly role: string; readonly text: string }> {
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

describe('production normal-TUI PTY tracer', () => {
  let journey: ProductionPtyJourney;

  beforeAll(async () => {
    journey = await driveProductionPtyJourney();
  }, 240_000);

  it('production PTY boot — reaches real Brunch/Pi chrome and an editable prompt without a launcher override', () => {
    // No launcher override is supplied, so the boot below went through the
    // production `launchPiInteractive` path.
    expect(journey.childSource).not.toMatch(/launchInteractive\s*:/u);

    const boot = journey.bootScreen.join('\n');
    expect(boot).toContain('Welcome to Brunch.');
    expect(boot).toMatch(/built on Pi v/u);
    // The Brunch-framed Pi editor, titled with the activated spec.
    expect(boot).toContain('[ Specify ]');
    expect(boot).toContain(TRACER_SPEC_TITLE);
    // Footer proof that the injected backend reached the real runtime rather
    // than a harness-side stand-in.
    expect(boot).toContain('brunch-faux-model');

    expect(journey.report.status).toBe('ready');
    expect(journey.promptEchoed).toBe(true);
  });

  it('ordinary turn — renders the deterministic reply and records that exchange in the sole canonical JSONL', () => {
    const reply = journey.replyScreen.join('\n');
    expect(reply).toContain(TRACER_PROBE_REPLY);
    // By settle time the footer names the resolved provider, so the turn was
    // served by the substituted backend inside the real runtime.
    expect(reply).toMatch(/model brunch-faux-model/u);

    expect(journey.sessionFilesAfterQuit).toHaveLength(1);
    const messages = jsonlMessages(journey.jsonl);
    expect(messages).toEqual([
      { role: 'user', text: TRACER_PROBE_PROMPT },
      { role: 'assistant', text: TRACER_PROBE_REPLY },
    ]);
  });

  it('bounded cleanup — Ctrl-D ends the PTY session and releases the target writer lock', () => {
    expect(journey.aliveAfterQuit).toBe(false);
    expect(journey.sessionDirRemoved).toBe(true);
    expect(journey.writerLockExists).toBe(false);
  });
});
