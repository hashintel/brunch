import { useState, useRef, useCallback } from 'preact/hooks';
import { apiFetchStream, streamNDJSON } from '../Home/apiFetch';
import type { StructuredSpec, WizardAssumption, WizardRequirement, RequirementsData, SpecAnswer, SpecQuestion } from './types';

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

interface WizardContext {
    screen: string;
    prompt: string;
    selectedModel: string;
    getQuestions: () => SpecQuestion[];
    getAnswers: () => SpecAnswer[];
    getSpec: () => StructuredSpec | null;
    getAssumptions: () => WizardAssumption[];
    getRequirements: () => RequirementsData | null;
}

export function useAssistantChat(ctx: WizardContext) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [activity, setActivity] = useState<ActivityInfo | null>(null);
    const [queue, setQueue] = useState<{ id: string; text: string }[]>([]);

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
        setActivity({
            label: 'Thinking...',
            startTime: Date.now(),
            steps: [
                { label: 'Processing your message', done: false },
                { label: 'Generating response', done: false },
            ],
        });

        const prompt = buildPrompt(text, currentMessages);
        let fullText = '';

        try {
            abortRef.current = new AbortController();
            const stream = await apiFetchStream('/api/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, model: ctx.selectedModel }),
                signal: abortRef.current.signal,
            });

            setActivity(prev => prev ? {
                ...prev,
                steps: [{ label: 'Processing your message', done: true }, { label: 'Generating response', done: false }],
            } : null);

            for await (const event of streamNDJSON(stream)) {
                if (event.type === 'text') {
                    fullText += event.text;
                    setStreamingContent(fullText);
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
        send,
        stop,
        removeFromQueue,
        newChat,
    };
}
