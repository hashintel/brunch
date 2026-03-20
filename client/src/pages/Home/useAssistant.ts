import { useState, useRef, useCallback } from 'preact/hooks';
import type { AssistantMessage, Assumption, Requirement } from './types';
import { apiFetchStream, streamNDJSON } from './apiFetch';

interface UseAssistantParams {
    selectedModel: string;
    cwd: string;
    projectId: string | null;
    getGoalResponse: () => string;
    getAssumptions: () => Assumption[];
    getRequirements: () => Requirement[];
    onSetGoal?: (goal: string) => void;
}

export function useAssistant({ selectedModel, cwd, projectId, getGoalResponse, getAssumptions, getRequirements, onSetGoal }: UseAssistantParams) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<AssistantMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [toolStatus, setToolStatus] = useState<{ tool: string } | null>(null);
    const [streamingContent, setStreamingContent] = useState('');
    const [pendingContext, setPendingContext] = useState<{ selectedText?: string; elementType?: string } | null>(null);
    const [goalJustSet, setGoalJustSet] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    function buildPrompt(userText: string, context: { selectedText?: string; elementType?: string } | null): string {
        const goalResponse = getGoalResponse();
        const assumptions = getAssumptions();
        const requirements = getRequirements();

        let prompt = 'You are an AI assistant helping a user refine a project specification. ';
        prompt += 'Answer concisely and helpfully. When the user references parts of the spec, use the provided context.\n\n';
        prompt += 'You have access to a set_goal tool. When the user has agreed on a goal definition or you have helped them refine their goal, use the set_goal tool to set it in the form.\n\n';

        if (goalResponse) {
            prompt += `## Current Goal\n${goalResponse}\n\n`;
        }

        if (assumptions.length > 0) {
            prompt += '## Assumptions\n';
            for (const a of assumptions) {
                prompt += `- [${a.confidence} confidence, ${a.impact} impact, ${a.status}] ${a.editedText || a.text}\n`;
            }
            prompt += '\n';
        }

        if (requirements.length > 0) {
            prompt += '## Requirements\n';
            for (const r of requirements) {
                prompt += `- ${r.title}: ${r.definition} (confidence: ${r.confidence}%, stage: ${r.stage})\n`;
            }
            prompt += '\n';
        }

        // Conversation history
        if (messages.length > 0) {
            prompt += '## Conversation History\n';
            for (const m of messages) {
                prompt += `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}\n\n`;
            }
        }

        // Context from selection
        if (context?.selectedText) {
            prompt += `## Selected Context\nThe user selected this text${context.elementType ? ` from the ${context.elementType} section` : ''}: "${context.selectedText}"\n\n`;
        }

        prompt += `## User Message\n${userText}`;
        return prompt;
    }

    const send = useCallback(async (text: string) => {
        if (!text.trim() || loading) return;

        const context = pendingContext;
        const userMsg: AssistantMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: text,
            context: context || undefined,
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, userMsg]);
        setPendingContext(null);
        setLoading(true);
        setStreamingContent('');
        setGoalJustSet(false);

        const prompt = buildPrompt(text, context);
        let fullText = '';

        try {
            abortRef.current = new AbortController();
            const stream = await apiFetchStream('/api/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, model: selectedModel, cwd: cwd || undefined, projectId: projectId || undefined, assistant: true }),
                signal: abortRef.current.signal,
            });

            for await (const event of streamNDJSON(stream)) {
                if (event.type === 'text') {
                    fullText += event.text;
                    setStreamingContent(fullText);
                } else if (event.type === 'tool_start') {
                    setToolStatus({ tool: event.tool });
                } else if (event.type === 'tool_end') {
                    setToolStatus(null);
                } else if (event.type === 'tool_use' && event.tool === 'set_goal') {
                    onSetGoal?.(event.input.goal);
                    setGoalJustSet(true);
                }
            }

            const assistantMsg: AssistantMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: fullText,
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (e) {
            if ((e as Error).name !== 'AbortError') {
                const errorMsg: AssistantMessage = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: `Error: ${(e as Error).message || 'Something went wrong'}`,
                    timestamp: Date.now(),
                };
                setMessages(prev => [...prev, errorMsg]);
            }
        } finally {
            setLoading(false);
            setStreamingContent('');
            setToolStatus(null);
            abortRef.current = null;
        }
    }, [loading, pendingContext, messages, selectedModel, cwd, getGoalResponse, getAssumptions, getRequirements, onSetGoal]);

    function openWithContext(ctx: { selectedText?: string; elementType?: string }) {
        setPendingContext(ctx);
        setIsOpen(true);
    }

    function toggle() {
        setIsOpen(prev => !prev);
    }

    function close() {
        setIsOpen(false);
    }

    function reset() {
        setMessages([]);
        setStreamingContent('');
        setToolStatus(null);
        setLoading(false);
        setPendingContext(null);
        setIsOpen(false);
        setGoalJustSet(false);
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
    }

    function open() {
        setIsOpen(true);
    }

    function openWithMessage(content: string) {
        const msg: AssistantMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content,
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, msg]);
        setIsOpen(true);
    }

    function dismissContext() {
        setPendingContext(null);
    }

    return {
        isOpen,
        messages,
        loading,
        toolStatus,
        streamingContent,
        pendingContext,
        goalJustSet,
        send,
        open,
        openWithMessage,
        openWithContext,
        toggle,
        close,
        reset,
        dismissContext,
    };
}
