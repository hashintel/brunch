import express from 'express';
import type { Request, Response } from 'express';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { createTranslator, formatSSE, type AIEvent } from './sse-adapter.js';
import { createDb, getOrCreateProject, createTurn, updateTurn, getActivePath, advanceHead, type Turn } from './db.js';

/** Extract user text from a UIMessage (parts[]) or legacy format (content string). */
function extractPrompt(messages: unknown[]): string {
	const lastMessage = messages?.[messages.length - 1] as Record<string, unknown> | undefined;
	if (!lastMessage) return '';
	if (typeof lastMessage.content === 'string') return lastMessage.content;
	const parts = lastMessage.parts as Array<{ type: string; text: string }> | undefined;
	return parts?.filter((p) => p.type === 'text').map((p) => p.text).join('') ?? '';
}

/** Format conversation history from active-path turns for multi-turn context. */
function formatHistory(turns: Turn[], currentPrompt: string): string {
	if (turns.length === 0) return currentPrompt;
	const lines: string[] = [];
	for (const turn of turns) {
		if (turn.answer) lines.push(`User: ${turn.answer}`);
		if (turn.question) lines.push(`Assistant: ${turn.question}`);
	}
	if (lines.length === 0) return currentPrompt;
	return `Previous conversation:\n${lines.join('\n')}\n\n---\nUser: ${currentPrompt}`;
}

/** Collect assistant text content from translated SSE events. */
function collectText(events: AIEvent[]): string {
	return events
		.filter((e): e is AIEvent & { type: 'text-delta' } => e.type === 'text-delta')
		.map((e) => e.delta)
		.join('');
}

export function createApp(dbPath?: string) {
	const db = createDb(dbPath);
	const app = express();
	app.use(express.json());

	app.get('/api/projects/current', (_req: Request, res: Response) => {
		const project = getOrCreateProject(db);
		const turns = getActivePath(db, project.id);
		res.json({ project, turns });
	});

	app.post('/api/chat', async (req: Request, res: Response) => {
		const prompt = extractPrompt(req.body.messages ?? []);

		console.log('POST /api/chat — prompt:', JSON.stringify(prompt).substring(0, 100));

		const project = getOrCreateProject(db);
		const activePath = getActivePath(db, project.id);

		// Create turn: answer = user's message, question = '' (filled after streaming)
		const turn = createTurn(db, project.id, {
			parent_turn_id: project.active_turn_id,
			phase: 'scope',
			question: '',
			answer: prompt,
		});

		const fullPrompt = formatHistory(activePath, prompt);

		res.setHeader('Content-Type', 'text/event-stream');
		res.setHeader('Cache-Control', 'no-cache');
		res.setHeader('Connection', 'keep-alive');

		const { translateEvent } = createTranslator();
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
				assistantText += collectText(events);
				for (const event of events) {
					console.log('SSE:', event.type);
					res.write(formatSSE(event));
				}
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error';
			res.write(formatSSE({ type: 'error', errorText: message }));
		}

		if (assistantText) {
			updateTurn(db, turn.id, { question: assistantText });
		}
		advanceHead(db, project.id, turn.id);

		res.write(formatSSE('[DONE]'));
		res.end();
	});

	return { app, db };
}
