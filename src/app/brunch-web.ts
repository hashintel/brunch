import { createAgentSessionRuntime, getAgentDir } from '@earendil-works/pi-coding-agent';

import { createLiveSessionEventProjection } from '../projections/session/live-session-events.js';
import { projectSessionPresentationFile } from '../projections/session/session-presentation.js';
import { createLiveSessionEventFrame } from '../rpc/live-session-contract.js';
import { startWebHost, type RunningWebHost } from '../rpc/web-host.js';
import { createLiveAskRegistry } from '../session/live-ask-registry.js';
import {
  createLiveSessionHost,
  type LiveSessionRuntime,
  type SessionTarget,
} from '../session/live-session-host.js';
import type { WorkspaceSessionCoordinator } from '../session/workspace-session-coordinator.js';
import { inspectCanonicalSessionFiles } from '../session/workspace-session-coordinator/canonical-session-files.js';
import { createBrunchAgentSessionRuntimeFactory, type BrunchAgentServicesOverride } from './brunch-tui.js';

export interface BrunchWebOptions {
  readonly cwd: string;
  readonly coordinator: WorkspaceSessionCoordinator;
  readonly createRuntime?: (target: SessionTarget) => Promise<LiveSessionRuntime>;
  /** Provider-backend substitution at Pi's existing service boundary for deterministic product tests. */
  readonly agentServices?: BrunchAgentServicesOverride;
  readonly startHost?: typeof startWebHost;
  readonly onStarted?: (host: RunningWebHost) => void;
}

export async function runBrunchWeb(options: BrunchWebOptions): Promise<RunningWebHost> {
  const liveSessions = createLiveSessionHost({
    createRuntime:
      options.createRuntime ??
      ((target) =>
        createStandaloneSessionRuntime(options.cwd, options.coordinator, target, options.agentServices)),
  });
  const host = await (options.startHost ?? startWebHost)({
    cwd: options.cwd,
    coordinator: options.coordinator,
    hostedSession: {
      liveSessions,
      async project(target) {
        const session = (await inspectCanonicalSessionFiles(options.cwd)).find(
          (candidate) =>
            candidate.available && candidate.id === target.sessionId && candidate.specId === target.specId,
        );
        if (!session?.available) throw new Error('Session target not found');
        return projectSessionPresentationFile({ target, sessionFile: session.file });
      },
    },
    sessionEvents: {
      subscribe(listener) {
        return liveSessions.subscribeAll((event) => listener(createLiveSessionEventFrame(event)));
      },
    },
  });
  const closeHost = host.close.bind(host);
  const running = {
    url: host.url,
    async close() {
      // Stop admitting HTTP/RPC work before disposing runtime cells. If a cell
      // reports an active turn, the public host is still guaranteed closed and
      // the classified disposal error remains visible to the caller.
      await closeHost();
      await liveSessions.dispose();
    },
  };
  options.onStarted?.(running);
  return running;
}

async function createStandaloneSessionRuntime(
  cwd: string,
  coordinator: WorkspaceSessionCoordinator,
  target: SessionTarget,
  agentServices?: BrunchAgentServicesOverride,
): Promise<LiveSessionRuntime> {
  const workspace = await coordinator.openTargetSession(target);

  const liveExchange = createLiveAskRegistry();
  const liveAgentSession = { current: null };
  const runtime = await createAgentSessionRuntime(
    createBrunchAgentSessionRuntimeFactory({
      workspace,
      coordinator: {
        inspectWorkspace: () => coordinator.inspectWorkspace(),
        activateWorkspace: (decision) => coordinator.activateWorkspace(decision),
        bindCurrentSpecToReplacementSession: (manager) =>
          coordinator.bindTargetSpecToReplacementSession(target, manager),
      },
      liveExchange,
      liveAgentSession,
      allowSubagents: true,
      ...(agentServices ? { agentServices } : {}),
    }),
    { cwd, agentDir: getAgentDir(), sessionManager: workspace.session.manager },
  );
  await runtime.session.bindExtensions({});
  const listeners = new Set<Parameters<LiveSessionRuntime['subscribe']>[0]>();
  const unsubscribeAsk = liveExchange.subscribe((ask) => {
    for (const listener of listeners) listener({ type: 'ask_opened', ask });
  });
  const project = createLiveSessionEventProjection();
  const unsubscribe = runtime.session.subscribe((event) => {
    const delta = project(event);
    if (delta) for (const listener of listeners) listener(delta);
  });
  return {
    prompt: (text) => runtime.session.prompt(text, { expandPromptTemplates: false, source: 'rpc' }),
    openAsks: () => liveExchange.reader.openAsks(),
    answerExchange: (exchangeId, answer) => liveExchange.answerer.submitAnswer({ exchangeId, answer }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async dispose() {
      unsubscribe();
      unsubscribeAsk();
      await runtime.dispose();
    },
  };
}
