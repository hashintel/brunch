import { useRef, useEffect, useState } from 'preact/hooks';
import type { AssistantMessage } from './types';
import { LoadingIndicator } from '../../components/LoadingIndicator';

interface AssistantPaneProps {
    isOpen: boolean;
    messages: AssistantMessage[];
    loading: boolean;
    toolStatus: { tool: string } | null;
    streamingContent: string;
    pendingContext: { selectedText?: string; elementType?: string } | null;
    goalJustSet?: boolean;
    onSend: (text: string) => void;
    onClose: () => void;
    onDismissContext: () => void;
}

export function AssistantPane({
    isOpen,
    messages,
    loading,
    toolStatus,
    streamingContent,
    pendingContext,
    goalJustSet,
    onSend,
    onClose,
    onDismissContext,
}: AssistantPaneProps) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingContent]);

    // Focus textarea when pane opens
    useEffect(() => {
        if (isOpen) {
            textareaRef.current?.focus();
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    function handleSubmit() {
        const text = input.trim();
        if (!text || loading) return;
        setInput('');
        onSend(text);
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    }

    return (
        <div class={`assistant-pane ${isOpen ? 'assistant-pane--open' : ''}`}>
            <div class="assistant-header">
                <span class="assistant-header-title">AI Assistant</span>
                <button class="assistant-header-close" onClick={onClose} title="Close (Esc)">
                    &times;
                </button>
            </div>

            {pendingContext?.selectedText && (
                <div class="assistant-context-badge">
                    <span class="assistant-context-badge-text">
                        {pendingContext.elementType && (
                            <span class="assistant-context-badge-type">{pendingContext.elementType}: </span>
                        )}
                        &ldquo;{pendingContext.selectedText.length > 80
                            ? pendingContext.selectedText.slice(0, 80) + '\u2026'
                            : pendingContext.selectedText}&rdquo;
                    </span>
                    <button class="assistant-context-badge-dismiss" onClick={onDismissContext}>&times;</button>
                </div>
            )}

            <div class="assistant-messages">
                {messages.length === 0 && !loading && (
                    <div class="assistant-empty">
                        Ask a question about the spec, request changes, or get explanations.
                    </div>
                )}

                {messages.map(msg => (
                    <div key={msg.id} class={`assistant-message assistant-message--${msg.role}`}>
                        {msg.context?.selectedText && (
                            <div class="assistant-message-context">
                                Re: &ldquo;{msg.context.selectedText.length > 60
                                    ? msg.context.selectedText.slice(0, 60) + '\u2026'
                                    : msg.context.selectedText}&rdquo;
                            </div>
                        )}
                        <div class="assistant-message-content">{msg.content}</div>
                    </div>
                ))}

                {loading && streamingContent && (
                    <div class="assistant-message assistant-message--assistant">
                        <div class="assistant-message-content">{streamingContent}</div>
                    </div>
                )}

                {goalJustSet && (
                    <div class="assistant-goal-set-notice">
                        Goal has been set in the form.
                    </div>
                )}

                {loading && (
                    <LoadingIndicator
                        message="Thinking"
                        toolStatus={toolStatus}
                    />
                )}

                <div ref={messagesEndRef} />
            </div>

            <div class="assistant-input">
                <textarea
                    ref={textareaRef}
                    class="assistant-input-textarea"
                    value={input}
                    onInput={e => setInput(e.currentTarget.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about the spec..."
                    disabled={loading}
                    rows={2}
                />
                <button
                    class="assistant-input-send"
                    onClick={handleSubmit}
                    disabled={loading || !input.trim()}
                    title="Send (Enter)"
                >
                    &#10148;
                </button>
            </div>
        </div>
    );
}
