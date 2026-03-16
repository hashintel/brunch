import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('ai', () => ({
    streamText: vi.fn(),
    streamObject: vi.fn(),
    createProviderRegistry: vi.fn(() => ({
        languageModel: vi.fn(id => `mock-model:${id}`),
    })),
}));

vi.mock('@ai-sdk/anthropic', () => ({ anthropic: vi.fn() }));
vi.mock('@ai-sdk/google',    () => ({ google:    vi.fn() }));
vi.mock('@ai-sdk/openai',    () => ({ openai:    vi.fn() }));
vi.mock('@ai-sdk/mistral',   () => ({ mistral:   vi.fn() }));

process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key';
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.OPENAI_API_KEY = 'test-key';
process.env.MISTRAL_API_KEY = 'test-key';

const { streamText, streamObject } = await import('ai');
const { app, MODELS } = await import('./server.js');

function makeMockResult(chunks) {
    return {
        pipeTextStreamToResponse: vi.fn((res) => {
            res.setHeader('Content-Type', 'text/plain');
            for (const chunk of chunks) res.write(chunk);
            res.end();
        }),
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

    it('includes all four providers', async () => {
        const res = await request(app).get('/api/models');
        const providers = new Set(res.body.map(m => m.provider));
        expect(providers).toContain('Google');
        expect(providers).toContain('Anthropic');
        expect(providers).toContain('OpenAI');
        expect(providers).toContain('Mistral');
    });
});

describe('POST /api/stream', () => {
    it('streams text response using the default model', async () => {
        streamText.mockReturnValue(makeMockResult(['Hello', ', ', 'world!']));

        const res = await request(app)
            .post('/api/stream')
            .send({ prompt: 'Say hello' });

        expect(res.status).toBe(200);
        expect(res.text).toBe('Hello, world!');
        expect(streamText).toHaveBeenCalledWith(expect.objectContaining({
            model: 'mock-model:anthropic:claude-haiku-4-5',
        }));
    });

    it('uses the requested model when provided', async () => {
        streamText.mockReturnValue(makeMockResult(['Hi']));

        const res = await request(app)
            .post('/api/stream')
            .send({ prompt: 'Hi', model: 'anthropic:claude-haiku-4-5' });

        expect(res.status).toBe(200);
        expect(streamText).toHaveBeenCalledWith(expect.objectContaining({
            model: 'mock-model:anthropic:claude-haiku-4-5',
        }));
    });

    it('returns 400 for an unknown model', async () => {
        const res = await request(app)
            .post('/api/stream')
            .send({ prompt: 'Hi', model: 'acme:gpt-99' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'invalid model: acme:gpt-99' });
        expect(streamText).not.toHaveBeenCalled();
    });

    it('returns 400 when prompt is missing', async () => {
        const res = await request(app).post('/api/stream').send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'prompt is required' });
        expect(streamText).not.toHaveBeenCalled();
    });

    it('returns 400 when prompt is blank', async () => {
        const res = await request(app).post('/api/stream').send({ prompt: '   ' });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'prompt is required' });
        expect(streamText).not.toHaveBeenCalled();
    });
});

describe('POST /api/streamrequirements', () => {
    function makeMockObjectResult(chunks) {
        return {
            pipeTextStreamToResponse: vi.fn((res) => {
                res.setHeader('Content-Type', 'text/plain');
                for (const chunk of chunks) res.write(chunk);
                res.end();
            }),
            object: Promise.resolve({}),
        };
    }

    it('streams object response using the default model', async () => {
        const json = JSON.stringify({ requirements: [{ title: 'Auth', definition: 'User login', confidence: 0.9 }] });
        streamObject.mockReturnValue(makeMockObjectResult([json]));

        const res = await request(app)
            .post('/api/streamrequirements')
            .send({ prompt: 'Build a todo app' });

        expect(res.status).toBe(200);
        expect(res.text).toBe(json);
        expect(streamObject).toHaveBeenCalledWith(expect.objectContaining({
            model: 'mock-model:anthropic:claude-haiku-4-5',
            schema: expect.any(Object),
        }));
    });

    it('returns 400 when prompt is missing', async () => {
        const res = await request(app).post('/api/streamrequirements').send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'prompt is required' });
        expect(streamObject).not.toHaveBeenCalled();
    });

    it('returns 400 for an unknown model', async () => {
        const res = await request(app)
            .post('/api/streamrequirements')
            .send({ prompt: 'Hi', model: 'acme:gpt-99' });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'invalid model: acme:gpt-99' });
        expect(streamObject).not.toHaveBeenCalled();
    });
});
