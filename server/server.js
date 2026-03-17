import express from 'express';
import cors from 'cors';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { resolve } from 'node:path';
import { mkdir, readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import crypto from 'node:crypto';

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
app.use(express.json());

app.get('/', (_req, res) => {
    res.json({ status: 'ok', endpoints: ['/api/models', '/api/stream', '/api/streamrequirements', '/api/streamtasks', '/api/streamsummary'] });
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

async function streamQueryText(prompt, modelId, res, cwd) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    let fullText = '';
    for await (const msg of query({
        prompt,
        options: {
            model: modelId,
            maxTurns: 100,
            includePartialMessages: true,
            ...cwdOptions(cwd),
        },
    })) {
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
    return fullText;
}

async function queryStructured(prompt, modelId, schema, cwd) {
    let result;
    for await (const msg of query({
        prompt,
        options: {
            model: modelId,
            maxTurns: 100,
            outputFormat: { type: 'json_schema', schema },
            ...cwdOptions(cwd),
        },
    })) {
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
    const { prompt, model: modelId = DEFAULT_MODEL, cwd } = req.body;

    if (!prompt?.trim()) {
        return res.status(400).json({ error: 'prompt is required' });
    }
    if (!VALID_MODEL_IDS.has(modelId)) {
        return res.status(400).json({ error: `invalid model: ${modelId}` });
    }

    console.log(`[${modelId}] streamrequirements: ${prompt}`);

    try {
        const output = await queryStructured(prompt, modelId, requirementJsonSchema, cwd);
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

const taskJsonSchema = {
    type: 'object',
    properties: {
        tasks: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    definition: { type: 'string' },
                    hours: { type: 'number' },
                    requirementIndex: { type: 'integer' },
                },
                required: ['title', 'definition', 'hours', 'requirementIndex'],
                additionalProperties: false,
            },
        },
    },
    required: ['tasks'],
    additionalProperties: false,
};

app.post('/api/streamtasks', async (req, res) => {
    const { prompt, model: modelId = DEFAULT_MODEL, cwd, requirements, existingTasks } = req.body;

    if (!prompt?.trim()) {
        return res.status(400).json({ error: 'prompt is required' });
    }
    if (!requirements?.length) {
        return res.status(400).json({ error: 'requirements are required' });
    }
    if (!VALID_MODEL_IDS.has(modelId)) {
        return res.status(400).json({ error: `invalid model: ${modelId}` });
    }

    console.log(`[${modelId}] streamtasks: ${requirements.length} requirements`);

    const reqList = requirements.map((r, i) => `${i}. ${r.title}: ${r.definition}`).join('\n');
    let userContent = `Goal description:\n${prompt}\n\nRequirements:\n${reqList}\n\nGenerate implementation tasks for these requirements. Each task must reference a requirementIndex (0-based) matching the requirement it fulfills. Estimate hours for each task.`;

    if (existingTasks?.length) {
        const existing = existingTasks.map(t => `- ${t.title} (${t.hours}h, req ${t.requirementIndex})`).join('\n');
        userContent += `\n\nAlready created tasks (do not duplicate):\n${existing}\n\nGenerate additional tasks only.`;
    }

    try {
        const output = await queryStructured(userContent, modelId, taskJsonSchema, cwd);
        res.json(output);
    } catch (err) {
        console.error(`[${modelId}] error:`, err.message ?? err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate tasks' });
        } else {
            res.end();
        }
    }
});

app.post('/api/streamsummary', async (req, res) => {
    const { prompt, model: modelId = DEFAULT_MODEL, cwd, requirements, tasks } = req.body;

    if (!prompt?.trim()) {
        return res.status(400).json({ error: 'prompt is required' });
    }
    if (!requirements?.length || !tasks?.length) {
        return res.status(400).json({ error: 'requirements and tasks are required' });
    }
    if (!VALID_MODEL_IDS.has(modelId)) {
        return res.status(400).json({ error: `invalid model: ${modelId}` });
    }

    console.log(`[${modelId}] streamsummary: ${requirements.length} requirements, ${tasks.length} tasks`);

    const reqList = requirements.map((r, i) => `${i + 1}. ${r.title}: ${r.definition}`).join('\n');
    const taskList = tasks.map((t, i) => `${i + 1}. ${t.title} (${t.hours}h) — ${t.definition} [Requirement: ${requirements[t.requirementIndex]?.title ?? 'N/A'}]`).join('\n');
    const totalHours = tasks.reduce((sum, t) => sum + t.hours, 0);

    const userContent = `Goal:\n${prompt}\n\nRequirements:\n${reqList}\n\nTasks (${totalHours}h total):\n${taskList}\n\nWrite a concise project roadmap summary formatted in Markdown. Include: an overview of the project goal, the key requirements, a phased breakdown of tasks grouped logically (use a table with columns: Phase, Task, Hours, Requirement), the total estimated effort, and any risks or dependencies as a bulleted list. Use ## headings for each section.`;

    try {
        await streamQueryText(userContent, modelId, res, cwd);
    } catch (err) {
        console.error(`[${modelId}] error:`, err.message ?? err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate summary' });
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

const PORT = process.env.PORT || 3001;

if (resolve(process.argv[1]) === import.meta.filename) {
    app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
}
