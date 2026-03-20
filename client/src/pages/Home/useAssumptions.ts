import { useEffect, useRef, useState } from 'preact/hooks';
import type { Assumption, ClarifyingAnswer, ClarifyingQuestion, SessionData } from './types';
import { apiFetch } from './apiFetch';
import { buildPreviousRounds } from './utils';

interface UseAssumptionsParams {
    selectedModel: string;
    cwd: string;
    projectId: string | null;
    response: string;
    clarifyingDone: boolean;
    onError: (msg: string) => void;
    onCallHistoryRefresh: () => void;
}

export function useAssumptions({
    selectedModel, cwd, projectId, response, clarifyingDone,
    onError, onCallHistoryRefresh,
}: UseAssumptionsParams) {
    const [assumptions, setAssumptions] = useState<Assumption[]>([]);
    const [done, setDone] = useState(false);
    const [loading, setLoading] = useState(false);
    const sectionRef = useRef<HTMLDivElement>(null);

    // Scroll to assumptions section when it becomes active
    useEffect(() => {
        if (clarifyingDone && !done && sectionRef.current) {
            sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [clarifyingDone]);

    async function generate(precomputedRounds?: { questions: ClarifyingQuestion[]; answers: ClarifyingAnswer[] }[], promptOverride?: string) {
        const prompt = promptOverride || response;
        if (!prompt.trim() || loading) return;
        setLoading(true);
        onError('');

        try {
            const rounds = precomputedRounds ?? buildPreviousRounds([], [], []);
            const data = await apiFetch<{ assumptions?: any[] }>('/api/assumptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    model: selectedModel,
                    cwd: cwd || undefined,
                    projectId: projectId || undefined,
                    previousRounds: rounds.length > 0 ? rounds : undefined,
                }),
            });

            const items: Assumption[] = (data.assumptions ?? []).map((a: any) => ({
                id: crypto.randomUUID(),
                text: a.text,
                rationale: a.rationale,
                confidence: a.confidence,
                impact: a.impact,
                status: 'pending' as const,
            }));
            setAssumptions(items);
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Failed to generate assumptions');
        } finally {
            setLoading(false);
            onCallHistoryRefresh();
        }
    }

    function markDone() {
        setDone(true);
    }

    function restore(data: SessionData) {
        setAssumptions(data.assumptions);
        setDone(data.assumptionsDone);
    }

    function reset() {
        setAssumptions([]);
        setDone(false);
    }

    return {
        assumptions, setAssumptions,
        assumptionsDone: done,
        loadingAssumptions: loading,
        assumptionsSectionRef: sectionRef,
        generate,
        markDone,
        restore,
        reset,
    };
}
