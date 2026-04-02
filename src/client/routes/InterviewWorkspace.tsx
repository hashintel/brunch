import { useChat } from '@ai-sdk/react';
import type { UIMessage } from '@ai-sdk/react';
import { useLoaderData, useParams, Link, useRouter } from '@tanstack/react-router';
import { DefaultChatTransport } from 'ai';
import { useState, useEffect, useMemo, useCallback } from 'react';

type LoaderTurn = {
  id: number;
  answer: string | null;
  question: string | null;
  why: string | null;
  impact: string | null;
  phase: string;
  user_parts: string | null;
  assistant_parts: string | null;
  options: Array<{
    id: number;
    position: number;
    content: string;
    is_recommended: boolean;
    is_selected: boolean;
  }>;
};

function hydrateMessages(turns: LoaderTurn[]): UIMessage[] {
  const msgs: UIMessage[] = [];
  for (const turn of turns) {
    if (turn.answer) {
      msgs.push({
        id: `turn-${turn.id}-answer`,
        role: 'user',
        parts: [{ type: 'text' as const, text: turn.answer }],
      });
    }

    if (turn.assistant_parts) {
      try {
        const parts = JSON.parse(turn.assistant_parts);
        if (Array.isArray(parts) && parts.length > 0) {
          msgs.push({ id: `turn-${turn.id}-assistant`, role: 'assistant', parts });
          continue;
        }
      } catch {
        // fall through to scalar synthesis
      }
    }

    if (turn.question) {
      msgs.push({
        id: `turn-${turn.id}-assistant`,
        role: 'assistant',
        parts: [{ type: 'text' as const, text: turn.question }],
      });
    }
  }
  return msgs;
}

const impactColors: Record<string, { bg: string; text: string }> = {
  high: { bg: '#fef2f2', text: '#991b1b' },
  medium: { bg: '#fffbeb', text: '#92400e' },
  low: { bg: '#f0fdf4', text: '#166534' },
};

function TurnCard({
  turn,
  onSelect,
  disabled,
}: {
  turn: LoaderTurn;
  onSelect: (turnId: number, position: number) => void;
  disabled: boolean;
}) {
  const hasSelection = turn.options.some((o) => o.is_selected);
  const impact = turn.impact ? impactColors[turn.impact] : null;

  return (
    <div
      style={{
        margin: '12px 0',
        padding: 16,
        border: '1px solid #e0e0e0',
        borderRadius: 8,
        background: '#fafafa',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{turn.question}</div>

      {turn.why && (
        <div style={{ fontSize: 13, color: '#555', marginBottom: 8, fontStyle: 'italic' }}>{turn.why}</div>
      )}

      {impact && (
        <span
          style={{
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 4,
            background: impact.bg,
            color: impact.text,
            marginBottom: 8,
            textTransform: 'uppercase',
          }}
        >
          {turn.impact} impact
        </span>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        {turn.options.map((opt) => {
          const isSelected = opt.is_selected;
          return (
            <button
              key={opt.position}
              type="button"
              disabled={disabled || hasSelection}
              onClick={() => onSelect(turn.id, opt.position)}
              style={{
                padding: '8px 12px',
                border: isSelected ? '2px solid #2563eb' : '1px solid #d0d0d0',
                borderRadius: 6,
                background: isSelected ? '#eff6ff' : '#fff',
                cursor: disabled || hasSelection ? 'default' : 'pointer',
                textAlign: 'left',
                fontSize: 14,
                opacity: hasSelection && !isSelected ? 0.5 : 1,
              }}
            >
              {opt.content}
              {opt.is_recommended && (
                <span style={{ marginLeft: 8, fontSize: 11, color: '#2563eb', fontWeight: 600 }}>
                  Recommended
                </span>
              )}
              {isSelected && (
                <span style={{ marginLeft: 8, fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                  ✓ Selected
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function InterviewWorkspace() {
  const { project, turns } = useLoaderData({ from: '/project/$id' });
  const { id } = useParams({ from: '/project/$id' });
  const router = useRouter();
  const [input, setInput] = useState('');
  const [selecting, setSelecting] = useState(false);

  const transport = useMemo(() => new DefaultChatTransport({ api: `/api/projects/${id}/chat` }), [id]);
  const { messages, sendMessage, setMessages, status } = useChat({ transport });
  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    setMessages(hydrateMessages(turns));
  }, [project.id, turns]);

  const lastTurn = turns[turns.length - 1] as LoaderTurn | undefined;
  const showTurnCard = lastTurn?.options?.length && lastTurn.options.length > 0;
  const lastTurnHasSelection = lastTurn?.options?.some((o) => o.is_selected) ?? false;

  const handleSelect = useCallback(
    async (turnId: number, position: number) => {
      setSelecting(true);
      try {
        const res = await fetch(`/api/projects/${id}/turns/${turnId}/select`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position }),
        });
        if (!res.ok) return;

        const selected = lastTurn?.options.find((o) => o.position === position);
        if (selected) {
          await router.invalidate();
          void sendMessage({ text: selected.content });
        }
      } finally {
        setSelecting(false);
      }
    },
    [id, lastTurn, router, sendMessage],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    void sendMessage({ text: input });
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
                  <details
                    key={i}
                    style={{ margin: '4px 0', padding: 8, background: '#f5f5f5', borderRadius: 4 }}
                  >
                    <summary style={{ cursor: 'pointer', color: '#666' }}>Thinking...</summary>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{part.text}</pre>
                  </details>
                );
              }
              if (part.type === 'tool-invocation' || part.type === 'dynamic-tool') {
                const toolPart = part as { toolName: string; state: string; toolCallId: string };
                if (toolPart.toolName === 'ask_question') return null;
                const stateLabel =
                  toolPart.state === 'input-streaming'
                    ? 'Streaming...'
                    : toolPart.state === 'result' || toolPart.state === 'output-available'
                      ? 'Done'
                      : toolPart.state;
                return (
                  <div
                    key={i}
                    style={{
                      margin: '4px 0',
                      padding: 8,
                      background: '#eef6ff',
                      borderRadius: 4,
                      border: '1px solid #c0d8f0',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Tool: {toolPart.toolName}</span>
                    <span style={{ marginLeft: 8, color: '#666' }}>{stateLabel}</span>
                  </div>
                );
              }
              if (part.type === 'text') {
                return (
                  <p key={i} style={{ margin: '4px 0' }}>
                    {part.text}
                  </p>
                );
              }
              return null;
            })}
          </div>
        ))}
      </div>

      {showTurnCard && !isLoading && (
        <TurnCard turn={lastTurn!} onSelect={handleSelect} disabled={selecting || isLoading} />
      )}

      {(!showTurnCard || lastTurnHasSelection) && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={isLoading || selecting}
            style={{ flex: 1, padding: 8, fontSize: 14 }}
          />
          <button type="submit" disabled={isLoading || selecting} style={{ padding: '8px 16px' }}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}
