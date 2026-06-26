import { describe, expect, it } from 'vitest';

import {
  bindBrunchSessionBoundary,
  registerBrunchSessionBoundary,
  runBrunchSessionBoundaryPipeline,
  type BrunchSessionBoundaryPipelineStep,
} from '../session-hooks/session/lifecycle.js';

describe('Brunch session-boundary lifecycle', () => {
  it('runs workspace rebinding and continuity steps through one ordered boundary pipeline', async () => {
    const events: string[] = [];
    const sessionManager = { id: 'session-manager' };
    const continuity: BrunchSessionBoundaryPipelineStep = ({ phase, sessionManager }) => {
      events.push(`continuity:${phase}:${(sessionManager as unknown as { id: string }).id}`);
    };

    await runBrunchSessionBoundaryPipeline(sessionManager as never, {
      phase: 'before_agent_start',
      refreshWorkspaceBinding: async (manager) => {
        events.push(`binding:${(manager as unknown as { id: string }).id}`);
      },
      continuitySteps: [continuity],
    });

    expect(events).toEqual(['binding:session-manager', 'continuity:before_agent_start:session-manager']);
  });

  it('preserves the previous bindBrunchSessionBoundary workspace-refresh behavior', async () => {
    const events: string[] = [];
    const sessionManager = { id: 'legacy-manager' };

    await bindBrunchSessionBoundary(sessionManager as never, async (manager) => {
      events.push((manager as unknown as { id: string }).id);
    });

    expect(events).toEqual(['legacy-manager']);
  });

  it('registers session_start, before_agent_start, and assistant message boundaries onto the same pipeline', async () => {
    const handlers = new Map<string, Array<(event: any, ctx: any) => Promise<void> | void>>();
    const phases: string[] = [];
    const sessionManager = { id: 'registered-manager' };

    registerBrunchSessionBoundary(
      {
        on(event: string, handler: (event: any, ctx: any) => Promise<void> | void) {
          handlers.set(event, [...(handlers.get(event) ?? []), handler]);
        },
      } as never,
      async () => {},
      {
        continuitySteps: [
          ({ phase }) => {
            phases.push(phase);
          },
        ],
      },
    );

    await handlers.get('session_start')?.[0]?.({}, { sessionManager });
    await handlers.get('before_agent_start')?.[0]?.({}, { sessionManager });
    await handlers.get('message_start')?.[0]?.({ message: { role: 'user' } }, { sessionManager });
    await handlers.get('message_start')?.[0]?.({ message: { role: 'assistant' } }, { sessionManager });

    expect(phases).toEqual(['session_start', 'before_agent_start', 'assistant_message_start']);
  });
});
