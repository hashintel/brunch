import { describe, it, expect, beforeEach } from 'vitest';
import { createTranslator, formatSSE } from './sse-adapter.js';

describe('formatSSE', () => {
	it('wraps a JSON object in SSE data line', () => {
		const result = formatSSE({ type: 'text-delta', id: 'text-1', delta: 'hi' });
		expect(result).toBe('data: {"type":"text-delta","id":"text-1","delta":"hi"}\n\n');
	});

	it('produces [DONE] terminator', () => {
		const result = formatSSE('[DONE]');
		expect(result).toBe('data: [DONE]\n\n');
	});
});

describe('translateEvent', () => {
	const messageId = 'msg-001';
	let translateEvent: ReturnType<typeof createTranslator>['translateEvent'];

	beforeEach(() => {
		({ translateEvent } = createTranslator());
	});

	it('translates message_start to start event', () => {
		const sdkMessage = {
			type: 'stream_event',
			event: { type: 'message_start', message: { id: messageId, role: 'assistant', content: [] } },
		};
		const events = translateEvent(sdkMessage);
		expect(events).toEqual([{ type: 'start', messageId }]);
	});

	it('translates text content_block_start to text-start', () => {
		const sdkMessage = {
			type: 'stream_event',
			event: {
				type: 'content_block_start',
				index: 1,
				content_block: { type: 'text', text: '' },
			},
		};
		const events = translateEvent(sdkMessage);
		expect(events).toEqual([{ type: 'text-start', id: 'text-1' }]);
	});

	it('translates text content_block_delta to text-delta with id', () => {
		const sdkMessage = {
			type: 'stream_event',
			event: {
				type: 'content_block_delta',
				index: 1,
				delta: { type: 'text_delta', text: 'Hello world' },
			},
		};
		const events = translateEvent(sdkMessage);
		expect(events).toEqual([{ type: 'text-delta', id: 'text-1', delta: 'Hello world' }]);
	});

	it('translates text content_block_stop to text-end', () => {
		// Register a text block first
		translateEvent({
			type: 'stream_event',
			event: { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
		});
		const sdkMessage = {
			type: 'stream_event',
			event: { type: 'content_block_stop', index: 1 },
		};
		const events = translateEvent(sdkMessage);
		expect(events).toEqual([{ type: 'text-end', id: 'text-1' }]);
	});

	it('translates thinking content_block_start to reasoning-start', () => {
		const sdkMessage = {
			type: 'stream_event',
			event: {
				type: 'content_block_start',
				index: 0,
				content_block: { type: 'thinking', thinking: '' },
			},
		};
		const events = translateEvent(sdkMessage);
		expect(events).toEqual([{ type: 'reasoning-start', id: 'reasoning-0' }]);
	});

	it('translates thinking content_block_delta to reasoning-delta', () => {
		const sdkMessage = {
			type: 'stream_event',
			event: {
				type: 'content_block_delta',
				index: 0,
				delta: { type: 'thinking_delta', thinking: 'Let me think...' },
			},
		};
		const events = translateEvent(sdkMessage);
		expect(events).toEqual([
			{ type: 'reasoning-delta', id: 'reasoning-0', delta: 'Let me think...' },
		]);
	});

	it('translates thinking content_block_stop to reasoning-end', () => {
		// Register a thinking block first
		translateEvent({
			type: 'stream_event',
			event: {
				type: 'content_block_start',
				index: 0,
				content_block: { type: 'thinking', thinking: '' },
			},
		});

		const sdkMessage = {
			type: 'stream_event',
			event: { type: 'content_block_stop', index: 0 },
		};
		const events = translateEvent(sdkMessage);
		expect(events).toEqual([{ type: 'reasoning-end', id: 'reasoning-0' }]);
	});

	it('translates message_stop to finish-step + finish', () => {
		const sdkMessage = {
			type: 'stream_event',
			event: { type: 'message_stop' },
		};
		const events = translateEvent(sdkMessage);
		expect(events).toEqual([
			{ type: 'finish-step' },
			{ type: 'finish', finishReason: 'stop' },
		]);
	});

	it('returns empty array for unhandled SDK message types', () => {
		const sdkMessage = { type: 'system', message: 'init' };
		const events = translateEvent(sdkMessage);
		expect(events).toEqual([]);
	});

	it('returns empty array for unhandled stream event types', () => {
		const sdkMessage = {
			type: 'stream_event',
			event: { type: 'ping' },
		};
		const events = translateEvent(sdkMessage);
		expect(events).toEqual([]);
	});
});
