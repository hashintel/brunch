import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockQuery = vi.fn();
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
    query: mockQuery,
}));

// Mock the mysql2 pool so tests don't need a running Dolt instance
// In-memory stores to support session CRUD and history tests
const projectStore = new Map();
const entryStore = new Map();
let autoIncrementPk = 100;

function resetStores() {
    projectStore.clear();
    entryStore.clear();
    autoIncrementPk = 100;
}

function routePoolExecute(sql, params) {
    if (sql.includes('information_schema')) return [[{ cnt: 1 }]];
    if (sql.includes('SELECT 1')) return [[{ 1: 1 }]];

    // Sessions: list
    if (sql.includes('SELECT pk, name, updated_at FROM project')) {
        const rows = [...projectStore.values()].map(p => ({ pk: p.pk, name: p.name, updated_at: p.updated_at }));
        rows.sort((a, b) => b.updated_at - a.updated_at);
        return [rows];
    }

    // Sessions: get by pk
    if (sql.includes('FROM project WHERE pk')) {
        const pk = Number(params?.[0]);
        const p = projectStore.get(pk);
        return [p ? [p] : []];
    }

    // Sessions: get entries for project
    if (sql.includes('FROM entry WHERE project_id')) {
        const pid = Number(params?.[0]);
        const rows = [...entryStore.values()].filter(e => e.project_id === pid);
        return [rows];
    }

    // History: count
    if (/SELECT COUNT\(\*\)/i.test(sql) && sql.includes('api_call')) return [[{ count: 0 }]];
    if (/SELECT COUNT\(\*\)/i.test(sql) && sql.includes('claude_call')) return [[{ count: 0 }]];
    if (/SELECT COUNT\(\*\)/i.test(sql)) return [[{ count: 0 }]];

    // History: list
    if (sql.includes('FROM api_call')) return [[]];
    if (sql.includes('FROM claude_call')) return [[]];

    return [[]];
}

function routeConnExecute(sql, params) {
    // INSERT into project
    if (sql.includes('INSERT INTO project')) {
        const pk = ++autoIncrementPk;
        const now = new Date().toISOString();
        projectStore.set(pk, {
            pk, name: params[0], prompt: params[1], folder: params[2],
            goal: params[3], model: params[4], clarifying_state: params[5],
            created_at: now, updated_at: now,
        });
        return [{ insertId: pk }];
    }

    // INSERT into entry
    if (sql.includes('INSERT INTO entry')) {
        const pk = ++autoIncrementPk;
        entryStore.set(pk, {
            pk, title: params[0], description: params[1], test: params[2],
            stage: params[3], confidence: params[4], project_id: params[5],
            parent_id: params[6], sort_order: params[7],
        });
        return [{ insertId: pk }];
    }

    // UPDATE project
    if (sql.includes('UPDATE project SET')) {
        const pk = Number(params[params.length - 1]);
        const p = projectStore.get(pk);
        if (p) {
            Object.assign(p, {
                name: params[0], prompt: params[1], folder: params[2],
                goal: params[3], model: params[4], clarifying_state: params[5],
                updated_at: new Date().toISOString(),
            });
        }
        return [{ affectedRows: p ? 1 : 0 }];
    }

    // DELETE from entry
    if (sql.includes('DELETE FROM entry WHERE project_id')) {
        const pid = Number(params[0]);
        for (const [k, e] of entryStore) if (e.project_id === pid) entryStore.delete(k);
        return [{ affectedRows: 1 }];
    }

    // DELETE from claude_call
    if (sql.includes('DELETE FROM claude_call')) return [{ affectedRows: 0 }];

    // DELETE from project
    if (sql.includes('DELETE FROM project WHERE pk')) {
        const pk = Number(params[0]);
        const deleted = projectStore.delete(pk);
        return [{ affectedRows: deleted ? 1 : 0 }];
    }

    // SELECT (connection-level, used by serializeSession after commit)
    return routePoolExecute(sql, params);
}

const mockConnection = {
    execute: vi.fn(async (sql, params) => routeConnExecute(sql, params)),
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
    release: vi.fn(),
};

