import express from 'express';
import type { Request, Response } from 'express';
import { createDb } from './db.js';
import { conductTurn, extractPrompt, getProjectState } from './core.js';
import { createDomainAdapter, formatSSE } from './sse-adapter.js';

export function createApp(dbPath?: string) {
	const db = createDb(dbPath);
	const app = express();
	app.use(express.json());

	app.get('/api/projects/current', (_req: Request, res: Response) => {
		res.json(getProjectState(db));
	});

	app.post('/api/chat', async (req: Request, res: Response) => {
		const prompt = extractPrompt(req.body.messages ?? []);
		console.log('POST /api/chat — prompt:', JSON.stringify(prompt).substring(0, 100));

		const project = getProjectState(db).project;

		res.setHeader('Content-Type', 'text/event-stream');
		res.setHeader('Cache-Control', 'no-cache');
		res.setHeader('Connection', 'keep-alive');

		const { translate } = createDomainAdapter();

		for await (const domainEvent of conductTurn(db, project.id, prompt)) {
			for (const sseEvent of translate(domainEvent)) {
				res.write(formatSSE(sseEvent));
			}
		}

		res.write(formatSSE('[DONE]'));
		res.end();
	});

	return { app, db };
}
