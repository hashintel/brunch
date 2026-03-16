import express from 'express';
import cors from 'cors';
import { streamText, streamObject, createProviderRegistry } from 'ai';
import { z } from 'zod';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { mistral } from '@ai-sdk/mistral';
import { resolve } from 'node:path';

const PROVIDER_ENV_KEYS = {
    google:    'GOOGLE_GENERATIVE_AI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    openai:    'OPENAI_API_KEY',
    mistral:   'MISTRAL_API_KEY',
};

const ALL_MODELS = [
    { id: 'anthropic:claude-haiku-4-5',     label: 'Claude Haiku 4.5',    provider: 'Anthropic', providerKey: 'anthropic' },
    { id: 'anthropic:claude-opus-4-6',      label: 'Claude Opus 4.6',     provider: 'Anthropic', providerKey: 'anthropic' },
    { id: 'google:gemini-2.0-flash',        label: 'Gemini 2.0 Flash',    provider: 'Google',    providerKey: 'google' },
    { id: 'google:gemini-1.5-pro',          label: 'Gemini 1.5 Pro',      provider: 'Google',    providerKey: 'google' },
    { id: 'openai:gpt-4o-mini',             label: 'GPT-4o Mini',         provider: 'OpenAI',    providerKey: 'openai' },
    { id: 'openai:gpt-4o',                  label: 'GPT-4o',              provider: 'OpenAI',    providerKey: 'openai' },
    { id: 'mistral:mistral-small-latest',   label: 'Mistral Small',       provider: 'Mistral',   providerKey: 'mistral' },
    { id: 'mistral:mistral-large-latest',   label: 'Mistral Large',       provider: 'Mistral',   providerKey: 'mistral' },
];

const configuredProviders = Object.entries(PROVIDER_ENV_KEYS)
    .filter(([, envVar]) => process.env[envVar]?.trim())
    .map(([key]) => key);

if (configuredProviders.length === 0) {
    console.error('No API keys configured. Set at least one of:', Object.values(PROVIDER_ENV_KEYS).join(', '));
    process.exit(1);
}

const configuredSet = new Set(configuredProviders);
const registry = createProviderRegistry(
    Object.fromEntries(
        Object.entries({ anthropic, google, openai, mistral })
            .filter(([key]) => configuredSet.has(key))
    )
);

export const MODELS = ALL_MODELS.filter(m => configuredSet.has(m.providerKey))
    .map(({ providerKey: _, ...rest }) => rest);

const VALID_MODEL_IDS = new Set(MODELS.map(m => m.id));
const DEFAULT_MODEL = MODELS[0].id;

console.log(`Configured providers: ${configuredProviders.join(', ')} (${MODELS.length} models, default: ${DEFAULT_MODEL})`);

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
        model: registry.languageModel(modelId),
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

    const result = streamObject({
        model: registry.languageModel(modelId),
        messages: [{ role: 'user', content: prompt }],
        schema: requirementSchema,
    });

    result.pipeTextStreamToResponse(res);

    result.object.catch(err => {
        console.error(`[${modelId}] error:`, err.message ?? err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate response' });
        } else {
            res.end();
        }
    });
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

    const result = streamObject({
        model: registry.languageModel(modelId),
        messages: [{ role: 'user', content: userContent }],
        schema: taskSchema,
    });

    result.pipeTextStreamToResponse(res);

    result.object.catch(err => {
        console.error(`[${modelId}] error:`, err.message ?? err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate tasks' });
        } else {
            res.end();
        }
    });
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

    const userContent = `Goal:\n${prompt}\n\nRequirements:\n${reqList}\n\nTasks (${totalHours}h total):\n${taskList}\n\nWrite a concise project roadmap summary. Include: an overview of the project goal, the key requirements, a phased breakdown of tasks grouped logically, the total estimated effort, and any risks or dependencies to be aware of. Write in prose with clear section headings.`;

    const result = streamText({
        model: registry.languageModel(modelId),
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

const PORT = process.env.PORT || 3001;

if (resolve(process.argv[1]) === import.meta.filename) {
    app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
}
