import { useState } from 'preact/hooks';
import { apiFetch } from '../Home/apiFetch';
import type { StructuredSpec, SpecSection } from './types';
import type { ActivityInfo } from './useAssistantChat';

interface UseStructuredSpecParams {
    selectedModel: string;
}

export function useStructuredSpec({ selectedModel }: UseStructuredSpecParams) {
    const [spec, setSpec] = useState<StructuredSpec | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activity, setActivity] = useState<ActivityInfo | null>(null);

    async function generate(prompt: string, answers?: { question: string; selectedLabels: string[]; otherText: string; skipped: boolean }[]) {
        setLoading(true);
        setError('');
        const startTime = Date.now();
        setActivity({ label: 'Generating spec...', startTime, steps: [{ label: 'Sending request', done: false }] });
        try {
            const data = await apiFetch<StructuredSpec>('/api/spec-wizard/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, model: selectedModel, answers }),
            });
            setSpec(data);
            setActivity(prev => prev ? { ...prev, steps: [{ label: 'Sending request', done: true }, { label: 'Spec ready', done: true }] } : null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to generate spec');
        } finally {
            setLoading(false);
            setActivity(null);
        }
    }

    function updateSection(index: number, updates: Partial<SpecSection>) {
        setSpec(prev => {
            if (!prev) return prev;
            const sections = [...prev.sections];
            sections[index] = { ...sections[index], ...updates };
            return { ...prev, sections };
        });
    }

    function hydrate(saved: StructuredSpec) {
        setSpec(saved);
    }

    function reset() {
        setSpec(null);
        setLoading(false);
        setError('');
    }

    return { spec, loading, error, activity, generate, updateSection, hydrate, reset };
}
