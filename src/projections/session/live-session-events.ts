import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';

import type { SessionPresentationDelta } from '../../session/live-session-host.js';

/** Projects Pi's direct assistant text updates into target-independent semantic deltas. */
export function createLiveSessionEventProjection(): (
  event: AgentSessionEvent,
) => SessionPresentationDelta | null {
  let run = 0;
  return (event) => {
    if (event.type === 'agent_start') {
      run += 1;
      return null;
    }
    if (event.type === 'agent_settled') return { type: 'agent_settled' };
    if (event.type !== 'message_update') return null;
    const assistantEvent = event.assistantMessageEvent;
    if (assistantEvent?.type !== 'text_delta') return null;
    return { type: 'assistant_text_delta', runId: `run:${run}`, text: assistantEvent.delta };
  };
}
