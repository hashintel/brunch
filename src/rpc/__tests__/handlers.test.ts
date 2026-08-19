import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';

import { SessionManager, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { TSchema } from 'typebox';
import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';

import { registerStructuredExchange } from '../../.pi/extensions/exchanges/index.js';
import type { StructuredExchangeUiContext } from '../../.pi/extensions/exchanges/shared/ui-context.js';
import { formatPresentCandidates } from '../../agents/contexts/exchanges/present-candidates.js';
import { projectPresentCandidates } from '../../exchanges/projections/present-candidates.js';
import { projectPresentDigest } from '../../exchanges/projections/present-digest.js';
import { projectPresentReviewSet } from '../../exchanges/projections/present-review-set.js';
import { runCreateOnlyMutation } from '../../graph/__tests__/support/create-only-mutation.js';
import { openWorkspaceGraphRuntime } from '../../graph/workspace-store.js';
import { assistantMessage, userMessage } from '../../probes/test-helpers.js';
import { projectSessionPresentationFile } from '../../projections/session/session-presentation.js';
import { flushSessionManagerToFile } from '../../session/flush-session-manager.js';
import { createLiveAskRegistry } from '../../session/live-ask-registry.js';
import {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  type BrunchAgentState,
} from '../../session/runtime-state.js';
import { createSessionBindingData } from '../../session/session-binding.js';
import { syntheticExchangeToolCallMessage } from '../../session/structured-exchange-loop.js';
import { createWorkspaceSessionCoordinator } from '../../session/workspace-session-coordinator.js';
import type {
  DefaultWorkspaceCoordinator,
  WorkspaceActivationState,
  WorkspaceLaunchInventory,
  WorkspaceSessionReadyState,
  WorkspaceSessionState,
  SpecSessionActivationCoordinator,
  SpecSessionActivationDecision,
} from '../../session/workspace-session-coordinator.js';
import {
  createReadOnlyRpcHandlers,
  createRpcHandlers,
  createWebSidecarRpcHandlers,
  runJsonRpcLineServer,
} from '../handlers.js';
import type { HostedSessionRpcBoundary } from '../methods/hosted-session.js';
import { NO_LIVE_AGENT_SESSION_DRIVER_MESSAGE } from '../methods/session-driver.js';
import { INVALID_LIVE_EXCHANGE_ANSWER_MESSAGE } from '../methods/session-exchange-answer.js';
import { createProductUpdatePublisher } from '../product-updates.js';

/**
 * Fixture-mint a deterministic exchange into a setup-session workspace and
 * flush it to the session file — the probe/test stand-in for an
 * assistant-authored offer now that the product mints nothing (D78-L revised
 * 2026-06-12).
 */
function mintExchangeIntoWorkspace(workspace: { session: { file: string } }, completedCount = 0) {
  const turnNumber = completedCount + 1;
  const exchangeId = `deterministic-grounding-choice-${turnNumber}`;
  const projection = projectPresentCandidates({
    exchangeId,
    heading: `Choose grounding direction ${turnNumber}`,
    body: 'Choose the active candidate that best grounds this specification.',
    candidates: [
      {
        id: 'new-from-scratch',
        title: 'Start a new spec workspace from a blank slate.',
        user_rubric: {
          core_bet: 'Ground the specification from first principles.',
          best_fit: 'A fresh product specification.',
          cost_complexity: 'Requires initial grounding.',
          covers_well: 'Covers the public RPC candidate path.',
          main_risks: 'Does not exercise every offer family.',
          lock_in_constraints: 'Keeps the fixture deterministic.',
          recommendation: 'Choose this for deterministic RPC coverage.',
        },
        meta_rubric: {
          legibility_cost_of_knowing: 'Easy to inspect.',
          failure_modes: 'A malformed candidate fails transcript validation.',
          coverage_range: 'Public RPC candidate settlement.',
          commitment: 'Commits only fixture state.',
        },
        graph_refs: [],
      },
    ],
  });
  const call = syntheticExchangeToolCallMessage(exchangeId, 'present_candidates');
  const manager = SessionManager.open(workspace.session.file);
  manager.appendMessage(call as never);
  manager.appendMessage({
    role: 'toolResult',
    toolCallId: call.content[0].id,
    toolName: 'present_candidates',
    content: [{ type: 'text', text: formatPresentCandidates(projection) }],
    details: projection.details,
    isError: false,
    timestamp: 0,
  } as never);
  flushSessionManagerToFile(manager, workspace.session.file);
  return {
    exchangeId,
    lens: 'intent' as const,
    mode: 'single-select' as const,
    prompt: projection.heading,
    options: [{ id: 'new-from-scratch', label: 'Start a new spec workspace from a blank slate.' }],
    note: { allowed: true },
  };
}

function coordinator(
  state: WorkspaceSessionState = readyState('/tmp/brunch-project/.brunch/sessions/session-1.jsonl'),
): DefaultWorkspaceCoordinator & SpecSessionActivationCoordinator {
  const inventory = launchInventory();
  return {
    async openDefaultWorkspace() {
      return state;
    },
    async inspectWorkspace() {
      return inventory;
    },
    async activateWorkspace(decision: SpecSessionActivationDecision): Promise<WorkspaceActivationState> {
      if (decision.action === 'cancel') return cancelledState();
      return readyState('/tmp/brunch-project/.brunch/sessions/session-1.jsonl');
    },
  };
}

function launchInventory(): WorkspaceLaunchInventory {
  return {
    cwd: '/tmp/brunch-project',
    currentSpec: { id: 1, title: 'Alpha spec', kind: 'product', origin: 'greenfield', relatesToSpecId: null },
    currentSessionFile: '/tmp/brunch-project/.brunch/sessions/session-1.jsonl',
    needsNewSpec: false,
    specs: [
      {
        spec: { id: 1, title: 'Alpha spec', kind: 'product', origin: 'greenfield', relatesToSpecId: null },
        sessions: [
          {
            id: 'session-1',
            file: '/tmp/brunch-project/.brunch/sessions/session-1.jsonl',
            specId: 1,
            specTitle: 'Alpha spec',
            available: true,
          },
        ],
      },
    ],
    unavailableSessions: [
      {
        file: '/tmp/missing.jsonl',
        reason: 'missing_header',
        available: false,
      },
    ],
    workspacePopulated: false,
  };
}

function cancelledState(): WorkspaceActivationState {
  return {
    status: 'cancelled',
    cwd: '/tmp/brunch-project',
    chrome: {
      cwd: '/tmp/brunch-project',
      spec: { id: 1, title: 'Alpha spec' },
    },
  };
}

function readyState(sessionFile: string): WorkspaceSessionReadyState {
  return {
    status: 'ready',
    cwd: '/tmp/brunch-project',
    spec: { id: 1, title: 'Alpha spec', kind: 'product', origin: 'greenfield', relatesToSpecId: null },
    session: {
      id: 'session-1',
      file: sessionFile,
      manager: {} as never,
    },
    chrome: {
      cwd: '/tmp/brunch-project',
      spec: { id: 1, title: 'Alpha spec' },
    },
  };
}

function selectSpecState(): WorkspaceSessionState {
  return {
    status: 'select_spec',
    cwd: '/tmp/brunch-project',
    chrome: {
      cwd: '/tmp/brunch-project',
      spec: null,
    },
  };
}

async function createSessionFile(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-session-'));
  const manager = SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
  appendBinding(manager);
  manager.appendMessage(assistantMessage('Question'));
  manager.appendMessage(userMessage('Answer'));
  return manager.getSessionFile()!;
}

async function createBranchedSessionFile(): Promise<{
  sessionFile: string;
  activeAnswerId: string;
  abandonedAnswerId: string;
  sessionId: string;
  cwd: string;
}> {
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-branch-'));
  const manager = SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
  appendBinding(manager);
  const sharedPromptId = manager.appendMessage(assistantMessage('Shared prompt'));
  const abandonedAnswerId = manager.appendMessage(userMessage('Abandoned answer'));
  manager.appendCustomEntry(BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE, {
    schemaVersion: 1,
    reason: 'switch',
    state: { schemaVersion: 1, operationalMode: 'execute' },
    source: 'user',
  });
  manager.branch(sharedPromptId);
  manager.appendCustomEntry(BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE, {
    schemaVersion: 1,
    reason: 'switch',
    state: { schemaVersion: 1, operationalMode: 'specify' },
    source: 'user',
  });
  manager.appendMessage(assistantMessage('Active prompt'));
  const activeAnswerId = manager.appendMessage(userMessage('Active answer'));
  return {
    sessionFile: manager.getSessionFile()!,
    activeAnswerId,
    abandonedAnswerId,
    sessionId: manager.getSessionId(),
    cwd,
  };
}

async function writeExplicitSessionFixture(cwd: string, entries: readonly unknown[]): Promise<void> {
  const sessionRoot = join(cwd, '.brunch', 'sessions');
  await mkdir(sessionRoot, { recursive: true });
  await writeFile(
    join(sessionRoot, 'session.jsonl'),
    entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n',
  );
}

function appendBinding(manager: SessionManager): void {
  manager.appendCustomEntry(
    'brunch.session_binding',
    createSessionBindingData({
      specId: 1,
    }),
  );
}

async function createGraphRpcFixture(): Promise<{
  cwd: string;
  specAId: number;
  specBId: number;
  specANodeId: number;
  specBNodeId: number;
  specALsn: number;
  specBLsn: number;
}> {
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-graph-'));
  const graph = await openWorkspaceGraphRuntime(cwd);
  const specA = graph.commandExecutor.createSpec({ name: 'Spec A', slug: 'spec-a' });
  const specB = graph.commandExecutor.createSpec({ name: 'Spec B', slug: 'spec-b' });
  if (specA.status !== 'success' || specB.status !== 'success') {
    throw new Error('failed to create graph RPC fixture specs');
  }

  const commitA = runCreateOnlyMutation(graph.commandExecutor, {
    specId: specA.specId,
    nodes: [
      { ref: 'requirement', plane: 'intent', kind: 'requirement', title: 'Spec A requirement' },
      { ref: 'constraint', plane: 'intent', kind: 'constraint', title: 'Spec A constraint' },
    ],
    edges: [
      { category: 'dependency', settlement: 'settled' as const, source: 'requirement', target: 'constraint' },
    ],
  });
  const commitB = runCreateOnlyMutation(graph.commandExecutor, {
    specId: specB.specId,
    nodes: [{ ref: 'goal', plane: 'intent', kind: 'goal', title: 'Spec B goal' }],
    edges: [],
  });
  if (commitA.status !== 'success' || commitB.status !== 'success') {
    throw new Error('failed to create graph RPC fixture graph');
  }

  return {
    cwd,
    specAId: specA.specId,
    specBId: specB.specId,
    specANodeId: commitA.createdNodes.requirement!.id,
    specBNodeId: commitB.createdNodes.goal!.id,
    specALsn: commitA.lsn,
    specBLsn: commitB.lsn,
  };
}

function activeCandidateEntry() {
  const projection = projectPresentCandidates({
    exchangeId: 'domain',
    heading: 'Domain?',
    body: 'What are we specifying?',
    candidates: [
      {
        id: 'developer-tooling',
        title: 'Developer tooling',
        user_rubric: {
          core_bet: 'Build tools for developers.',
          best_fit: 'Developer workflows.',
          cost_complexity: 'Bounded fixture complexity.',
          covers_well: 'Active candidate reconstruction.',
          main_risks: 'Fixture-only coverage.',
          lock_in_constraints: 'Uses the active ask continuation.',
          recommendation: 'Select this candidate.',
        },
        meta_rubric: {
          legibility_cost_of_knowing: 'Easy to inspect.',
          failure_modes: 'Schema validation rejects drift.',
          coverage_range: 'Pending RPC readback.',
          commitment: 'Fixture state only.',
        },
        graph_refs: [],
      },
    ],
  });
  return {
    id: 'present-candidates-1',
    type: 'message',
    parentId: 'binding-session-1-spec-1',
    message: {
      role: 'toolResult',
      toolCallId: 'present-call-1',
      toolName: 'present_candidates',
      content: [{ type: 'text', text: formatPresentCandidates(projection) }],
      details: projection.details,
      isError: false,
    },
  };
}

function presentQuestionEntry() {
  return {
    id: 'present-question-1',
    type: 'message',
    parentId: 'binding-session-1-spec-1',
    message: {
      role: 'toolResult',
      toolCallId: 'present-call-1',
      toolName: 'present_question',
      content: [{ type: 'text', text: '## Domain?\n\nWhat are we specifying?' }],
      details: {
        schema: 'brunch.structured_exchange.present',
        v: 1,
        exchange_id: 'domain',
        tool_meta: { curr: 'present_question', next: 'request_response' },
        response_kind: 'answer',
        display: { heading: 'Domain?', body: 'What are we specifying?' },
      },
      isError: false,
    },
  };
}

function requestAnswerEntry(parentId = 'present-question-1') {
  return {
    id: 'request-answer-1',
    type: 'message',
    parentId,
    message: {
      role: 'toolResult',
      toolCallId: 'request-call-1',
      toolName: 'request_answer',
      content: [{ type: 'text', text: '### Response\n\nDeveloper tooling' }],
      details: {
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'domain',
        tool_meta: { prev: 'present_question', curr: 'request_answer' },
        answered: { text: 'Developer tooling' },
      },
      isError: false,
    },
  };
}

function sessionBindingEntry(sessionId = 'session-1', specId = 1) {
  return {
    id: `binding-${sessionId}-${specId}`,
    type: 'custom',
    parentId: null,
    customType: 'brunch.session_binding',
    data: createSessionBindingData({
      specId,
    }),
  };
}

describe('JSON-RPC handlers', () => {
  it('refuses persisted provider asks occupied by malformed or exchange-mismatched results without mutation', async () => {
    for (const [name, details] of [
      ['malformed', { raw: 'pi' }],
      [
        'mismatched',
        {
          schema: 'brunch.structured_exchange.request',
          v: 1,
          exchange_id: 'other-exchange',
          tool_meta: { curr: 'ask' },
          question: { body: 'Choose?' },
          answered: { text: 'Wrong identity.' },
        },
      ],
    ] as const) {
      const cwd = await mkdtemp(join(tmpdir(), `brunch-rpc-poisoned-ask-${name}-`));
      const setup = await createWorkspaceSessionCoordinator({ cwd }).createSetupSession({
        specTitle: 'Poisoned persisted ask',
      });
      const manager = SessionManager.open(setup.session.file);
      manager.appendMessage({
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            id: 'provider-call',
            name: 'ask',
            arguments: { exchangeId: 'ask-1', body: 'Choose?' },
          },
        ],
        api: 'anthropic-messages',
        provider: 'anthropic',
        model: 'test',
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: 'toolUse',
        timestamp: 0,
      } as never);
      manager.appendMessage({
        role: 'toolResult',
        toolName: 'ask',
        toolCallId: 'provider-call',
        content: [],
        details,
        isError: false,
        timestamp: 1,
      } as never);
      flushSessionManagerToFile(manager, setup.session.file);
      const before = await readFile(setup.session.file, 'utf8');
      const handlers = createRpcHandlers({ coordinator: createWorkspaceSessionCoordinator({ cwd }), cwd });
      const call = (id: number, method: string, params?: unknown) =>
        handlers.handle({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) });

      await expect(call(1, 'session.pendingExchange')).resolves.toMatchObject({ result: { status: 'idle' } });
      await expect(
        call(2, 'session.submitExchangeResponse', { exchangeId: 'ask-1', answer: { text: 'Duplicate.' } }),
      ).resolves.toMatchObject({ error: { code: -32008, message: 'No pending structured exchange' } });
      await expect(readFile(setup.session.file, 'utf8')).resolves.toBe(before);
    }
  });

  it('drives a persisted provider-authored standalone ask through one-shot public RPC', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-persisted-ask-'));
    const setup = await createWorkspaceSessionCoordinator({ cwd }).createSetupSession({
      specTitle: 'Persisted ask spec',
    });
    const manager = SessionManager.open(setup.session.file);
    manager.appendMessage({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Retained assistant framing.' },
        {
          type: 'toolCall',
          id: 'toolu_fe1348_anchor',
          name: 'ask',
          arguments: { exchangeId: 'fe1348-anchor-1', body: 'What should be canonical?' },
        },
      ],
      api: 'anthropic-messages',
      provider: 'anthropic',
      model: 'test',
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: 'toolUse',
      timestamp: 0,
    } as never);
    flushSessionManagerToFile(manager, setup.session.file);
    const before = await readFile(setup.session.file, 'utf8');
    const call = async (id: number, method: string, params?: unknown) =>
      createRpcHandlers({ coordinator: createWorkspaceSessionCoordinator({ cwd }), cwd }).handle({
        jsonrpc: '2.0',
        id,
        method,
        ...(params === undefined ? {} : { params }),
      });

    for (const [id, method] of [
      [1, 'session.triggerExchange'],
      [2, 'session.pendingExchange'],
    ] as const) {
      await expect(call(id, method)).resolves.toMatchObject({
        result: { status: 'pending', exchange: { exchangeId: 'fe1348-anchor-1', mode: 'text' } },
      });
      await expect(readFile(setup.session.file, 'utf8')).resolves.toBe(before);
    }
    await expect(call(3, 'session.exchanges')).resolves.toMatchObject({ result: { status: 'open_prompt' } });
    await expect(
      call(4, 'session.submitExchangeResponse', {
        exchangeId: 'fe1348-anchor-1',
        answer: { text: 'Canonical JSONL.' },
      }),
    ).resolves.toMatchObject({ result: { status: 'accepted' } });

    const after = await readFile(setup.session.file, 'utf8');
    const delta = after
      .slice(before.length)
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(delta).toHaveLength(1);
    expect(delta[0].message).toMatchObject({
      role: 'toolResult',
      toolName: 'ask',
      toolCallId: 'toolu_fe1348_anchor',
      details: { exchange_id: 'fe1348-anchor-1', answered: { text: 'Canonical JSONL.' } },
    });
    await expect(call(5, 'session.pendingExchange')).resolves.toMatchObject({ result: { status: 'idle' } });
    await expect(call(6, 'session.exchanges')).resolves.toMatchObject({ result: { status: 'ready' } });
    await expect(
      projectSessionPresentationFile({
        target: { specId: setup.spec.id, sessionId: setup.session.id },
        sessionFile: setup.session.file,
      }),
    ).resolves.toMatchObject({
      status: 'ready',
      presentation: {
        entries: expect.arrayContaining([
          expect.objectContaining({
            kind: 'ask',
            exchangeId: 'fe1348-anchor-1',
            terminal: expect.objectContaining({ status: 'answered' }),
          }),
        ]),
      },
    });
    await expect(
      call(7, 'session.submitExchangeResponse', {
        exchangeId: 'fe1348-anchor-1',
        answer: { text: 'Duplicate.' },
      }),
    ).resolves.toMatchObject({ error: { code: -32008 } });
    await expect(readFile(setup.session.file, 'utf8')).resolves.toBe(after);
  });
  it('rejects combined standalone-host and sidecar-driver authority', () => {
    const hostedSession = {} as HostedSessionRpcBoundary;
    // @ts-expect-error hosted-session authority and sidecar handles are mutually exclusive
    const invalidOptions: Parameters<typeof createWebSidecarRpcHandlers>[0] = {
      coordinator: coordinator(),
      cwd: '/tmp/brunch-project',
      hostedSession,
      sessionTurnDriver: {
        async prompt() {
          return { driven: true };
        },
      },
    };

    expect(() => createWebSidecarRpcHandlers(invalidOptions as never)).toThrow(
      'hostedSession cannot be combined with sidecar session driver handles',
    );
  });

  it('discovers the current public Brunch JSON-RPC surface', async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp/brunch-project',
    });

    const response = await handlers.handle({
      jsonrpc: '2.0',
      id: 30,
      method: 'rpc.discover',
    });

    expect(response).toMatchObject({ jsonrpc: '2.0', id: 30 });
    if (!('result' in response)) throw new Error('expected success response');

    const methods = (
      response.result as {
        methods: Array<{
          method: string;
          description: string;
          paramsSchema: unknown;
          resultSchema: unknown;
          examples: Array<Record<string, unknown>>;
        }>;
      }
    ).methods;
    expect(methods.map((entry) => entry.method).sort()).toEqual([
      'execute.replanAbandonRun',
      'execute.replanRecommendation',
      'execute.replanRegeneratePlan',
      'execute.replanStartNewRun',
      'execute.run',
      'execute.runTraceIndex',
      'execute.runs',
      'graph.nodeNeighborhood',
      'graph.overview',
      'rpc.discover',
      'session.exchanges',
      'session.pendingExchange',
      'session.runtimeState',
      'session.submitExchangeResponse',
      'session.submitMessage',
      'session.triggerExchange',
      'workspace.activate',
      'workspace.selectionState',
      'workspace.state',
    ]);

    const discoveredNames = new Set(methods.map((entry) => entry.method));
    for (const entry of methods) {
      expect(entry.description).toEqual(expect.any(String));
      expect(entry.description.length).toBeGreaterThan(10);
      expect(entry.paramsSchema).toEqual(expect.any(Object));
      expect(entry.resultSchema).toEqual(expect.any(Object));
      expect(entry.examples.length).toBeGreaterThanOrEqual(1);
      for (const example of entry.examples) {
        expect(example).toMatchObject({ jsonrpc: '2.0', method: entry.method });
        expect(discoveredNames.has(String(example.method))).toBe(true);
      }
    }
  });

  it('rejects params on method discovery', async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp/brunch-project',
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 31,
        method: 'rpc.discover',
        params: {},
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 31,
      error: { code: -32602, message: 'Invalid params' },
    });
  });

  it('keeps discovery product-shaped and exposes workspace activation variants', async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp/brunch-project',
    });

    const response = await handlers.handle({
      jsonrpc: '2.0',
      id: 32,
      method: 'rpc.discover',
    });
    if (!('result' in response)) throw new Error('expected success response');

    const result = response.result as {
      methods: Array<{
        method: string;
        paramsSchema: unknown;
        examples: unknown[];
      }>;
    };
    const methods = result.methods;
    const discoveryJson = JSON.stringify(result);
    expect(discoveryJson).not.toContain('get_commands');
    expect(discoveryJson).not.toContain('get_state');
    expect(discoveryJson).not.toContain('"method":"prompt"');
    expect(discoveryJson).not.toContain('/brunch');

    const activation = methods.find((entry) => entry.method === 'workspace.activate');
    expect(activation).toBeDefined();
    const activationSchema = JSON.stringify(activation?.paramsSchema);
    for (const action of ['continue', 'openSession', 'newSession', 'newSpec', 'cancel']) {
      expect(activationSchema).toContain(action);
    }
  });

  it('discovers selected-spec graph read methods with schemas and examples', async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp/brunch-project',
    });

    const response = await handlers.handle({
      jsonrpc: '2.0',
      id: 34,
      method: 'rpc.discover',
    });
    if (!('result' in response)) throw new Error('expected success response');

    const methods = (
      response.result as {
        methods: Array<{
          method: string;
          description: string;
          paramsSchema: unknown;
          resultSchema: unknown;
          examples: unknown[];
        }>;
      }
    ).methods;
    const overview = methods.find((entry) => entry.method === 'graph.overview');
    const neighborhood = methods.find((entry) => entry.method === 'graph.nodeNeighborhood');

    expect(overview).toBeDefined();
    expect(neighborhood).toBeDefined();
    expect(JSON.stringify(overview?.paramsSchema)).toContain('specId');
    const overviewResultSchema = JSON.stringify(overview?.resultSchema);
    expect(overviewResultSchema).toContain('nodes');
    expect(overviewResultSchema).toContain('edges');
    expect(overviewResultSchema).toContain('lsn');
    expect(overviewResultSchema).not.toContain('nodeCount');
    expect(overviewResultSchema).not.toContain('edgeCount');
    expect(JSON.stringify(neighborhood?.paramsSchema)).toContain('nodeId');
    const neighborhoodResultSchema = JSON.stringify(neighborhood?.resultSchema);
    expect(neighborhoodResultSchema).toContain('found');
    expect(neighborhoodResultSchema).toContain('not_found');
    expect(neighborhoodResultSchema).not.toContain('success');
    expect(neighborhoodResultSchema).not.toContain('anchor');
    expect(neighborhoodResultSchema).not.toContain('neighbors');
    expect(overview?.examples).toContainEqual({
      jsonrpc: '2.0',
      id: expect.any(Number),
      method: 'graph.overview',
      params: { specId: expect.any(Number) },
    });
    expect(neighborhood?.examples).toContainEqual({
      jsonrpc: '2.0',
      id: expect.any(Number),
      method: 'graph.nodeNeighborhood',
      params: { specId: expect.any(Number), nodeId: expect.any(Number), hops: expect.any(Number) },
    });
  });

  it('discovers exact session projection wire shapes', async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp/brunch-project',
    });

    const response = await handlers.handle({
      jsonrpc: '2.0',
      id: 35,
      method: 'rpc.discover',
    });
    if (!('result' in response)) throw new Error('expected success response');

    const methods = (
      response.result as {
        methods: Array<{
          method: string;
          paramsSchema: TSchema & { properties?: Record<string, unknown> };
          resultSchema: TSchema & { properties?: Record<string, unknown> };
          examples: Array<{ params?: unknown }>;
        }>;
      }
    ).methods;
    const exchanges = methods.find((entry) => entry.method === 'session.exchanges');
    const pending = methods.find((entry) => entry.method === 'session.pendingExchange');
    const runtimeState = methods.find((entry) => entry.method === 'session.runtimeState');
    const submitMessage = methods.find((entry) => entry.method === 'session.submitMessage');
    const submit = methods.find((entry) => entry.method === 'session.submitExchangeResponse');

    for (const entry of [exchanges, pending]) {
      if (!entry) throw new Error('expected discovered selected-session projection method');
      expect(entry.paramsSchema.properties?.specId).toMatchObject({
        type: 'integer',
        minimum: 1,
      });
      expect(Value.Check(entry.paramsSchema, { sessionId: 'session-1' })).toBe(true);
      expect(Value.Check(entry.paramsSchema, { sessionId: 'session-1', specId: 1 })).toBe(true);
      for (const example of entry.examples.filter((example) => example.params !== undefined)) {
        expect(Value.Check(entry.paramsSchema, example.params)).toBe(true);
      }
    }

    if (!runtimeState) throw new Error('expected discovered session.runtimeState method');
    expect(runtimeState.paramsSchema.properties?.specId).toMatchObject({
      type: 'integer',
      minimum: 1,
    });
    expect(Value.Check(runtimeState.paramsSchema, { sessionId: 'session-1' })).toBe(false);
    expect(Value.Check(runtimeState.paramsSchema, { sessionId: 'session-1', specId: 1 })).toBe(true);
    for (const example of runtimeState.examples.filter((example) => example.params !== undefined)) {
      expect(Value.Check(runtimeState.paramsSchema, example.params)).toBe(true);
    }

    if (!submit) throw new Error('expected discovered session.submitExchangeResponse method');
    expect(submit.resultSchema.properties?.capture).toBeUndefined();

    if (!submitMessage) throw new Error('expected discovered session.submitMessage method');
    expect(JSON.stringify(submitMessage.paramsSchema.properties?.text)).toContain('string');
    expect(JSON.stringify(submitMessage.paramsSchema.properties?.interruption)).toContain('boolean');
    expect(submitMessage.resultSchema.properties?.capture).toBeUndefined();
    for (const example of submitMessage.examples.filter((example) => example.params !== undefined)) {
      expect(Value.Check(submitMessage.paramsSchema, example.params)).toBe(true);
    }
  });

  it('serves discovery examples that are valid JSON-RPC requests for advertised methods', async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp/brunch-project',
    });

    const response = await handlers.handle({
      jsonrpc: '2.0',
      id: 33,
      method: 'rpc.discover',
    });
    if (!('result' in response)) throw new Error('expected success response');

    const methods = (
      response.result as {
        methods: Array<{
          method: string;
          examples: unknown[];
        }>;
      }
    ).methods;
    const discoveredNames = new Set(methods.map((entry) => entry.method));
    const exampleRequestSchema = {
      type: 'object',
      properties: {
        jsonrpc: { const: '2.0' },
        id: {
          anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }],
        },
        method: { type: 'string' },
        params: {},
      },
      required: ['jsonrpc', 'method'],
      additionalProperties: false,
    };

    for (const entry of methods) {
      for (const example of entry.examples) {
        expect(Value.Check(exampleRequestSchema, example)).toBe(true);
        expect(discoveredNames.has((example as { method: string }).method)).toBe(true);
      }
    }
  });

  it('serves structured workspace selection state without invoking the TUI picker', async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(selectSpecState()),
      cwd: '/tmp/brunch-project',
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 20,
        method: 'workspace.selectionState',
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 20,
      result: {
        status: 'select_spec',
        requiresSelection: true,
        cwd: '/tmp/brunch-project',
        currentSpec: {
          id: 1,
          title: 'Alpha spec',
          kind: 'product',
          origin: 'greenfield',
          relatesToSpecId: null,
        },
        currentSessionFile: '/tmp/brunch-project/.brunch/sessions/session-1.jsonl',
        specs: [{ spec: { id: 1 }, sessions: [{ id: 'session-1' }] }],
        unavailableSessions: [{ reason: 'missing_header' }],
      },
    });
  });

  it('publishes workspace mutation invalidation through the shared product update bus', async () => {
    const productUpdates = createProductUpdatePublisher();
    const observed: unknown[] = [];
    productUpdates.subscribe((updates) => observed.push(...updates));
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp/brunch-project',
      productUpdates,
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 35,
        method: 'workspace.activate',
        params: { decision: { action: 'continue', specId: 1, sessionFile: 'session-1.jsonl' } },
      }),
    ).resolves.toMatchObject({ jsonrpc: '2.0', id: 35, result: { status: 'ready' } });

    expect(observed).toEqual([
      { topic: 'workspace.state', specId: 1, sessionId: 'session-1' },
      { topic: 'workspace.selectionState', specId: 1, sessionId: 'session-1' },
      { topic: 'session.pendingExchange', specId: 1, sessionId: 'session-1' },
      { topic: 'session.exchanges', specId: 1, sessionId: 'session-1' },
      { topic: 'session.runtimeState', specId: 1, sessionId: 'session-1' },
    ]);
  });

  it('activates valid spec/session decisions and returns serializable product state', async () => {
    const decisions: SpecSessionActivationDecision[] = [];
    const handlers = createRpcHandlers({
      cwd: '/tmp/brunch-project',
      coordinator: {
        ...coordinator(),
        async activateWorkspace(decision): Promise<WorkspaceActivationState> {
          decisions.push(decision);
          return decision.action === 'cancel'
            ? cancelledState()
            : readyState('/tmp/brunch-project/.brunch/sessions/session-1.jsonl');
        },
      },
    });

    const validDecisions: SpecSessionActivationDecision[] = [
      { action: 'cancel' },
      { action: 'newSpec', title: 'New spec' },
      { action: 'newSession', specId: 1 },
      {
        action: 'continue',
        specId: 1,
        sessionFile: 'session-1.jsonl',
      },
      {
        action: 'openSession',
        specId: 1,
        sessionFile: 'session-2.jsonl',
      },
    ];

    for (const [index, decision] of validDecisions.entries()) {
      await expect(
        handlers.handle({
          jsonrpc: '2.0',
          id: 21 + index,
          method: 'workspace.activate',
          params: { decision },
        }),
      ).resolves.toMatchObject({
        jsonrpc: '2.0',
        id: 21 + index,
        result:
          decision.action === 'cancel'
            ? { status: 'cancelled', spec: { id: 1 } }
            : {
                status: 'ready',
                spec: { id: 1 },
                session: { id: 'session-1' },
              },
      });
      expect(decisions).toHaveLength(index + 1);
      expect(decisions[index]).toEqual(decision);
    }
  });

  it('rejects invalid workspace activation params', async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp/brunch-project',
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 22,
        method: 'workspace.activate',
        params: { decision: { action: 'openSession', specId: 1 } },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 22,
      error: { code: -32602, message: 'Invalid params' },
    });
  });

  it('keeps RPC initial selection independent from TUI picker imports', async () => {
    const source = await readFile(new URL('../handlers.ts', import.meta.url), 'utf8');

    expect(source).not.toContain('workspace-dialog');
    expect(source).not.toContain('createWorkspaceDialogComponent');
    expect(source).not.toContain('pi --mode rpc');
  });

  it('serves the named workspace.state method', async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp/brunch-project',
    });

    const result = await handlers.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'workspace.state',
    });

    expect(result).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        status: 'ready',
        spec: { id: 1, title: 'Alpha spec', kind: 'product', origin: 'greenfield', relatesToSpecId: null },
        session: { id: 'session-1' },
      },
    });
  });

  it('serves session exchanges from the coordinator-selected session', async () => {
    const sessionFile = await createSessionFile();
    const handlers = createRpcHandlers({
      coordinator: coordinator(readyState(sessionFile)),
      cwd: '/tmp/brunch-project',
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 3,
        method: 'session.exchanges',
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 3,
      result: {
        status: 'ready',
        exchanges: [{ promptEntryIds: [expect.any(String)] }],
      },
    });
  });

  it('triggerExchange is a kick surface: seeds origination context and reports idle when no assistant-created exchange exists', async () => {
    // D49-L/D78-L revised 2026-06-12: the product mints no deterministic
    // exchange. On a fresh session triggerExchange seeds and reports idle;
    // pending state exists only once the assistant has created an exchange.
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-start-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: 'Start spec',
    });
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    });

    const start = await handlers.handle({
      jsonrpc: '2.0',
      id: 40,
      method: 'session.triggerExchange',
    });
    expect(start).toMatchObject({
      jsonrpc: '2.0',
      id: 40,
      result: { status: 'idle', exchange: null },
    });

    const sessionText = await readFile(workspace.session.file, 'utf8');
    expect(sessionText).toContain('brunch.context_seed');
    expect(sessionText).not.toContain('present_options');

    // Once an assistant-created exchange exists (fixture stand-in), the same
    // kick surface reports it as pending.
    const minted = mintExchangeIntoWorkspace(workspace);
    const pending = await handlers.handle({
      jsonrpc: '2.0',
      id: 41,
      method: 'session.triggerExchange',
    });
    expect(pending).toMatchObject({
      jsonrpc: '2.0',
      id: 41,
      result: { status: 'pending', exchange: { exchangeId: minted.exchangeId } },
    });
  });

  it('reads the selected pending structured exchange from transcript truth', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-pending-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: 'Pending spec',
    });
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    });

    const minted = mintExchangeIntoWorkspace(workspace);
    const pending = await handlers.handle({
      jsonrpc: '2.0',
      id: 47,
      method: 'session.pendingExchange',
    });

    expect(pending).toMatchObject({
      jsonrpc: '2.0',
      id: 47,
      result: {
        status: 'pending',
        exchange: {
          exchangeId: minted.exchangeId,
          prompt: 'Choose grounding direction 1',
          lens: 'intent',
          options: expect.arrayContaining([
            expect.objectContaining({
              id: 'new-from-scratch',
              content: 'Start a new spec workspace from a blank slate.',
              rationale: 'Choose this for deterministic RPC coverage.',
            }),
          ]),
          note: { allowed: true },
        },
      },
    });
  });

  it('reads an explicit pending exchange without opening the selected workspace session', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-explicit-pending-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: 'Explicit pending spec',
    });
    mintExchangeIntoWorkspace(workspace);

    const handlers = createRpcHandlers({
      coordinator: {
        ...coordinatorInstance,
        async openDefaultWorkspace() {
          throw new Error('explicit pending reads must not open selected session');
        },
      },
      cwd,
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 49,
        method: 'session.pendingExchange',
        params: { sessionId: workspace.session.id, specId: workspace.spec.id },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 49,
      result: {
        status: 'pending',
        exchange: { exchangeId: 'deterministic-grounding-choice-1' },
      },
    });
  });

  it('reads an explicit active candidate exchange without a sidecar prompt store', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-tuple-pending-'));
    await writeExplicitSessionFixture(cwd, [
      { type: 'session', id: 'session-1', cwd },
      sessionBindingEntry(),
      activeCandidateEntry(),
    ]);
    const handlers = createRpcHandlers({
      coordinator: coordinator(selectSpecState()),
      cwd,
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 149,
        method: 'session.pendingExchange',
        params: { sessionId: 'session-1', specId: 1 },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 149,
      result: {
        status: 'pending',
        exchange: {
          exchangeId: 'domain',
          mode: 'single-select',
          prompt: 'Domain?',
          details: expect.stringContaining('What are we specifying?'),
        },
      },
    });
  });

  it('serves tuple-shaped exchange and transcript projections explicitly', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-tuple-projection-'));
    await writeExplicitSessionFixture(cwd, [
      { type: 'session', id: 'session-1', cwd },
      sessionBindingEntry(),
      presentQuestionEntry(),
      requestAnswerEntry(),
    ]);
    const handlers = createRpcHandlers({
      coordinator: coordinator(selectSpecState()),
      cwd,
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 150,
        method: 'session.exchanges',
        params: { sessionId: 'session-1', specId: 1 },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 150,
      result: {
        status: 'ready',
        exchanges: [
          {
            promptEntryIds: [expect.any(String)],
            responseEntryIds: [expect.any(String)],
          },
        ],
      },
    });
  });

  it('reports idle pending state when the selected session has no open prompt', async () => {
    const sessionFile = await createSessionFile();
    const handlers = createRpcHandlers({
      coordinator: coordinator(readyState(sessionFile)),
      cwd: '/tmp/brunch-project',
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 50,
        method: 'session.pendingExchange',
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 50,
      result: { status: 'idle', exchange: null },
    });
  });

  it('reports idle pending state after selected and explicit terminal unavailable request tuples', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-unavailable-idle-'));
    const sessionFile = join(cwd, '.brunch', 'sessions', 'session.jsonl');
    await writeExplicitSessionFixture(cwd, [
      { type: 'session', id: 'session-1', cwd },
      sessionBindingEntry(),
      presentQuestionEntry(),
      {
        ...requestAnswerEntry(),
        id: 'request-answer-unavailable',
        message: {
          ...requestAnswerEntry().message,
          details: {
            schema: 'brunch.structured_exchange.request',
            v: 1,
            exchange_id: 'domain',
            tool_meta: { prev: 'present_question', curr: 'request_answer' },
            unavailable: { message: 'Editor unavailable.' },
          },
        },
      },
    ]);
    const handlers = createRpcHandlers({
      coordinator: coordinator(readyState(sessionFile)),
      cwd,
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 152,
        method: 'session.pendingExchange',
      }),
    ).resolves.toMatchObject({
      result: { status: 'idle', exchange: null },
    });
    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 153,
        method: 'session.pendingExchange',
        params: { sessionId: 'session-1', specId: 1 },
      }),
    ).resolves.toMatchObject({
      result: { status: 'idle', exchange: null },
    });
  });

  it('reports idle pending state after an explicit terminal cancelled request_choices tuple', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-cancelled-idle-'));
    await writeExplicitSessionFixture(cwd, [
      { type: 'session', id: 'session-1', cwd },
      sessionBindingEntry(),
      {
        ...presentQuestionEntry(),
        id: 'present-options-1',
        message: {
          ...presentQuestionEntry().message,
          toolName: 'present_question',
          details: {
            schema: 'brunch.structured_exchange.present',
            v: 1,
            exchange_id: 'domain',
            tool_meta: { curr: 'present_question', next: 'request_response' },
            response_kind: 'choices',
            display: { heading: 'Choose priorities' },
            options: [{ id: 'speed', content: 'Move quickly' }],
          },
        },
      },
      {
        id: 'request-choices-cancelled',
        type: 'message',
        parentId: 'present-options-1',
        message: {
          role: 'toolResult',
          toolCallId: 'request-call-choices-cancelled',
          toolName: 'request_choices',
          content: [{ type: 'text', text: '### Response\n\nCancelled.' }],
          details: {
            schema: 'brunch.structured_exchange.request',
            v: 1,
            exchange_id: 'domain',
            tool_meta: { prev: 'present_question', curr: 'request_choices' },
            cancelled: { message: 'User cancelled the selection.' },
          },
          isError: false,
        },
      },
    ]);
    const handlers = createRpcHandlers({
      coordinator: coordinator(selectSpecState()),
      cwd,
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 154,
        method: 'session.pendingExchange',
        params: { sessionId: 'session-1', specId: 1 },
      }),
    ).resolves.toMatchObject({
      result: { status: 'idle', exchange: null },
    });
  });

  it('returns a product-shaped no-session error when reading pending without a selected session', async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(selectSpecState()),
      cwd: '/tmp/brunch-project',
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 51,
        method: 'session.pendingExchange',
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 51,
      error: { code: -32001, message: 'No selected Brunch session' },
    });
  });

  it('keeps all selected-session reads on one active sibling branch without non-linear errors', async () => {
    const { sessionFile, activeAnswerId, abandonedAnswerId, sessionId, cwd } =
      await createBranchedSessionFile();
    const handlers = createRpcHandlers({
      coordinator: coordinator(readyState(sessionFile)),
      cwd,
    });

    const [pending, exchanges, runtime] = await Promise.all([
      handlers.handle({ jsonrpc: '2.0', id: 52, method: 'session.pendingExchange' }),
      handlers.handle({ jsonrpc: '2.0', id: 53, method: 'session.exchanges' }),
      handlers.handle({
        jsonrpc: '2.0',
        id: 54,
        method: 'session.runtimeState',
        params: { sessionId, specId: 1 },
      }),
    ]);

    expect(pending).toMatchObject({ result: { status: 'idle', exchange: null } });
    expect(exchanges).toMatchObject({
      result: {
        status: 'ready',
        exchanges: [expect.objectContaining({ responseEntryIds: [activeAnswerId] })],
      },
    });
    expect(exchanges).not.toMatchObject({
      result: { exchanges: [expect.objectContaining({ responseEntryIds: [abandonedAnswerId] })] },
    });
    expect(runtime).toMatchObject({
      result: { status: 'ready', agent: { operationalMode: 'specify', role: 'elicitor' } },
    });
    expect([pending, exchanges, runtime]).not.toContainEqual(
      expect.objectContaining({ error: expect.objectContaining({ code: -32002 }) }),
    );
  });

  it('responds to the deterministic listed-option exchange and closes the projection', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-respond-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: 'Respond spec',
    });
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    });

    const exchangeId = mintExchangeIntoWorkspace(workspace).exchangeId;

    const response = await handlers.handle({
      jsonrpc: '2.0',
      id: 54,
      method: 'session.submitExchangeResponse',
      params: {
        exchangeId,
        answer: { optionId: 'new-from-scratch' },
        note: 'This is a greenfield product.',
      },
    });

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 54,
      result: {
        status: 'accepted',
        exchangeId,
        answer: {
          optionId: 'new-from-scratch',
          label: 'Start a new spec workspace from a blank slate.',
        },
        note: 'This is a greenfield product.',
      },
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 55,
        method: 'session.pendingExchange',
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 55,
      result: { status: 'idle', exchange: null },
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 56,
        method: 'session.exchanges',
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 56,
      result: {
        status: 'ready',
        exchanges: [
          {
            // present toolCall + present toolResult + request toolCall — the
            // synthetic call halves keep the transcript provider-legal (no
            // orphan tool_result); both assistant-side calls group prompt-side.
            promptEntryIds: [expect.any(String), expect.any(String), expect.any(String)],
            responseEntryIds: [expect.any(String)],
          },
        ],
      },
    });

    const sessionText = await readFile(workspace.session.file, 'utf8');
    expect(sessionText).toContain('brunch.structured_exchange.request');
    expect(sessionText).toContain(
      '"tool_meta":{"prev":"present_candidates","curr":"request_choice","next":"capture_candidate"}',
    );
    expect(sessionText).not.toContain('"prev":"present_question","curr":"request_choice"');
    expect(sessionText).toContain('This is a greenfield product.');
  });

  it('approves a pending review exchange into the selected spec graph and publishes graph invalidations', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-review-approve-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({ specTitle: 'Review approval spec' });
    const graph = await openWorkspaceGraphRuntime(cwd);
    const existing = runCreateOnlyMutation(graph.commandExecutor, {
      specId: workspace.spec.id,
      nodes: [{ ref: 'goal', plane: 'intent', kind: 'goal', title: 'Existing selected-spec goal' }],
      edges: [],
    });
    if (existing.status !== 'success') throw new Error('failed to create existing graph node');
    const payload = {
      schemaVersion: 1,
      lens: 'intent',
      epistemicStatus: 'asserted',
      grounding: { summary: 'User asked to approve requirement graph facts.', support: ['Transcript'] },
      pitch: { title: 'Approve reviewed graph facts', narrative: 'Creates one reviewed requirement.' },
      entityDrafts: [
        {
          draftId: 'requirement-draft',
          proposedCode: 'REQ1',
          settlement: 'settled' as const,
          plane: 'intent',
          kind: 'requirement',
          title: 'Reviewed requirement',
          body: 'This exact reviewed node should be accepted.',
        },
      ],
      edgeDrafts: [
        {
          category: 'rationale',
          settlement: 'settled' as const,
          stance: 'for',
          support: { draftId: 'requirement-draft' },
          claim: { existingCode: 'G1' },
          rationale: 'The reviewed requirement supports the selected-spec goal.',
        },
      ],
    } as const;
    const projection = projectPresentReviewSet({ exchangeId: 'review-cycle', payload });
    workspace.session.manager.appendMessage({
      role: 'toolResult',
      toolCallId: 'present-review-call-1',
      toolName: 'present_review_set',
      content: [{ type: 'text', text: '## Approve reviewed graph facts' }],
      details: projection.details,
      isError: false,
      timestamp: 0,
    });
    flushSessionManagerToFile(workspace.session.manager);
    const productUpdates = createProductUpdatePublisher();
    const updates: unknown[] = [];
    productUpdates.subscribe((batch) => updates.push(...batch));
    const handlers = createRpcHandlers({ coordinator: coordinatorInstance, cwd, productUpdates });

    const response = await handlers.handle({
      jsonrpc: '2.0',
      id: 276,
      method: 'session.submitExchangeResponse',
      params: {
        exchangeId: 'review-cycle',
        answer: { review: { decision: 'approve', comment: 'Looks correct.' } },
      },
    });

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 276,
      result: {
        status: 'accepted',
        exchangeId: 'review-cycle',
        answer: { review: { decision: 'approve', comment: 'Looks correct.' } },
        review: {
          status: 'approved',
          lsn: expect.any(Number),
          createdNodes: { 'requirement-draft': { id: expect.any(Number), code: 'REQ1' } },
        },
      },
    });
    if (!('result' in response)) throw new Error('expected review approval response');
    const lsn = (response.result as { review: { lsn: number } }).review.lsn;
    expect(updates).toContainEqual({ topic: 'graph.overview', specId: workspace.spec.id, lsn });
    expect(updates).toContainEqual({ topic: 'graph.nodeNeighborhood', specId: workspace.spec.id, lsn });

    const overview = await handlers.handle({
      jsonrpc: '2.0',
      id: 277,
      method: 'graph.overview',
      params: { specId: workspace.spec.id },
    });
    expect(overview).toMatchObject({
      result: {
        nodes: expect.arrayContaining([
          expect.objectContaining({
            kind: 'requirement',
            title: 'Reviewed requirement',
            basis: 'explicit',
          }),
        ]),
      },
    });
    const sessionText = await readFile(workspace.session.file, 'utf8');
    expect(sessionText).toContain('request_review');
    expect(sessionText).toContain('requirement-draft → REQ1');

    const retry = await handlers.handle({
      jsonrpc: '2.0',
      id: 278,
      method: 'session.submitExchangeResponse',
      params: {
        exchangeId: 'review-cycle',
        answer: { review: { decision: 'approve', comment: 'Looks correct.' } },
      },
    });
    expect(retry).toMatchObject({ error: { code: -32008 } });
    const afterRetryOverview = await handlers.handle({
      jsonrpc: '2.0',
      id: 2781,
      method: 'graph.overview',
      params: { specId: workspace.spec.id },
    });
    expect(afterRetryOverview).toMatchObject('result' in overview ? { result: overview.result } : {});
    const afterRetry = await readFile(workspace.session.file, 'utf8');
    expect(afterRetry).toBe(sessionText);
    expect(afterRetry.match(/"curr":"request_review"/g)).toHaveLength(1);
  });

  it('records conversational digest feedback through the public submit path and closes the continuation', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-digest-approve-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({ specTitle: 'Digest approval spec' });
    const projection = projectPresentDigest({
      exchangeId: 'digest-cycle',
      heading: 'Review source digest',
      body: 'Approve before mapping.',
      digest: { abstract: 'The source asks for advisory capture before settlement.' },
    });
    workspace.session.manager.appendMessage({
      role: 'toolResult',
      toolCallId: 'present-digest-call-1',
      toolName: 'present_digest',
      content: [{ type: 'text', text: '## Review source digest\n\nApprove before mapping.' }],
      details: projection.details,
      isError: false,
      timestamp: 0,
    });
    flushSessionManagerToFile(workspace.session.manager);
    const handlers = createRpcHandlers({ coordinator: coordinatorInstance, cwd });

    const response = await handlers.handle({
      jsonrpc: '2.0',
      id: 279,
      method: 'session.submitExchangeResponse',
      params: {
        exchangeId: 'digest-cycle',
        answer: { text: 'The digest sounds right; continue to clarification.' },
      },
    });

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 279,
      result: {
        status: 'accepted',
        exchangeId: 'digest-cycle',
        answer: { text: 'The digest sounds right; continue to clarification.' },
      },
    });

    await expect(
      handlers.handle({ jsonrpc: '2.0', id: 280, method: 'session.pendingExchange' }),
    ).resolves.toMatchObject({ result: { status: 'idle', exchange: null } });
    await expect(
      handlers.handle({ jsonrpc: '2.0', id: 281, method: 'session.exchanges' }),
    ).resolves.toMatchObject({ result: { status: 'ready', openPrompt: null } });

    const sessionText = await readFile(workspace.session.file, 'utf8');
    expect(sessionText).toContain('"toolName":"ask"');
    expect(sessionText).toContain('present_digest');
    expect(sessionText).toContain('The digest sounds right; continue to clarification.');
    expect(sessionText).not.toContain('accepted_abstract');
  });

  it('drives the registered no-UI questionnaire through public RPC to the same durable terminal as local UI', async () => {
    const registry = createLiveAskRegistry();
    const registered = new Map<string, { execute: (...args: unknown[]) => Promise<{ details: unknown }> }>();
    registerStructuredExchange(
      {
        registerTool: (tool: { name: string }) => registered.set(tool.name, tool as never),
      } as unknown as ExtensionAPI,
      { liveExchange: registry.opener },
    );
    const ask = registered.get('ask')!;
    const digestDetails = projectPresentDigest({
      exchangeId: 'digest-final',
      heading: 'Digest',
      digest: { abstract: 'Runtime final abstract.' },
    }).details;
    const branch = [{ type: 'message', message: { role: 'toolResult', details: digestDetails } }];
    const params = {
      exchangeId: 'digest-questionnaire-rpc',
      acceptsDigest: 'digest-final',
      questions: [
        { id: 'goal', kind: 'free-text', prompt: 'What is the goal?' },
        {
          id: 'route',
          kind: 'single-select',
          prompt: 'Which route?',
          options: [{ id: 'safe', label: 'Safe' }],
        },
      ],
    };
    const headlessDone = ask.execute('call', params, new AbortController().signal, undefined, {
      hasUI: false,
      sessionManager: { getBranch: () => branch },
    });
    const handlers = createWebSidecarRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp/brunch-project',
      sessionExchangeAnswer: { answerer: registry.answerer },
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 282,
        method: 'session.answerExchange',
        params: {
          exchangeId: 'digest-questionnaire-rpc',
          answer: JSON.stringify({
            schema: 'brunch.ask.questionnaire-answer',
            answers: [{ questionId: 'goal', kind: 'free-text', text: 'Capture safely.' }],
          }),
        },
      }),
    ).resolves.toMatchObject({ error: { code: -32602, message: INVALID_LIVE_EXCHANGE_ANSWER_MESSAGE } });
    expect(registry.reader.openAsks()).toHaveLength(1);

    const envelope = JSON.stringify({
      schema: 'brunch.ask.questionnaire-answer',
      answers: [
        { questionId: 'goal', kind: 'free-text', text: 'Capture safely.' },
        { questionId: 'route', kind: 'single-select', optionId: 'safe' },
      ],
    });
    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 283,
        method: 'session.answerExchange',
        params: { exchangeId: 'digest-questionnaire-rpc', answer: envelope },
      }),
    ).resolves.toEqual({ jsonrpc: '2.0', id: 283, result: { status: 'completed' } });
    const headless = await headlessDone;
    const local = await ask.execute('local-call', params, undefined, undefined, {
      hasUI: true,
      sessionManager: { getBranch: () => branch },
      ui: {
        custom: async () => [
          { questionId: 'goal', kind: 'free-text', text: 'Capture safely.' },
          { questionId: 'route', kind: 'single-select', optionId: 'safe' },
        ],
      },
    } as unknown as StructuredExchangeUiContext);
    expect(headless.details).toEqual(local.details);
    expect(headless.details).toMatchObject({
      accepts_digest: 'digest-final',
      answered: { accepted_abstract: 'Runtime final abstract.' },
    });
    expect(registry.reader.openAsks()).toEqual([]);
  });

  it('rejects a review approval whose persisted review set is not a valid ReviewSetDetailsPayload', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-review-malformed-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: 'Malformed review set spec',
    });
    workspace.session.manager.appendCustomMessageEntry(
      'brunch.elicitation_prompt',
      'Approve reviewed graph facts',
      true,
      {
        exchangeId: 'malformed-review-set',
        lens: 'intent',
        mode: 'review',
        prompt: 'Approve reviewed graph facts',
        options: [],
        note: { allowed: true },
        reviewSet: {
          nodes: [
            {
              draft_id: 'requirement-draft',
              proposed_code: 'REQ1',
              settlement: 'settled' as const,
              plane: 'intent',
              kind: 'requirement',
              title: 'Reviewed requirement',
            },
          ],
          edges: [{ category: 'dependency', settlement: 'settled' as const, dependency: {}, dependent: {} }],
        },
      },
    );
    flushSessionManagerToFile(workspace.session.manager);
    const handlers = createRpcHandlers({ coordinator: coordinatorInstance, cwd });

    const response = await handlers.handle({
      jsonrpc: '2.0',
      id: 278,
      method: 'session.submitExchangeResponse',
      params: {
        exchangeId: 'malformed-review-set',
        answer: { review: { decision: 'approve' } },
      },
    });

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 278,
      result: {
        status: 'accepted',
        exchangeId: 'malformed-review-set',
        review: {
          status: 'structural_illegal',
          diagnostics: expect.arrayContaining([expect.objectContaining({ field: expect.any(String) })]),
        },
      },
    });
  });

  it('accepts active candidate answers without submit-time capture or graph invalidations', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-response-capture-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: 'Transcript-bound spec',
    });
    const graph = await openWorkspaceGraphRuntime(cwd);
    const wrongSpec = graph.commandExecutor.createSpec({ name: 'Wrong default spec', slug: 'wrong-default' });
    if (wrongSpec.status !== 'success') throw new Error('failed to create wrong-spec fixture');
    const productUpdates = createProductUpdatePublisher();
    const updates: unknown[] = [];
    productUpdates.subscribe((batch) => updates.push(...batch));
    const handlers = createRpcHandlers({
      coordinator: coordinator({
        ...workspace,
        spec: {
          id: wrongSpec.specId,
          title: 'Wrong default spec',
          kind: 'product',
          origin: 'greenfield',
          relatesToSpecId: null,
        },
      }),
      cwd,
      productUpdates,
    });

    const firstExchangeId = mintExchangeIntoWorkspace(workspace, 0).exchangeId;
    await handlers.handle({
      jsonrpc: '2.0',
      id: 271,
      method: 'session.submitExchangeResponse',
      params: { exchangeId: firstExchangeId, answer: { optionId: 'new-from-scratch' } },
    });
    const secondExchange = mintExchangeIntoWorkspace(workspace, 1);

    const response = await handlers.handle({
      jsonrpc: '2.0',
      id: 273,
      method: 'session.submitExchangeResponse',
      params: {
        exchangeId: secondExchange.exchangeId,
        answer: { optionId: 'new-from-scratch' },
      },
    });

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 273,
      result: {
        status: 'accepted',
        exchangeId: secondExchange.exchangeId,
        answer: { optionId: 'new-from-scratch' },
      },
    });
    if (!('result' in response)) throw new Error('expected response');
    expect(response.result).not.toHaveProperty('capture');
    expect(updates).not.toContainEqual({
      topic: 'graph.overview',
      specId: workspace.spec.id,
      lsn: expect.any(Number),
    });
    expect(updates).not.toContainEqual({
      topic: 'graph.nodeNeighborhood',
      specId: workspace.spec.id,
      lsn: expect.any(Number),
    });

    const overview = await handlers.handle({
      jsonrpc: '2.0',
      id: 274,
      method: 'graph.overview',
      params: { specId: workspace.spec.id },
    });
    expect(overview).toMatchObject({
      result: {
        nodes: [],
        edges: [],
      },
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 275,
        method: 'graph.overview',
        params: { specId: wrongSpec.specId },
      }),
    ).resolves.toMatchObject({
      result: {
        nodes: [],
        edges: [],
      },
    });
  });

  it('accepts labeled ordinary messages without submit-time capture or graph invalidations', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-message-capture-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: 'Ordinary message capture spec',
    });
    const graph = await openWorkspaceGraphRuntime(cwd);
    const sibling = graph.commandExecutor.createSpec({ name: 'Sibling spec', slug: 'sibling-spec' });
    if (sibling.status !== 'success') throw new Error('failed to create sibling spec fixture');
    const productUpdates = createProductUpdatePublisher();
    const updates: unknown[] = [];
    productUpdates.subscribe((batch) => updates.push(...batch));
    const handlers = createRpcHandlers({
      coordinator: coordinator({
        ...workspace,
        spec: {
          id: sibling.specId,
          title: 'Sibling spec',
          kind: 'product',
          origin: 'greenfield',
          relatesToSpecId: null,
        },
      }),
      cwd,
      productUpdates,
    });

    const before = await readFile(workspace.session.file, 'utf8');
    const response = await handlers.handle({
      jsonrpc: '2.0',
      id: 280,
      method: 'session.submitMessage',
      params: {
        text: [
          'Goal: Keep ordinary messages in transcript truth for the next capture sweep.',
          'Context: Users may say this outside a structured exchange.',
          'Constraint: Do not silently answer pending structured requests.',
          'Criterion: Submit-time RPC responses stay slim.',
        ].join('\n'),
      },
    });

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 280,
      result: {
        status: 'accepted',
        interruption: false,
      },
    });
    if (!('result' in response)) throw new Error('expected submitMessage response');
    expect(response.result).not.toHaveProperty('capture');
    expect(updates).not.toContainEqual({
      topic: 'graph.overview',
      specId: workspace.spec.id,
      lsn: expect.any(Number),
    });
    expect(updates).not.toContainEqual({
      topic: 'graph.nodeNeighborhood',
      specId: workspace.spec.id,
      lsn: expect.any(Number),
    });

    const overview = await handlers.handle({
      jsonrpc: '2.0',
      id: 281,
      method: 'graph.overview',
      params: { specId: workspace.spec.id },
    });
    expect(overview).toMatchObject({
      result: {
        nodes: [],
        edges: [],
      },
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 282,
        method: 'graph.overview',
        params: { specId: sibling.specId },
      }),
    ).resolves.toMatchObject({ result: { nodes: [], edges: [] } });
    const after = await readFile(workspace.session.file, 'utf8');
    expect(after.length).toBeGreaterThan(before.length);
    expect(after).toContain('Keep ordinary messages in transcript truth for the next capture sweep.');
  });

  it('resolves stable graph mentions at submit time for the selected session transcript', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-message-mentions-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({ specTitle: 'Mention spec' });
    const graph = await openWorkspaceGraphRuntime(cwd);
    const node = graph.commandExecutor.createNode({
      specId: workspace.spec.id,
      plane: 'intent',
      kind: 'goal',
      title: 'Mentioned goal',
    });
    if (node.status !== 'success') throw new Error('failed to create mention fixture node');
    const handlers = createRpcHandlers({ coordinator: coordinatorInstance, cwd });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 283,
        method: 'session.submitMessage',
        params: { text: 'Please check #G1 before the next turn.' },
      }),
    ).resolves.toMatchObject({ result: { status: 'accepted', interruption: false } });

    const sessionText = await readFile(workspace.session.file, 'utf8');
    expect(sessionText).toContain('brunch.mention');
    expect(sessionText).toContain('Mentioned goal');
    expect(sessionText).toContain(`"seenLsn":${node.lsn}`);
  });

  it('rejects ordinary messages while a structured exchange is pending unless they are explicit interruptions', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-message-pending-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: 'Pending message guard spec',
    });
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    });
    mintExchangeIntoWorkspace(workspace);
    const before = await readFile(workspace.session.file, 'utf8');

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 284,
        method: 'session.submitMessage',
        params: { text: 'This should not answer the pending exchange.' },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 284,
      error: {
        code: -32009,
        message:
          'Pending structured exchange requires session.submitExchangeResponse unless this message is an explicit interruption',
      },
    });
    await expect(readFile(workspace.session.file, 'utf8')).resolves.toBe(before);
  });

  it('records explicit interruptions transcript-visibly without answering the pending structured exchange', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-message-interruption-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({ specTitle: 'Interruption spec' });
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    });
    const exchangeId = mintExchangeIntoWorkspace(workspace).exchangeId;

    const response = await handlers.handle({
      jsonrpc: '2.0',
      id: 286,
      method: 'session.submitMessage',
      params: {
        text: 'Pause this question and let me clarify a broader constraint first.',
        interruption: true,
      },
    });

    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: 286,
      result: {
        status: 'accepted',
        interruption: true,
      },
    });
    const sessionText = await readFile(workspace.session.file, 'utf8');
    expect(sessionText).toContain('Pause this question and let me clarify a broader constraint first.');
    expect(sessionText).toContain('brunch.session_interruption');
    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 287,
        method: 'session.pendingExchange',
      }),
    ).resolves.toMatchObject({
      result: {
        status: 'pending',
        exchange: { exchangeId },
      },
    });
  });

  it('rejects mismatched elicitation response ids without appending transcript entries', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-respond-bad-id-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: 'Bad id spec',
    });
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    });
    mintExchangeIntoWorkspace(workspace);
    const before = await readFile(workspace.session.file, 'utf8');

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 59,
        method: 'session.submitExchangeResponse',
        params: {
          exchangeId: 'not-current',
          answer: { optionId: 'new-from-scratch' },
        },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 59,
      error: {
        code: -32006,
        message: 'Pending structured exchange does not match request',
      },
    });
    await expect(readFile(workspace.session.file, 'utf8')).resolves.toBe(before);
  });

  it('rejects unknown elicitation option ids without appending transcript entries', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-respond-bad-option-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: 'Bad option spec',
    });
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    });
    const exchangeId = mintExchangeIntoWorkspace(workspace).exchangeId;
    const before = await readFile(workspace.session.file, 'utf8');

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 61,
        method: 'session.submitExchangeResponse',
        params: { exchangeId, answer: { optionId: 'missing-option' } },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 61,
      error: { code: -32007, message: 'Invalid elicitation option' },
    });
    await expect(readFile(workspace.session.file, 'utf8')).resolves.toBe(before);
  });

  it('guards duplicate elicitation responses without appending transcript entries', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-respond-duplicate-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: 'Duplicate spec',
    });
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    });
    const exchangeId = mintExchangeIntoWorkspace(workspace).exchangeId;
    await handlers.handle({
      jsonrpc: '2.0',
      id: 63,
      method: 'session.submitExchangeResponse',
      params: { exchangeId, answer: { optionId: 'new-from-scratch' } },
    });
    const before = await readFile(workspace.session.file, 'utf8');

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 64,
        method: 'session.submitExchangeResponse',
        params: { exchangeId, answer: { optionId: 'new-from-scratch' } },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 64,
      error: { code: -32008, message: 'No pending structured exchange' },
    });
    await expect(readFile(workspace.session.file, 'utf8')).resolves.toBe(before);
  });

  it('resumes an open deterministic elicitation prompt without duplicating transcript entries', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-resume-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: 'Resume spec',
    });
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    });

    const minted = mintExchangeIntoWorkspace(workspace);
    // Establish the kick-surface baseline (seed already written), then prove
    // a second trigger neither duplicates entries nor disturbs the pending
    // assistant-created exchange.
    const first = await handlers.handle({
      jsonrpc: '2.0',
      id: 43,
      method: 'session.triggerExchange',
    });
    expect(first).toMatchObject({
      jsonrpc: '2.0',
      id: 43,
      result: { status: 'pending', exchange: { exchangeId: minted.exchangeId } },
    });
    const before = await readFile(workspace.session.file, 'utf8');

    const second = await handlers.handle({
      jsonrpc: '2.0',
      id: 44,
      method: 'session.triggerExchange',
    });
    const after = await readFile(workspace.session.file, 'utf8');

    expect(second).toMatchObject({
      jsonrpc: '2.0',
      id: 44,
      result: { status: 'pending', exchange: { exchangeId: minted.exchangeId } },
    });
    expect(after).toBe(before);
  });

  it('returns a product-shaped no-session error when starting elicitation without a selected session', async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(selectSpecState()),
      cwd: '/tmp/brunch-project',
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 45,
        method: 'session.triggerExchange',
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 45,
      error: { code: -32001, message: 'No selected Brunch session' },
    });
  });

  it('serves exchanges from the active branch of a selected sibling tree', async () => {
    const { sessionFile } = await createBranchedSessionFile();
    const handlers = createRpcHandlers({
      coordinator: coordinator(readyState(sessionFile)),
      cwd: '/tmp/brunch-project',
    });

    await expect(
      handlers.handle({ jsonrpc: '2.0', id: 8, method: 'session.exchanges' }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 8,
      result: { status: 'ready', exchanges: [expect.any(Object)] },
    });
  });

  it('serves session exchanges by durable session id without opening the selected workspace session', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-explicit-session-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const first = await coordinatorInstance.createSetupSession({
      specTitle: 'Explicit spec',
    });
    first.session.manager.appendMessage(assistantMessage('First question'));
    first.session.manager.appendMessage(userMessage('First answer'));
    const second = await coordinatorInstance.createSetupSessionForCurrentSpec();
    if (second.status !== 'ready') {
      throw new Error('expected a ready second session');
    }
    const handlers = createRpcHandlers({
      coordinator: {
        ...coordinatorInstance,
        async openDefaultWorkspace() {
          throw new Error('explicit reads must not open selected session');
        },
      },
      cwd,
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 9,
        method: 'session.exchanges',
        params: { sessionId: first.session.id },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 9,
      result: {
        status: 'ready',
        exchanges: [{ promptEntryIds: [expect.any(String)] }],
      },
    });
  });

  it('serves transcript display rows by durable session id without opening the selected workspace session', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-display-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: 'Display spec',
    });
    workspace.session.manager.appendMessage(assistantMessage('Display question'));
    workspace.session.manager.appendMessage(userMessage('Display answer'));
    const handlers = createRpcHandlers({
      coordinator: {
        ...coordinatorInstance,
        async openDefaultWorkspace() {
          throw new Error('explicit reads must not open selected session');
        },
      },
      cwd,
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 10,
        method: 'session.exchanges',
        params: { sessionId: workspace.session.id },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 10,
      result: { status: 'ready' },
    });
  });

  it('serves runtime state by explicit spec and session id without opening selected session', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-runtime-state-'));
    const latestState: BrunchAgentState = {
      schemaVersion: 1,
      operationalMode: 'specify',
    };
    await writeExplicitSessionFixture(cwd, [
      { type: 'session', id: 'session-1', cwd },
      sessionBindingEntry('session-1', 1),
      {
        id: 'runtime-state-1',
        type: 'custom',
        parentId: 'binding-session-1-1',
        customType: BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
        data: {
          schemaVersion: 1,
          reason: 'switch',
          state: latestState,
          source: 'user',
        },
      },
    ]);
    const handlers = createRpcHandlers({
      coordinator: {
        ...coordinator(),
        async openDefaultWorkspace() {
          throw new Error('explicit reads must not open selected session');
        },
      },
      cwd,
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 14,
        method: 'session.runtimeState',
        params: { sessionId: 'session-1', specId: 1 },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 14,
      result: {
        status: 'ready',
        specId: 1,
        sessionId: 'session-1',
        agent: {
          operationalMode: 'specify',
          role: 'elicitor',
        },
        mentions: { graphNodes: [], files: [] },
        world: { graph: { latestLsn: null }, git: { head: null } },
      },
    });
  });

  it('requires an explicit spec id for runtime state reads', async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp/brunch-project',
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 15,
        method: 'session.runtimeState',
        params: { sessionId: 'session-1' },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 15,
      error: { code: -32602, message: 'Invalid params' },
    });
  });

  it('validates explicit session projection against a requested spec id', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-explicit-spec-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({
      specTitle: 'Explicit spec',
    });
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 10,
        method: 'session.exchanges',
        params: { sessionId: workspace.session.id, specId: 9999 },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 10,
      error: {
        code: -32003,
        message: 'Brunch session does not belong to requested spec',
      },
    });
  });

  it('returns a product-shaped error for explicit sessions with duplicate durable bindings', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-duplicate-binding-'));
    await writeExplicitSessionFixture(cwd, [
      { type: 'session', id: 'session-1', cwd },
      sessionBindingEntry(),
      sessionBindingEntry(),
    ]);
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd,
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 16,
        method: 'session.exchanges',
        params: { sessionId: 'session-1' },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 16,
      error: {
        code: -32005,
        message: 'Brunch session self-description is invalid',
      },
    });
  });

  it('returns a product-shaped not-found error for a headerless explicit session file', async () => {
    const headerlessCwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-missing-header-'));
    await writeExplicitSessionFixture(headerlessCwd, [sessionBindingEntry()]);
    const headerlessHandlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: headerlessCwd,
    });

    await expect(
      headerlessHandlers.handle({
        jsonrpc: '2.0',
        id: 19,
        method: 'session.exchanges',
        params: { sessionId: 'session-1' },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 19,
      error: {
        code: -32004,
        message: 'Brunch session not found',
      },
    });
  });

  it('resolves explicit forked sessions by Pi header id with inherited binding', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-header-mismatch-'));
    await writeExplicitSessionFixture(cwd, [
      { type: 'session', id: 'session-header', cwd },
      sessionBindingEntry('session-binding'),
    ]);
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd,
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 18,
        method: 'session.exchanges',
        params: { sessionId: 'session-header' },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 18,
      result: {
        exchanges: [],
      },
    });
  });

  it('returns a product-shaped error for unknown explicit sessions', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-missing-session-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    await coordinatorInstance.createSetupSession({ specTitle: 'Explicit spec' });
    const handlers = createRpcHandlers({
      coordinator: coordinatorInstance,
      cwd,
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 11,
        method: 'session.exchanges',
        params: { sessionId: 'session-does-not-exist' },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 11,
      error: {
        code: -32004,
        message: 'Brunch session not found',
      },
    });
  });

  it('serves active-branch exchanges for an explicit sibling session', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-rpc-explicit-branch-'));
    const coordinatorInstance = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinatorInstance.createSetupSession({ specTitle: 'Explicit branch spec' });
    const manager = SessionManager.open(workspace.session.file);
    const sharedPromptId = manager.appendMessage(assistantMessage('Shared prompt'));
    manager.appendMessage(userMessage('Abandoned answer'));
    manager.branch(sharedPromptId);
    const activeAnswerId = manager.appendMessage(userMessage('Active answer'));
    const reopened = SessionManager.open(workspace.session.file);
    expect(reopened.getBranch().at(-1)?.id).toBe(activeAnswerId);
    const handlers = createRpcHandlers({ coordinator: coordinatorInstance, cwd });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 12,
        method: 'session.exchanges',
        params: { sessionId: workspace.session.id },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 12,
      result: { status: 'ready', exchanges: [{ responseEntryIds: [activeAnswerId] }] },
    });
  });

  it('rejects raw file params on session session exchange RPC', async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp/brunch-project',
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 4,
        method: 'session.exchanges',
        params: { file: '/tmp/not-a-product-param.jsonl' },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 4,
      error: { code: -32602, message: 'Invalid params' },
    });
  });

  it('returns a product-shaped no-session error without creating a session', async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(selectSpecState()),
      cwd: '/tmp/brunch-project',
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 5,
        method: 'session.exchanges',
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 5,
      error: { code: -32001, message: 'No selected Brunch session' },
    });
  });

  it('rejects invalid request id shapes', async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp/brunch-project',
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: { bad: true },
        method: 'workspace.state',
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Invalid Request' },
    });
  });

  it('returns structured errors for unknown methods', async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp/brunch-project',
    });

    await expect(handlers.handle({ jsonrpc: '2.0', id: 2, method: 'records.list' })).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 2,
      error: { code: -32601, message: 'Method not found' },
    });
  });

  it('serves selected-spec graph overview and node neighborhoods through public RPC', async () => {
    const fixture = await createGraphRpcFixture();
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: fixture.cwd,
    });

    const overviewA = await handlers.handle({
      jsonrpc: '2.0',
      id: 50,
      method: 'graph.overview',
      params: { specId: fixture.specAId },
    });
    expect(overviewA).toMatchObject({
      jsonrpc: '2.0',
      id: 50,
      result: {
        nodes: expect.arrayContaining([
          expect.objectContaining({ title: 'Spec A requirement', specId: fixture.specAId }),
          expect.objectContaining({ title: 'Spec A constraint', specId: fixture.specAId }),
        ]),
        edges: [
          expect.objectContaining({
            category: 'dependency',
            settlement: 'settled' as const,
            specId: fixture.specAId,
          }),
        ],
        lsn: fixture.specALsn,
      },
    });
    if (!('result' in overviewA)) throw new Error('expected graph overview');
    expect(overviewA.result).not.toHaveProperty('nodeCount');
    expect(overviewA.result).not.toHaveProperty('edgeCount');
    expect(JSON.stringify(overviewA.result)).not.toContain('Spec B goal');

    const overviewB = await handlers.handle({
      jsonrpc: '2.0',
      id: 51,
      method: 'graph.overview',
      params: { specId: fixture.specBId },
    });
    expect(overviewB).toMatchObject({
      jsonrpc: '2.0',
      id: 51,
      result: {
        nodes: [expect.objectContaining({ title: 'Spec B goal' })],
        edges: [],
        lsn: fixture.specBLsn,
      },
    });
    if (!('result' in overviewB)) throw new Error('expected graph overview');
    expect(overviewB.result).not.toHaveProperty('nodeCount');
    expect(overviewB.result).not.toHaveProperty('edgeCount');

    const crossSpecNeighborhood = await handlers.handle({
      jsonrpc: '2.0',
      id: 52,
      method: 'graph.nodeNeighborhood',
      params: { specId: fixture.specAId, nodeId: fixture.specBNodeId },
    });
    expect(crossSpecNeighborhood).toEqual({
      jsonrpc: '2.0',
      id: 52,
      result: {
        selector: { id: fixture.specBNodeId },
        status: 'not_found',
        related: [],
        edges: [],
      },
    });

    const neighborhood = await handlers.handle({
      jsonrpc: '2.0',
      id: 53,
      method: 'graph.nodeNeighborhood',
      params: { specId: fixture.specAId, nodeId: fixture.specANodeId, hops: 1 },
    });
    expect(neighborhood).toMatchObject({
      jsonrpc: '2.0',
      id: 53,
      result: {
        selector: { id: fixture.specANodeId },
        status: 'found',
        node: { id: fixture.specANodeId, specId: fixture.specAId },
        related: [{ title: 'Spec A constraint', specId: fixture.specAId }],
        edges: [{ category: 'dependency', settlement: 'settled' as const, specId: fixture.specAId }],
      },
    });
  });

  it('requires explicit params for selected-spec graph RPC reads', async () => {
    const handlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp/brunch-project',
    });

    await expect(
      handlers.handle({ jsonrpc: '2.0', id: 54, method: 'graph.overview' }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 54,
      error: { code: -32602, message: 'Invalid params' },
    });
    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 55,
        method: 'graph.nodeNeighborhood',
        params: { specId: 1 },
      }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 55,
      error: { code: -32602, message: 'Invalid params' },
    });
  });

  it('keeps graph-curation RPC out of the public registry', async () => {
    const fixture = await createGraphRpcFixture();
    const defaultHandlers = createRpcHandlers({
      coordinator: coordinator(),
      cwd: fixture.cwd,
    });
    const readOnlyHandlers = createReadOnlyRpcHandlers({
      coordinator: coordinator(),
      cwd: fixture.cwd,
    });

    await expect(
      defaultHandlers.handle({ jsonrpc: '2.0', id: 56, method: 'dev.graph.mutateGraph', params: {} }),
    ).resolves.toMatchObject({
      jsonrpc: '2.0',
      id: 56,
      error: { code: -32601, message: 'Method not found' },
    });

    const defaultDiscovery = await defaultHandlers.handle({ jsonrpc: '2.0', id: 57, method: 'rpc.discover' });
    const readOnlyDiscovery = await readOnlyHandlers.handle({
      jsonrpc: '2.0',
      id: 58,
      method: 'rpc.discover',
    });
    if (!('result' in defaultDiscovery) || !('result' in readOnlyDiscovery)) {
      throw new Error('expected discovery success');
    }

    const methodNames = (response: typeof defaultDiscovery) =>
      (
        response.result as {
          methods: Array<{ method: string }>;
        }
      ).methods.map((entry) => entry.method);

    expect(methodNames(defaultDiscovery)).not.toContain('dev.graph.mutateGraph');
    expect(methodNames(readOnlyDiscovery)).not.toContain('dev.graph.mutateGraph');
  });

  it('maps an attached-but-not-live sidecar driver to the public no-live-driver error', async () => {
    const handlers = createWebSidecarRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp/brunch-project',
      sessionTurnDriver: {
        async prompt() {
          return { driven: false };
        },
      },
    });

    await expect(
      handlers.handle({
        jsonrpc: '2.0',
        id: 60,
        method: 'session.driveTurn',
        params: { prompt: 'try to drive before the live session exists' },
      }),
    ).resolves.toEqual({
      jsonrpc: '2.0',
      id: 60,
      error: { code: -32010, message: NO_LIVE_AGENT_SESSION_DRIVER_MESSAGE },
    });
  });

  it('returns parse errors over newline-delimited JSON-RPC streams', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on('data', (chunk) => chunks.push(String(chunk)));

    const done = runJsonRpcLineServer({
      input,
      output,
      handlers: createRpcHandlers({
        coordinator: coordinator(),
        cwd: '/tmp/brunch-project',
      }),
    });

    input.end('not json\n');
    await done;

    expect(JSON.parse(chunks.join(''))).toEqual({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    });
  });

  it('returns internal errors for thrown newline-delimited JSON-RPC handlers', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on('data', (chunk) => chunks.push(String(chunk)));

    const done = runJsonRpcLineServer({
      input,
      output,
      handlers: {
        async handle() {
          throw new Error('boom');
        },
      },
    });

    input.end(`${JSON.stringify({ jsonrpc: '2.0', id: 15, method: 'workspace.state' })}\n`);
    await done;

    expect(JSON.parse(chunks.join(''))).toEqual({
      jsonrpc: '2.0',
      id: 15,
      error: { code: -32603, message: 'Internal error' },
    });
  });

  it('speaks newline-delimited JSON-RPC over streams', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on('data', (chunk) => chunks.push(String(chunk)));

    const done = runJsonRpcLineServer({
      input,
      output,
      handlers: createRpcHandlers({
        coordinator: coordinator(),
        cwd: '/tmp/brunch-project',
      }),
    });

    input.end(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'workspace.state' })}\n`);
    await done;

    expect(JSON.parse(chunks.join(''))).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: { status: 'ready' },
    });
  });

  it('writes product update notifications over stdio independently from responses', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const productUpdates = createProductUpdatePublisher();
    const chunks: string[] = [];
    output.on('data', (chunk) => chunks.push(String(chunk)));

    const done = runJsonRpcLineServer({
      input,
      output,
      handlers: createRpcHandlers({
        coordinator: coordinator(),
        cwd: '/tmp/brunch-project',
      }),
      productUpdates,
    });

    productUpdates.publish({ topic: 'graph.overview', specId: 1, lsn: 4 });
    input.end();
    await done;

    expect(JSON.parse(chunks.join(''))).toEqual({
      jsonrpc: '2.0',
      method: 'brunch.updated',
      params: {
        topics: ['graph.overview'],
        updates: [{ topic: 'graph.overview', specId: 1, lsn: 4 }],
      },
    });
  });

  it('parses stdio input as LF-framed JSON-RPC without splitting U+2028 inside strings', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on('data', (chunk) => chunks.push(String(chunk)));

    const done = runJsonRpcLineServer({
      input,
      output,
      handlers: createRpcHandlers({
        coordinator: coordinator(),
        cwd: '/tmp/brunch-project',
      }),
    });

    input.end(
      `${JSON.stringify({ jsonrpc: '2.0', id: 99, method: 'unknown.method', params: { text: 'a b' } })}\n`,
    );
    await done;

    expect(JSON.parse(chunks.join(''))).toEqual({
      jsonrpc: '2.0',
      id: 99,
      error: { code: -32601, message: 'Method not found' },
    });
  });
});
