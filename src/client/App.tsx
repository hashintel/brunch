import { useState } from 'react';
import { useChat } from '@ai-sdk/react';

export function App() {
	const [input, setInput] = useState('');
	const { messages, sendMessage, status, error } = useChat();
	const isLoading = status === 'submitted' || status === 'streaming';

	console.log('Chat status:', status, 'messages:', messages.length, 'error:', error?.message);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!input.trim() || isLoading) return;
		console.log('Sending message:', input);
		sendMessage({ text: input });
		setInput('');
	};

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
