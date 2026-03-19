import { useState } from 'preact/hooks';
import type { Assumption, ClarifyingAnswer, ClarifyingQuestion, GoalIteration, Requirement, SessionData, TestCase } from './types';
import { apiFetch, apiFetchStream } from './apiFetch';
import { buildPreviousRounds, makeRequirement } from './utils';

interface UseRequirementsParams {
    selectedModel: string;
    cwd: string;
    response: string;
    onError: (msg: string) => void;
    onCallHistoryRefresh: () => void;
}

function findInTree(reqs: Requirement[], id: string): Requirement | null {
    for (const r of reqs) {
        if (r.id === id) return r;
        const found = findInTree(r.children, id);
        if (found) return found;
    }
    return null;
}

function updateInTree(reqs: Requirement[], id: string, updater: (r: Requirement) => Requirement): Requirement[] {
    return reqs.map(r => {
        if (r.id === id) return updater(r);
        return { ...r, children: updateInTree(r.children, id, updater) };
    });
}

export function useRequirements({
    selectedModel, cwd, response, onError, onCallHistoryRefresh,
}: UseRequirementsParams) {
    const [requirements, setRequirements] = useState<Requirement[]>([]);
    const [loading, setLoading] = useState(false);
    const [generatingChildrenId, setGeneratingChildrenId] = useState<string | null>(null);
    const [generatingTestsId, setGeneratingTestsId] = useState<string | null>(null);
    const [pendingTests, setPendingTests] = useState<{ reqId: string; tests: TestCase[] } | null>(null);

    async function generate(
        goalIterations: GoalIteration[],
        allQuestions: ClarifyingQuestion[],
        allAnswers: ClarifyingAnswer[],
        assumptions: Assumption[],
    ) {
        if (!response.trim() || loading) return;

        onError('');
        setLoading(true);

        const isGenerateMore = requirements.length > 0;
        const rounds = buildPreviousRounds(goalIterations, allQuestions, allAnswers);
        const confirmedAssumptions = assumptions.filter(a => a.status !== 'pending');
        const body: any = {
            prompt: response, model: selectedModel, cwd: cwd || undefined,
            clarifyingRounds: rounds.length > 0 ? rounds : undefined,
            assumptions: confirmedAssumptions.length > 0 ? confirmedAssumptions : undefined,
        };
        if (isGenerateMore) body.existingRequirements = requirements;

        try {
            const stream = await apiFetchStream('/api/streamrequirements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let accumulated = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                accumulated += decoder.decode(value);
            }

            const parsed = JSON.parse(accumulated);
            const rawReqs: { title: string; definition: string; confidence: number }[] = Array.isArray(parsed) ? parsed : parsed.requirements ?? [];
            const reqs: Requirement[] = rawReqs.map(makeRequirement);
            setRequirements(prev => isGenerateMore ? [...prev, ...reqs] : reqs);
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Failed to generate requirements');
        } finally {
            setLoading(false);
            onCallHistoryRefresh();
        }
    }

    async function generateChildren(reqId: string) {
        if (generatingChildrenId) return;
        setGeneratingChildrenId(reqId);
        onError('');

        const targetReq = findInTree(requirements, reqId);
        if (!targetReq) { setGeneratingChildrenId(null); return; }

        try {
            const data = await apiFetch<{ children?: any[] }>('/api/generatechildren', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requirement: { title: targetReq.title, definition: targetReq.definition },
                    prompt: response, model: selectedModel, cwd: cwd || undefined,
                }),
            });
            const newChildren: Requirement[] = (data.children ?? []).map((c: any) => makeRequirement(c));
            setRequirements(prev => updateInTree(prev, reqId, r => ({
                ...r, children: [...r.children, ...newChildren],
            })));
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Failed to generate sub-requirements');
        } finally {
            setGeneratingChildrenId(null);
            onCallHistoryRefresh();
        }
    }

    async function generateTests(reqId: string) {
        if (generatingTestsId) return;
        setGeneratingTestsId(reqId);
        onError('');

        const targetReq = findInTree(requirements, reqId);
        if (!targetReq) { setGeneratingTestsId(null); return; }

        try {
            const data = await apiFetch<{ tests?: TestCase[] }>('/api/generatetests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requirement: { title: targetReq.title, definition: targetReq.definition },
                    prompt: response, model: selectedModel, cwd: cwd || undefined,
                }),
            });
            const newTests = Array.isArray(data.tests) ? data.tests : [];
            if (newTests.length > 0) {
                setPendingTests({ reqId, tests: newTests });
            }
        } catch (e) {
            onError(e instanceof Error ? e.message : 'Failed to generate tests');
        } finally {
            setGeneratingTestsId(null);
            onCallHistoryRefresh();
        }
    }

    function approvePendingTests(approved: TestCase[]) {
        if (!pendingTests) return;
        const { reqId } = pendingTests;
        if (approved.length > 0) {
            setRequirements(prev => updateInTree(prev, reqId, r => ({
                ...r, tests: [...r.tests, ...approved],
            })));
        }
        setPendingTests(null);
    }

    function cancelPendingTests() {
        setPendingTests(null);
    }

    function restore(data: SessionData) {
        setRequirements(data.requirements);
    }

    function reset() {
        setRequirements([]);
        setPendingTests(null);
    }

    return {
        requirements, setRequirements,
        loadingRequirements: loading,
        generatingChildrenId,
        generatingTestsId,
        pendingTests,
        generate,
        generateChildren,
        generateTests,
        approvePendingTests,
        cancelPendingTests,
        restore,
        reset,
    };
}
