import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai';
import { createAgentSessionRuntime } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { createBrunchAgentSessionRuntimeFactory, runBrunchTui } from '../../app/brunch-tui.js';
import { runBrunchWeb } from '../../app/brunch-web.js';
import { flushSessionManagerToFile } from '../../session/flush-session-manager.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';
import { emitStartupOrientationForHarness } from '../tier-2-harness.js';
import { registerKeptFauxProvider, RpcSocket, waitFor } from './web-driver-streaming-support.js';

const prompts = ['First ordinary turn.', 'Second ordinary turn.', 'Ask turn.'] as const;
const answer = 'Canonical JSONL semantics.';

function scriptedResponses() {
  return [
    () => fauxAssistantMessage('Equivalent opening turn.'),
    () => fauxAssistantMessage('First ordinary answer.'),
    () => fauxAssistantMessage('Second ordinary answer.'),
    () =>
      fauxAssistantMessage(
        [
          fauxToolCall('ask', {
            exchangeId: 'parity-ask',
            body: 'What stays canonical?',
            options: [{ id: 'semantic-option-id', label: 'Keep semantic ids' }],
          }),
        ],
        { stopReason: 'toolUse' },
      ),
    () => fauxAssistantMessage('Settled after the answer.'),
  ];
}

/** Select the parity contract's carriers, preserving their order and every semantic field. */
export function normalizeSessionJsonl(jsonl: string): unknown[] {
  const ids = new Map<string, string>();
  const normalizeId = (value: unknown): unknown => {
    if (typeof value !== 'string') return value;
    let normalized = ids.get(value);
    if (!normalized) {
      normalized = `<id-${ids.size + 1}>`;
      ids.set(value, normalized);
    }
    return normalized;
  };
  const normalizeMessage = (value: unknown): unknown => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const message = structuredClone(value) as Record<string, unknown>;
    if ('id' in message) message.id = normalizeId(message.id);
    if ('timestamp' in message) message.timestamp = '<timestamp>';
    if (message.role === 'assistant' && Array.isArray(message.content)) {
      message.content = message.content.map((part) => {
        if (!part || typeof part !== 'object' || Array.isArray(part)) return part;
        const content = structuredClone(part) as Record<string, unknown>;
        if (content.type === 'toolCall' && 'id' in content) content.id = normalizeId(content.id);
        return content;
      });
    }
    if (message.role === 'toolResult' && 'toolCallId' in message)
      message.toolCallId = normalizeId(message.toolCallId);
    return message;
  };
  return jsonl
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as { type?: string; customType?: string })
    .filter(
      (entry) =>
        entry.type === 'message' ||
        (entry.type === 'custom' &&
          (entry.customType === 'brunch.session_binding' ||
            entry.customType === 'brunch.agent_runtime_state')),
    )
    .map((entry) => {
      const normalized = structuredClone(entry) as Record<string, unknown>;
      if ('id' in normalized) normalized.id = normalizeId(normalized.id);
      if ('parentId' in normalized && normalized.parentId !== null)
        normalized.parentId = normalizeId(normalized.parentId);
      if ('timestamp' in normalized) normalized.timestamp = '<timestamp>';
      if ('message' in normalized) normalized.message = normalizeMessage(normalized.message);
      return normalized;
    });
}

async function driveWeb(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-parity-web-'));
  const coordinator = createWorkspaceSessionCoordinator({ cwd });
  const workspace = await coordinator.createSetupSession({ specTitle: 'Semantic parity' });
  const target = { specId: workspace.spec.id, sessionId: workspace.session.id };
  const faux = await registerKeptFauxProvider('parity-differential', 'Equivalent opening turn.');
  const host = await runBrunchWeb({ cwd, coordinator, agentServices: faux.agentServices });
  const rpc = await RpcSocket.open(`${host.url.replace(/^http/u, 'ws')}/rpc`);
  try {
    await rpc.request('session.open', target);
    await waitFor(
      () => rpc.liveSessionEvents().some((event) => event.params.delta.type === 'agent_settled'),
      8000,
      'web opening turn to settle',
    );
    faux.provider.appendResponses(scriptedResponses().slice(1));
    for (const prompt of prompts.slice(0, 2)) {
      await rpc.request('session.driveTurn', { ...target, driverId: 'parity-driver', prompt });
    }
    const turn = rpc.request('session.driveTurn', {
      ...target,
      driverId: 'parity-driver',
      prompt: prompts[2],
    });
    await waitFor(
      async () =>
        ((await rpc.request('session.openAsks', target)) as { openAsks: unknown[] }).openAsks.length === 1,
      8000,
      'web ask',
    );
    await rpc.request('session.answerExchange', {
      ...target,
      driverId: 'parity-driver',
      exchangeId: 'parity-ask',
      answer,
    });
    await turn;
    return await readFile(workspace.session.file, 'utf8');
  } finally {
    rpc.close();
    await host.close();
    faux.provider.unregister();
  }
}

