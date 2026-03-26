import { useState, useRef, useEffect } from 'preact/hooks';
import { Markdown } from './Markdown';
import type { ChatMessage, ActivityInfo, ToolUpdate } from './useAssistantChat';

interface Props {
    open: boolean;
    onClose: () => void;
    messages: ChatMessage[];
    loading: boolean;
    streamingContent: string;
    activity: ActivityInfo | null;
    queue: { id: string; text: string }[];
    onSend: (text: string) => void;
    onStop: () => void;
    onRemoveFromQueue: (id: string) => void;
    onNewChat: () => void;
    toolUpdates?: ToolUpdate[];
}

export function AssistantPanel({
    open, onClose, messages, loading, streamingContent,
    activity, queue, onSend, onStop, onRemoveFromQueue, onNewChat, toolUpdates,
}: Props) {
    const [tab, setTab] = useState<'new' | 'history'>('new');
    const [input, setInput] = useState('');
    const [queueOpen, setQueueOpen] = useState(true);
    const [activityOpen, setActivityOpen] = useState(true);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingContent]);

    // Focus textarea
    useEffect(() => {
        if (open) textareaRef.current?.focus();
    }, [open]);

    // Escape to close
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape' && open) onClose();
        }
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open, onClose]);

    if (!open) return null;

    function handleSend() {
        const text = input.trim();
        if (!text) return;
        setInput('');
        onSend(text);
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    return (
        <div class="cs-assistant">
            <div class="cs-assistant__glow" />
            <div class="cs-assistant__border" />

            <div class="cs-assistant__panel">
                {/* Top bar */}
                <div class="cs-assistant__top-left">
                    <button class="cs-assistant__icon-btn" title="Minimize" onClick={onClose}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M4 8h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                        </svg>
                    </button>
                    <div class="cs-assistant__separator" />
                    <button
                        class={`cs-assistant__tab ${tab === 'new' ? 'cs-assistant__tab--active' : ''}`}
                        onClick={() => { setTab('new'); onNewChat(); }}
                    >
                        New chat
                    </button>
                    <button
                        class={`cs-assistant__tab ${tab === 'history' ? 'cs-assistant__tab--active' : ''}`}
                        onClick={() => setTab('history')}
                    >
                        Old chat
                    </button>
                </div>

                <button class="cs-assistant__close-btn" onClick={onClose}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                    </svg>
                </button>

                {/* Chat area */}
                <div class="cs-assistant__chat-area">
                    {messages.length === 0 && !loading && (
                        <div class="cs-assistant__empty">
                            <div class="cs-assistant__empty-icon">
                                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                                    <path d="M16 4l5 7L28 14l-5 6L24 28l-8-3-8 3 1-8L4 14l7-3L16 4z" stroke="#5424ff" stroke-width="1.5" fill="none" opacity="0.4" />
                                </svg>
                            </div>
                            <p class="cs-assistant__empty-text">
                                Ask me anything about your project spec. I can help refine ideas, suggest improvements, or explain sections.
                            </p>
                        </div>
                    )}

                    {messages.map(msg => (
                        <div key={msg.id} class={`cs-assistant__msg cs-assistant__msg--${msg.role}`}>
                            {msg.role === 'assistant' && (
                                <div class="cs-assistant__msg-avatar">
                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                        <path d="M8 1l2.5 3.5L14 6l-2.5 3L12 13l-4-1.5L4 13l.5-4L2 6l3.5-1.5L8 1z" stroke="#5424ff" stroke-width="1.2" fill="none" />
                                    </svg>
                                </div>
                            )}
                            {msg.role === 'assistant' ? (
                                <Markdown content={msg.content} class="cs-assistant__msg-content" />
                            ) : (
                                <div class="cs-assistant__msg-content">{msg.content}</div>
                            )}
                        </div>
                    ))}

                    {loading && streamingContent && (
                        <div class="cs-assistant__msg cs-assistant__msg--assistant">
                            <div class="cs-assistant__msg-avatar">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                    <path d="M8 1l2.5 3.5L14 6l-2.5 3L12 13l-4-1.5L4 13l.5-4L2 6l3.5-1.5L8 1z" stroke="#5424ff" stroke-width="1.2" fill="none" />
                                </svg>
                            </div>
                            <Markdown content={streamingContent} class="cs-assistant__msg-content" />
                        </div>
                    )}

                    {loading && !streamingContent && (
                        <div class="cs-assistant__msg cs-assistant__msg--assistant">
                            <div class="cs-assistant__msg-avatar">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                    <path d="M8 1l2.5 3.5L14 6l-2.5 3L12 13l-4-1.5L4 13l.5-4L2 6l3.5-1.5L8 1z" stroke="#5424ff" stroke-width="1.2" fill="none" />
                                </svg>
                            </div>
                            <div class="cs-assistant__msg-content cs-assistant__msg-typing">
                                <span class="cs-assistant__dot" />
                                <span class="cs-assistant__dot" />
                                <span class="cs-assistant__dot" />
                            </div>
                        </div>
                    )}

                    {toolUpdates && toolUpdates.length > 0 && (
                        <div class="cs-assistant__updates">
                            {toolUpdates.map((u, i) => (
                                <div key={i} class="cs-assistant__update-card">
                                    <span class="cs-assistant__update-icon">&#9998;</span>
                                    <span>{formatToolUpdate(u)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Activity section */}
                {activity && (
                    <div class="cs-assistant__activity">
                        <div class="cs-assistant__activity-header">
                            <div class="cs-assistant__activity-icon">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M8 1l2.5 3.5L14 6l-2.5 3L12 13l-4-1.5L4 13l.5-4L2 6l3.5-1.5L8 1z" stroke="#5424ff" stroke-width="1.2" fill="none" />
                                </svg>
                            </div>
                            <p class="cs-assistant__activity-label">{activity.label}</p>
                            <ElapsedTimer startTime={activity.startTime} />
                            <button class="cs-assistant__activity-stop" title="Stop" onClick={onStop}>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" />
                                </svg>
                            </button>
                            <div class="cs-assistant__separator" />
                            <button
                                class="cs-assistant__activity-toggle"
                                onClick={() => setActivityOpen(!activityOpen)}
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: activityOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                                    <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </button>
                        </div>
                        {activityOpen && (
                            <div class="cs-assistant__activity-steps">
                                {activity.steps.map((step, i) => (
                                    <div key={i} class="cs-assistant__step">
                                        <div class={`cs-assistant__step-dot ${step.done ? 'cs-assistant__step-dot--done' : ''}`} />
                                        {i < activity.steps.length - 1 && <div class="cs-assistant__step-line" />}
                                        <span class="cs-assistant__step-label">{step.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Bottom: queue + input */}
                <div class="cs-assistant__bottom">
                    {queue.length > 0 && (
                        <div class="cs-assistant__queue">
                            <div class="cs-assistant__queue-header" onClick={() => setQueueOpen(!queueOpen)}>
                                <span class="cs-assistant__queue-label">{queue.length} Queued</span>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: queueOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                                    <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </div>
                            {queueOpen && (
                                <div class="cs-assistant__queue-items">
                                    {queue.map(item => (
                                        <div key={item.id} class="cs-assistant__queue-item">
                                            <span class="cs-assistant__queue-text">{item.text}</span>
                                            <button class="cs-assistant__queue-remove" onClick={() => onRemoveFromQueue(item.id)}>
                                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div class="cs-assistant__input-card">
                        <textarea
                            ref={textareaRef}
                            class="cs-assistant__input"
                            placeholder="Ask me everything..."
                            value={input}
                            onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
                            onKeyDown={handleKeyDown}
                            rows={2}
                        />
                        <div class="cs-assistant__input-actions">
                            <div class="cs-assistant__input-left">
                                <button class="cs-assistant__attach-btn" title="Attach">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                                    </svg>
                                </button>
                                <button class="cs-assistant__voice-btn" title="Voice">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <path d="M8 2a2 2 0 012 2v4a2 2 0 01-4 0V4a2 2 0 012-2z" stroke="currentColor" stroke-width="1.2" />
                                        <path d="M4 7v1a4 4 0 008 0V7M8 12v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                                    </svg>
                                </button>
                            </div>
                            <button
                                class="cs-assistant__send-btn"
                                onClick={handleSend}
                                disabled={!input.trim()}
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Live elapsed timer component */
function ElapsedTimer({ startTime }: { startTime: number }) {
    const [, setTick] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    return <span class="cs-assistant__activity-time">{formatElapsed(Date.now() - startTime)}</span>;
}

function formatElapsed(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatToolUpdate(u: ToolUpdate): string {
    switch (u.tool) {
        case 'set_goal': return `Set goal → ${u.data?.goal ?? ''}`;
        case 'update_assumption': return `Updated assumption → ${u.data?.text ?? u.data?.confidence ?? u.data?.id ?? ''}`;
        case 'create_assumption': return `Created assumption → ${u.data?.text?.slice(0, 50) ?? ''}`;
        case 'delete_assumption': return `Deleted assumption`;
        case 'update_requirement': return `Updated requirement → ${u.data?.title ?? u.data?.id ?? ''}`;
        case 'create_requirement': return `Created requirement → ${u.data?.title?.slice(0, 50) ?? ''}`;
        case 'delete_requirement': return `Deleted requirement`;
        default: return u.tool.replace(/_/g, ' ');
    }
}

/** Small floating button to open the assistant */
export function AssistantToggle({ onClick }: { onClick: () => void }) {
    return (
        <button class="cs-assistant-toggle" onClick={onClick} title="AI Assistant">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2l3 4.5L17 8l-3 4L15 17l-5-2-5 2 1-5L3 8l4-1.5L10 2z" stroke="currentColor" stroke-width="1.3" fill="none" />
            </svg>
        </button>
    );
}
