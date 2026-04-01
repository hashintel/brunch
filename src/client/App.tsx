import { useState, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from '@ai-sdk/react';

export function App() {
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(true);
	const { messages, sendMessage, setMessages, status, error } = useChat();
	const isLoading = status === 'submitted' || status === 'streaming';

	// Fetch conversation history on mount — hydrate turns into useChat messages
	useEffect(() => {
		fetch('/api/projects/current')
			.then((res) => res.json())
			.then((data) => {
				if (data.turns?.length > 0) {
					const msgs: UIMessage[] = [];
					for (const turn of data.turns as Array<{ id: number; answer: string | null; question: string | null }>) {
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
				setLoading(false);
			})
			.catch(() => setLoading(false));
	}, []);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isLoading) return;
		sendMessage({ text: input });
		setInput('');
	};

	if (loading) {
		return (
			<div style={{ maxWidth: 640, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
				<h1>Brunch</h1>
				<p>Loading...</p>
			</div>
		);
	}

	return (
		<div style={{ maxWidth: 640, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
			<h1>Brunch</h1>

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
