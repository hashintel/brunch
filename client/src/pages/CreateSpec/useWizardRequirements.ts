import { useState } from 'preact/hooks';
import { apiFetchStream, streamNDJSON } from '../Home/apiFetch';
import type { WizardRequirement, RequirementsData } from './types';
import type { ActivityInfo } from './useAssistantChat';

interface UseWizardRequirementsParams {
    selectedModel: string;
}

export function useWizardRequirements({ selectedModel }: UseWizardRequirementsParams) {
    const [data, setData] = useState<RequirementsData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activity, setActivity] = useState<ActivityInfo | null>(null);

    async function generate(prompt: string, answers?: any[], assumptions?: any[]) {
        setLoading(true);
        setData(null);
        setError('');
        const startTime = Date.now();
        setActivity({ label: 'Generating requirements...', startTime, steps: [] });
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
                if (event.type === 'thinking_start') {
                    setActivity(prev => prev ? { ...prev, steps: [...prev.steps, { label: 'Thinking', done: false }] } : null);
                } else if (event.type === 'thinking_end') {
                    setActivity(prev => prev ? { ...prev, steps: prev.steps.map(s => s.label === 'Thinking' && !s.done ? { ...s, done: true } : s) } : null);
                } else if (event.type === 'tool_use' && event.tool === 'set_requirements_meta') {
                    title = (event.input as any).title;
                    description = (event.input as any).description;
                    setActivity(prev => prev ? { ...prev, steps: [...prev.steps, { label: `Set meta: ${title.slice(0, 40)}`, done: true }] } : null);
                } else if (event.type === 'tool_use' && event.tool === 'add_requirement') {
                    const req = { ...(event.input as any), expanded: false };
                    reqs.push(req);
                    setData(buildRequirementsData(title, description, reqs));
                    setActivity(prev => prev ? { ...prev, steps: [...prev.steps, { label: `Added: ${req.title?.slice(0, 40)}`, done: true }] } : null);
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
            setActivity(null);
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

    function updateRequirement(input: { id: string; title?: string; status?: string }) {
        if (!data) return;
        setData({ ...data, requirements: updateInTree(data.requirements, input) });
    }

    function addRequirement(input: { id?: string; title: string }) {
        if (!data) return;
        const r = normalizeRequirement({
            id: input.id ?? `R${data.requirements.length + 1}`,
            title: input.title,
            status: 'ok',
            checks: [],
            children: [],
        });
        setData(buildRequirementsData(data.title, data.description, [...data.requirements, r]));
    }

    function deleteRequirement(id: string) {
        if (!data) return;
        setData(buildRequirementsData(data.title, data.description, removeFromTree(data.requirements, id)));
    }

    return { data, loading, error, activity, generate, toggleExpand, updateRequirement, addRequirement, deleteRequirement, hydrate, reset };
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

function updateInTree(reqs: WizardRequirement[], input: { id: string; title?: string; status?: string }): WizardRequirement[] {
    return reqs.map(r => {
        if (r.id === input.id) {
            return {
                ...r,
                ...(input.title != null && { title: input.title }),
                ...(input.status != null && { status: input.status }),
            };
        }
        if (r.children?.length) return { ...r, children: updateInTree(r.children, input) };
        return r;
    });
}

function removeFromTree(reqs: WizardRequirement[], id: string): WizardRequirement[] {
    return reqs
        .filter(r => r.id !== id)
        .map(r => r.children?.length ? { ...r, children: removeFromTree(r.children, id) } : r);
}