vi.mock('mysql2/promise', () => ({
    default: {
        createPool: () => ({
            execute: vi.fn(async (sql, params) => routePoolExecute(sql, params)),
            getConnection: vi.fn(async () => mockConnection),
            end: vi.fn(async () => {}),
        }),
    },
}));

const { app, MODELS } = await import('./server.js');

function makeTextStream(chunks, { withToolEvents = false } = {}) {
    return async function* () {
        if (withToolEvents) {
            yield {
                type: 'stream_event',
                event: {
                    type: 'content_block_start',
                    content_block: { type: 'tool_use', name: 'Read' },
                },
            };
            yield {
                type: 'stream_event',
                event: { type: 'content_block_stop' },
            };
        }
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

function parseNDJSON(text) {
    return text.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
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

function makeErrorStream(errorMessage) {
    return async function* () {
        throw new Error(errorMessage);
    };
}

beforeEach(() => vi.clearAllMocks());

// ── Health ──

describe('GET /api/health', () => {
    it('returns ok status', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});

// ── Models ──

describe('GET /api/models', () => {
    it('returns the list of available models (filtered by backend availability)', async () => {
        const res = await request(app).get('/api/models');
        expect(res.status).toBe(200);
        // Without OPENCODE_URL, only Claude models are returned
        const expected = MODELS.filter(m => m.backend !== 'opencode');
        expect(res.body).toEqual(expected);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0]).toMatchObject({ id: expect.any(String), label: expect.any(String), provider: expect.any(String) });
    });

    it('only includes Anthropic models when OPENCODE_URL is not set', async () => {
        const res = await request(app).get('/api/models');
        const providers = new Set(res.body.map(m => m.provider));
        expect(providers.size).toBe(1);
        expect(providers).toContain('Anthropic');
    });
});

// ── Stream ──

describe('POST /api/stream', () => {
    it('streams NDJSON text response using the default model', async () => {
        mockQuery.mockReturnValue(makeTextStream(['Hello', ', ', 'world!'])());

        const res = await request(app)
            .post('/api/stream')
            .send({ prompt: 'Say hello' });

        expect(res.status).toBe(200);
        const events = parseNDJSON(res.text);
        const textEvents = events.filter(e => e.type === 'text');
        expect(textEvents.map(e => e.text).join('')).toBe('Hello, world!');
        expect(events[events.length - 1]).toEqual({ type: 'done' });
        expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
            prompt: 'Say hello',
            options: expect.objectContaining({ model: 'claude-haiku-4-5' }),
        }));
    });

    it('streams tool events alongside text', async () => {
        mockQuery.mockReturnValue(makeTextStream(['result'], { withToolEvents: true })());

        const res = await request(app)
            .post('/api/stream')
            .send({ prompt: 'Read a file' });

        expect(res.status).toBe(200);
        const events = parseNDJSON(res.text);
        expect(events).toContainEqual({ type: 'tool_start', tool: 'Read' });
        expect(events).toContainEqual({ type: 'tool_end', tool: 'Read' });
        expect(events).toContainEqual({ type: 'text', text: 'result' });
        expect(events[events.length - 1]).toEqual({ type: 'done' });
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

    it('passes cwd options when provided', async () => {
        mockQuery.mockReturnValue(makeTextStream(['ok'])());

        await request(app)
            .post('/api/stream')
            .send({ prompt: 'Explore', cwd: '/tmp/project' });

        expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
            options: expect.objectContaining({
                cwd: '/tmp/project',
                allowedTools: ['Read', 'Glob', 'Grep'],
            }),
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

    it('handles SDK errors gracefully', async () => {
        mockQuery.mockReturnValue(makeErrorStream('API key invalid')());

        // The stream endpoint sets Transfer-Encoding: chunked before the SDK runs,
        // so on error the response closes abruptly rather than returning a clean 500.
        // We just verify it doesn't hang or crash the server.
        try {
            await request(app)
                .post('/api/stream')
                .send({ prompt: 'test' });
        } catch {
            // Connection may reset — that's acceptable
        }

        // Verify the server is still healthy after the error
        const healthCheck = await request(app).get('/api/models');
        expect(healthCheck.status).toBe(200);
    });
});

// ── Clarifying Questions ──

describe('POST /api/clarifyingquestions', () => {
    it('returns clarifying questions', async () => {
        const output = {
            questions: [{ question: 'Internal or external?', why: 'Affects auth', options: [{ label: 'Internal' }, { label: 'External' }] }],
            done: false,
        };
        mockQuery.mockReturnValue(makeStructuredResult(output)());

        const res = await request(app)
            .post('/api/clarifyingquestions')
            .send({ prompt: 'Build a dashboard' });

        expect(res.status).toBe(200);
        expect(res.body.questions).toHaveLength(1);
        expect(res.body.questions[0].question).toBe('Internal or external?');
        expect(res.body.done).toBe(false);
    });

    it('includes previous rounds in the prompt', async () => {
        const output = { questions: [], done: true };
        mockQuery.mockReturnValue(makeStructuredResult(output)());

        const previousRounds = [{
            questions: [{ question: 'Type?', why: 'matters', options: [{ label: 'A' }] }],
            answers: [{ selectedLabels: ['A'], otherText: '', skipped: false }],
        }];

        const res = await request(app)
            .post('/api/clarifyingquestions')
            .send({ prompt: 'Build an app', previousRounds });

        expect(res.status).toBe(200);
        // Verify the prompt sent to Claude includes the round context
        const calledPrompt = mockQuery.mock.calls[0][0].prompt;
        expect(calledPrompt).toContain('Previous clarifying Q&A');
        expect(calledPrompt).toContain('Type?');
    });

    it('returns 400 when prompt is missing', async () => {
        const res = await request(app).post('/api/clarifyingquestions').send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'prompt is required' });
    });

    it('returns 400 for an unknown model', async () => {
        const res = await request(app)
            .post('/api/clarifyingquestions')
            .send({ prompt: 'Hi', model: 'bad-model' });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'invalid model: bad-model' });
    });
});

