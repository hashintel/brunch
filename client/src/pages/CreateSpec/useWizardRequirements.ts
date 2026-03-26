import { useState } from 'preact/hooks';
import { apiFetchStream, streamNDJSON } from '../Home/apiFetch';
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
        setData(null);
        setError('');
        let title = '';
        let description = '';
        const reqs: WizardRequirement[] = [];
        try {
            const stream = await apiFetchStream('/api/spec-wizard/requirements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, model: selectedModel, answers, assumptions }),
            });
            for await (const event of streamNDJSON(stream)) {
                if (event.type === 'tool_use' && event.tool === 'set_requirements_meta') {
                    title = (event.input as any).title;
                    description = (event.input as any).description;
                } else if (event.type === 'tool_use' && event.tool === 'add_requirement') {
                    reqs.push({ ...(event.input as any), expanded: false });
                    setData(buildRequirementsData(title, description, reqs));
                } else if (event.type === 'done') {
                    break;
                }
            }
            // Final update in case no requirements were emitted yet
            if (!data && (title || reqs.length)) {
                setData(buildRequirementsData(title, description, reqs));
            }
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

    function hydrate(saved: RequirementsData) {
        setData(saved ?? null);
    }

    function reset() {
        setData(null);
        setLoading(false);
        setError('');
    }

    return { data, loading, error, generate, toggleExpand, hydrate, reset };
}

function normalizeRequirement(r: any): WizardRequirement {
    return {
        ...r,
        checks: r.checks ?? [],
        children: (r.children ?? []).map(normalizeRequirement),
        expanded: r.expanded ?? false,
    };
}

function buildRequirementsData(title: string, description: string, reqs: WizardRequirement[]): RequirementsData {
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
        r.children.forEach(walk);
    }
    const normalized = reqs.map(normalizeRequirement);
    normalized.forEach(walk);

    return {
        title,
        description,
        stats: { uncertain, decisionNode, checksTotal, checksWithChecks, automated, humanReview, totalRequirements: totalReqs },
        requirements: normalized,
    };
}

function toggleInTree(reqs: WizardRequirement[], id: string): WizardRequirement[] {
    return reqs.map(r => {
        if (r.id === id) return { ...r, expanded: !r.expanded };
        if (r.children?.length) return { ...r, children: toggleInTree(r.children, id) };
        return r;
    });
}
