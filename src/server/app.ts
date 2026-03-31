import express from 'express';
import type { Request, Response } from 'express';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { translateEvent, formatSSE, resetAdapter } from './sse-adapter.js';

export const app = express();
app.use(express.json());

app.post('/api/chat', async (req: Request, res: Response) => {
	const { messages } = req.body;
	const lastMessage = messages?.[messages.length - 1];
	// UIMessage format uses parts[]; legacy format uses content string
	const prompt = lastMessage?.content
		?? lastMessage?.parts?.filter((p: { type: string }) => p.type === 'text')
			.map((p: { text: string }) => p.text).join('') ?? '';

	console.log('POST /api/chat — prompt:', JSON.stringify(prompt).substring(0, 100));

	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');

	resetAdapter();

	try {
		const stream = query({
			prompt,
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
			}
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		res.write(formatSSE({ type: 'error', errorText: message }));
	}

	res.write(formatSSE('[DONE]'));
	res.end();
});
