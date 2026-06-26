import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PassThrough } from 'node:stream';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { runSeedFixturesCli } from '../../graph/seed-fixtures.js';
import { assistantMessage, userMessage } from '../../probes/test-helpers.js';
import { createSessionBindingData } from '../../session/session-binding.js';
import {
  createWorkspaceSessionCoordinator,
  type WorkspaceSessionCoordinator,
} from '../../session/workspace-session-coordinator.js';
import { runBrunchCli } from '../brunch.js';

function coordinator(sessionFile?: string): WorkspaceSessionCoordinator {
  return {
    async openDefaultWorkspace() {
      return {
        ...(sessionFile
          ? {
              status: 'ready' as const,
              spec: { id: 1, title: 'Alpha spec' },
              session: {
                id: 'session-1',
                file: sessionFile,
                manager: {} as never,
              },
              chrome: {
                cwd: '/tmp/brunch-project',
                spec: { id: 1, title: 'Alpha spec' },
              },
            }
          : {
              status: 'select_spec' as const,
              chrome: {
                cwd: '/tmp/brunch-project',
                spec: null,
              },
            }),
        cwd: '/tmp/brunch-project',
      };
    },
    async createSetupSession() {
      throw new Error('print must not create a session');
    },
    async createSetupSessionForCurrentSpec() {
      throw new Error('not used');
    },
    async bindCurrentSpecToReplacementSession() {
      throw new Error('not used');
    },
    async deriveDefaultChromeState() {
      throw new Error('not used');
    },
  } as unknown as WorkspaceSessionCoordinator;
}

function rpcRequest(method: string, id = 1): PassThrough {
  const stdin = new PassThrough();
  stdin.end(`${JSON.stringify({ jsonrpc: '2.0', id, method })}\n`);
  return stdin;
}

async function runRpcRequest(cwd: string, method: string): Promise<unknown> {
  const stdout = new PassThrough();
  const chunks = collectStream(stdout);
  await runBrunchCli({
    argv: ['--cwd', cwd, '--mode=rpc'],
    stdin: rpcRequest(method),
    stdout,
  });
  return JSON.parse(chunks.join('')).result;
}

function collectStream(stream: PassThrough): string[] {
  const chunks: string[] = [];
  stream.on('data', (chunk) => chunks.push(String(chunk)));
  return chunks;
}

