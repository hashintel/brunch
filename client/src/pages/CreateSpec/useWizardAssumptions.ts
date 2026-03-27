import { useState } from 'preact/hooks';
import { apiFetchStream, streamNDJSON } from '../../shared/apiFetch';
import type { WizardAssumption } from './types';
import type { ActivityInfo } from './useAssistantChat';

interface UseWizardAssumptionsParams {
    selectedModel: string;
}

export function useWizardAssumptions({ selectedModel }: UseWizardAssumptionsParams) {
    const [assumptions, setAssumptions] = useState<WizardAssumption[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activity, setActivity] = useState<ActivityInfo | null>(null);

    const selected = assumptions.find(a => a.id === selectedId) ?? null;

    async function generate(prompt: string, answers?: any[]) {
        setLoading(true);
        setAssumptions([]);
        setSelectedId(null);
        setError('');
        const startTime = Date.now();
        setActivity({ label: 'Generating assumptions...', startTime, steps: [] });
        try {
            const stream = await apiFetchStream('/api/spec-wizard/assumptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, model: selectedModel, answers }),
            });
            for await (const event of streamNDJSON(stream)) {
                if (event.type === 'thinking_start') {
                    setActivity(prev => prev ? { ...prev, steps: [...prev.steps, { label: 'Thinking', done: false }] } : null);
                } else if (event.type === 'thinking_end') {
                    setActivity(prev => prev ? { ...prev, steps: prev.steps.map(s => s.label === 'Thinking' && !s.done ? { ...s, done: true } : s) } : null);
                } else if (event.type === 'tool_use' && event.tool === 'add_assumption') {
                    const a = { ...event.input, status: 'pending' } as unknown as WizardAssumption;
                    setAssumptions(prev => {
                        const next = [...prev, a];
                        if (next.length === 1) setSelectedId(a.id);
                        return next;
                    });
                    setActivity(prev => prev ? { ...prev, steps: [...prev.steps, { label: `Added: ${a.text?.slice(0, 40)}...`, done: true }] } : null);
                } else if (event.type === 'done') {
                    break;
                }
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to generate assumptions');
        } finally {
            setLoading(false);
            setActivity(null);
        }
    }

    function confirmAssumption(id: string) {
        setAssumptions(prev => prev.map(a => a.id === id ? { ...a, status: 'confirmed' } : a));
    }

    function confirmAll() {
        setAssumptions(prev => prev.map(a => a.status === 'pending' ? { ...a, status: 'confirmed' } : a));
    }

    function editAssumption(id: string, newText: string) {
        setAssumptions(prev => prev.map(a =>
            a.id === id ? { ...a, status: 'edited', editedText: newText } : a
        ));
    }

    function updateAssumption(input: { id: string; text?: string; status?: string; confidence?: string; impact?: string }) {
        setAssumptions(prev => prev.map(a => a.id === input.id ? {
            ...a,
            ...(input.text != null && { text: input.text, editedText: input.text }),
            ...(input.status != null && { status: input.status }),
            ...(input.confidence != null && { confidence: input.confidence }),
            ...(input.impact != null && { impact: input.impact }),
        } : a));
    }

    function addAssumption(input: { id?: string; text: string; rationale: string; confidence: string; impact: string }) {
        const a: WizardAssumption = {
            id: input.id ?? crypto.randomUUID(),
            label: input.text.slice(0, 40),
            text: input.text,
            rationale: input.rationale,
            impact: input.impact as any,
            confidence: input.confidence as any,
            status: 'pending',
            options: [],
        };
        setAssumptions(prev => [...prev, a]);
    }

    function deleteAssumption(id: string) {
        setAssumptions(prev => prev.filter(a => a.id !== id));
    }

    function hydrate(saved: WizardAssumption[]) {
        setAssumptions(saved ?? []);
        if (saved?.length) setSelectedId(saved[0].id);
    }

    function reset() {
        setAssumptions([]);
        setSelectedId(null);
        setLoading(false);
        setError('');
    }

    return {
        assumptions,
        selected,
        selectedId,
        setSelectedId,
        loading,
        error,
        activity,
        generate,
        confirmAssumption,
        confirmAll,
        editAssumption,
        updateAssumption,
        addAssumption,
        deleteAssumption,
        hydrate,
        reset,
    };
}
