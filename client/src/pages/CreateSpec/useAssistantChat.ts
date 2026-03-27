import { useState, useRef, useCallback } from 'preact/hooks';
import { apiFetchStream, streamNDJSON } from '../../shared/apiFetch';
import type { StructuredSpec, WizardAssumption, WizardRequirement, RequirementsData, SpecAnswer, SpecQuestion, FocusedItem } from './types';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export interface ActivityInfo {
    label: string;
    startTime: number;
    steps: { label: string; done: boolean }[];
}

export interface ToolUpdate {
    tool: string;
    data: any;
    timestamp: number;
}

export interface ToolCallbacks {
    onSetGoal?: (goal: string) => void;
    onUpdateAssumption?: (input: any) => void;
    onCreateAssumption?: (input: any) => void;
    onDeleteAssumption?: (id: string) => void;
    onUpdateRequirement?: (input: any) => void;
    onCreateRequirement?: (input: any) => void;
    onDeleteRequirement?: (id: string) => void;
}

interface WizardContext {
    screen: string;
    prompt: string;
    selectedModel: string;
    getQuestions: () => SpecQuestion[];
    getAnswers: () => SpecAnswer[];
    getSpec: () => StructuredSpec | null;
    getAssumptions: () => WizardAssumption[];
    getRequirements: () => RequirementsData | null;
    getWizardStatus: () => string;
    getFocusedItem?: () => FocusedItem;
    toolCallbacks?: ToolCallbacks;
}