describe('Brunch CLI dispatch', () => {
  it('rejects --mode web as a deferred feature (web UI runs only as the TUI sidecar)', async () => {
    await expect(
      runBrunchCli({
        argv: ['--mode=web'],
        cwd: '/tmp/brunch-project',
        coordinator: coordinator(),
      }),
    ).rejects.toThrow(/web mode is not available yet/u);
  });

  it('routes empty argv to the TUI launch path', async () => {
    let launchedTui = false;

    const code = await runBrunchCli({
      argv: [],
      cwd: '/tmp/brunch-project',
      coordinator: coordinator(),
      launchTui: async () => {
        launchedTui = true;
      },
    });

    expect(code).toBe(0);
    expect(launchedTui).toBe(true);
  });

  it('parses --cwd for TUI launch and resolves relative paths against process cwd', async () => {
    const launchedCwds: string[] = [];

    await runBrunchCli({
      argv: ['--cwd', '.fixtures/workbenches/demo'],
      coordinator: coordinator(),
      launchTui: async (options) => {
        launchedCwds.push(options?.cwd ?? '<missing>');
      },
    });
    await runBrunchCli({
      argv: ['--cwd=/tmp/brunch-absolute'],
      coordinator: coordinator(),
      launchTui: async (options) => {
        launchedCwds.push(options?.cwd ?? '<missing>');
      },
    });

    expect(launchedCwds).toEqual([
      resolve(process.cwd(), '.fixtures/workbenches/demo'),
      '/tmp/brunch-absolute',
    ]);
  });

  it('keeps the web sidecar browser launch opt-in via --open-web', async () => {
    const launches: boolean[] = [];
    const launchTui = async (options?: { openWeb?: boolean }) => {
      launches.push(options?.openWeb === true);
    };

    await runBrunchCli({ argv: [], coordinator: coordinator(), launchTui });
    await runBrunchCli({ argv: ['--open-web'], coordinator: coordinator(), launchTui });

    expect(launches).toEqual([false, true]);
  });

  it('routes --mode print through the coordinator state and exits', async () => {
    let output = '';

    const code = await runBrunchCli({
      argv: ['--mode', 'print'],
      cwd: '/tmp/brunch-project',
      coordinator: coordinator(),
      stdout: (chunk) => {
        output += chunk;
      },
    });

    expect(code).toBe(0);
    expect(output).toContain('status: select_spec');
    expect(output).toContain('spec: <none>');
  });

  it('routes --mode rpc session projection through the coordinator-selected session', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-'));
    const manager = SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
    manager.appendCustomEntry(
      'brunch.session_binding',
      createSessionBindingData({
        specId: 1,
      }),
    );
    manager.appendMessage(assistantMessage('Question'));
    manager.appendMessage(userMessage('Answer'));
    const stdout = new PassThrough();
    const chunks = collectStream(stdout);

    const code = await runBrunchCli({
      argv: ['--mode=rpc'],
      cwd: '/tmp/brunch-project',
      coordinator: coordinator(manager.getSessionFile()!),
      stdin: rpcRequest('session.exchanges', 2),
      stdout,
    });

    expect(code).toBe(0);
    expect(JSON.parse(chunks.join(''))).toMatchObject({
      jsonrpc: '2.0',
      id: 2,
      result: {
        status: 'ready',
        exchanges: [{ promptEntryIds: [expect.any(String)] }],
      },
    });
  });

  it('shares one product update publisher between RPC handlers and the stdio line server', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-updates-'));
    const workspace = await createWorkspaceSessionCoordinator({ cwd }).createSetupSession({
      specTitle: 'RPC updates',
    });
    const stdout = new PassThrough();
    const chunks = collectStream(stdout);

    const code = await runBrunchCli({
      argv: ['--mode=rpc'],
      cwd,
      coordinator: createWorkspaceSessionCoordinator({ cwd }),
      stdin: rpcRequest('session.triggerExchange', 7),
      stdout,
    });

    const messages = chunks
      .join('')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as unknown);

    expect(code).toBe(0);
    expect(messages).toContainEqual({
      jsonrpc: '2.0',
      method: 'brunch.updated',
      params: {
        topics: [
          'workspace.state',
          'workspace.selectionState',
          'session.pendingExchange',
          'session.exchanges',
          'session.runtimeState',
        ],
        updates: [
          { topic: 'workspace.state', specId: workspace.spec.id, sessionId: workspace.session.id },
          {
            topic: 'workspace.selectionState',
            specId: workspace.spec.id,
            sessionId: workspace.session.id,
          },
          {
            topic: 'session.pendingExchange',
            specId: workspace.spec.id,
            sessionId: workspace.session.id,
          },
          {
            topic: 'session.exchanges',
            specId: workspace.spec.id,
            sessionId: workspace.session.id,
          },
          {
            topic: 'session.runtimeState',
            specId: workspace.spec.id,
            sessionId: workspace.session.id,
          },
        ],
      },
    });
    // Kick surface (D49-L revised 2026-06-12): no assistant-created exchange
    // exists in this transport-only flow, so the trigger reports idle — the
    // shared-publisher claim above is what this test owns.
    expect(messages).toContainEqual(
      expect.objectContaining({
        jsonrpc: '2.0',
        id: 7,
        result: expect.objectContaining({ status: 'idle' }),
      }),
    );
  });

  it('routes --mode rpc through the named JSON-RPC stdio adapter', async () => {
    const stdout = new PassThrough();
    const chunks = collectStream(stdout);

    const code = await runBrunchCli({
      argv: ['--mode=rpc'],
      cwd: '/tmp/brunch-project',
      coordinator: coordinator(),
      stdin: rpcRequest('workspace.state'),
      stdout,
    });

    expect(code).toBe(0);
    expect(JSON.parse(chunks.join(''))).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: { status: 'select_spec' },
    });
  });

  it('keeps CLI rpc mode on the public method registry', async () => {
    const stdout = new PassThrough();
    const chunks = collectStream(stdout);
    const code = await runBrunchCli({
      argv: ['--mode=rpc'],
      cwd: '/tmp/brunch-project',
      coordinator: coordinator(),
      stdin: rpcRequest('rpc.discover'),
      stdout,
    });

    expect(code).toBe(0);
    expect(JSON.stringify(JSON.parse(chunks.join('')))).not.toContain('dev.graph.mutateGraph');
  });
  it('uses --cwd product RPC to inspect the named workspace rather than the shell cwd', async () => {
    const shellCwd = await mkdtemp(join(tmpdir(), 'brunch-shell-'));
    const seededWorkspace = await mkdtemp(join(tmpdir(), 'brunch-seeded-'));
    const emptySibling = await mkdtemp(join(tmpdir(), 'brunch-empty-'));
    await runSeedFixturesCli({
      argv: ['--workspace', seededWorkspace, '--seed', 'workspace-spread/alpha-grounding'],
      cwd: shellCwd,
      stdout: () => {},
    });

    const seededSelection = await runRpcRequest(seededWorkspace, 'workspace.selectionState');
    const siblingSelection = await runRpcRequest(emptySibling, 'workspace.selectionState');

    expect(seededSelection).toMatchObject({
      cwd: seededWorkspace,
      specs: [{ spec: { title: 'Alpha Grounding' } }],
    });
    expect(siblingSelection).toMatchObject({ cwd: emptySibling, specs: [] });
  });

  it('exposes matching print and RPC workspace states from a real coordinator store', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-parity-'));
    await createWorkspaceSessionCoordinator({ cwd }).createSetupSession({
      specTitle: 'Parity spec',
    });
    let printOutput = '';
    const rpcOutput = new PassThrough();
    const rpcChunks = collectStream(rpcOutput);

    await runBrunchCli({
      argv: ['--mode=print'],
      cwd,
      stdout: (chunk) => {
        printOutput += chunk;
      },
    });
    await runBrunchCli({
      argv: ['--mode=rpc'],
      cwd,
      stdin: rpcRequest('workspace.state'),
      stdout: rpcOutput,
    });

    const rpcState = JSON.parse(rpcChunks.join('')).result;
    expect(printOutput).toContain('status: ready');
    expect(printOutput).toContain(`cwd: ${rpcState.cwd}`);
    expect(printOutput).toContain('spec: Parity spec');
    expect(printOutput).not.toContain('phase:');
    expect(printOutput).not.toContain('chatMode:');
    expect(rpcState).toMatchObject({
      status: 'ready',
      cwd,
      spec: { title: 'Parity spec' },
      chrome: {},
    });
  });
});
