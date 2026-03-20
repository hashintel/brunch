import { useState } from 'preact/hooks';
import { apiFetch } from './apiFetch';
import type { ProjectBus } from './projectBus';
import type { Assumption, ClarifyingAnswer, ClarifyingQuestion, GoalIteration, Requirement, SessionData } from './types';
import { buildPreviousRounds } from './utils';

interface UseSpecParams {
    selectedModel: string;
    cwd: string;
    projectId: string | null;
    bus: ProjectBus;
}

export function useSpec({ selectedModel, cwd, projectId, bus }: UseSpecParams) {
    const [spec, setSpec] = useState('');
    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(false);
    const [specDone, setSpecDone] = useState(false);

    async function generate(
        prompt: string,
        goalIterations: GoalIteration[],
        allQuestions: ClarifyingQuestion[],
        allAnswers: ClarifyingAnswer[],
        assumptions?: Assumption[],
        requirements?: Requirement[],
    ) {
        if (!prompt.trim() || loading) return;
        setLoading(true);
        bus.error('');

        try {
            const rounds = buildPreviousRounds(goalIterations, allQuestions, allAnswers);

            const data = await apiFetch<{ spec: string; progress: number }>('/api/generatespec', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    model: selectedModel,
                    cwd: cwd || undefined,
                    projectId: projectId || undefined,
                    clarifyingRounds: rounds.length > 0 ? rounds : undefined,
                    assumptions: assumptions?.filter(a => a.status !== 'rejected'),
                    requirements,
                }),
            });

            setSpec(data.spec);
            setProgress(data.progress);
        } catch (e) {
            bus.error(e instanceof Error ? e.message : 'Failed to generate spec');
        } finally {
            setLoading(false);
            bus.callHistoryChanged();
        }
    }

    function markDone() {
        setSpecDone(true);
    }

    function restore(data: SessionData) {
        setSpec(data.spec ?? '');
        setProgress(data.specProgress ?? 0);
    }

    function reset() {
        setSpec('');
        setProgress(0);
        setLoading(false);
        setSpecDone(false);
    }

    return {
        spec,
        progress,
        loading,
        specDone,
        generate,
        setSpec,
        markDone,
        restore,
        reset,
    };
}