export function useAssistantChat(ctx: WizardContext) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [activity, setActivity] = useState<ActivityInfo | null>(null);
    const [queue, setQueue] = useState<{ id: string; text: string }[]>([]);
    const [toolUpdates, setToolUpdates] = useState<ToolUpdate[]>([]);

    const abortRef = useRef<AbortController | null>(null);
    const messagesRef = useRef<ChatMessage[]>([]);
    const queueRef = useRef<{ id: string; text: string }[]>([]);

    // Keep refs in sync
    messagesRef.current = messages;
    queueRef.current = queue;

    function buildPrompt(userText: string, history: ChatMessage[]): string {
        let p = 'You are an AI assistant embedded in a project spec wizard. ';
        p += 'Help the user refine their project spec. Answer concisely. Use markdown formatting when helpful.\n\n';

        p += `## Current Wizard Screen: ${ctx.screen}\n\n`;

        const status = ctx.getWizardStatus();
        if (status) {
            p += `## Current Activity\n${status}\n\n`;
        }

        if (ctx.prompt) {
            p += `## Original Project Idea\n${ctx.prompt}\n\n`;
        }

        const questions = ctx.getQuestions();
        const answers = ctx.getAnswers();
        if (questions.length > 0) {
            p += '## Clarifying Questions & Answers\n';
            questions.forEach((q, i) => {
                const a = answers[i];
                const answerText = a?.skipped ? '(skipped)' : a?.selectedLabels?.length ? a.selectedLabels.join(', ') : '(not answered yet)';
                p += `- Q: ${q.question}\n  A: ${answerText}\n`;
            });
            p += '\n';
        }

        const spec = ctx.getSpec();
        if (spec) {
            p += '## Current Spec\n';
            p += `Overall confidence: ${Math.round(spec.overallConfidence)}%\n`;
            for (const s of spec.sections) {
                p += `### ${s.type} (confidence: ${Math.round(s.confidence)}%)\n${s.content}\n`;
                if (s.items?.length) p += `Items: ${s.items.join(', ')}\n`;
                if (s.risks?.length) {
                    p += 'Risks:\n';
                    s.risks.forEach(r => { p += `- [${r.severity}] ${r.risk} → ${r.mitigation}\n`; });
                }
            }
            p += '\n';
        }

        const assumptions = ctx.getAssumptions();
        if (assumptions.length > 0) {
            p += '## Assumptions\n';
            for (const a of assumptions) {
                p += `- [${a.impact} impact, ${a.confidence} confidence, ${a.status}] ${a.editedText || a.text}\n`;
            }
            p += '\n';
        }

        const reqs = ctx.getRequirements();
        if (reqs) {
            p += '## Requirements\n';
            function walkReq(r: WizardRequirement, depth: number) {
                p += `${'  '.repeat(depth)}- ${r.id}: ${r.title}`;
                if (r.status === 'uncertain') p += ' (uncertain)';
                if (r.checks.length > 0) p += ` [${r.checks.length} checks]`;
                p += '\n';
                r.children?.forEach(c => walkReq(c, depth + 1));
            }
            reqs.requirements.forEach(r => walkReq(r, 0));
            p += '\n';
        }

        const focused = ctx.getFocusedItem?.();
        if (focused) {
            p += '## Currently Focused Item\n';
            p += 'The user has selected this item. Prioritize your response around it.\n';
            if (focused.type === 'assumption') {
                const a = focused.item;
                p += `Type: Assumption\n`;
                p += `Text: ${a.editedText || a.text}\n`;
                p += `Rationale: ${a.rationale}\n`;
                p += `Impact: ${a.impact} | Confidence: ${a.confidence} | Status: ${a.status}\n`;
            } else if (focused.type === 'requirement') {
                const r = focused.item;
                p += `Type: Requirement\n`;
                p += `ID: ${r.id}\n`;
                p += `Title: ${r.title}\n`;
                if (r.status) p += `Status: ${r.status}\n`;
                if (r.checks.length > 0) {
                    p += `Checks:\n`;
                    r.checks.forEach(c => { p += `  - [${c.type}] ${c.description}\n`; });
                }
                if (r.children.length > 0) {
                    p += `Sub-requirements: ${r.children.map(c => c.title).join(', ')}\n`;
                }
            } else if (focused.type === 'question') {
                const q = focused.item;
                p += `Type: Question\n`;
                p += `Question: ${q.question}\n`;
                p += `Why: ${q.why}\n`;
                p += `Impact: ${q.impact}\n`;
                if (focused.answer) {
                    const a = focused.answer;
                    p += `Answer: ${a.skipped ? '(skipped)' : a.selectedLabels.join(', ')}`;
                    if (a.otherText) p += ` | Other: ${a.otherText}`;
                    p += '\n';
                }
            }
            p += '\n';
        }

        if (history.length > 0) {
            p += '## Conversation History\n';
            for (const m of history) {
                p += `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}\n\n`;
            }
        }

        p += `## User Message\n${userText}`;
        return p;
    }

    async function processOne(text: string, currentMessages: ChatMessage[]): Promise<ChatMessage[]> {
        const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: text,
            timestamp: Date.now(),
        };

        const updated = [...currentMessages, userMsg];
        setMessages(updated);
        setLoading(true);
        setStreamingContent('');
        setToolUpdates([]);

        const startTime = Date.now();
        setActivity({
            label: 'Thinking...',
            startTime,
            steps: [{ label: 'Sending request', done: false }],
        });

        const prompt = buildPrompt(text, currentMessages);
        let fullText = '';
        let receivedFirstText = false;

        try {
            abortRef.current = new AbortController();
            const stream = await apiFetchStream('/api/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, model: ctx.selectedModel, assistant: true }),
                signal: abortRef.current.signal,
            });

            setActivity(prev => prev ? {
                ...prev,
                steps: [{ label: 'Sending request', done: true }],
            } : null);

            for await (const event of streamNDJSON(stream)) {
                if (event.type === 'thinking_start') {
                    setActivity(prev => prev ? {
                        ...prev,
                        label: 'Thinking...',
                        steps: [...prev.steps, { label: 'Thinking', done: false }],
                    } : null);
                } else if (event.type === 'thinking_end') {
                    setActivity(prev => {
                        if (!prev) return null;
                        const steps = prev.steps.map(s =>
                            s.label === 'Thinking' && !s.done ? { ...s, done: true } : s
                        );
                        return { ...prev, steps };
                    });
                } else if (event.type === 'text') {
                    if (!receivedFirstText) {
                        receivedFirstText = true;
                        setActivity(prev => prev ? {
                            ...prev,
                            label: 'Writing response...',
                            steps: [...prev.steps, { label: 'Generating response', done: false }],
                        } : null);
                    }
                    fullText += event.text;
                    setStreamingContent(fullText);
                } else if (event.type === 'tool_start') {
                    const toolLabel = formatToolName(event.tool);
                    setActivity(prev => prev ? {
                        ...prev,
                        label: toolLabel + '...',
                        steps: [...prev.steps, { label: toolLabel, done: false }],
                    } : null);
                } else if (event.type === 'tool_end') {
                    setActivity(prev => {
                        if (!prev) return null;
                        const steps = prev.steps.map(s => ({ ...s, done: true }));
                        return { ...prev, steps };
                    });
                } else if (event.type === 'tool_use') {
                    const toolLabel = formatToolName(event.tool);
                    setActivity(prev => {
                        if (!prev) return null;
                        const steps = [...prev.steps.map(s => ({ ...s, done: true })), { label: toolLabel, done: true }];
                        return { ...prev, steps };
                    });

                    // Dispatch tool callback
                    const cb = ctx.toolCallbacks;
                    if (cb) {
                        if (event.tool === 'set_goal') cb.onSetGoal?.(event.input?.goal);
                        else if (event.tool === 'update_assumption') cb.onUpdateAssumption?.(event.input);
                        else if (event.tool === 'create_assumption') cb.onCreateAssumption?.(event.input);
                        else if (event.tool === 'delete_assumption') cb.onDeleteAssumption?.(event.input?.id);
                        else if (event.tool === 'update_requirement') cb.onUpdateRequirement?.(event.input);
                        else if (event.tool === 'create_requirement') cb.onCreateRequirement?.(event.input);
                        else if (event.tool === 'delete_requirement') cb.onDeleteRequirement?.(event.input?.id);
                    }
                    setToolUpdates(prev => [...prev, { tool: event.tool, data: event.input, timestamp: Date.now() }]);
                } else if (event.type === 'done') {
                    break;
                }
            }

            const assistantMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: fullText,
                timestamp: Date.now(),
            };
            const final = [...updated, assistantMsg];
            setMessages(final);
            return final;
        } catch (e) {
            if ((e as Error).name !== 'AbortError') {
                const errorMsg: ChatMessage = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: `Error: ${(e as Error).message || 'Something went wrong'}`,
                    timestamp: Date.now(),
                };
                const final = [...updated, errorMsg];
                setMessages(final);
                return final;
            }
            return updated;
        } finally {
            setLoading(false);
            setStreamingContent('');
            setActivity(null);
            abortRef.current = null;
        }
    }

    const send = useCallback(async (text: string) => {
        if (!text.trim()) return;

        if (loading) {
            const item = { id: crypto.randomUUID(), text };
            setQueue(prev => [...prev, item]);
            return;
        }

        let msgs = await processOne(text, messagesRef.current);

        // Drain queue
        while (queueRef.current.length > 0) {
            const next = queueRef.current[0];
            setQueue(prev => prev.slice(1));
            msgs = await processOne(next.text, msgs);
        }
    }, [loading, ctx.screen, ctx.prompt, ctx.selectedModel]);

    function stop() {
        abortRef.current?.abort();
    }

    function removeFromQueue(id: string) {
        setQueue(prev => prev.filter(q => q.id !== id));
    }

    function newChat() {
        stop();
        setMessages([]);
        setQueue([]);
        setStreamingContent('');
        setActivity(null);
        setLoading(false);
        messagesRef.current = [];
        queueRef.current = [];
    }

    return {
        messages,
        loading,
        streamingContent,
        activity,
        queue,
        toolUpdates,
        send,
        stop,
        removeFromQueue,
        newChat,
    };
}

const TOOL_LABELS: Record<string, string> = {
    set_goal: 'Setting goal',
    update_assumption: 'Updating assumption',
    create_assumption: 'Creating assumption',
    delete_assumption: 'Deleting assumption',
    update_requirement: 'Updating requirement',
    create_requirement: 'Creating requirement',
    delete_requirement: 'Deleting requirement',
};

function formatToolName(tool: string): string {
    return TOOL_LABELS[tool] ?? tool.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}
