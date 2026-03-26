import express from 'express';
import cors from 'cors';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { loggingMiddleware } from './middleware/logging.js';
import { errorHandler } from './middleware/asyncHandler.js';
import streamRouter from './routes/stream.js';
import clarifyingRouter from './routes/clarifying.js';
import assumptionsRouter from './routes/assumptions.js';
import requirementsRouter from './routes/requirements.js';
import sessionsRouter from './routes/sessions.js';
import historyRouter from './routes/history.js';
import versionsRouter from './routes/versions.js';
import specRouter from './routes/spec.js';
import specWizardRouter from './routes/specWizard.js';
import pool, { initDb } from './db.js';

import { MODELS, VALID_MODEL_IDS, DEFAULT_MODEL } from './models.js';
export { MODELS, VALID_MODEL_IDS, DEFAULT_MODEL };

console.log(`Models: ${MODELS.map(m => m.id).join(', ')} (default: ${DEFAULT_MODEL})`);

export const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use('/api', loggingMiddleware);

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/models', async (_req, res) => {
    if (!process.env.OPENCODE_URL) {
        return res.json(MODELS.filter(m => m.backend !== 'opencode'));
    }
    // Only show OpenCode models whose provider is actually connected (with 3s timeout)
    try {
        const { getAvailableModelIds } = await import('./services/opencode.js');
        const available = new Set(await Promise.race([
            getAvailableModelIds(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
        ]));
        res.json(MODELS.filter(m => m.backend !== 'opencode' || available.has(m.id)));
    } catch {
        // If OpenCode is unreachable or times out, just show Claude models
        res.json(MODELS.filter(m => m.backend !== 'opencode'));
    }
});

app.use('/api', streamRouter);
app.use('/api', clarifyingRouter);
app.use('/api', assumptionsRouter);
app.use('/api', requirementsRouter);
app.use('/api', sessionsRouter);
app.use('/api', historyRouter);
app.use('/api', versionsRouter);
app.use('/api', specRouter);
app.use('/api', specWizardRouter);
app.use(errorHandler);

// In production, serve the built frontend
const distDir = resolve(new URL('.', import.meta.url).pathname, '..', 'dist');
if (existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
        res.sendFile(resolve(distDir, 'index.html'));
    });
}

const PORT = process.env.PORT || 3001;

if (resolve(process.argv[1]) === import.meta.filename) {
    await initDb();
    const server = app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));

    function shutdown(signal) {
        console.log(`\n[server] ${signal} received, shutting down...`);
        server.close(() => {
            pool.end().catch(() => {});
            console.log('[server] stopped.');
            process.exit(0);
        });
        // Force exit if graceful shutdown takes too long
        setTimeout(() => process.exit(1), 3000);
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}