// ── Assumptions ──

describe('POST /api/assumptions', () => {
    it('returns assumptions', async () => {
        const output = {
            assumptions: [
                { text: 'Web-based', rationale: 'Default platform', confidence: 'high', impact: 'high' },
            ],
        };
        mockQuery.mockReturnValue(makeStructuredResult(output)());

        const res = await request(app)
            .post('/api/assumptions')
            .send({ prompt: 'Build a todo app' });

        expect(res.status).toBe(200);
        expect(res.body.assumptions).toHaveLength(1);
        expect(res.body.assumptions[0].text).toBe('Web-based');
    });

    it('includes clarifying rounds in the prompt', async () => {
        const output = { assumptions: [] };
        mockQuery.mockReturnValue(makeStructuredResult(output)());

        await request(app)
            .post('/api/assumptions')
            .send({
                prompt: 'Build an app',
                previousRounds: [{
                    questions: [{ question: 'Platform?', why: 'x', options: [] }],
                    answers: [{ selectedLabels: ['Web'], otherText: '', skipped: false }],
                }],
            });

        const calledPrompt = mockQuery.mock.calls[0][0].prompt;
        expect(calledPrompt).toContain('Clarifying Q&A');
        expect(calledPrompt).toContain('Platform?');
    });

    it('returns 400 when prompt is missing', async () => {
        const res = await request(app).post('/api/assumptions').send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'prompt is required' });
    });

    it('returns 400 for an unknown model', async () => {
        const res = await request(app)
            .post('/api/assumptions')
            .send({ prompt: 'Hi', model: 'bad-model' });
        expect(res.status).toBe(400);
    });
});

