import { useState, useRef, useCallback } from 'preact/hooks';
import type { AssistantMessage, Assumption, Requirement, ClarifyingQuestion, ToolUpdate } from './types';
import { apiFetchStream, streamNDJSON } from './apiFetch';

interface UseAssistantParams {
    selectedModel: string;
    cwd: string;
    projectId: string | null;
    getGoalResponse: () => string;
    getAssumptions: () => Assumption[];
    getRequirements: () => Requirement[];
    onSetGoal?: (goal: string) => void;
    getFocusedAssumption?: () => Assumption | null;
    onUpdateAssumption?: (update: { id: string; text?: string; status?: string; confidence?: string; impact?: string }) => void;
    getFocusedRequirement?: () => Requirement | null;
    onUpdateRequirement?: (update: { id: string; title?: string; definition?: string; confidence?: number; stage?: string }) => void;
    getFocusedQuestion?: () => ClarifyingQuestion | null;
}

export function useAssistant({ selectedModel, cwd, projectId, getGoalResponse, getAssumptions, getRequirements, onSetGoal, getFocusedAssumption, onUpdateAssumption, getFocusedRequirement, onUpdateRequirement, getFocusedQuestion }: UseAssistantParams) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<AssistantMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [toolStatus, setToolStatus] = useState<{ tool: string } | null>(null);
    const [streamingContent, setStreamingContent] = useState('');
    const [pendingContext, setPendingContext] = useState<{ selectedText?: string; elementType?: string } | null>(null);
    const [goalJustSet, setGoalJustSet] = useState(false);
    const [toolUpdates, setToolUpdates] = useState<ToolUpdate[]>([]);
    const abortRef = useRef<AbortController | null>(null);

    function buildPrompt(userText: string, context: { selectedText?: string; elementType?: string } | null): string {
        const goalResponse = getGoalResponse();
        const assumptions = getAssumptions();
        const requirements = getRequirements();

        let prompt = 'You are an AI assistant helping a user refine a project specification. ';
        prompt += 'Answer concisely and helpfully. When the user references parts of the spec, use the provided context.\n\n';
        prompt += 'You have access to a set_goal tool. When the user has agreed on a goal definition or you have helped them refine their goal, use the set_goal tool to set it in the form.\n';
        prompt += 'You have access to an update_assumption tool. When the user wants to change an assumption\'s text, status, confidence, or impact, use this tool to update it directly.\n';
        prompt += 'You have access to an update_requirement tool. When the user wants to change a requirement\'s title, definition, confidence, or stage, use this tool to update it directly.\n\n';

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

        const focused = getFocusedAssumption?.();
        if (focused) {
            prompt += '## Focused Assumption (the user is discussing this specific assumption)\n';
            prompt += `ID: ${focused.id}\n`;
            prompt += `Text: ${focused.editedText || focused.text}\n`;
            prompt += `Rationale: ${focused.rationale}\n`;
            prompt += `Status: ${focused.status}\n`;
            prompt += `Confidence: ${focused.confidence}\n`;
            prompt += `Impact: ${focused.impact}\n`;
            prompt += 'When the user asks to modify this assumption, use the update_assumption tool with the ID above.\n\n';
        }

        if (requirements.length > 0) {
            prompt += '## Requirements\n';
            for (const r of requirements) {
                prompt += `- ${r.title}: ${r.definition} (confidence: ${r.confidence}%, stage: ${r.stage})\n`;
            }
            prompt += '\n';
        }

        const focusedReq = getFocusedRequirement?.();
        if (focusedReq) {
            prompt += '## Focused Requirement (the user is discussing this specific requirement)\n';
            prompt += `ID: ${focusedReq.id}\n`;
            prompt += `Title: ${focusedReq.title}\n`;
            prompt += `Definition: ${focusedReq.definition}\n`;
            prompt += `Confidence: ${Math.round(focusedReq.confidence * 100)}%\n`;
            prompt += `Stage: ${focusedReq.stage}\n`;
            if (focusedReq.tests.length > 0) {
                prompt += `Tests: ${focusedReq.tests.map(t => `${t.type}: ${t.description}`).join('; ')}\n`;
            }
            prompt += 'When the user asks to modify this requirement, use the update_requirement tool with the ID above.\n\n';
        }

        const focusedQ = getFocusedQuestion?.();
        if (focusedQ) {
            prompt += '## Focused Clarifying Question (the user is discussing this specific question)\n';
            prompt += `Question: ${focusedQ.question}\n`;
            prompt += `Why: ${focusedQ.why}\n`;
            if (focusedQ.options.length > 0) {
                prompt += `Options: ${focusedQ.options.map(o => o.label).join(', ')}\n`;
            }
            prompt += 'Help the user think through this question and provide useful context.\n\n';
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
                    onSetGoal?.(event.input.goal as string);
                    setGoalJustSet(true);
                } else if (event.type === 'tool_use' && event.tool === 'update_assumption') {
                    onUpdateAssumption?.(event.input as { id: string; text?: string; status?: string; confidence?: string; impact?: string });
                    setToolUpdates(prev => [...prev, { tool: 'update_assumption', data: event.input as Record<string, any>, timestamp: Date.now() }]);
                } else if (event.type === 'tool_use' && event.tool === 'update_requirement') {
                    onUpdateRequirement?.(event.input as { id: string; title?: string; definition?: string; confidence?: number; stage?: string });
                    setToolUpdates(prev => [...prev, { tool: 'update_requirement', data: event.input as Record<string, any>, timestamp: Date.now() }]);
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
    }, [loading, pendingContext, messages, selectedModel, cwd, getGoalResponse, getAssumptions, getRequirements, onSetGoal, getFocusedAssumption, onUpdateAssumption, getFocusedRequirement, onUpdateRequirement]);

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
        setToolUpdates([]);
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
        toolUpdates,
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
