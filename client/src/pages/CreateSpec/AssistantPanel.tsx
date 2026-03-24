import { useState, useRef, useEffect } from 'preact/hooks';

interface ActivityStep {
    label: string;
    done: boolean;
}

interface QueuedMessage {
    id: string;
    text: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
}

export function AssistantPanel({ open, onClose }: Props) {
    const [tab, setTab] = useState<'new' | 'old'>('new');
    const [input, setInput] = useState('');
    const [queueOpen, setQueueOpen] = useState(true);
    const [activityOpen, setActivityOpen] = useState(true);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Demo state — wire to real data later
    const [activity] = useState<{
        label: string;
        elapsed: string;
        steps: ActivityStep[];
    } | null>({
        label: 'Now generating the new questions...',
        elapsed: '2:32',
        steps: [
            { label: 'Reviewing the prompt', done: true },
            { label: 'Building the plan', done: true },
            { label: 'Generating clarifying questions', done: false },
        ],
    });

    const [queue] = useState<QueuedMessage[]>([
        { id: '1', text: 'Can you review the prompt for me again?' },
    ]);

    useEffect(() => {
        if (open && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [open]);

    if (!open) return null;

    function handleSend() {
        if (!input.trim()) return;
        // TODO: send message
        setInput('');
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    function removeQueueItem(id: string) {
        // TODO: remove from queue
        void id;
    }

    return (
        <div class="cs-assistant">
            {/* Gradient glow */}
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
                        onClick={() => setTab('new')}
                    >
                        New chat
                    </button>
                    <button
                        class={`cs-assistant__tab ${tab === 'old' ? 'cs-assistant__tab--active' : ''}`}
                        onClick={() => setTab('old')}
                    >
                        Old chat
                    </button>
                </div>

                <button class="cs-assistant__close-btn" onClick={onClose}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                    </svg>
                </button>

                {/* Chat area (scrollable, grows to fill) */}
                <div class="cs-assistant__chat-area">
                    {/* Messages would render here */}
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
                            <span class="cs-assistant__activity-time">{activity.elapsed}</span>
                            <button class="cs-assistant__activity-stop" title="Stop">
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
                    {/* Queue */}
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
                                            <button class="cs-assistant__queue-remove" onClick={() => removeQueueItem(item.id)}>
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

                    {/* Input */}
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
                            <button class="cs-assistant__send-btn" onClick={handleSend} disabled={!input.trim()}>
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
