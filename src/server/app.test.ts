import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { DB } from './db.js';

// Mock the Claude Agent SDK
const mockQuery = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
	query: mockQuery,
}));

// Import app factory after mocking
const { createApp } = await import('./app.js');

let app: ReturnType<typeof createApp>['app'];
let db: DB;

beforeEach(() => {
	mockQuery.mockReset();
	const result = createApp();
	app = result.app;
	db = result.db;
});

afterEach(() => {
	db.$client.close();
});

/** Helper: collect full SSE body as string */
function collectSSE(res: request.Response): string {
	return res.text;
}

/** Helper: parse SSE lines into data payloads */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSSELines(body: string): any[] {
	return body
		.split('\n\n')
		.filter(Boolean)
		.map((chunk: string) => {
			const line = chunk.replace(/^data: /, '');
			if (line === '[DONE]') return '[DONE]';
			return JSON.parse(line);
		});
}

/** Create a mock async generator of SDK messages */
async function* makeMockStream(messages: Record<string, unknown>[]) {
	for (const msg of messages) {
		yield msg;
	}
}

/** Standard mock stream that produces a text response */
function mockTextStream(text = 'Hi') {
	return makeMockStream([
		{
			type: 'stream_event',
			event: { type: 'message_start', message: { id: 'msg-1', role: 'assistant', content: [] } },
		},
		{
			type: 'stream_event',
			event: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
		},
		{
			type: 'stream_event',
			event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
		},
		{
			type: 'stream_event',
			event: { type: 'content_block_stop', index: 0 },
		},
		{
			type: 'stream_event',
			event: { type: 'message_stop' },
		},
	]);
}

describe('POST /api/chat', () => {
	it('returns Content-Type text/event-stream', async () => {
		mockQuery.mockReturnValue(mockTextStream());

		const res = await request(app)
			.post('/api/chat')
			.send({ messages: [{ role: 'user', content: 'hello' }] })
			.expect('Content-Type', /text\/event-stream/);

		expect(res.status).toBe(200);
	});

	it('produces well-formed SSE lines with data: prefix and double newline delimiters', async () => {
		mockQuery.mockReturnValue(makeMockStream([
			{
				type: 'stream_event',
				event: { type: 'message_start', message: { id: 'msg-1', role: 'assistant', content: [] } },
			},
			{
				type: 'stream_event',
				event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hi' } },
			},
			{
				type: 'stream_event',
				event: { type: 'message_stop' },
			},
		]));

		const res = await request(app)
			.post('/api/chat')
			.send({ messages: [{ role: 'user', content: 'hello' }] });

		const body = await collectSSE(res);
		const lines = body.split('\n\n').filter(Boolean);
		for (const line of lines) {
			expect(line).toMatch(/^data: /);
		}
	});

	it('contains at least one text-delta event with non-empty text', async () => {
		mockQuery.mockReturnValue(mockTextStream('Hello!'));

		const res = await request(app)
			.post('/api/chat')
			.send({ messages: [{ role: 'user', content: 'hello' }] });

		const events = parseSSELines(await collectSSE(res));
		const textDeltas = events.filter((e: any) => e.type === 'text-delta');
		expect(textDeltas.length).toBeGreaterThanOrEqual(1);
		expect(textDeltas[0].delta).toBe('Hello!');
	});

	it('ends with finish event and [DONE]', async () => {
		mockQuery.mockReturnValue(mockTextStream());

		const res = await request(app)
			.post('/api/chat')
			.send({ messages: [{ role: 'user', content: 'hello' }] });

		const events = parseSSELines(await collectSSE(res));
		const last = events[events.length - 1];
		const secondToLast = events[events.length - 2];
		expect(last).toBe('[DONE]');
		expect(secondToLast.type).toBe('finish');
	});

	it('emits reasoning-delta events for thinking content', async () => {
		mockQuery.mockReturnValue(makeMockStream([
			{
				type: 'stream_event',
				event: { type: 'message_start', message: { id: 'msg-1', role: 'assistant', content: [] } },
			},
			{
				type: 'stream_event',
				event: { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
			},
			{
				type: 'stream_event',
				event: { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Hmm...' } },
			},
			{
				type: 'stream_event',
				event: { type: 'content_block_stop', index: 0 },
			},
			{
				type: 'stream_event',
				event: { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
			},
			{
				type: 'stream_event',
				event: { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'Answer' } },
			},
			{
				type: 'stream_event',
				event: { type: 'content_block_stop', index: 1 },
			},
			{
				type: 'stream_event',
				event: { type: 'message_stop' },
			},
		]));

		const res = await request(app)
			.post('/api/chat')
			.send({ messages: [{ role: 'user', content: 'hello' }] });

		const events = parseSSELines(await collectSSE(res));

		const reasoningStart = events.find((e: any) => e.type === 'reasoning-start');
		const reasoningDelta = events.find((e: any) => e.type === 'reasoning-delta');
		const reasoningEnd = events.find((e: any) => e.type === 'reasoning-end');
		expect(reasoningStart).toBeDefined();
		expect(reasoningDelta).toBeDefined();
		expect(reasoningDelta.delta).toBe('Hmm...');
		expect(reasoningEnd).toBeDefined();

		const textDelta = events.find((e: any) => e.type === 'text-delta');
		expect(textDelta).toBeDefined();
		expect(textDelta.delta).toBe('Answer');
	});
});

describe('POST /api/chat — turn persistence', () => {
	it('creates a turn with user answer and advances HEAD', async () => {
		mockQuery.mockReturnValue(mockTextStream('Hi there'));

		await request(app)
			.post('/api/chat')
			.send({ messages: [{ role: 'user', content: 'hello' }] });

		const { getOrCreateProject, getActivePath } = await import('./db.js');
		const project = getOrCreateProject(db);
		expect(project.active_turn_id).not.toBeNull();
		const turns = getActivePath(db, project.id);
		expect(turns).toHaveLength(1);
		expect(turns[0].answer).toBe('hello');
		expect(turns[0].question).toContain('Hi there');
		expect(turns[0].phase).toBe('scope');
	});

	it('chains turns with parent pointers across exchanges', async () => {
		mockQuery.mockReturnValue(mockTextStream('First response'));
		await request(app)
			.post('/api/chat')
			.send({ messages: [{ role: 'user', content: 'first' }] });

		mockQuery.mockReturnValue(mockTextStream('Second response'));
		await request(app)
			.post('/api/chat')
			.send({ messages: [{ role: 'user', content: 'second' }] });

		const { getOrCreateProject, getActivePath } = await import('./db.js');
		const project = getOrCreateProject(db);
		const turns = getActivePath(db, project.id);
		expect(turns).toHaveLength(2);
		expect(turns[0].answer).toBe('first');
		expect(turns[1].answer).toBe('second');
		expect(turns[1].parent_turn_id).toBe(turns[0].id);
	});
});

describe('GET /api/projects/current', () => {
	it('returns a project with empty turns when no history exists', async () => {
		const res = await request(app)
			.get('/api/projects/current')
			.expect(200);

		expect(res.body.project).toMatchObject({ name: 'default' });
		expect(res.body.turns).toEqual([]);
	});

	it('returns turns on active path after a chat exchange', async () => {
		mockQuery.mockReturnValue(mockTextStream('Hi'));

		await request(app)
			.post('/api/chat')
			.send({ messages: [{ role: 'user', content: 'hello' }] });

		const res = await request(app)
			.get('/api/projects/current')
			.expect(200);

		expect(res.body.turns).toHaveLength(1);
		expect(res.body.turns[0].answer).toBe('hello');
		expect(res.body.turns[0].question).toContain('Hi');
	});
});
