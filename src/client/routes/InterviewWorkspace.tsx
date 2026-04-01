import { useState, useEffect, useMemo } from 'react';
import { useLoaderData, useParams, Link } from '@tanstack/react-router';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from '@ai-sdk/react';

export function InterviewWorkspace() {
	const { project, turns } = useLoaderData({ from: '/project/$id' });
	const { id } = useParams({ from: '/project/$id' });
	const [input, setInput] = useState('');

	const transport = useMemo(
		() => new DefaultChatTransport({ api: `/api/projects/${id}/chat` }),
		[id],
	);

	const { messages, sendMessage, setMessages, status, error } = useChat({ transport });
	const isLoading = status === 'submitted' || status === 'streaming';

	// Hydrate turns into useChat messages on mount
	useEffect(() => {
		if (turns?.length > 0) {
			const msgs: UIMessage[] = [];
			for (const turn of turns) {
				if (turn.answer) {
					msgs.push({
						id: `turn-${turn.id}-answer`,
						role: 'user',
						parts: [{ type: 'text' as const, text: turn.answer }],
					});
				}
				if (turn.question) {
					msgs.push({
						id: `turn-${turn.id}-question`,
						role: 'assistant',
						parts: [{ type: 'text' as const, text: turn.question }],
					});
				}
			}
			setMessages(msgs);
		}
	}, [project.id]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isLoading) return;
		sendMessage({ text: input });
		setInput('');
	};

	return (
		<div style={{ maxWidth: 640, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
				<Link to="/" style={{ textDecoration: 'none', fontSize: 14 }}>
					&larr; Projects
				</Link>
				<h1 style={{ margin: 0 }}>{project.name}</h1>
			</div>

			<div style={{ marginBottom: 16 }}>
				{messages.map((msg) => (
					<div key={msg.id} style={{ marginBottom: 12 }}>
						<strong>{msg.role === 'user' ? 'You' : 'Assistant'}:</strong>
						{msg.parts?.map((part, i) => {
							if (part.type === 'reasoning') {
								return (
									<details key={i} style={{ margin: '4px 0', padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
										<summary style={{ cursor: 'pointer', color: '#666' }}>Thinking...</summary>
										<pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{part.text}</pre>
									</details>
								);
							}
							if (part.type === 'text') {
								return <p key={i} style={{ margin: '4px 0' }}>{part.text}</p>;
							}
							return null;
						})}
					</div>
				))}
			</div>

			<form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Type a message..."
					disabled={isLoading}
					style={{ flex: 1, padding: 8, fontSize: 14 }}
				/>
				<button type="submit" disabled={isLoading} style={{ padding: '8px 16px' }}>
					Send
				</button>
			</form>
		</div>
	);
}
