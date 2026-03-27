import { useState } from 'preact/hooks';
import { apiFetchStream, streamNDJSON } from '../../shared/apiFetch';
import type { SpecQuestion, SpecAnswer } from './types';
import type { ActivityInfo } from './useAssistantChat';

interface UseSpecQuestionsParams {
    selectedModel: string;
}

export function useSpecQuestions({ selectedModel }: UseSpecQuestionsParams) {
    const [questions, setQuestions] = useState<SpecQuestion[]>([]);
    const [answers, setAnswers] = useState<SpecAnswer[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activity, setActivity] = useState<ActivityInfo | null>(null);

    const answeredCount = answers.filter(a => a && !a.skipped).length;
    const remainingCount = questions.length - answeredCount;

    async function fetchQuestions(prompt: string) {
        setLoading(true);
        setQuestions([]);
        setAnswers([]);
        setCurrentIndex(0);
        setError('');
        const startTime = Date.now();
        setActivity({ label: 'Generating questions...', startTime, steps: [] });
        try {
            const stream = await apiFetchStream('/api/spec-wizard/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, model: selectedModel }),
            });
            for await (const event of streamNDJSON(stream)) {
                if (event.type === 'thinking_start') {
                    setActivity(prev => prev ? { ...prev, steps: [...prev.steps, { label: 'Thinking', done: false }] } : null);
                } else if (event.type === 'thinking_end') {
                    setActivity(prev => prev ? { ...prev, steps: prev.steps.map(s => s.label === 'Thinking' && !s.done ? { ...s, done: true } : s) } : null);
                } else if (event.type === 'tool_use' && event.tool === 'add_question') {
                    const q = event.input as unknown as SpecQuestion;
                    setQuestions(prev => [...prev, q]);
                    setAnswers(prev => [...prev, null as unknown as SpecAnswer]);
                    setActivity(prev => prev ? { ...prev, label: 'Generating questions...', steps: [...prev.steps, { label: `Added: ${q.question.slice(0, 40)}...`, done: true }] } : null);
                } else if (event.type === 'done') {
                    break;
                }
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load questions');
        } finally {
            setLoading(false);
            setActivity(null);
        }
    }

    function answerQuestion(index: number, answer: SpecAnswer) {
        setAnswers(prev => {
            const next = [...prev];
            next[index] = answer;
            return next;
        });
    }

    function skipQuestion(index: number) {
        answerQuestion(index, { selectedLabels: [], otherText: '', skipped: true });
        if (index < questions.length - 1) {
            setCurrentIndex(index + 1);
        }
    }

    function goNext() {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    }

    function goBack() {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    }

    function getAnswersWithQuestions() {
        return questions.map((q, i) => ({
            question: q.question,
            selectedLabels: answers[i]?.selectedLabels ?? [],
            otherText: answers[i]?.otherText ?? '',
            skipped: answers[i]?.skipped ?? true,
        }));
    }

    function hydrate(savedQuestions: SpecQuestion[], savedAnswers: SpecAnswer[]) {
        setQuestions(savedQuestions ?? []);
        setAnswers(savedAnswers ?? []);
        setCurrentIndex(0);
    }

    function reset() {
        setQuestions([]);
        setAnswers([]);
        setCurrentIndex(0);
        setLoading(false);
        setError('');
    }

    return {
        questions,
        answers,
        currentIndex,
        setCurrentIndex,
        loading,
        error,
        activity,
        answeredCount,
        remainingCount,
        fetchQuestions,
        answerQuestion,
        skipQuestion,
        goNext,
        goBack,
        getAnswersWithQuestions,
        hydrate,
        reset,
    };
}
