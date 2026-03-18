import express from 'express';
import cors from 'cors';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { resolve } from 'node:path';
import { mkdir, readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import crypto from 'node:crypto';
import db from './db.js';

export const MODELS = [
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', provider: 'Anthropic' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', provider: 'Anthropic' },
    { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', provider: 'Anthropic' },
];

const VALID_MODEL_IDS = new Set(MODELS.map(m => m.id));
const DEFAULT_MODEL = MODELS[0].id;

console.log(`Models: ${MODELS.map(m => m.id).join(', ')} (default: ${DEFAULT_MODEL})`);

export const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// --- API call history logging ---
const logApiCall = db.prepare(`
    INSERT INTO api_call (method, path, status_code, model, session_id, request_body, response_body, duration_ms, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

app.use('/api', (req, res, next) => {
    const start = Date.now();
    const originalJson = res.json.bind(res);
    const originalEnd = res.end.bind(res);
    let responseBody = null;

    res.json = function (body) {
        responseBody = body;
        return originalJson(body);
    };

    res.on('finish', () => {
        try {
            logApiCall.run(
                req.method,
                req.path,
                res.statusCode,
                req.body?.model ?? null,
                req.body?.sessionId ?? req.params?.id ?? null,
                req.method !== 'GET' ? JSON.stringify(req.body) : null,
                responseBody ? JSON.stringify(responseBody) : null,
                Date.now() - start,
                res.statusCode >= 400 && responseBody?.error ? responseBody.error : null,
            );
        } catch (e) {
            console.error('[db] failed to log api call:', e.message);
        }
    });

    next();
});

app.get('/', (_req, res) => {
    res.json({ status: 'ok', endpoints: ['/api/models', '/api/stream', '/api/clarifyingquestions', '/api/streamrequirements', '/api/generatechildren', '/api/generatetests'] });
});

app.get('/api/models', (_req, res) => {
    res.json(MODELS);
});

// --- Helpers ---

const READ_TOOLS = ['Read', 'Glob', 'Grep'];
const CWD_SYSTEM_PROMPT = 'You have access to a project directory. Use the Read, Glob, and Grep tools to explore the codebase and answer questions based on the actual files. Always investigate the project before responding.';

function cwdOptions(cwd) {
    if (!cwd) return {};
    return { cwd, allowedTools: READ_TOOLS, systemPrompt: CWD_SYSTEM_PROMPT };
}

const logClaudeCall = db.prepare(`
    INSERT INTO claude_call (model, caller, prompt, response, input_tokens, output_tokens, turns, duration_ms, status, error, cwd)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function extractUsage(messages) {
    let inputTokens = 0;
    let outputTokens = 0;
    let turns = 0;
    for (const msg of messages) {
        if (msg.type === 'stream_event' && msg.event.type === 'message_delta' && msg.event.usage) {
            outputTokens += msg.event.usage.output_tokens ?? 0;
        }
        if (msg.type === 'stream_event' && msg.event.type === 'message_start' && msg.event.message?.usage) {
            inputTokens += msg.event.message.usage.input_tokens ?? 0;
            turns++;
        }
    }
    return { inputTokens, outputTokens, turns };
}

async function streamQueryText(prompt, modelId, res, cwd) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const start = Date.now();
    const allMessages = [];
    let fullText = '';
    let error = null;

    try {
        for await (const msg of query({
            prompt,
            options: {
                model: modelId,
                maxTurns: 100,
                includePartialMessages: true,
                ...cwdOptions(cwd),
            },
        })) {
            allMessages.push(msg);
            if (
                msg.type === 'stream_event' &&
                msg.event.type === 'content_block_delta' &&
                msg.event.delta.type === 'text_delta'
            ) {
                res.write(msg.event.delta.text);
                fullText += msg.event.delta.text;
            }
        }
        res.end();
    } catch (e) {
        error = e;
        throw e;
    } finally {
        const { inputTokens, outputTokens, turns } = extractUsage(allMessages);
        try {
            logClaudeCall.run(
                modelId, 'streamQueryText', prompt,
                fullText || null,
                inputTokens || null, outputTokens || null, turns || null,
                Date.now() - start,
                error ? 'error' : 'success',
                error?.message ?? null,
                cwd ?? null,
            );
        } catch (e) {
            console.error('[db] failed to log claude call:', e.message);
        }
    }
    return fullText;
}

async function queryStructured(prompt, modelId, schema, cwd) {
    const start = Date.now();
    const allMessages = [];
    let result;
    let error = null;

    try {
        for await (const msg of query({
            prompt,
            options: {
                model: modelId,
                maxTurns: 100,
                outputFormat: { type: 'json_schema', schema },
                ...cwdOptions(cwd),
            },
        })) {
            allMessages.push(msg);
            if (msg.type === 'result') {
                result = msg;
            }
        }
        if (result?.subtype === 'success' && result.structured_output) {
            return result.structured_output;
        }
        // Fallback: parse the result text as JSON
        if (result?.subtype === 'success' && result.result) {
            return JSON.parse(result.result);
        }
        throw new Error(result?.subtype ?? 'Unknown error');
    } catch (e) {
        error = e;
        throw e;
    } finally {
        const { inputTokens, outputTokens, turns } = extractUsage(allMessages);
        const response = result?.structured_output
            ? JSON.stringify(result.structured_output)
            : result?.result ?? null;
        try {
            logClaudeCall.run(
                modelId, 'queryStructured', prompt,
                response,
                inputTokens || null, outputTokens || null, turns || null,
                Date.now() - start,
                error ? 'error' : 'success',
                error?.message ?? null,
                cwd ?? null,
            );
        } catch (e) {
            console.error('[db] failed to log claude call:', e.message);
        }
    }
}

// --- Endpoints ---

app.post('/api/stream', async (req, res) => {
    const { prompt, model: modelId = DEFAULT_MODEL, cwd } = req.body;

    if (!prompt?.trim()) {
        return res.status(400).json({ error: 'prompt is required' });
    }
    if (!VALID_MODEL_IDS.has(modelId)) {
        return res.status(400).json({ error: `invalid model: ${modelId}` });
    }

    console.log(`[${modelId}]${cwd ? ` (${cwd})` : ''} ${prompt}`);

    try {
        const text = await streamQueryText(prompt, modelId, res, cwd);
        console.log(`[${modelId}] response: ${text}`);
    } catch (err) {
        console.error(`[${modelId}] error:`, err.message ?? err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate response' });
        } else {
            res.end();
        }
    }
});

// --- Clarifying Questions ---

const clarifyingQuestionsSchema = {
    type: 'object',
    properties: {
        questions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    question: { type: 'string' },
                    why: { type: 'string' },
                    options: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: { label: { type: 'string' } },
                            required: ['label'],
                            additionalProperties: false,
                        },
                    },
                },
                required: ['question', 'why', 'options'],
                additionalProperties: false,
            },
        },
        done: { type: 'boolean' },
    },
    required: ['questions', 'done'],
    additionalProperties: false,
};

