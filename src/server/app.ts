import express from 'express';
import type { Request, Response } from 'express';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { translateEvent, formatSSE, resetAdapter } from './sse-adapter.js';
import { createDb, getOrCreateProject, saveMessage, getMessages } from './db.js';

export function createApp(dbPath?: string) {
	const db = createDb(dbPath);
	const app = express();
	app.use(express.json());

	app.get('/api/projects/current', (_req: Request, res: Response) => {
		const project = getOrCreateProject(db);
		const messages = getMessages(db, project.id);
		res.json({ project, messages });
	});

	app.post('/api/chat', async (req: Request, res: Response) => {
		const { messages } = req.body;
		const lastMessage = messages?.[messages.length - 1];
		// UIMessage format uses parts[]; legacy format uses content string
		const prompt = lastMessage?.content
			?? lastMessage?.parts?.filter((p: { type: string }) => p.type === 'text')
				.map((p: { text: string }) => p.text).join('') ?? '';

		console.log('POST /api/chat — prompt:', JSON.stringify(prompt).substring(0, 100));

		// Persist user message and build conversation context
		const project = getOrCreateProject(db);
		const history = getMessages(db, project.id);
		saveMessage(db, project.id, 'user', prompt);

		// Format conversation history for multi-turn context (A11)
		let fullPrompt = prompt;
		if (history.length > 0) {
			const historyText = history
				.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
				.join('\n');
			fullPrompt = `Previous conversation:\n${historyText}\n\n---\nUser: ${prompt}`;
		}

		res.setHeader('Content-Type', 'text/event-stream');
		res.setHeader('Cache-Control', 'no-cache');
		res.setHeader('Connection', 'keep-alive');

		resetAdapter();
		let assistantText = '';

		try {
			const stream = query({
				prompt: fullPrompt,
				options: {
					model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
					maxTurns: 1,
					includePartialMessages: true,
					systemPrompt: 'You are a helpful assistant.',
				},
			});

			for await (const sdkMessage of stream) {
				console.log('SDK:', sdkMessage.type, (sdkMessage as any).event?.type ?? '');
				const events = translateEvent(sdkMessage);
				for (const event of events) {
					console.log('SSE:', event.type);
					res.write(formatSSE(event));
					// Accumulate text for persistence
					if (event.type === 'text-delta') {
						assistantText += event.delta;
					}
				}
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			res.write(formatSSE({ type: 'error', errorText: message }));
		}

		// Persist assistant response
		if (assistantText) {
			saveMessage(db, project.id, 'assistant', assistantText);
		}

		res.write(formatSSE('[DONE]'));
		res.end();
	});

	return { app, db };
}
