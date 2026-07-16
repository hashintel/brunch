import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';

import type { SessionPresentationDelta } from '../../session/live-session-host.js';

/** Projects Pi's cumulative assistant updates into target-independent semantic deltas. */
export function createLiveSessionEventProjection(): (
  event: AgentSessionEvent,
) => SessionPresentationDelta | null {
  let run = 0;
  let assistantText = '';
  return (event) => {
    if (event.type === 'agent_start') {
      run += 1;
      assistantText = '';
      return null;
    }
    if (event.type === 'agent_settled') return { type: 'agent_settled' };
    if (event.type !== 'message_update') return null;
    const message = (event as { message?: { role?: string; content?: unknown } }).message;
    if (message?.role !== 'assistant' || !Array.isArray(message.content)) return null;
    const current = message.content
      .flatMap((block: { type?: string; text?: string }) =>
        block.type === 'text' && typeof block.text === 'string' ? [block.text] : [],
      )
      .join('');
    if (!current.startsWith(assistantText) || current.length === assistantText.length) return null;
    const text = current.slice(assistantText.length);
    assistantText = current;
    return { type: 'assistant_text_delta', runId: `run:${run}`, text };
  };
}
