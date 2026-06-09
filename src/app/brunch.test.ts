import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { assistantMessage, userMessage } from '../probes/test-helpers.js';
import { createSessionBindingData } from '../session/session-binding.js';
import {
  createWorkspaceSessionCoordinator,
  type WorkspaceSessionCoordinator,
} from '../session/workspace-session-coordinator.js';
import { runBrunchCli, type WebHostRunnerOptions } from './brunch.js';

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
                phase: 'elicitation' as const,
                chatMode: 'responding-to-elicitation' as const,
              },
            }
          : {
              status: 'select_spec' as const,
              chrome: {
                cwd: '/tmp/brunch-project',
                spec: null,
                phase: 'select_spec' as const,
                chatMode: 'select-spec' as const,
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

function collectStream(stream: PassThrough): string[] {
  const chunks: string[] = [];
  stream.on('data', (chunk) => chunks.push(String(chunk)));
  return chunks;
}

describe('Brunch CLI dispatch', () => {
  it('routes --mode web through an injectable web host runner', async () => {
    let launchedWith: WebHostRunnerOptions | null = null;

    const code = await runBrunchCli({
      argv: ['--mode=web'],
      cwd: '/tmp/brunch-project',
      coordinator: coordinator(),
      webHostRunner: async (options) => {
        launchedWith = options;
      },
    });

    expect(code).toBe(0);
    expect(launchedWith).toMatchObject({ cwd: '/tmp/brunch-project' });
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
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cli-rpc-'));
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
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-cli-rpc-updates-'));
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
        topics: ['workspace.state', 'session.pendingExchange', 'session.exchanges', 'session.runtimeState'],
        updates: [
          { topic: 'workspace.state', specId: workspace.spec.id, sessionId: workspace.session.id },
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
    expect(messages).toContainEqual(
      expect.objectContaining({
        jsonrpc: '2.0',
        id: 7,
        result: expect.objectContaining({ status: 'pending' }),
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

  it('gates dev RPC methods in CLI rpc mode behind BRUNCH_DEV_RPC=1', async () => {
    const previous = process.env.BRUNCH_DEV_RPC;
    const stdout = new PassThrough();
    const chunks = collectStream(stdout);
    process.env.BRUNCH_DEV_RPC = '1';
    try {
      const code = await runBrunchCli({
        argv: ['--mode=rpc'],
        cwd: '/tmp/brunch-project',
        coordinator: coordinator(),
        stdin: rpcRequest('rpc.discover'),
        stdout,
      });

      expect(code).toBe(0);
      expect(JSON.stringify(JSON.parse(chunks.join('')))).toContain('dev.graph.mutateGraph');
    } finally {
      if (previous === undefined) {
        delete process.env.BRUNCH_DEV_RPC;
      } else {
        process.env.BRUNCH_DEV_RPC = previous;
      }
    }
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
    expect(printOutput).toContain(`phase: ${rpcState.chrome.phase}`);
    expect(printOutput).toContain(`chatMode: ${rpcState.chrome.chatMode}`);
    expect(rpcState).toMatchObject({
      status: 'ready',
      cwd,
      spec: { title: 'Parity spec' },
      chrome: {
        phase: 'elicitation',
        chatMode: 'responding-to-elicitation',
      },
    });
  });
});
