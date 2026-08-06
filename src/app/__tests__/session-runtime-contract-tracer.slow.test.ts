import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import { describe, expect, it, vi } from 'vitest';

import type { HostedSessionRpcBoundary } from '../../rpc/methods/hosted-session.js';
import { acquireSessionWriter } from '../../session/session-writer-guard.js';
import type { WorkspaceSessionReadyState } from '../../session/workspace-session-coordinator.js';
import { runBrunchTui } from '../brunch-tui.js';

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
      launchInteractive: async ({ tuiLiveSessionAdapter }) => {
        expect(boundary).toBeDefined();
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
