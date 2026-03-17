import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockClient = {
    session: {
        create: vi.fn(),
        delete: vi.fn(),
        prompt: vi.fn(),
        promptAsync: vi.fn(),
    },
    event: {
        subscribe: vi.fn(),
    },
};

vi.mock('@opencode-ai/sdk', () => ({
    createOpencode: vi.fn(() => Promise.resolve({ client: mockClient })),
}));

const { app, MODELS } = await import('./server.js');

function makeStreamEvents(sessionId, chunks) {
    return {
        stream: (async function* () {
            for (const chunk of chunks) {
                yield {
                    type: 'message.part.updated',
                    properties: {
                        part: { sessionID: sessionId, type: 'text' },
                        delta: chunk,
                    },
                };
            }
            yield {
                type: 'session.status',
                properties: { sessionID: sessionId, status: 'idle' },
            };
        })(),
    };
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/models', () => {
    it('returns the list of available models', async () => {
        const res = await request(app).get('/api/models');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(MODELS);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0]).toMatchObject({ id: expect.any(String), label: expect.any(String), provider: expect.any(String) });
    });
});

describe('POST /api/stream', () => {
    it('streams text response using the default model', async () => {
        const sessionId = 'test-session-1';
        mockClient.session.create.mockResolvedValue({ data: { id: sessionId } });
        mockClient.session.promptAsync.mockResolvedValue({});
        mockClient.session.delete.mockResolvedValue({});
        mockClient.event.subscribe.mockResolvedValue(makeStreamEvents(sessionId, ['Hello', ', ', 'world!']));

        const res = await request(app)
            .post('/api/stream')
            .send({ prompt: 'Say hello' });

        expect(res.status).toBe(200);
        expect(res.text).toBe('Hello, world!');
        expect(mockClient.session.promptAsync).toHaveBeenCalledWith(
            expect.objectContaining({
                path: { id: sessionId },
                body: expect.objectContaining({
                    model: { providerID: 'anthropic', modelID: 'claude-haiku-4-5-20251001' },
                }),
            })
        );
    });

    it('returns 400 for an unknown model', async () => {
        const res = await request(app)
            .post('/api/stream')
            .send({ prompt: 'Hi', model: 'acme/gpt-99' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'invalid model: acme/gpt-99' });
        expect(mockClient.session.create).not.toHaveBeenCalled();
    });

    it('returns 400 when prompt is missing', async () => {
        const res = await request(app).post('/api/stream').send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'prompt is required' });
        expect(mockClient.session.create).not.toHaveBeenCalled();
    });

    it('returns 400 when prompt is blank', async () => {
        const res = await request(app).post('/api/stream').send({ prompt: '   ' });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'prompt is required' });
        expect(mockClient.session.create).not.toHaveBeenCalled();
    });
});

describe('POST /api/streamrequirements', () => {
    it('returns parsed JSON from the model response', async () => {
        const sessionId = 'test-session-req';
        const jsonResponse = { requirements: [{ title: 'Auth', definition: 'User login', confidence: 0.9 }] };
        mockClient.session.create.mockResolvedValue({ data: { id: sessionId } });
        mockClient.session.prompt.mockResolvedValue({
            data: {
                info: {},
                parts: [{ type: 'text', text: JSON.stringify(jsonResponse) }],
            },
        });
        mockClient.session.delete.mockResolvedValue({});

        const res = await request(app)
            .post('/api/streamrequirements')
            .send({ prompt: 'Build a todo app' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual(jsonResponse);
    });

    it('returns 400 when prompt is missing', async () => {
        const res = await request(app).post('/api/streamrequirements').send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'prompt is required' });
        expect(mockClient.session.create).not.toHaveBeenCalled();
    });

    it('returns 400 for an unknown model', async () => {
        const res = await request(app)
            .post('/api/streamrequirements')
            .send({ prompt: 'Hi', model: 'acme/gpt-99' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'invalid model: acme/gpt-99' });
        expect(mockClient.session.create).not.toHaveBeenCalled();
    });
});
