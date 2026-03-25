import { useState } from 'preact/hooks';
import { apiFetchStream, streamNDJSON } from '../Home/apiFetch';
import type { SpecQuestion, SpecAnswer } from './types';

interface UseSpecQuestionsParams {
    selectedModel: string;
}

export function useSpecQuestions({ selectedModel }: UseSpecQuestionsParams) {
    const [questions, setQuestions] = useState<SpecQuestion[]>([]);
    const [answers, setAnswers] = useState<SpecAnswer[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const answeredCount = answers.filter(a => a && !a.skipped).length;
    const remainingCount = questions.length - answeredCount;

    async function fetchQuestions(prompt: string) {
        setLoading(true);
        setQuestions([]);
        setAnswers([]);
        setCurrentIndex(0);
        setError('');
        try {
            const stream = await apiFetchStream('/api/spec-wizard/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, model: selectedModel }),
            });
            for await (const event of streamNDJSON(stream)) {
                if (event.type === 'tool_use' && event.tool === 'add_question') {
                    const q = event.input as unknown as SpecQuestion;
                    setQuestions(prev => [...prev, q]);
                    setAnswers(prev => [...prev, null as unknown as SpecAnswer]);
                } else if (event.type === 'done') {
                    break;
                }
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load questions');
        } finally {
            setLoading(false);
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
        answeredCount,
        remainingCount,
        fetchQuestions,
        answerQuestion,
        skipQuestion,
        goNext,
        goBack,
        getAnswersWithQuestions,
        reset,
    };
}
