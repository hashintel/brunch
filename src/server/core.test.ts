import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DB } from './db.js';

// Mock the Claude Agent SDK
const mockQuery = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
	query: mockQuery,
}));

const { conductTurn, extractPrompt, formatHistory } = await import('./core.js');
const { createDb, getOrCreateProject, getActivePath, createTurn, advanceHead } = await import('./db.js');

let db: DB;

beforeEach(() => {
	mockQuery.mockReset();
	db = createDb();
});

afterEach(() => {
	db.$client.close();
});

/** Create a mock async generator of SDK messages */
async function* makeMockStream(messages: Record<string, unknown>[]) {
	for (const msg of messages) {
		yield msg;
	}
}

describe('extractPrompt', () => {
	it('extracts content string from legacy format', () => {
		expect(extractPrompt([{ role: 'user', content: 'hello' }])).toBe('hello');
	});

	it('extracts text from parts array', () => {
		const msg = { role: 'user', parts: [{ type: 'text', text: 'world' }] };
		expect(extractPrompt([msg])).toBe('world');
	});

	it('returns empty string for empty array', () => {
		expect(extractPrompt([])).toBe('');
	});
});

describe('formatHistory', () => {
	it('returns prompt as-is when no turns', () => {
		expect(formatHistory([], 'hello')).toBe('hello');
	});

	it('formats turns into conversation history', () => {
		const turns = [
			{ answer: 'Hi', question: 'Hello back' },
		] as any[];
		const result = formatHistory(turns, 'next');
		expect(result).toContain('User: Hi');
		expect(result).toContain('Assistant: Hello back');
		expect(result).toContain('User: next');
	});
});

describe('conductTurn', () => {
	it('yields turn-created as first event', async () => {
		mockQuery.mockReturnValue(makeMockStream([
			{ type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-1' } } },
			{ type: 'stream_event', event: { type: 'message_stop' } },
		]));

		const project = getOrCreateProject(db);
		const events: any[] = [];
		for await (const event of conductTurn(db, project.id, 'hello')) {
			events.push(event);
		}

		expect(events[0].type).toBe('turn-created');
		expect(events[0].turn.answer).toBe('hello');
		expect(events[0].turn.phase).toBe('scope');
	});

	it('yields stream-start with message ID', async () => {
		mockQuery.mockReturnValue(makeMockStream([
			{ type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-42' } } },
			{ type: 'stream_event', event: { type: 'message_stop' } },
		]));

		const project = getOrCreateProject(db);
		const events: any[] = [];
		for await (const event of conductTurn(db, project.id, 'test')) {
			events.push(event);
		}

		const streamStart = events.find(e => e.type === 'stream-start');
		expect(streamStart).toBeDefined();
		expect(streamStart.messageId).toBe('msg-42');
	});

	it('yields thinking events for thinking_delta', async () => {
		mockQuery.mockReturnValue(makeMockStream([
			{ type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-1' } } },
			{ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Let me think...' } } },
			{ type: 'stream_event', event: { type: 'message_stop' } },
		]));

		const project = getOrCreateProject(db);
		const events: any[] = [];
		for await (const event of conductTurn(db, project.id, 'test')) {
			events.push(event);
		}

		const thinking = events.find(e => e.type === 'thinking');
		expect(thinking).toBeDefined();
		expect(thinking.delta).toBe('Let me think...');
	});

	it('yields text-delta events and persists assistant text', async () => {
		mockQuery.mockReturnValue(makeMockStream([
			{ type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-1' } } },
			{ type: 'stream_event', event: { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'Hello!' } } },
			{ type: 'stream_event', event: { type: 'message_stop' } },
		]));

		const project = getOrCreateProject(db);
		const events: any[] = [];
		for await (const event of conductTurn(db, project.id, 'test')) {
			events.push(event);
		}

		const textDelta = events.find(e => e.type === 'text-delta');
		expect(textDelta).toBeDefined();
		expect(textDelta.delta).toBe('Hello!');

		// Verify turn was persisted with assistant text
		const turns = getActivePath(db, project.id);
		expect(turns).toHaveLength(1);
		expect(turns[0].question).toBe('Hello!');
		expect(turns[0].answer).toBe('test');
	});

	it('yields stream-end and advances HEAD', async () => {
		mockQuery.mockReturnValue(makeMockStream([
			{ type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-1' } } },
			{ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hi' } } },
			{ type: 'stream_event', event: { type: 'message_stop' } },
		]));

		const project = getOrCreateProject(db);
		const events: any[] = [];
		for await (const event of conductTurn(db, project.id, 'hello')) {
			events.push(event);
		}

		const streamEnd = events.find(e => e.type === 'stream-end');
		expect(streamEnd).toBeDefined();

		// HEAD should be advanced
		const updated = getOrCreateProject(db);
		expect(updated.active_turn_id).not.toBeNull();
	});

	it('yields error event on SDK failure', async () => {
		mockQuery.mockReturnValue((async function* () {
			throw new Error('API rate limit');
		})());

		const project = getOrCreateProject(db);
		const events: any[] = [];
		for await (const event of conductTurn(db, project.id, 'test')) {
			events.push(event);
		}

		const error = events.find(e => e.type === 'error');
		expect(error).toBeDefined();
		expect(error.message).toBe('API rate limit');
	});

	it('chains turns with parent pointers', async () => {
		// First turn
		mockQuery.mockReturnValue(makeMockStream([
			{ type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-1' } } },
			{ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'First' } } },
			{ type: 'stream_event', event: { type: 'message_stop' } },
		]));

		const project = getOrCreateProject(db);
		for await (const _ of conductTurn(db, project.id, 'first')) { /* consume */ }

		// Second turn
		mockQuery.mockReturnValue(makeMockStream([
			{ type: 'stream_event', event: { type: 'message_start', message: { id: 'msg-2' } } },
			{ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Second' } } },
			{ type: 'stream_event', event: { type: 'message_stop' } },
		]));

		for await (const _ of conductTurn(db, project.id, 'second')) { /* consume */ }

		const turns = getActivePath(db, project.id);
		expect(turns).toHaveLength(2);
		expect(turns[1].parent_turn_id).toBe(turns[0].id);
	});
});
