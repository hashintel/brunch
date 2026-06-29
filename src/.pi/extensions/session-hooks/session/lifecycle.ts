import { SessionManager, type ExtensionAPI } from '@earendil-works/pi-coding-agent';

export type BrunchSessionBoundaryPhase = 'session_start' | 'before_agent_start' | 'assistant_message_start';

export interface BrunchSessionBoundaryPipelineContext {
  readonly sessionManager: SessionManager;
  readonly phase: BrunchSessionBoundaryPhase;
}

export type BrunchSessionBoundaryHandler = (sessionManager: SessionManager) => Promise<void> | void;
export type BrunchSessionBoundaryPipelineStep = (
  context: BrunchSessionBoundaryPipelineContext,
) => Promise<void> | void;

export interface BrunchSessionBoundaryPipelineOptions {
  readonly phase?: BrunchSessionBoundaryPhase;
  readonly refreshWorkspaceBinding?: BrunchSessionBoundaryHandler | undefined;
  readonly continuitySteps?: readonly BrunchSessionBoundaryPipelineStep[];
}

export async function runBrunchSessionBoundaryPipeline(
  sessionManager: SessionManager,
  options: BrunchSessionBoundaryPipelineOptions = {},
): Promise<void> {
  await options.refreshWorkspaceBinding?.(sessionManager);
  const context = { sessionManager, phase: options.phase ?? 'before_agent_start' };
  for (const step of options.continuitySteps ?? []) {
    await step(context);
  }
}

export async function bindBrunchSessionBoundary(
  sessionManager: SessionManager,
  onSessionBoundary?: BrunchSessionBoundaryHandler,
): Promise<void> {
  await runBrunchSessionBoundaryPipeline(sessionManager, { refreshWorkspaceBinding: onSessionBoundary });
}

export function registerBrunchSessionBoundaryRefreshHandlers(
  pi: ExtensionAPI,
  onSessionBoundary?: BrunchSessionBoundaryHandler,
  options: Omit<BrunchSessionBoundaryPipelineOptions, 'phase' | 'refreshWorkspaceBinding'> = {},
): void {
  pi.on('before_agent_start', async (_event, ctx) => {
    await runBrunchSessionBoundaryPipeline(ctx.sessionManager as SessionManager, {
      ...options,
      phase: 'before_agent_start',
      refreshWorkspaceBinding: onSessionBoundary,
    });
  });
  pi.on('message_start', async (event, ctx) => {
    if (event.message.role === 'assistant') {
      await runBrunchSessionBoundaryPipeline(ctx.sessionManager as SessionManager, {
        ...options,
        phase: 'assistant_message_start',
        refreshWorkspaceBinding: onSessionBoundary,
      });
    }
  });
}

export function registerBrunchSessionBoundary(
  pi: ExtensionAPI,
  onSessionBoundary?: BrunchSessionBoundaryHandler,
  options: Omit<BrunchSessionBoundaryPipelineOptions, 'phase' | 'refreshWorkspaceBinding'> = {},
): void {
  pi.on('session_start', async (_event, ctx) => {
    await runBrunchSessionBoundaryPipeline(ctx.sessionManager as SessionManager, {
      ...options,
      phase: 'session_start',
      refreshWorkspaceBinding: onSessionBoundary,
    });
  });
  registerBrunchSessionBoundaryRefreshHandlers(pi, onSessionBoundary, options);
}
