import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockQuery = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
    query: mockQuery,
}));
const { app, MODELS } = await import('./server.js');

function makeTextStream(chunks) {
    return async function* () {
        for (const chunk of chunks) {
            yield {
                type: 'stream_event',
                event: {
                    type: 'content_block_delta',
                    delta: { type: 'text_delta', text: chunk },
                },
            };
        }
        yield {
            type: 'result',
            subtype: 'success',
            result: chunks.join(''),
        };
    };
}

function makeStructuredResult(output) {
    return async function* () {
        yield {
            type: 'result',
            subtype: 'success',
            structured_output: output,
            result: JSON.stringify(output),
        };
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

    it('only includes Anthropic models', async () => {
        const res = await request(app).get('/api/models');
        const providers = new Set(res.body.map(m => m.provider));
        expect(providers.size).toBe(1);
        expect(providers).toContain('Anthropic');
    });
});

describe('POST /api/stream', () => {
    it('streams text response using the default model', async () => {
        mockQuery.mockReturnValue(makeTextStream(['Hello', ', ', 'world!'])());

        const res = await request(app)
            .post('/api/stream')
            .send({ prompt: 'Say hello' });

        expect(res.status).toBe(200);
        expect(res.text).toBe('Hello, world!');
        expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
            prompt: 'Say hello',
            options: expect.objectContaining({ model: 'claude-haiku-4-5' }),
        }));
    });

    it('uses the requested model when provided', async () => {
        mockQuery.mockReturnValue(makeTextStream(['Hi'])());

        const res = await request(app)
            .post('/api/stream')
            .send({ prompt: 'Hi', model: 'claude-sonnet-4-6' });

        expect(res.status).toBe(200);
        expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
            options: expect.objectContaining({ model: 'claude-sonnet-4-6' }),
        }));
    });

    it('returns 400 for an unknown model', async () => {
        const res = await request(app)
            .post('/api/stream')
            .send({ prompt: 'Hi', model: 'acme:gpt-99' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'invalid model: acme:gpt-99' });
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns 400 when prompt is missing', async () => {
        const res = await request(app).post('/api/stream').send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'prompt is required' });
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns 400 when prompt is blank', async () => {
        const res = await request(app).post('/api/stream').send({ prompt: '   ' });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'prompt is required' });
        expect(mockQuery).not.toHaveBeenCalled();
    });
});

describe('POST /api/streamrequirements', () => {
    it('returns structured requirements using the default model', async () => {
        const output = { requirements: [{ title: 'Auth', definition: 'User login', confidence: 0.9 }] };
        mockQuery.mockReturnValue(makeStructuredResult(output)());

        const res = await request(app)
            .post('/api/streamrequirements')
            .send({ prompt: 'Build a todo app' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual(output);
        expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
            prompt: 'Build a todo app',
            options: expect.objectContaining({
                model: 'claude-haiku-4-5',
                outputFormat: expect.objectContaining({ type: 'json_schema' }),
            }),
        }));
    });

    it('returns 400 when prompt is missing', async () => {
        const res = await request(app).post('/api/streamrequirements').send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'prompt is required' });
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('returns 400 for an unknown model', async () => {
        const res = await request(app)
            .post('/api/streamrequirements')
            .send({ prompt: 'Hi', model: 'acme:gpt-99' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'invalid model: acme:gpt-99' });
        expect(mockQuery).not.toHaveBeenCalled();
    });
});