// ── Requirements ──

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
            options: expect.objectContaining({
                model: 'claude-haiku-4-5',
                outputFormat: expect.objectContaining({ type: 'json_schema' }),
            }),
        }));
    });

    it('includes clarifying rounds and assumptions in the prompt', async () => {
        const output = { requirements: [] };
        mockQuery.mockReturnValue(makeStructuredResult(output)());

        await request(app)
            .post('/api/streamrequirements')
            .send({
                prompt: 'Build an app',
                clarifyingRounds: [{
                    questions: [{ question: 'Scale?', why: 'x', options: [] }],
                    answers: [{ selectedLabels: ['Large'], otherText: '', skipped: false }],
                }],
                assumptions: [
                    { text: 'Cloud hosted', rationale: 'Standard', confidence: 'high', impact: 'high', status: 'confirmed' },
                    { text: 'On-prem', rationale: 'Alternative', confidence: 'low', impact: 'low', status: 'rejected' },
                ],
            });

        const calledPrompt = mockQuery.mock.calls[0][0].prompt;
        expect(calledPrompt).toContain('Scale?');
        expect(calledPrompt).toContain('CONFIRMED');
        expect(calledPrompt).toContain('REJECTED');
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

// ── Generate Children ──

describe('POST /api/generatechildren', () => {
    it('returns sub-requirements for a requirement', async () => {
        const output = {
            children: [
                { title: 'Login UI', definition: 'Login form', confidence: 0.85 },
                { title: 'Session mgmt', definition: 'JWT tokens', confidence: 0.8 },
            ],
        };
        mockQuery.mockReturnValue(makeStructuredResult(output)());

        const res = await request(app)
            .post('/api/generatechildren')
            .send({
                requirement: { title: 'Auth', definition: 'User authentication' },
                prompt: 'Build a todo app',
            });

        expect(res.status).toBe(200);
        expect(res.body.children).toHaveLength(2);
        expect(res.body.children[0].title).toBe('Login UI');
    });

    it('returns 400 when requirement is missing', async () => {
        const res = await request(app)
            .post('/api/generatechildren')
            .send({ prompt: 'Build an app' });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'requirement is required' });
    });

    it('returns 400 when requirement.title is empty', async () => {
        const res = await request(app)
            .post('/api/generatechildren')
            .send({ requirement: { title: '', definition: 'x' } });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'requirement is required' });
    });

    it('returns 400 for an unknown model', async () => {
        const res = await request(app)
            .post('/api/generatechildren')
            .send({ requirement: { title: 'Auth' }, model: 'bad' });
        expect(res.status).toBe(400);
    });
});

// ── Generate Tests ──

describe('POST /api/generatetests', () => {
    it('returns tests for a requirement', async () => {
        const output = {
            tests: [
                { type: 'programmatic_test', description: 'Unit test for login' },
                { type: 'human_review', description: 'Manual UX check' },
            ],
        };
        mockQuery.mockReturnValue(makeStructuredResult(output)());

        const res = await request(app)
            .post('/api/generatetests')
            .send({
                requirement: { title: 'Auth', definition: 'User authentication' },
                prompt: 'Build a todo app',
            });

        expect(res.status).toBe(200);
        expect(res.body.tests).toHaveLength(2);
        expect(res.body.tests[0].type).toBe('programmatic_test');
    });

    it('returns 400 when requirement is missing', async () => {
        const res = await request(app)
            .post('/api/generatetests')
            .send({ prompt: 'Build an app' });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'requirement is required' });
    });

    it('returns 400 for an unknown model', async () => {
        const res = await request(app)
            .post('/api/generatetests')
            .send({ requirement: { title: 'Auth' }, model: 'bad' });
        expect(res.status).toBe(400);
    });
});

// ── Sessions ──

