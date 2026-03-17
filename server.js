import express from 'express';
import cors from 'cors';
import { streamText, streamObject } from 'ai';
import { z } from 'zod';
import { createOpencode } from 'ai-sdk-provider-opencode-sdk';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

// Ensure the opencode binary is discoverable
const opencodebin = resolve(homedir(), '.opencode/bin');
if (!process.env.PATH?.includes(opencodebin)) {
    process.env.PATH = `${opencodebin}:${process.env.PATH}`;
}
import { mkdir, readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import crypto from 'node:crypto';

const opencode = createOpencode({
    autoStartServer: true,
});

export const MODELS = [
    { id: 'anthropic/claude-haiku-4-5-20251001',    label: 'Claude Haiku 4.5',    provider: 'Anthropic' },
    { id: 'anthropic/claude-sonnet-4-5-20250929',   label: 'Claude Sonnet 4.5',   provider: 'Anthropic' },
    { id: 'anthropic/claude-opus-4-5-20250918',     label: 'Claude Opus 4.5',     provider: 'Anthropic' },
    { id: 'google/gemini-2.5-flash',                label: 'Gemini 2.5 Flash',    provider: 'Google' },
    { id: 'google/gemini-2.5-pro',                  label: 'Gemini 2.5 Pro',      provider: 'Google' },
    { id: 'openai/gpt-4o-mini',                     label: 'GPT-4o Mini',         provider: 'OpenAI' },
    { id: 'openai/gpt-4o',                          label: 'GPT-4o',              provider: 'OpenAI' },
];

const VALID_MODEL_IDS = new Set(MODELS.map(m => m.id));
const DEFAULT_MODEL = MODELS[0].id;

console.log(`OpenCode SDK provider initialized (${MODELS.length} models, default: ${DEFAULT_MODEL})`);

function extractJsonObject(text) {
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    const body = fenced?.[1] ?? trimmed;
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return null;
    return body.slice(start, end + 1);
}

async function generateJsonObject({ modelId, prompt, schema, retries = 2 }) {
    // Try native streamObject first
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const result = streamObject({
                model: opencode(modelId, { outputFormatRetryCount: 2 }),
                schema,
                prompt,
            });
            return await result.object;
        } catch (err) {
            console.log(`[${modelId}] streamObject attempt ${attempt}/${retries} failed: ${err.message}`);
            if (attempt === retries) break;
        }
    }

    // Fallback: streamText + manual JSON extraction
    console.log(`[${modelId}] falling back to streamText + JSON extraction`);
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const result = streamText({
                model: opencode(modelId),
                prompt: `Return only valid JSON (no prose, no markdown fences).\n\n${prompt}`,
            });
            let text = '';
            for await (const chunk of result.textStream) {
                text += chunk;
            }
            const json = extractJsonObject(text);
            if (!json) {
                if (attempt === retries) throw new Error('Response did not contain a JSON object');
                continue;
            }
            return schema.parse(JSON.parse(json));
        } catch (err) {
            if (attempt === retries) throw err;
            console.log(`[${modelId}] fallback attempt ${attempt}/${retries} failed: ${err.message}`);
        }
    }
}

export const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
    res.json({ status: 'ok', endpoints: ['/api/models', '/api/stream', '/api/streamrequirements', '/api/streamtasks', '/api/streamsummary'] });
});

app.get('/api/models', (_req, res) => {
    res.json(MODELS);
});

app.post('/api/stream', async (req, res) => {
    const { prompt, model: modelId = DEFAULT_MODEL } = req.body;

    if (!prompt?.trim()) {
        return res.status(400).json({ error: 'prompt is required' });
    }
    if (!VALID_MODEL_IDS.has(modelId)) {
        return res.status(400).json({ error: `invalid model: ${modelId}` });
    }

    console.log(`[${modelId}] ${prompt}`);

    const result = streamText({
        model: opencode(modelId),
        messages: [{ role: 'user', content: prompt }],
        onFinish({ text }) {
            console.log(`[${modelId}] response: ${text}`);
        },
    });

    result.pipeTextStreamToResponse(res);

    result.text.catch(err => {
        console.error(`[${modelId}] error:`, err.message ?? err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate response' });
        } else {
            res.end();
        }
    });
});

const requirementSchema = z.object({
    requirements: z.array(z.object({
        title: z.string(),
        definition: z.string(),
        confidence: z.number(),
    })),
});

app.post('/api/streamrequirements', async (req, res) => {
    const { prompt, model: modelId = DEFAULT_MODEL } = req.body;

    if (!prompt?.trim()) {
        return res.status(400).json({ error: 'prompt is required' });
    }
    if (!VALID_MODEL_IDS.has(modelId)) {
        return res.status(400).json({ error: `invalid model: ${modelId}` });
    }

    console.log(`[${modelId}] streamrequirements: ${prompt}`);

    try {
        const parsed = await generateJsonObject({ modelId, prompt, schema: requirementSchema });
        res.json(parsed);
    } catch (err) {
        console.error(`[${modelId}] error:`, err.message ?? err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate requirements' });
        }
    }
});

const taskSchema = z.object({
    tasks: z.array(z.object({
        title: z.string(),
        definition: z.string(),
        hours: z.number(),
        requirementIndex: z.number(),
    })),
});

app.post('/api/streamtasks', async (req, res) => {
    const { prompt, model: modelId = DEFAULT_MODEL, requirements, existingTasks } = req.body;

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
        const parsed = await generateJsonObject({ modelId, prompt: userContent, schema: taskSchema });
        res.json(parsed);
    } catch (err) {
        console.error(`[${modelId}] error:`, err.message ?? err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate tasks' });
        }
    }
});

app.post('/api/streamsummary', async (req, res) => {
    const { prompt, model: modelId = DEFAULT_MODEL, requirements, tasks } = req.body;

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

    const result = streamText({
        model: opencode(modelId),
        messages: [{ role: 'user', content: userContent }],
    });

    result.pipeTextStreamToResponse(res);

    result.text.catch(err => {
        console.error(`[${modelId}] error:`, err.message ?? err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate summary' });
        } else {
            res.end();
        }
    });
});

// --- Sessions ---
const SESSIONS_DIR = resolve('data/sessions');
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
