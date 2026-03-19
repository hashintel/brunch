import { useEffect, useRef, useState } from 'preact/hooks';
import type { ClarifyingAnswer, ClarifyingQuestion, GoalIteration, SessionData } from './types';
import { apiFetchStream } from './apiFetch';
import { buildPreviousRounds, formatAnswer } from './utils';

interface UseGoalParams {
    selectedModel: string;
    cwd: string;
    onError: (msg: string) => void;
    onCallHistoryRefresh: () => void;
    onGoalReady: (goalText: string, iterations: GoalIteration[], questions: ClarifyingQuestion[], answers: ClarifyingAnswer[]) => void;
}

export function useGoal({ selectedModel, cwd, onError, onCallHistoryRefresh, onGoalReady }: UseGoalParams) {
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [updatingGoal, setUpdatingGoal] = useState(false);
    const goalTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize the goal textarea as content streams in
    useEffect(() => {
        const el = goalTextareaRef.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = el.scrollHeight + 'px';
        }
    }, [prompt]);

    async function go() {
        if (!prompt.trim() || loading) return;

        setResponse('');
        onError('');
        setLoading(true);
        const originalPrompt = prompt;
        setPrompt('');

        let fullText = '';
        try {
            const stream = await apiFetchStream('http://localhost:3001/api/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: originalPrompt, model: selectedModel, cwd: cwd || undefined }),
            });

            const reader = stream.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                fullText += chunk;
                setPrompt(prev => prev + chunk);
            }

            setResponse(fullText);
            onGoalReady(fullText, [], [], []);
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Something went wrong');
        } finally {
            setLoading(false);
            onCallHistoryRefresh();
        }
    }

    async function updateGoal(
        goalIterations: GoalIteration[],
        allQuestions: ClarifyingQuestion[],
        allAnswers: ClarifyingAnswer[],
    ) {
        if (updatingGoal || loading) return;

        // Save current iteration
        const iteration: GoalIteration = {
            goalText: prompt,
            questions: allQuestions,
            answers: allAnswers,
        };
        const newIterations = [...goalIterations, iteration];

        // Build Q&A context for the prompt
        const rounds = buildPreviousRounds(newIterations, [], []);
        const roundsText = rounds.map(r =>
            r.questions.map((q, i) => {
                const a = r.answers[i];
                return `Q: ${q.question}\nA: ${formatAnswer(a)}`;
            }).join('\n\n')
        ).join('\n\n');

        const enhancedPrompt = `Here is a project goal description:\n\n${response}\n\nBased on the following clarifying Q&A, please update and improve the goal description to be more specific and comprehensive:\n\n${roundsText}`;

        setUpdatingGoal(true);
        setPrompt('');
        onError('');

        let fullText = '';
        try {
            const stream = await apiFetchStream('http://localhost:3001/api/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: enhancedPrompt, model: selectedModel, cwd: cwd || undefined }),
            });

            const reader = stream.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                fullText += chunk;
                setPrompt(prev => prev + chunk);
            }

            setResponse(fullText);
            return { newIterations, goalText: fullText };
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Failed to update goal');
            return null;
        } finally {
            setUpdatingGoal(false);
            onCallHistoryRefresh();
        }
    }

    function restore(data: SessionData) {
        setPrompt(data.prompt);
        setResponse(data.response);
    }

    function reset() {
        setPrompt('');
        setResponse('');
        setUpdatingGoal(false);
    }

    return {
        prompt, setPrompt,
        response, setResponse,
        loading,
        updatingGoal,
        goalTextareaRef,
        go,
        updateGoal,
        restore,
        reset,
    };
}
