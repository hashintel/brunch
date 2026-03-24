import { useState } from 'preact/hooks';
import { apiFetch } from '../Home/apiFetch';
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
        setError('');
        try {
            const data = await apiFetch<{ assumptions: Omit<WizardAssumption, 'status'>[] }>('/api/spec-wizard/assumptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, model: selectedModel, answers }),
            });
            const withStatus = data.assumptions.map(a => ({ ...a, status: 'pending' as const }));
            setAssumptions(withStatus);
            if (withStatus.length > 0) setSelectedId(withStatus[0].id);
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