function formatClarifyingRounds(rounds) {
    if (!rounds?.length) return '';
    return rounds.map((round, i) => {
        const qas = round.questions.map((q, j) => {
            const ans = round.answers[j];
            let answerText = 'Skipped';
            if (ans && !ans.skipped) {
                const parts = [];
                if (ans.selectedLabels?.length) parts.push(ans.selectedLabels.join(', '));
                if (ans.otherText) parts.push(`Other: ${ans.otherText}`);
                if (parts.length) answerText = parts.join('; ');
            }
            return `Q: ${q.question}\nA: ${answerText}`;
        }).join('\n\n');
        return `--- Round ${i + 1} ---\n${qas}`;
    }).join('\n\n');
}

app.post('/api/clarifyingquestions', async (req, res) => {
    const { prompt, model: modelId = DEFAULT_MODEL, cwd, previousRounds } = req.body;

    if (!prompt?.trim()) {
        return res.status(400).json({ error: 'prompt is required' });
    }
    if (!VALID_MODEL_IDS.has(modelId)) {
        return res.status(400).json({ error: `invalid model: ${modelId}` });
    }

    console.log(`[${modelId}] clarifyingquestions`);

    let userContent = `Goal description:\n${prompt}\n\n`;

    const roundsText = formatClarifyingRounds(previousRounds);
    if (roundsText) {
        userContent += `Previous clarifying Q&A:\n${roundsText}\n\n`;
    }

    userContent += `You are a spec elicitation assistant. Based on the goal above${previousRounds?.length ? ' and the previous answers' : ''}, generate 3-5 multi-choice clarifying questions about ambiguities that would change the shape of the specification if answered differently. Each question should have 2-5 options. For each question, explain why it matters for the spec in the "why" field.

If the goal is already clear enough and no more clarification is needed, set "done" to true and return an empty questions array.`;

    try {
        const output = await queryStructured(userContent, modelId, clarifyingQuestionsSchema, cwd);
        res.json(output);
    } catch (err) {
        console.error(`[${modelId}] error:`, err.message ?? err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate clarifying questions' });
        } else {
            res.end();
        }
    }
});

