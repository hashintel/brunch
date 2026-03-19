import { useRef, useState } from 'preact/hooks';
import type { ClarifyingAnswer, ClarifyingQuestion, GoalIteration, SessionData } from './types';
import { apiFetch } from './apiFetch';
import { buildPreviousRounds, isAnswered } from './utils';

interface UseClarifyingParams {
    selectedModel: string;
    cwd: string;
    response: string;
    onError: (msg: string) => void;
    onCallHistoryRefresh: () => void;
    onClarifyingDone: (
        iterations: GoalIteration[],
        questions: ClarifyingQuestion[],
        answers: ClarifyingAnswer[],
    ) => void;
}

export function useClarifying({
    selectedModel, cwd, response, onError, onCallHistoryRefresh, onClarifyingDone,
}: UseClarifyingParams) {
    const [goalIterations, setGoalIterations] = useState<GoalIteration[]>([]);
    const [allQuestions, setAllQuestions] = useState<ClarifyingQuestion[]>([]);
    const [allAnswers, setAllAnswers] = useState<ClarifyingAnswer[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [questionsExhausted, setQuestionsExhausted] = useState(false);
    const [clarifyingDone, setClarifyingDone] = useState(false);
    const preloadingRef = useRef(false);

    async function fetchQuestions(
        goalText: string,
        iterations: GoalIteration[],
        questions: ClarifyingQuestion[],
        answers: ClarifyingAnswer[],
        showLoading = true,
    ) {
        if (!goalText.trim()) return;
        if (showLoading) setLoadingQuestions(true);
        onError('');

        try {
            const rounds = buildPreviousRounds(iterations, questions, answers);
            const data = await apiFetch<{ done?: boolean; questions?: ClarifyingQuestion[] }>('/api/clarifyingquestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: goalText,
                    model: selectedModel,
                    cwd: cwd || undefined,
                    previousRounds: rounds.length > 0 ? rounds : undefined,
                }),
            });

            if (data.done || !data.questions?.length) {
                setQuestionsExhausted(true);
            } else {
                setAllQuestions(prev => [...prev, ...data.questions!]);
                setAllAnswers(prev => [
                    ...prev,
                    ...data.questions!.map(() => ({ selectedLabels: [], otherText: '', skipped: false })),
                ]);
            }
        } catch (e) {
            if (showLoading) {
                onError(e instanceof Error ? e.message : 'Failed to generate questions');
            }
        } finally {
            if (showLoading) setLoadingQuestions(false);
            onCallHistoryRefresh();
        }
    }

    function maybePreloadQuestions(currentAnswers: ClarifyingAnswer[]) {
        if (questionsExhausted || preloadingRef.current || loadingQuestions || !response || allQuestions.length === 0) return;
        const answeredCount = currentAnswers.filter(isAnswered).length;
        if (allQuestions.length - answeredCount > 2) return;

        preloadingRef.current = true;
        const rounds = buildPreviousRounds(goalIterations, allQuestions, currentAnswers);
        apiFetch<{ done?: boolean; questions?: ClarifyingQuestion[] }>('/api/clarifyingquestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: response,
                model: selectedModel,
                cwd: cwd || undefined,
                previousRounds: rounds.length > 0 ? rounds : undefined,
            }),
        })
            .then(data => {
                if (data.done || !data.questions?.length) {
                    setQuestionsExhausted(true);
                } else {
                    setAllQuestions(prev => [...prev, ...data.questions!]);
                    setAllAnswers(prev => [
                        ...prev,
                        ...data.questions!.map(() => ({ selectedLabels: [], otherText: '', skipped: false })),
                    ]);
                }
            })
            .catch(() => {})
            .finally(() => {
                preloadingRef.current = false;
                onCallHistoryRefresh();
            });
    }

    function updateAnswer(index: number, answer: ClarifyingAnswer) {
        const newAnswers = [...allAnswers];
        newAnswers[index] = answer;
        setAllAnswers(newAnswers);
        maybePreloadQuestions(newAnswers);
    }

    function done() {
        // Save final Q&A if any
        const finalIterations = allQuestions.length > 0
            ? [...goalIterations, { goalText: '', questions: allQuestions, answers: allAnswers }]
            : goalIterations;

        if (allQuestions.length > 0) {
            setGoalIterations(finalIterations);
            setAllQuestions([]);
            setAllAnswers([]);
        }
        setClarifyingDone(true);
        onClarifyingDone(finalIterations, [], []);
    }

    /** Called after goal update to reset Q&A for new round */
    function resetForNewRound(newIterations: GoalIteration[]) {
        setGoalIterations(newIterations);
        setAllQuestions([]);
        setAllAnswers([]);
        setQuestionsExhausted(false);
        preloadingRef.current = false;
    }

    function restore(data: SessionData) {
        setGoalIterations(data.goalIterations);
        setAllQuestions(data.allQuestions);
        setAllAnswers(data.allAnswers);
        setQuestionsExhausted(data.questionsExhausted);
        setClarifyingDone(data.clarifyingDone);
    }

    function reset() {
        setGoalIterations([]);
        setAllQuestions([]);
        setAllAnswers([]);
        setQuestionsExhausted(false);
        setClarifyingDone(false);
        preloadingRef.current = false;
    }

    return {
        goalIterations,
        allQuestions,
        allAnswers,
        loadingQuestions,
        questionsExhausted,
        clarifyingDone,
        fetchQuestions,
        updateAnswer,
        done,
        resetForNewRound,
        restore,
        reset,
    };
}
