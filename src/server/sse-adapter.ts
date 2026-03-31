/**
 * SSE Adapter — translates Claude Agent SDK stream events into
 * AI SDK UI Message Stream protocol events.
 *
 * Pure functions. No I/O, no side effects (aside from adapter state reset).
 */

/** AI SDK protocol event types we emit */
type AIEvent =
	| { type: 'start'; messageId: string }
	| { type: 'text-start'; id: string }
	| { type: 'text-delta'; id: string; delta: string }
	| { type: 'text-end'; id: string }
	| { type: 'reasoning-start'; id: string }
	| { type: 'reasoning-delta'; id: string; delta: string }
	| { type: 'reasoning-end'; id: string }
	| { type: 'finish-step' }
	| { type: 'finish'; finishReason: string }
	| { type: 'error'; errorText: string };

/** Minimal shape of an SDKPartialAssistantMessage from the Claude Agent SDK */
interface SDKStreamEvent {
	type: 'stream_event';
	event: {
		type: string;
		index?: number;
		message?: { id: string; role: string; content: unknown[] };
		content_block?: { type: string; thinking?: string; text?: string };
		delta?: { type: string; text?: string; thinking?: string };
	};
}

interface SDKOtherMessage {
	type: string;
}

type SDKMessage = SDKStreamEvent | SDKOtherMessage;

// Track content block types by index
const thinkingBlocks = new Set<number>();
const textBlocks = new Set<number>();

/**
 * Format a payload as an SSE data line.
 */
export function formatSSE(payload: AIEvent | '[DONE]'): string {
	if (payload === '[DONE]') return 'data: [DONE]\n\n';
	return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * Translate a single SDKMessage into zero or more AI SDK protocol events.
 */
export function translateEvent(sdkMessage: SDKMessage): AIEvent[] {
	if (sdkMessage.type !== 'stream_event') return [];

	const event = (sdkMessage as SDKStreamEvent).event;

	switch (event.type) {
		case 'message_start':
			return [{ type: 'start', messageId: event.message!.id }];

		case 'content_block_start': {
			const block = event.content_block!;
			if (block.type === 'thinking') {
				thinkingBlocks.add(event.index!);
				return [{ type: 'reasoning-start', id: `reasoning-${event.index}` }];
			}
			if (block.type === 'text') {
				textBlocks.add(event.index!);
				return [{ type: 'text-start', id: `text-${event.index}` }];
			}
			return [];
		}

		case 'content_block_delta': {
			const delta = event.delta!;
			if (delta.type === 'thinking_delta') {
				return [{
					type: 'reasoning-delta',
					id: `reasoning-${event.index}`,
					delta: delta.thinking!,
				}];
			}
			if (delta.type === 'text_delta') {
				return [{ type: 'text-delta', id: `text-${event.index}`, delta: delta.text! }];
			}
			return [];
		}

		case 'content_block_stop': {
			if (thinkingBlocks.has(event.index!)) {
				thinkingBlocks.delete(event.index!);
				return [{ type: 'reasoning-end', id: `reasoning-${event.index}` }];
			}
			if (textBlocks.has(event.index!)) {
				textBlocks.delete(event.index!);
				return [{ type: 'text-end', id: `text-${event.index}` }];
			}
			return [];
		}

		case 'message_stop':
			return [
				{ type: 'finish-step' },
				{ type: 'finish', finishReason: 'stop' },
			];

		default:
			return [];
	}
}

/**
 * Reset adapter state between requests.
 */
export function resetAdapter(): void {
	thinkingBlocks.clear();
	textBlocks.clear();
}