async function driveTui(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-parity-tui-'));
  const coordinator = createWorkspaceSessionCoordinator({ cwd });
  const faux = await registerKeptFauxProvider('parity-differential', 'Equivalent opening turn.');
  let sessionFile: string | undefined;
  try {
    await runBrunchTui({
      cwd,
      coordinator,
      webSidecarRunner: async () => null,
      runWorkspaceDialogPreflight: async () => ({ action: 'newSpec', title: 'Semantic parity' }),
      launchInteractive: async (context) => {
        sessionFile = context.workspace.session.file;
        const runtime = await createAgentSessionRuntime(
          createBrunchAgentSessionRuntimeFactory({ ...context, agentServices: faux.agentServices }),
          {
            cwd,
            agentDir: await mkdtemp(join(tmpdir(), 'brunch-parity-agent-')),
            sessionManager: context.workspace.session.manager,
          },
        );
        try {
          const liveExchange = context.liveExchange;
          if (!liveExchange) throw new Error('TUI production boot did not provide its live ask registry');
          const openingTurnEnded = new Promise<void>((resolve) => {
            const unsubscribe = runtime.session.subscribe((event) => {
              if (event.type !== 'agent_settled') return;
              unsubscribe();
              resolve();
            });
          });
          await emitStartupOrientationForHarness(runtime);
          await openingTurnEnded;
          faux.provider.appendResponses(scriptedResponses().slice(1));
          for (const prompt of prompts.slice(0, 2))
            await runtime.session.prompt(prompt, { source: 'interactive' });
          const opened = new Promise<void>((resolve) => {
            const unsubscribe = liveExchange.subscribe(() => {
              unsubscribe();
              resolve();
            });
          });
          const turn = runtime.session.prompt(prompts[2], { source: 'interactive' });
          await opened;
          liveExchange.answerer.submitAnswer({ exchangeId: 'parity-ask', answer });
          await turn;
          await runtime.session.agent.waitForIdle();
          flushSessionManagerToFile(runtime.session.sessionManager, context.workspace.session.file);
        } finally {
          await runtime.dispose();
        }
      },
    });
    if (!sessionFile) throw new Error('TUI production boot did not create a session file');
    return await readFile(sessionFile, 'utf8');
  } finally {
    faux.provider.unregister();
  }
}

describe('standalone web/TUI canonical JSONL semantic differential', () => {
  it('preserves binding, runtime, ordinary turns, current ask answer, and settlement semantics', async () => {
    const web = await driveWeb();
    const tui = await driveTui();
    const normalizedWeb = normalizeSessionJsonl(web);
    expect(normalizedWeb).toEqual(normalizeSessionJsonl(tui));

    const rival = structuredClone(normalizedWeb) as Array<Record<string, unknown>>;
    const askResult = rival.find((entry) => {
      const message = entry.message as { role?: string; toolName?: string } | undefined;
      return message?.role === 'toolResult' && message.toolName === 'ask';
    });
    expect(askResult).toBeDefined();
    const resultContent = (askResult!.message as { content: Array<{ type: string; text?: string }> }).content;
    const answerText = resultContent.find((part) => part.type === 'text');
    expect(answerText).toBeDefined();
    answerText!.text = 'A laundered rival.';
    expect(rival).not.toEqual(normalizedWeb);

    const semanticIdRival = structuredClone(normalizedWeb) as Array<Record<string, unknown>>;
    const askCall = semanticIdRival.find((entry) => {
      const message = entry.message as { role?: string; content?: unknown[] } | undefined;
      return (
        message?.role === 'assistant' &&
        message.content?.some(
          (part) =>
            typeof part === 'object' &&
            part !== null &&
            (part as { type?: string; name?: string }).type === 'toolCall' &&
            (part as { name?: string }).name === 'ask',
        )
      );
    });
    expect(askCall).toBeDefined();
    const askPart = (askCall!.message as { content: Array<Record<string, unknown>> }).content.find(
      (part) => part.type === 'toolCall' && part.name === 'ask',
    )!;
    const arguments_ = askPart.arguments as { options: Array<{ id: string }> };
    arguments_.options[0]!.id = 'changed-semantic-option-id';
    expect(semanticIdRival).not.toEqual(normalizedWeb);
  }, 30000);
});
