import { useState } from 'preact/hooks';
import { apiFetch } from '../Home/apiFetch';
import type { WizardRequirement, RequirementsData } from './types';

interface UseWizardRequirementsParams {
    selectedModel: string;
}

export function useWizardRequirements({ selectedModel }: UseWizardRequirementsParams) {
    const [data, setData] = useState<RequirementsData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function generate(prompt: string, answers?: any[], assumptions?: any[]) {
        setLoading(true);
        setError('');
        try {
            const result = await apiFetch<{ title: string; description: string; requirements: WizardRequirement[] }>('/api/spec-wizard/requirements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, model: selectedModel, answers, assumptions }),
            });

            // Compute stats
            const reqs = result.requirements;
            let totalReqs = 0;
            let uncertain = 0;
            let decisionNode = 0;
            let checksTotal = 0;
            let checksWithChecks = 0;
            let automated = 0;
            let humanReview = 0;

            function walk(r: WizardRequirement) {
                totalReqs++;
                if (r.status === 'uncertain') uncertain++;
                if (r.status === 'decision_node') decisionNode++;
                checksTotal += r.checks.length;
                if (r.checks.length > 0) checksWithChecks++;
                r.checks.forEach(c => {
                    if (c.type === 'human_review') humanReview++;
                    else automated++;
                });
                r.children?.forEach(walk);
            }
            reqs.forEach(walk);

            setData({
                title: result.title,
                description: result.description,
                stats: { uncertain, decisionNode, checksTotal, checksWithChecks, automated, humanReview, totalRequirements: totalReqs },
                requirements: reqs.map(r => ({ ...r, expanded: false })),
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to generate requirements');
        } finally {
            setLoading(false);
        }
    }

    function toggleExpand(id: string) {
        if (!data) return;
        setData({
            ...data,
            requirements: toggleInTree(data.requirements, id),
        });
    }

    function reset() {
        setData(null);
        setLoading(false);
        setError('');
    }

    return { data, loading, error, generate, toggleExpand, reset };
}

function toggleInTree(reqs: WizardRequirement[], id: string): WizardRequirement[] {
    return reqs.map(r => {
        if (r.id === id) return { ...r, expanded: !r.expanded };
        if (r.children?.length) return { ...r, children: toggleInTree(r.children, id) };
        return r;
    });
}