describe('Sessions API', () => {
    let sessionId;

    beforeEach(() => resetStores());

    it('POST /api/sessions creates a session', async () => {
        const res = await request(app)
            .post('/api/sessions')
            .send({
                name: 'Test Session',
                prompt: 'my goal',
                cwd: '/tmp',
                response: 'generated goal text',
                selectedModel: 'claude-haiku-4-5',
                requirements: [
                    {
                        title: 'Req 1', definition: 'Def 1', confidence: 0.9,
                        tests: [{ type: 'human_review', description: 'check' }],
                        children: [{ title: 'Sub 1', definition: 'Sub def', confidence: 0.8 }],
                    },
                ],
                goalIterations: [],
                allQuestions: [],
                allAnswers: [],
                questionsExhausted: false,
                clarifyingDone: false,
                assumptions: [],
                assumptionsDone: false,
            });

        expect(res.status).toBe(201);
        expect(res.body.name).toBe('Test Session');
        expect(res.body.prompt).toBe('my goal');
        expect(res.body.response).toBe('generated goal text');
        expect(res.body.requirements).toHaveLength(1);
        expect(res.body.requirements[0].title).toBe('Req 1');
        expect(res.body.requirements[0].children).toHaveLength(1);
        expect(res.body.requirements[0].tests).toHaveLength(1);
        sessionId = res.body.id;
    });

    it('GET /api/sessions lists sessions', async () => {
        // Create a session first
        const create = await request(app).post('/api/sessions').send({
            name: 'List Test', prompt: 'p', response: 'r', selectedModel: 'claude-haiku-4-5', requirements: [],
        });
        sessionId = create.body.id;

        const res = await request(app).get('/api/sessions');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some(s => s.id === sessionId)).toBe(true);
    });

    it('GET /api/sessions/:id loads a session', async () => {
        const create = await request(app).post('/api/sessions').send({
            name: 'Load Test', prompt: 'p', response: 'r', selectedModel: 'claude-haiku-4-5',
            requirements: [{ title: 'R1', definition: 'D1', confidence: 0.9 }],
        });
        sessionId = create.body.id;

        const res = await request(app).get(`/api/sessions/${sessionId}`);
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Load Test');
        expect(res.body.requirements).toHaveLength(1);
    });

    it('GET /api/sessions/:id returns 404 for unknown id', async () => {
        const res = await request(app).get('/api/sessions/99999');
        expect(res.status).toBe(404);
    });

    it('PUT /api/sessions/:id updates a session', async () => {
        const create = await request(app).post('/api/sessions').send({
            name: 'Before Update', prompt: 'p', response: 'r', selectedModel: 'claude-haiku-4-5', requirements: [],
        });
        sessionId = create.body.id;

        const res = await request(app)
            .put(`/api/sessions/${sessionId}`)
            .send({
                name: 'Updated Session',
                prompt: 'updated goal',
                cwd: '/tmp',
                response: 'updated response',
                selectedModel: 'claude-sonnet-4-6',
                requirements: [
                    { title: 'New Req', definition: 'New def', confidence: 0.95, tests: [] },
                ],
                goalIterations: [],
                allQuestions: [],
                allAnswers: [],
            });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Updated Session');
        expect(res.body.requirements).toHaveLength(1);
        expect(res.body.requirements[0].title).toBe('New Req');
    });

    it('PUT /api/sessions/:id returns 404 for unknown id', async () => {
        const res = await request(app)
            .put('/api/sessions/99999')
            .send({ name: 'x', prompt: 'x', response: 'x', selectedModel: 'claude-haiku-4-5', requirements: [] });
        expect(res.status).toBe(404);
    });

    it('DELETE /api/sessions/:id deletes a session', async () => {
        const create = await request(app).post('/api/sessions').send({
            name: 'To Delete', prompt: 'p', response: 'r', selectedModel: 'claude-haiku-4-5', requirements: [],
        });
        sessionId = create.body.id;

        const res = await request(app).delete(`/api/sessions/${sessionId}`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true });

        const check = await request(app).get(`/api/sessions/${sessionId}`);
        expect(check.status).toBe(404);
    });

    it('DELETE /api/sessions/:id returns 404 for unknown id', async () => {
        const res = await request(app).delete('/api/sessions/99999');
        expect(res.status).toBe(404);
    });
});

// ── History ──

describe('History API', () => {
    it('GET /api/history returns api call history', async () => {
        const res = await request(app).get('/api/history');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('rows');
        expect(res.body).toHaveProperty('total');
        expect(Array.isArray(res.body.rows)).toBe(true);
        expect(typeof res.body.total).toBe('number');
    });

    it('GET /api/history supports limit and offset', async () => {
        const res = await request(app).get('/api/history?limit=5&offset=0');
        expect(res.status).toBe(200);
        expect(res.body.rows.length).toBeLessThanOrEqual(5);
    });

    it('GET /api/history supports path filter', async () => {
        const res = await request(app).get('/api/history?path=/models');
        expect(res.status).toBe(200);
        for (const row of res.body.rows) {
            expect(row.path).toBe('/models');
        }
    });

    it('GET /api/history/claude returns claude call history', async () => {
        const res = await request(app).get('/api/history/claude');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('rows');
        expect(res.body).toHaveProperty('total');
    });

    it('GET /api/history/claude supports model filter', async () => {
        const res = await request(app).get('/api/history/claude?model=claude-haiku-4-5');
        expect(res.status).toBe(200);
        for (const row of res.body.rows) {
            expect(row.model).toBe('claude-haiku-4-5');
        }
    });
});
