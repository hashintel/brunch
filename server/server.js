import express from 'express';
import cors from 'cors';
import { resolve } from 'node:path';
import { loggingMiddleware } from './middleware/logging.js';
import { errorHandler } from './middleware/asyncHandler.js';
import streamRouter from './routes/stream.js';
import clarifyingRouter from './routes/clarifying.js';
import assumptionsRouter from './routes/assumptions.js';
import requirementsRouter from './routes/requirements.js';
import sessionsRouter from './routes/sessions.js';
import historyRouter from './routes/history.js';
import db from './db.js';

import { MODELS, VALID_MODEL_IDS, DEFAULT_MODEL } from './models.js';
export { MODELS, VALID_MODEL_IDS, DEFAULT_MODEL };

console.log(`Models: ${MODELS.map(m => m.id).join(', ')} (default: ${DEFAULT_MODEL})`);

export const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use('/api', loggingMiddleware);

app.get('/', (_req, res) => {
    res.json({ status: 'ok', endpoints: ['/api/models', '/api/stream', '/api/clarifyingquestions', '/api/assumptions', '/api/streamrequirements', '/api/generatechildren', '/api/generatetests'] });
});

app.get('/api/models', (_req, res) => {
    res.json(MODELS);
});

app.use('/api', streamRouter);
app.use('/api', clarifyingRouter);
app.use('/api', assumptionsRouter);
app.use('/api', requirementsRouter);
app.use('/api', sessionsRouter);
app.use('/api', historyRouter);
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

if (resolve(process.argv[1]) === import.meta.filename) {
    const server = app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));

    function shutdown(signal) {
        console.log(`\n[server] ${signal} received, shutting down...`);
        server.close(() => {
            try { db.close(); } catch {}
            console.log('[server] stopped.');
            process.exit(0);
        });
        // Force exit if graceful shutdown takes too long
        setTimeout(() => process.exit(1), 3000);
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}