const requirementJsonSchema = {
    type: 'object',
    properties: {
        requirements: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    definition: { type: 'string' },
                    confidence: { type: 'number' },
                },
                required: ['title', 'definition', 'confidence'],
                additionalProperties: false,
            },
        },
    },
    required: ['requirements'],
    additionalProperties: false,
};

app.post('/api/streamrequirements', async (req, res) => {
    const { prompt, model: modelId = DEFAULT_MODEL, cwd, clarifyingRounds } = req.body;

    if (!prompt?.trim()) {
        return res.status(400).json({ error: 'prompt is required' });
    }
    if (!VALID_MODEL_IDS.has(modelId)) {
        return res.status(400).json({ error: `invalid model: ${modelId}` });
    }

    console.log(`[${modelId}] streamrequirements: ${prompt}`);

    let fullPrompt = prompt;
    const roundsContext = formatClarifyingRounds(clarifyingRounds);
    if (roundsContext) {
        fullPrompt = `${prompt}\n\nClarifying Q&A context:\n${roundsContext}`;
    }

    try {
        const output = await queryStructured(fullPrompt, modelId, requirementJsonSchema, cwd);
        res.json(output);
    } catch (err) {
        console.error(`[${modelId}] error:`, err.message ?? err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate response' });
        } else {
            res.end();
        }
    }
});

// --- Expand Requirement ---

const expandRequirementSchema = {
    type: 'object',
    properties: {
        tests: {
            type: 'array',
            description: 'Verification methods for this requirement',
            items: {
                type: 'object',
                properties: {
                    type: { type: 'string', enum: ['static_analysis', 'programmatic_test', 'llm_review', 'human_review'] },
                    description: { type: 'string' },
                },
                required: ['type', 'description'],
                additionalProperties: false,
            },
        },
        children: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    definition: { type: 'string' },
                    confidence: { type: 'number' },
                },
                required: ['title', 'definition', 'confidence'],
                additionalProperties: false,
            },
        },
    },
    required: ['tests', 'children'],
    additionalProperties: false,
};

const generateChildrenSchema = {
    type: 'object',
    properties: {
        children: expandRequirementSchema.properties.children,
    },
    required: ['children'],
    additionalProperties: false,
};

const generateTestsSchema = {
    type: 'object',
    properties: {
        tests: expandRequirementSchema.properties.tests,
    },
    required: ['tests'],
    additionalProperties: false,
};

app.post('/api/generatechildren', async (req, res) => {
    const { requirement, prompt, model: modelId = DEFAULT_MODEL, cwd } = req.body;

    if (!requirement?.title) {
        return res.status(400).json({ error: 'requirement is required' });
    }
    if (!VALID_MODEL_IDS.has(modelId)) {
        return res.status(400).json({ error: `invalid model: ${modelId}` });
    }

    console.log(`[${modelId}] generatechildren: ${requirement.title}`);

    const userContent = `You are a spec elicitation assistant breaking a requirement into sub-requirements.

Project goal:
${prompt || 'Not specified'}

Requirement to decompose:
Title: ${requirement.title}
Definition: ${requirement.definition}

Generate sub-requirements that break this requirement down into smaller, more specific parts. Each sub-requirement should have a title, definition, and confidence score (0-1). Generate 2-5 sub-requirements if the requirement is complex enough to warrant decomposition, or an empty array if it's already atomic.`;

    try {
        const output = await queryStructured(userContent, modelId, generateChildrenSchema, cwd);
        res.json(output);
    } catch (err) {
        console.error(`[${modelId}] error:`, err.message ?? err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate sub-requirements' });
        } else {
            res.end();
        }
    }
});

