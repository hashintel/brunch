import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import {
  acquireSessionWriter,
  SessionWriterConflictError,
  sessionWriterLockPath,
} from '../../session/session-writer-guard.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';
import { createWebSocketRpcClient } from '../../web/rpc-client.js';

type RpcWebSocketConstructor = NonNullable<Parameters<typeof createWebSocketRpcClient>[0]['WebSocketImpl']>;

const SOURCE_ENTRY = resolve('src/app/brunch.ts');
const START_TIMEOUT_MS = 15_000;
const EXIT_TIMEOUT_MS = 10_000;

describe('standalone web process lifecycle', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
    cleanups.length = 0;
  });

  it('awaits host cleanup for concurrent termination signals without releasing another target', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-web-signal-'));
    cleanups.push(() => rm(cwd, { recursive: true, force: true }));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const ownedWorkspace = await coordinator.createSetupSession({
      specTitle: 'Signal-owned target',
      createNewSpec: true,
    });
    const otherWorkspace = await coordinator.createSetupSession({
      specTitle: 'Other runtime target',
      createNewSpec: true,
    });
    const ownedTarget = {
      specId: ownedWorkspace.spec.id,
      sessionId: ownedWorkspace.session.id,
    };
    const otherTarget = {
      specId: otherWorkspace.spec.id,
      sessionId: otherWorkspace.session.id,
    };
    const otherWriter = await acquireSessionWriter({ cwd, target: otherTarget });
    cleanups.push(() => otherWriter.release());

    const child = spawn(process.execPath, ['--import', 'tsx', SOURCE_ENTRY, '--cwd', cwd, '--mode', 'web'], {
      cwd: resolve('.'),
      env: {
        ...process.env,
        PI_OFFLINE: '1',
        PI_SKIP_VERSION_CHECK: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    cleanups.push(() => stopChild(child));
    const url = await webUrl(child);
    const client = createWebSocketRpcClient({
      url: `${url.replace(/^http/u, 'ws')}/rpc`,
      WebSocketImpl: WebSocket as unknown as RpcWebSocketConstructor,
    });
    cleanups.push(async () => client.close());

    await expect(client.request('session.open', ownedTarget)).resolves.toMatchObject({
      status: 'opened',
    });
    await expect(pathExists(sessionWriterLockPath(cwd, ownedTarget))).resolves.toBe(true);
    client.close();

    const exited = once(child, 'exit');
    expect(child.kill('SIGTERM')).toBe(true);
    child.kill('SIGINT');
    const [exitCode, signal] = await withTimeout(exited, EXIT_TIMEOUT_MS, 'standalone web process exit');

    expect(exitCode).toBeNull();
    expect(['SIGINT', 'SIGTERM']).toContain(signal);
    await expect(pathExists(sessionWriterLockPath(cwd, ownedTarget))).resolves.toBe(false);
    await expect(fetch(url)).rejects.toThrow();
    await expect(acquireSessionWriter({ cwd, target: otherTarget })).rejects.toEqual(
      new SessionWriterConflictError(otherTarget),
    );
  });
});

async function webUrl(child: ChildProcess): Promise<string> {
  if (!child.stdout || !child.stderr) throw new Error('Expected piped child output');
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += String(chunk);
  });
  child.stderr.on('data', (chunk) => {
    stderr += String(chunk);
  });

  await withTimeout(
    new Promise<void>((resolvePromise, reject) => {
      const inspect = () => {
        if (/Brunch web running at http:\/\/127\.0\.0\.1:\d+/u.test(stdout)) resolvePromise();
      };
      child.stdout?.on('data', inspect);
      child.once('exit', (code, signal) => {
        reject(
          new Error(
            `Standalone web exited before startup (code=${String(code)}, signal=${String(signal)}): ${stderr}`,
          ),
        );
      });
      inspect();
    }),
    START_TIMEOUT_MS,
    'standalone web startup',
  );
  const match = stdout.match(/Brunch web running at (http:\/\/127\.0\.0\.1:\d+)/u);
  if (!match?.[1]) throw new Error(`Standalone web URL missing from output: ${stdout}`);
  return match[1];
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await withTimeout(once(child, 'exit'), EXIT_TIMEOUT_MS, 'standalone web test cleanup');
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
