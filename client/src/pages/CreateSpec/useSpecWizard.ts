import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useSpecQuestions } from './useSpecQuestions';
import { useStructuredSpec } from './useStructuredSpec';
import { useWizardAssumptions } from './useWizardAssumptions';
import { useWizardRequirements } from './useWizardRequirements';
import type { WizardScreen } from './types';

interface UseSpecWizardParams {
    selectedModel: string;
}

export function useSpecWizard({ selectedModel }: UseSpecWizardParams) {
    const [screen, setScreen] = useState<WizardScreen>('landing');
    const [prompt, setPrompt] = useState('');

    const questions = useSpecQuestions({ selectedModel });
    const spec = useStructuredSpec({ selectedModel });
    const assumptions = useWizardAssumptions({ selectedModel });
    const requirements = useWizardRequirements({ selectedModel });

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastAnswerHash = useRef('');

    async function submit(text: string) {
        setPrompt(text);
        setScreen('loading');
        await Promise.all([
            questions.fetchQuestions(text),
            spec.generate(text),
        ]);
        setScreen('clarify');
    }

    // Debounced spec regeneration when answers change
    const regenerateSpec = useCallback(() => {
        if (!prompt) return;
        const answersData = questions.getAnswersWithQuestions();
        const hash = JSON.stringify(answersData);
        if (hash === lastAnswerHash.current) return;
        lastAnswerHash.current = hash;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            spec.generate(prompt, answersData);
        }, 500);
    }, [prompt, questions.answers]);

    useEffect(() => {
        if (screen === 'clarify' && questions.answeredCount > 0) {
            regenerateSpec();
        }
    }, [questions.answers, screen]);

    function skipAllAndGenerate() {
        const answersData = questions.getAnswersWithQuestions();
        spec.generate(prompt, answersData);
    }

    async function goToAssumptions() {
        setScreen('assumptions');
        const answersData = questions.getAnswersWithQuestions();
        await assumptions.generate(prompt, answersData);
    }

    async function goToRequirements() {
        setScreen('requirements');
        const answersData = questions.getAnswersWithQuestions();
        await requirements.generate(prompt, answersData, assumptions.assumptions);
    }

    async function goToOverview() {
        setScreen('overview');
        // Regenerate spec with all context
        const answersData = questions.getAnswersWithQuestions();
        await spec.generate(prompt, answersData);
    }

    function reset() {
        setScreen('landing');
        setPrompt('');
        questions.reset();
        spec.reset();
        assumptions.reset();
        requirements.reset();
        lastAnswerHash.current = '';
    }

    return {
        screen,
        prompt,
        setPrompt,
        submit,
        questions,
        spec,
        assumptions,
        requirements,
        skipAllAndGenerate,
        goToAssumptions,
        goToRequirements,
        goToOverview,
        reset,
    };
}