app.post('/api/generatetests', async (req, res) => {
    const { requirement, prompt, model: modelId = DEFAULT_MODEL, cwd } = req.body;

    if (!requirement?.title) {
        return res.status(400).json({ error: 'requirement is required' });
    }
    if (!VALID_MODEL_IDS.has(modelId)) {
        return res.status(400).json({ error: `invalid model: ${modelId}` });
    }

    console.log(`[${modelId}] generatetests: ${requirement.title}`);

    const userContent = `You are a spec elicitation assistant generating verification tests for a requirement.

Project goal:
${prompt || 'Not specified'}

Requirement to generate tests for:
Title: ${requirement.title}
Definition: ${requirement.definition}

Generate verification tests for this requirement. Each test has a "type" (one of: static_analysis, programmatic_test, llm_review, human_review) and a "description" explaining what to check. Choose the most appropriate test types — use static_analysis for linting/type checks, programmatic_test for unit/integration tests, llm_review for AI-based assessment, human_review for manual verification. Generate 1-4 tests.`;

    try {
        const output = await queryStructured(userContent, modelId, generateTestsSchema, cwd);
        res.json(output);
    } catch (err) {
        console.error(`[${modelId}] error:`, err.message ?? err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate tests' });
        } else {
            res.end();
        }
    }
});

// --- Sessions ---
const __dirname = new URL('.', import.meta.url).pathname;
const SESSIONS_DIR = resolve(__dirname, 'data/sessions');
await mkdir(SESSIONS_DIR, { recursive: true });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

app.get('/api/sessions', async (_req, res) => {
    try {
        const files = await readdir(SESSIONS_DIR);
        const sessions = await Promise.all(
            files.filter(f => f.endsWith('.json')).map(async f => {
                const data = JSON.parse(await readFile(resolve(SESSIONS_DIR, f), 'utf-8'));
                return { id: data.id, name: data.name, updatedAt: data.updatedAt };
            })
        );
        sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: 'Failed to list sessions' });
    }
});

app.get('/api/sessions/:id', async (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid session id' });
    try {
        const data = await readFile(resolve(SESSIONS_DIR, `${id}.json`), 'utf-8');
        res.json(JSON.parse(data));
    } catch {
        res.status(404).json({ error: 'Session not found' });
    }
});

app.post('/api/sessions', async (req, res) => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const session = { ...req.body, id, createdAt: now, updatedAt: now };
    try {
        await writeFile(resolve(SESSIONS_DIR, `${id}.json`), JSON.stringify(session, null, 2));
        res.status(201).json(session);
    } catch {
        res.status(500).json({ error: 'Failed to create session' });
    }
});

app.put('/api/sessions/:id', async (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid session id' });
    const filePath = resolve(SESSIONS_DIR, `${id}.json`);
    try {
        const existing = JSON.parse(await readFile(filePath, 'utf-8'));
        const updated = { ...existing, ...req.body, id, updatedAt: new Date().toISOString() };
        await writeFile(filePath, JSON.stringify(updated, null, 2));
        res.json(updated);
    } catch {
        res.status(404).json({ error: 'Session not found' });
    }
});

app.delete('/api/sessions/:id', async (req, res) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid session id' });
    try {
        await unlink(resolve(SESSIONS_DIR, `${id}.json`));
        res.json({ ok: true });
    } catch {
        res.status(404).json({ error: 'Session not found' });
    }
});

// --- Call history ---
app.get('/api/history/claude', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const offset = parseInt(req.query.offset) || 0;
    const model = req.query.model;

    let sql = 'SELECT * FROM claude_call';
    const params = [];

    if (model) {
        sql += ' WHERE model = ?';
        params.push(model);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.prepare(sql).all(...params);
    const total = db.prepare(
        `SELECT COUNT(*) as count FROM claude_call${model ? ' WHERE model = ?' : ''}`
    ).get(...(model ? [model] : []));

    res.json({ rows, total: total.count });
});

app.get('/api/history', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const offset = parseInt(req.query.offset) || 0;
    const path = req.query.path;

    let sql = 'SELECT * FROM api_call';
    const params = [];

    if (path) {
        sql += ' WHERE path = ?';
        params.push(path);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.prepare(sql).all(...params);
    const total = db.prepare(
        `SELECT COUNT(*) as count FROM api_call${path ? ' WHERE path = ?' : ''}`
    ).get(...(path ? [path] : []));

    res.json({ rows, total: total.count });
});

const PORT = process.env.PORT || 3001;

if (resolve(process.argv[1]) === import.meta.filename) {
    app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
}
