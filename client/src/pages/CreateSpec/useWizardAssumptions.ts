import { useState } from 'preact/hooks';
import { apiFetchStream, streamNDJSON } from '../Home/apiFetch';
import type { WizardAssumption } from './types';

interface UseWizardAssumptionsParams {
    selectedModel: string;
}

export function useWizardAssumptions({ selectedModel }: UseWizardAssumptionsParams) {
    const [assumptions, setAssumptions] = useState<WizardAssumption[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const selected = assumptions.find(a => a.id === selectedId) ?? null;

    async function generate(prompt: string, answers?: any[]) {
        setLoading(true);
        setAssumptions([]);
        setSelectedId(null);
        setError('');
        try {
            const stream = await apiFetchStream('/api/spec-wizard/assumptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, model: selectedModel, answers }),
            });
            for await (const event of streamNDJSON(stream)) {
                if (event.type === 'tool_use' && event.tool === 'add_assumption') {
                    const a = { ...event.input, status: 'pending' } as unknown as WizardAssumption;
                    setAssumptions(prev => {
                        const next = [...prev, a];
                        if (next.length === 1) setSelectedId(a.id);
                        return next;
                    });
                } else if (event.type === 'done') {
                    break;
                }
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to generate assumptions');
        } finally {
            setLoading(false);
        }
    }

    function confirmAssumption(id: string) {
        setAssumptions(prev => prev.map(a => a.id === id ? { ...a, status: 'confirmed' } : a));
    }

    function editAssumption(id: string, newText: string) {
        setAssumptions(prev => prev.map(a =>
            a.id === id ? { ...a, status: 'edited', editedText: newText } : a
        ));
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
        generate,
        confirmAssumption,
        editAssumption,
        reset,
    };
}
