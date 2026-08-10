import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LiveSessionHost } from '../../session/live-session-host.js';
import { acquireSessionWriter } from '../../session/session-writer-guard.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';
import { runBrunchWeb } from '../brunch-web.js';

const runtime = vi.hoisted(() => ({
  bindExtensions: vi.fn<() => Promise<void>>(),
  dispose: vi.fn<() => Promise<void>>(),
  prompt: vi.fn<() => Promise<void>>(),
  subscribe: vi.fn(() => () => {}),
}));

vi.mock('@earendil-works/pi-coding-agent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@earendil-works/pi-coding-agent')>();
  return {
    ...actual,
    createAgentSessionRuntime: vi.fn(async () => ({
      session: {
        bindExtensions: runtime.bindExtensions,
        prompt: runtime.prompt,
        subscribe: runtime.subscribe,
      },
      dispose: runtime.dispose,
    })),
  };
});

beforeEach(() => {
  runtime.bindExtensions.mockReset().mockResolvedValue();
  runtime.dispose.mockReset().mockResolvedValue();
  runtime.prompt.mockReset().mockResolvedValue();
  runtime.subscribe.mockClear();
});

describe('Brunch web runtime ownership', () => {
  it('disposes a runtime whose extension binding fails before releasing writer authority', async () => {
    runtime.bindExtensions.mockRejectedValueOnce(new Error('bind failed'));
    const fixture = await webFixture();

    try {
      await expect(fixture.liveSessions.open(fixture.target)).rejects.toThrow('bind failed');
      expect(runtime.dispose).toHaveBeenCalledOnce();

      const writer = await acquireSessionWriter({ cwd: fixture.cwd, target: fixture.target });
      await writer.release();
    } finally {
      await fixture.host.close();
      await rm(fixture.cwd, { recursive: true, force: true });
    }
  });

  it('disposes and releases a successfully opened runtime exactly once on host close', async () => {
    const fixture = await webFixture();

    try {
      await expect(fixture.liveSessions.open(fixture.target)).resolves.toEqual({ status: 'opened' });
      await fixture.host.close();
      expect(runtime.dispose).toHaveBeenCalledOnce();

      const writer = await acquireSessionWriter({ cwd: fixture.cwd, target: fixture.target });
      await writer.release();
    } finally {
      await rm(fixture.cwd, { recursive: true, force: true });
    }
  });
});

async function webFixture() {
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-web-ownership-'));
  const coordinator = createWorkspaceSessionCoordinator({ cwd });
  const workspace = await coordinator.createSetupSession({
    specTitle: 'Runtime ownership',
    createNewSpec: true,
  });
  const target = { specId: workspace.spec.id, sessionId: workspace.session.id };
  let liveSessions: LiveSessionHost | undefined;

  const host = await runBrunchWeb({
    cwd,
    coordinator,
    startHost: async (options) => {
      if (!options.hostedSession) throw new Error('Expected hosted-session authority');
      liveSessions = options.hostedSession.liveSessions;
      return { url: 'http://127.0.0.1:0', close: async () => {} };
    },
  });

  if (!liveSessions) throw new Error('Web host did not receive live-session authority');
  return { cwd, host, liveSessions, target };
}
